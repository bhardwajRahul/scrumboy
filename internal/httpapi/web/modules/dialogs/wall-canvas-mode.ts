export type WallCanvasMode = "select" | "pan";

let wallCanvasMode: WallCanvasMode = "select";

export function getWallCanvasMode(): WallCanvasMode {
  return wallCanvasMode;
}

export function setWallCanvasMode(mode: WallCanvasMode): void {
  wallCanvasMode = mode === "pan" ? "pan" : "select";
}

export function toggleWallCanvasMode(): WallCanvasMode {
  wallCanvasMode = wallCanvasMode === "select" ? "pan" : "select";
  return wallCanvasMode;
}

export function isWallPanMode(): boolean {
  return wallCanvasMode === "pan";
}

export function resetWallCanvasMode(): void {
  wallCanvasMode = "select";
}
