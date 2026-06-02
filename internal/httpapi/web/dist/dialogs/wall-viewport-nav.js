// Pan/zoom navigation bindings for #wallSurface (wheel, space-drag, middle-drag).
// Listeners use the wall mount AbortSignal; space-held state clears on blur.
import { clampPan, getViewportState, isNavigationSuppressed, panBy, scheduleSaveViewport, setViewportState, zoomAround, } from "./wall-viewport.js";
const WHEEL_ZOOM_FACTOR = 1.08;
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
    if (ev.ctrlKey || ev.metaKey) {
        const factor = ev.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
        zoomAround(ev.clientX, ev.clientY, factor);
        return;
    }
    panBy(-ev.deltaX, -ev.deltaY);
}
function onKeyDown(ev) {
    if (ev.code !== "Space" || ev.repeat)
        return;
    if (isNavigationSuppressed(ev.target))
        return;
    ev.preventDefault();
    spaceHeld = true;
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
        const onMove = (mv) => {
            mv.preventDefault();
            const st = getViewportState();
            movePanGesture(mv.clientX, mv.clientY, (px, py) => {
                setViewportState({ panX: clampPan(px), panY: clampPan(py), zoom: st.zoom });
            });
        };
        const onUp = () => {
            document.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerup", onUp);
            document.removeEventListener("pointercancel", onUp);
            onActiveChange(false);
            scheduleSaveViewport();
        };
        document.addEventListener("pointermove", onMove, { passive: false });
        document.addEventListener("pointerup", onUp);
        document.addEventListener("pointercancel", onUp);
    }, { signal });
}
/**
 * Bind wheel / keyboard / space+drag / middle-drag pan on the wall surface.
 * All listeners abort when `signal` fires (wall teardown).
 */
export function bindWallNavigation(surface, signal) {
    const opts = { signal, passive: false };
    surface.addEventListener("wheel", onWheel, opts);
    window.addEventListener("keydown", onKeyDown, { signal });
    window.addEventListener("keyup", onKeyUp, { signal });
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
/** For tests: whether space-to-pan is armed. */
export function __isSpaceHeldForTest() {
    return spaceHeld;
}
export function __resetNavStateForTest() {
    spaceHeld = false;
    spacePanActive = false;
    middlePanActive = false;
}
