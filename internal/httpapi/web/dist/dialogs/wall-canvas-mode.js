let wallCanvasMode = "select";
export function getWallCanvasMode() {
    return wallCanvasMode;
}
export function setWallCanvasMode(mode) {
    wallCanvasMode = mode === "pan" ? "pan" : "select";
}
export function toggleWallCanvasMode() {
    wallCanvasMode = wallCanvasMode === "select" ? "pan" : "select";
    return wallCanvasMode;
}
export function isWallPanMode() {
    return wallCanvasMode === "pan";
}
export function resetWallCanvasMode() {
    wallCanvasMode = "select";
}
