// Pan/zoom viewport for the Scrumbaby wall infinite canvas.
//
// Coordinate model:
//   - Note x/y are CANVAS coordinates (persisted server-side, +/-100000).
//   - #wallSurface is the clipping viewport (screen pixels).
//   - .wall-content child receives CSS transform: translate(pan) scale(zoom).
//
// screenToCanvas:
//   canvasX = (clientX - surfaceRect.left - panX) / zoom
//
// See wall-viewport-coord-audit.md for the full pointer-path checklist.
export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 3;
/** Matches internal/store/wall.go maxNoteCoordinate */
export const MAX_CANVAS_COORD = 100000;
const STORAGE_PREFIX = "scrumboy.wall.viewport.";
const SAVE_DEBOUNCE_MS = 250;
const FIT_PADDING_PX = 48;
let viewportSurface = null;
let viewportContent = null;
let viewportSlug = null;
let panX = 0;
let panY = 0;
let zoom = 1;
let saveTimer = null;
export function clampCanvasCoord(v) {
    if (!Number.isFinite(v))
        return 0;
    if (v < -MAX_CANVAS_COORD)
        return -MAX_CANVAS_COORD;
    if (v > MAX_CANVAS_COORD)
        return MAX_CANVAS_COORD;
    return v;
}
export function clampZoom(z) {
    if (!Number.isFinite(z))
        return 1;
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}
function maxPanAbs() {
    return MAX_CANVAS_COORD * zoom + 10000;
}
export function clampPan(p) {
    if (!Number.isFinite(p))
        return 0;
    const bound = maxPanAbs();
    if (p < -bound)
        return -bound;
    if (p > bound)
        return bound;
    return p;
}
function identityViewport() {
    return { panX: 0, panY: 0, zoom: 1 };
}
export function storageKey(slug) {
    return `${STORAGE_PREFIX}${slug}`;
}
/** Validate and clamp a parsed record; returns null if unusable. */
export function normalizePersistedViewport(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const o = raw;
    const px = o.panX;
    const py = o.panY;
    const z = o.zoom;
    if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(z))
        return null;
    return {
        panX: clampPan(px),
        panY: clampPan(py),
        zoom: clampZoom(z),
    };
}
export function loadViewport(slug) {
    try {
        const raw = localStorage.getItem(storageKey(slug));
        if (!raw)
            return identityViewport();
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            return identityViewport();
        }
        const normalized = normalizePersistedViewport(parsed);
        return normalized ?? identityViewport();
    }
    catch {
        return identityViewport();
    }
}
export function saveViewportNow(slug, state = getViewportState()) {
    try {
        const payload = {
            panX: clampPan(state.panX),
            panY: clampPan(state.panY),
            zoom: clampZoom(state.zoom),
        };
        localStorage.setItem(storageKey(slug), JSON.stringify(payload));
    }
    catch {
        // private mode / quota / disabled — ignore
    }
}
export function scheduleSaveViewport() {
    const slug = viewportSlug;
    if (!slug)
        return;
    if (saveTimer)
        clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        if (viewportSlug)
            saveViewportNow(viewportSlug);
    }, SAVE_DEBOUNCE_MS);
}
export function initWallViewport(surface, content, slug, persisted) {
    viewportSurface = surface;
    viewportContent = content;
    viewportSlug = slug;
    const loaded = persisted ?? loadViewport(slug);
    panX = clampPan(loaded.panX);
    panY = clampPan(loaded.panY);
    zoom = clampZoom(loaded.zoom);
    applyTransform();
}
export function teardownWallViewport() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    if (viewportSlug)
        saveViewportNow(viewportSlug);
    viewportSurface = null;
    viewportContent = null;
    viewportSlug = null;
    panX = 0;
    panY = 0;
    zoom = 1;
}
export function getWallContent() {
    return viewportContent;
}
export function getViewportState() {
    return { panX, panY, zoom };
}
export function getViewportZoom() {
    return zoom;
}
export function setViewportState(state) {
    panX = clampPan(state.panX);
    panY = clampPan(state.panY);
    zoom = clampZoom(state.zoom);
    applyTransform();
    scheduleSaveViewport();
}
export function applyTransform() {
    if (!viewportContent)
        return;
    viewportContent.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
}
function surfaceRect() {
    return viewportSurface?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0);
}
/** Screen (client) point -> canvas coordinates. */
export function screenToCanvas(clientX, clientY) {
    const r = surfaceRect();
    const z = zoom || 1;
    return {
        x: (clientX - r.left - panX) / z,
        y: (clientY - r.top - panY) / z,
    };
}
/** Convert a screen-space delta (px) to canvas-space delta. */
export function canvasDelta(screenDelta) {
    const z = zoom || 1;
    return screenDelta / z;
}
export function panBy(dx, dy) {
    panX = clampPan(panX + dx);
    panY = clampPan(panY + dy);
    applyTransform();
    scheduleSaveViewport();
}
/**
 * Zoom around a screen point so the canvas point under the cursor stays fixed.
 */
export function zoomAround(clientX, clientY, factor) {
    const before = screenToCanvas(clientX, clientY);
    const nextZoom = clampZoom(zoom * factor);
    if (nextZoom === zoom)
        return;
    const r = surfaceRect();
    zoom = nextZoom;
    panX = clampPan(clientX - r.left - before.x * zoom);
    panY = clampPan(clientY - r.top - before.y * zoom);
    applyTransform();
    scheduleSaveViewport();
}
/** Fit all notes in the viewport; empty wall resets to origin @ 100%. */
export function fitToNotes(notes) {
    if (!viewportSurface) {
        setViewportState(identityViewport());
        return;
    }
    if (!notes.length) {
        setViewportState(identityViewport());
        return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of notes) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.width);
        maxY = Math.max(maxY, n.y + n.height);
    }
    const bboxW = Math.max(1, maxX - minX);
    const bboxH = Math.max(1, maxY - minY);
    const r = surfaceRect();
    const availW = Math.max(1, r.width - FIT_PADDING_PX * 2);
    const availH = Math.max(1, r.height - FIT_PADDING_PX * 2);
    const fitZoom = clampZoom(Math.min(availW / bboxW, availH / bboxH, 1));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    zoom = fitZoom;
    panX = clampPan(r.width / 2 - cx * zoom);
    panY = clampPan(r.height / 2 - cy * zoom);
    applyTransform();
    scheduleSaveViewport();
}
export function resetView() {
    fitToNotes([]);
}
/**
 * True when pan/zoom navigation must not run (editing, inputs, etc.).
 */
export function isNavigationSuppressed(target) {
    if (!target || !(target instanceof Node))
        return false;
    const el = target instanceof Element ? target : target.parentElement;
    if (!el)
        return false;
    if (el.closest(".wall-note--editing"))
        return true;
    if (el.closest("textarea, input, select, button, [contenteditable='true']"))
        return true;
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
        if (active.closest(".wall-note--editing"))
            return true;
        if (active.matches("textarea, input, select, button, [contenteditable='true']"))
            return true;
    }
    return false;
}
export function ensureWallContent(surface) {
    let content = surface.querySelector(":scope > .wall-content");
    if (!content) {
        content = document.createElement("div");
        content.className = "wall-content";
        content.setAttribute("aria-hidden", "true");
        surface.appendChild(content);
    }
    viewportContent = content;
    return content;
}
