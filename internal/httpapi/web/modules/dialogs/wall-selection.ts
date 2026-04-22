// Multi-select state helpers for the Scrumbaby/Wall feature.
//
// Selection is stored on the mounted state object (`state.selected: Set<string>`).
// These helpers own the surface-side DOM class toggles so callers never have
// to remember to re-sync after mutating the set.
//
// All functions read the active wall via `wall-state.getMounted()` and no-op
// when nothing is mounted; callers don't have to check.

import { wallSurface } from "../dom/elements.js";
import { getMounted } from "./wall-state.js";

/** Re-apply the `wall-note--selected` class to every note element on the surface. */
export function syncSelectionDom(): void {
  const state = getMounted();
  if (!state || !wallSurface) return;
  const all = wallSurface.querySelectorAll<HTMLElement>(".wall-note");
  all.forEach((el) => {
    const id = el.dataset.noteId || "";
    el.classList.toggle("wall-note--selected", state.selected.has(id));
  });
}

/** Drop selection entries whose notes no longer exist (remote delete, reconcile). */
export function pruneSelection(): void {
  const state = getMounted();
  if (!state) return;
  if (state.selected.size === 0) return;
  const live = new Set(state.doc.notes.map((n) => n.id));
  for (const id of Array.from(state.selected)) {
    if (!live.has(id)) state.selected.delete(id);
  }
}

export function clearSelection(): void {
  const state = getMounted();
  if (!state) return;
  if (state.selected.size === 0) return;
  state.selected.clear();
  syncSelectionDom();
}

export function setSelection(ids: Iterable<string>): void {
  const state = getMounted();
  if (!state) return;
  state.selected = new Set(ids);
  syncSelectionDom();
}

export function toggleSelection(id: string): void {
  const state = getMounted();
  if (!state) return;
  if (state.selected.has(id)) state.selected.delete(id);
  else state.selected.add(id);
  syncSelectionDom();
}
