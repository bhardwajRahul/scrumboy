// Pan/zoom navigation bindings for #wallSurface (wheel, space-drag, middle-drag,
// and Pan-mode empty-canvas pointer navigation). Listeners use the wall mount
// AbortSignal; space-held state clears on blur.

import {
  clampPan,
  getViewportState,
  isNavigationSuppressed,
  panBy,
  scheduleSaveViewport,
  setViewportState,
  zoomAround,
} from "./wall-viewport.js";
import { isWallPanMode } from "./wall-canvas-mode.js";

const WHEEL_ZOOM_FACTOR = 1.08;
// Approximate pixel sizes for line/page wheel modes (Firefox, some mice).
const WHEEL_LINE_PX = 16;
const WHEEL_PAGE_PX = 800;
// Arrow-key pan step (screen px). Shift pans in coarse steps.
const ARROW_PAN_STEP_PX = 64;
const ARROW_PAN_STEP_COARSE_PX = ARROW_PAN_STEP_PX * 4;

/** Normalize wheel deltas to pixels regardless of deltaMode. */
function wheelPixels(ev: WheelEvent): { dx: number; dy: number } {
  const unit =
    ev.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? WHEEL_LINE_PX
      : ev.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? WHEEL_PAGE_PX
        : 1;
  return { dx: ev.deltaX * unit, dy: ev.deltaY * unit };
}

let spaceHeld = false;
let spacePanActive = false;
let middlePanActive = false;
let panStartX = 0;
let panStartY = 0;
let panStartPanX = 0;
let panStartPanY = 0;
let navigationSurface: HTMLElement | null = null;
let activeNavigationCleanup: (() => void) | null = null;
let activeNavigationKind: "none" | "pointer" | "touch" = "none";
let activeTouchPointerId: number | null = null;
let pinchDistance = 0;
let touchResumeBlocked = false;
const activeTouchPointers = new Map<number, { clientX: number; clientY: number }>();
const capturedPointerIds = new Set<number>();

const PINCH_DISTANCE_MIN_PX = 8;
const PINCH_FACTOR_MIN = 0.5;
const PINCH_FACTOR_MAX = 2;

function clearSpaceHeld(): void {
  spaceHeld = false;
  spacePanActive = false;
}

function clearTouchGestureState(): void {
  activeTouchPointerId = null;
  pinchDistance = 0;
  touchResumeBlocked = false;
  activeTouchPointers.clear();
}

function setPanningClass(active: boolean): void {
  navigationSurface?.classList.toggle("wall-surface--panning", active);
}

function rememberCapturedPointerId(pointerId: number): void {
  capturedPointerIds.add(pointerId);
}

function trySetPointerCapture(surface: HTMLElement, pointerId: number): void {
  if (typeof surface.setPointerCapture !== "function") return;
  try {
    surface.setPointerCapture(pointerId);
    rememberCapturedPointerId(pointerId);
  } catch {
    // Some test environments and pointer types do not support capture.
  }
}

function tryReleasePointerCapture(surface: HTMLElement | null, pointerId: number): void {
  if (!surface || typeof surface.releasePointerCapture !== "function") return;
  try {
    surface.releasePointerCapture(pointerId);
  } catch {
    // Safe to ignore: release is best-effort during teardown/cancel.
  }
}

function releaseCapturedPointers(): void {
  const surface = navigationSurface;
  for (const pointerId of capturedPointerIds) {
    tryReleasePointerCapture(surface, pointerId);
  }
  capturedPointerIds.clear();
}

function pointerDistance(
  a: { clientX: number; clientY: number },
  b: { clientX: number; clientY: number },
): number {
  const dx = b.clientX - a.clientX;
  const dy = b.clientY - a.clientY;
  return Math.hypot(dx, dy);
}

function pointerMidpoint(
  a: { clientX: number; clientY: number },
  b: { clientX: number; clientY: number },
): { clientX: number; clientY: number } {
  return {
    clientX: (a.clientX + b.clientX) / 2,
    clientY: (a.clientY + b.clientY) / 2,
  };
}

function activeTouchPair(): Array<{ clientX: number; clientY: number }> | null {
  if (activeTouchPointers.size !== 2) return null;
  return Array.from(activeTouchPointers.values());
}

function beginTouchSinglePan(clientX: number, clientY: number, pointerId: number): void {
  beginPanGesture(clientX, clientY, getViewportState);
  activeTouchPointerId = pointerId;
  setPanningClass(true);
}

function maybePromoteTouchPinch(): void {
  const pair = activeTouchPair();
  if (!pair) {
    activeTouchPointerId = null;
    pinchDistance = 0;
    return;
  }
  activeTouchPointerId = null;
  pinchDistance = pointerDistance(pair[0], pair[1]);
  setPanningClass(true);
}

function isEmptyCanvasGestureTarget(surface: HTMLElement, target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (!surface.contains(target)) return false;
  if (target.closest(".wall-note")) return false;
  if (target.closest(".wall-note__resize-handle")) return false;
  if (target.closest(".wall-edge-hit")) return false;
  if (target.closest(".wall-note-context-menu")) return false;
  if (target.closest("button, textarea, input, select, [contenteditable='true']")) return false;
  return true;
}

function clearTouchPointer(pointerId: number): void {
  tryReleasePointerCapture(navigationSurface, pointerId);
  activeTouchPointers.delete(pointerId);
  capturedPointerIds.delete(pointerId);
}

export function cancelWallNavigationGestures(): void {
  const cleanup = activeNavigationCleanup;
  activeNavigationCleanup = null;
  if (cleanup) cleanup();
  clearTouchGestureState();
  middlePanActive = false;
  spacePanActive = false;
  setPanningClass(false);
  releaseCapturedPointers();
  activeNavigationKind = "none";
}

function onWheel(ev: WheelEvent): void {
  if (isNavigationSuppressed(ev.target)) return;
  ev.preventDefault();
  const { dx, dy } = wheelPixels(ev);
  if (ev.ctrlKey || ev.metaKey) {
    const factor = dy < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
    zoomAround(ev.clientX, ev.clientY, factor);
    return;
  }
  panBy(-dx, -dy);
}

function onKeyDown(ev: KeyboardEvent): void {
  if (ev.code !== "Space" || ev.repeat) return;
  if (isNavigationSuppressed(ev.target)) return;
  ev.preventDefault();
  spaceHeld = true;
}

// Arrow keys pan the canvas (additive to wheel / Space+drag / middle-drag).
// Direction = the way the viewport moves toward content, matching scroll-to-pan.
function onArrowKeyDown(ev: KeyboardEvent, isOpen: () => boolean): void {
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  let dx = 0;
  let dy = 0;
  const step = ev.shiftKey ? ARROW_PAN_STEP_COARSE_PX : ARROW_PAN_STEP_PX;
  switch (ev.key) {
    case "ArrowRight":
      dx = -step;
      break;
    case "ArrowLeft":
      dx = step;
      break;
    case "ArrowDown":
      dy = -step;
      break;
    case "ArrowUp":
      dy = step;
      break;
    default:
      return;
  }
  if (!isOpen()) return;
  if (isNavigationSuppressed(ev.target)) return;
  ev.preventDefault();
  panBy(dx, dy);
}

function onKeyUp(ev: KeyboardEvent): void {
  if (ev.code !== "Space") return;
  spaceHeld = false;
  spacePanActive = false;
  scheduleSaveViewport();
}

function onBlur(): void {
  clearSpaceHeld();
}

function beginPanGesture(clientX: number, clientY: number, getPan: () => { panX: number; panY: number }): void {
  panStartX = clientX;
  panStartY = clientY;
  const p = getPan();
  panStartPanX = p.panX;
  panStartPanY = p.panY;
}

function movePanGesture(
  clientX: number,
  clientY: number,
  setPan: (panX: number, panY: number) => void,
): void {
  setPan(
    panStartPanX + (clientX - panStartX),
    panStartPanY + (clientY - panStartY),
  );
}

function startPointerPanGesture(
  surface: HTMLElement,
  signal: AbortSignal,
  ev: PointerEvent,
  onActiveChange: (active: boolean) => void,
): void {
  cancelWallNavigationGestures();
  activeNavigationKind = "pointer";
  onActiveChange(true);
  setPanningClass(true);
  beginPanGesture(ev.clientX, ev.clientY, getViewportState);
  trySetPointerCapture(surface, ev.pointerId);

  let ended = false;
  const pointerId = ev.pointerId;
  const onMove = (mv: PointerEvent) => {
    if (mv.pointerId !== pointerId) return;
    mv.preventDefault();
    const st = getViewportState();
    movePanGesture(mv.clientX, mv.clientY, (px, py) => {
      setViewportState({ panX: clampPan(px), panY: clampPan(py), zoom: st.zoom });
    });
  };
  const cleanup = () => {
    if (ended) return;
    ended = true;
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);
    signal.removeEventListener("abort", cleanup);
    tryReleasePointerCapture(surface, pointerId);
    capturedPointerIds.delete(pointerId);
    onActiveChange(false);
    setPanningClass(false);
    if (activeNavigationCleanup === cleanup) activeNavigationCleanup = null;
    activeNavigationKind = "none";
    scheduleSaveViewport();
  };
  const onUp = (up: PointerEvent) => {
    if (up.pointerId !== pointerId) return;
    cleanup();
  };

  activeNavigationCleanup = cleanup;
  signal.addEventListener("abort", cleanup);
  document.addEventListener("pointermove", onMove, { passive: false });
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onUp);
}

function startTouchNavigationGesture(
  surface: HTMLElement,
  signal: AbortSignal,
  ev: PointerEvent,
): void {
  if (activeNavigationKind !== "touch") {
    cancelWallNavigationGestures();
    activeNavigationKind = "touch";
    clearTouchGestureState();

    let ended = false;
    const onMove = (mv: PointerEvent) => {
      const tracked = activeTouchPointers.get(mv.pointerId);
      if (!tracked) return;
      tracked.clientX = mv.clientX;
      tracked.clientY = mv.clientY;

      if (activeTouchPointers.size === 1) {
        if (touchResumeBlocked || activeTouchPointerId !== mv.pointerId) return;
        mv.preventDefault();
        const st = getViewportState();
        movePanGesture(mv.clientX, mv.clientY, (px, py) => {
          setViewportState({ panX: clampPan(px), panY: clampPan(py), zoom: st.zoom });
        });
        return;
      }

      const pair = activeTouchPair();
      if (!pair) {
        activeTouchPointerId = null;
        pinchDistance = 0;
        return;
      }

      const currentDistance = pointerDistance(pair[0], pair[1]);
      if (currentDistance < PINCH_DISTANCE_MIN_PX) {
        pinchDistance = currentDistance;
        return;
      }
      if (pinchDistance < PINCH_DISTANCE_MIN_PX) {
        pinchDistance = currentDistance;
        return;
      }
      let factor = currentDistance / pinchDistance;
      if (!Number.isFinite(factor) || factor <= 0) {
        pinchDistance = currentDistance;
        return;
      }
      factor = Math.max(PINCH_FACTOR_MIN, Math.min(PINCH_FACTOR_MAX, factor));
      const midpoint = pointerMidpoint(pair[0], pair[1]);
      mv.preventDefault();
      zoomAround(midpoint.clientX, midpoint.clientY, factor);
      pinchDistance = currentDistance;
    };
    const maybeEndSession = () => {
      if (activeTouchPointers.size === 0) {
        cleanup();
      } else if (activeTouchPointers.size === 1) {
        activeTouchPointerId = null;
        pinchDistance = 0;
        touchResumeBlocked = true;
        setPanningClass(false);
      } else {
        activeTouchPointerId = null;
        maybePromoteTouchPinch();
      }
    };
    const onUp = (up: PointerEvent) => {
      if (!activeTouchPointers.has(up.pointerId)) return;
      clearTouchPointer(up.pointerId);
      maybeEndSession();
    };
    const cleanup = () => {
      if (ended) return;
      ended = true;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      signal.removeEventListener("abort", cleanup);
      releaseCapturedPointers();
      clearTouchGestureState();
      setPanningClass(false);
      if (activeNavigationCleanup === cleanup) activeNavigationCleanup = null;
      activeNavigationKind = "none";
      scheduleSaveViewport();
    };

    activeNavigationCleanup = cleanup;
    signal.addEventListener("abort", cleanup);
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  activeTouchPointers.set(ev.pointerId, { clientX: ev.clientX, clientY: ev.clientY });
  trySetPointerCapture(surface, ev.pointerId);
  if (activeTouchPointers.size === 1 && !touchResumeBlocked) {
    beginTouchSinglePan(ev.clientX, ev.clientY, ev.pointerId);
    return;
  }
  maybePromoteTouchPinch();
}

function bindPanPointer(
  surface: HTMLElement,
  signal: AbortSignal,
  shouldStart: (ev: PointerEvent) => boolean,
  onActiveChange: (active: boolean) => void,
): void {
  surface.addEventListener(
    "pointerdown",
    (ev: PointerEvent) => {
      if (!shouldStart(ev)) return;
      if (isNavigationSuppressed(ev.target)) return;
      ev.preventDefault();
      startPointerPanGesture(surface, signal, ev, onActiveChange);
    },
    { signal },
  );
}

function bindPanModeCanvasNavigation(surface: HTMLElement, signal: AbortSignal): void {
  surface.addEventListener(
    "pointerdown",
    (ev: PointerEvent) => {
      if (!isWallPanMode()) return;
      if (ev.button !== 0) return;
      if (!isEmptyCanvasGestureTarget(surface, ev.target)) return;
      if (isNavigationSuppressed(ev.target)) return;
      ev.preventDefault();

      if (ev.pointerType === "touch") {
        startTouchNavigationGesture(surface, signal, ev);
        return;
      }

      startPointerPanGesture(surface, signal, ev, () => {
        // Pan mode owns the visual state via .wall-surface--pan-mode and
        // .wall-surface--panning, so there is no extra per-gesture flag here.
      });
    },
    { signal },
  );
}

/**
 * Bind wheel / keyboard / space+drag / middle-drag pan on the wall surface.
 * All listeners abort when `signal` fires (wall teardown).
 */
export function bindWallNavigation(
  surface: HTMLElement,
  signal: AbortSignal,
  isOpen: () => boolean = () => true,
): void {
  cancelWallNavigationGestures();
  navigationSurface = surface;
  const opts = { signal, passive: false as const };

  surface.addEventListener("wheel", onWheel, opts);
  window.addEventListener("keydown", onKeyDown, { signal });
  window.addEventListener("keyup", onKeyUp, { signal });
  window.addEventListener("keydown", (ev) => onArrowKeyDown(ev, isOpen), { signal });
  surface.addEventListener("blur", onBlur, { signal, capture: true });
  window.addEventListener("blur", onBlur, { signal });
  signal.addEventListener("abort", () => {
    cancelWallNavigationGestures();
    if (navigationSurface === surface) navigationSurface = null;
  }, { once: true });

  bindPanPointer(
    surface,
    signal,
    (ev) => ev.button === 1,
    (active) => {
      middlePanActive = active;
    },
  );

  bindPanPointer(
    surface,
    signal,
    (ev) => ev.button === 0 && spaceHeld && !ev.shiftKey,
    (active) => {
      spacePanActive = active;
    },
  );

  bindPanModeCanvasNavigation(surface, signal);
}

/** True while Space is held (marquee / note drag should defer to pan). */
export function isSpacePanArmed(): boolean {
  return spaceHeld;
}

/** For tests: drive the arrow-key pan handler directly. */
export function __onArrowKeyDownForTest(ev: KeyboardEvent, isOpen: () => boolean = () => true): void {
  onArrowKeyDown(ev, isOpen);
}

/** For tests: whether space-to-pan is armed. */
export function __isSpaceHeldForTest(): boolean {
  return spaceHeld;
}

export function __resetNavStateForTest(): void {
  cancelWallNavigationGestures();
  spaceHeld = false;
  spacePanActive = false;
  middlePanActive = false;
  navigationSurface = null;
}
