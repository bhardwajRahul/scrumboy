// Pan/zoom navigation bindings for #wallSurface (wheel, space-drag, middle-drag).
// Listeners use the wall mount AbortSignal; space-held state clears on blur.
import { clampPan, getViewportState, isNavigationSuppressed, panBy, scheduleSaveViewport, setViewportState, zoomAround, } from "./wall-viewport.js";
const WHEEL_ZOOM_FACTOR = 1.08;
// Approximate pixel sizes for line/page wheel modes (Firefox, some mice).
const WHEEL_LINE_PX = 16;
const WHEEL_PAGE_PX = 800;
// Arrow-key pan step (screen px). Shift pans in coarse steps.
const ARROW_PAN_STEP_PX = 64;
const ARROW_PAN_STEP_COARSE_PX = ARROW_PAN_STEP_PX * 4;
/** Normalize wheel deltas to pixels regardless of deltaMode. */
function wheelPixels(ev) {
    const unit = ev.deltaMode === WheelEvent.DOM_DELTA_LINE
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
function clearSpaceHeld() {
    spaceHeld = false;
    spacePanActive = false;
}
function onWheel(ev) {
    if (isNavigationSuppressed(ev.target))
        return;
    ev.preventDefault();
    const { dx, dy } = wheelPixels(ev);
    if (ev.ctrlKey || ev.metaKey) {
        const factor = dy < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
        zoomAround(ev.clientX, ev.clientY, factor);
        return;
    }
    panBy(-dx, -dy);
}
function onKeyDown(ev) {
    if (ev.code !== "Space" || ev.repeat)
        return;
    if (isNavigationSuppressed(ev.target))
        return;
    ev.preventDefault();
    spaceHeld = true;
}
// Arrow keys pan the canvas (additive to wheel / Space+drag / middle-drag).
// Direction = the way the viewport moves toward content, matching scroll-to-pan.
function onArrowKeyDown(ev, isOpen) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey)
        return;
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
    if (!isOpen())
        return;
    if (isNavigationSuppressed(ev.target))
        return;
    ev.preventDefault();
    panBy(dx, dy);
}
function onKeyUp(ev) {
    if (ev.code !== "Space")
        return;
    spaceHeld = false;
    spacePanActive = false;
    scheduleSaveViewport();
}
function onBlur() {
    clearSpaceHeld();
}
function beginPanGesture(clientX, clientY, getPan) {
    panStartX = clientX;
    panStartY = clientY;
    const p = getPan();
    panStartPanX = p.panX;
    panStartPanY = p.panY;
}
function movePanGesture(clientX, clientY, setPan) {
    setPan(panStartPanX + (clientX - panStartX), panStartPanY + (clientY - panStartY));
}
function bindPanPointer(surface, signal, shouldStart, onActiveChange) {
    surface.addEventListener("pointerdown", (ev) => {
        if (!shouldStart(ev))
            return;
        if (isNavigationSuppressed(ev.target))
            return;
        ev.preventDefault();
        onActiveChange(true);
        beginPanGesture(ev.clientX, ev.clientY, getViewportState);
        // Tear down the document listeners on pointerup/cancel AND if the wall
        // closes mid-drag (wall signal). onUp is idempotent so abort + pointerup
        // both firing is safe.
        let ended = false;
        const onMove = (mv) => {
            mv.preventDefault();
            const st = getViewportState();
            movePanGesture(mv.clientX, mv.clientY, (px, py) => {
                setViewportState({ panX: clampPan(px), panY: clampPan(py), zoom: st.zoom });
            });
        };
        const onUp = () => {
            if (ended)
                return;
            ended = true;
            document.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerup", onUp);
            document.removeEventListener("pointercancel", onUp);
            signal.removeEventListener("abort", onUp);
            onActiveChange(false);
            scheduleSaveViewport();
        };
        signal.addEventListener("abort", onUp);
        document.addEventListener("pointermove", onMove, { passive: false });
        document.addEventListener("pointerup", onUp);
        document.addEventListener("pointercancel", onUp);
    }, { signal });
}
/**
 * Bind wheel / keyboard / space+drag / middle-drag pan on the wall surface.
 * All listeners abort when `signal` fires (wall teardown).
 */
export function bindWallNavigation(surface, signal, isOpen = () => true) {
    const opts = { signal, passive: false };
    surface.addEventListener("wheel", onWheel, opts);
    window.addEventListener("keydown", onKeyDown, { signal });
    window.addEventListener("keyup", onKeyUp, { signal });
    window.addEventListener("keydown", (ev) => onArrowKeyDown(ev, isOpen), { signal });
    surface.addEventListener("blur", onBlur, { signal, capture: true });
    window.addEventListener("blur", onBlur, { signal });
    bindPanPointer(surface, signal, (ev) => ev.button === 1, (active) => {
        middlePanActive = active;
    });
    bindPanPointer(surface, signal, (ev) => ev.button === 0 && spaceHeld && !ev.shiftKey, (active) => {
        spacePanActive = active;
    });
}
/** True while Space is held (marquee / note drag should defer to pan). */
export function isSpacePanArmed() {
    return spaceHeld;
}
/** For tests: drive the arrow-key pan handler directly. */
export function __onArrowKeyDownForTest(ev, isOpen = () => true) {
    onArrowKeyDown(ev, isOpen);
}
/** For tests: whether space-to-pan is armed. */
export function __isSpaceHeldForTest() {
    return spaceHeld;
}
export function __resetNavStateForTest() {
    spaceHeld = false;
    spacePanActive = false;
    middlePanActive = false;
}
