// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The selection helpers read `wallSurface` out of ../dom/elements.js. That
// module captures the element at import time with `document.getElementById`,
// so we need to render the element BEFORE we import the modules under test.
function bootstrapSurface(): HTMLElement {
  document.body.innerHTML = `<div id="wallSurface"></div>`;
  return document.getElementById("wallSurface") as HTMLElement;
}

function makeNoteEl(id: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "wall-note";
  el.dataset.noteId = id;
  return el;
}

describe("wall-selection", () => {
  beforeEach(() => {
    vi.resetModules();
    bootstrapSurface();
  });

  afterEach(() => {
    vi.resetModules();
  });

  async function loadWithNotes(ids: string[]) {
    const surface = document.getElementById("wallSurface") as HTMLElement;
    surface.innerHTML = "";
    for (const id of ids) surface.appendChild(makeNoteEl(id));

    const state = await import("./wall-state.js");
    const selection = await import("./wall-selection.js");
    state.setMounted({
      projectId: 1,
      slug: "s",
      role: "editor" as any,
      canEdit: true,
      doc: { notes: ids.map((id) => ({
        id,
        x: 0, y: 0, width: 200, height: 120,
        color: "#fff", text: "", version: 0,
      })), edges: [], version: 0 } as any,
      userId: null,
      onRefreshNeeded: () => { /* noop */ },
      onTransient: () => { /* noop */ },
      abort: new AbortController(),
      prevHtmlOverflow: "",
      transient: new Map(),
      colorTimers: new Map(),
      lastTapAt: new Map(),
      selected: new Set<string>(),
    });
    return { state, selection };
  }

  it("syncSelectionDom toggles --selected class to match state.selected", async () => {
    const { state, selection } = await loadWithNotes(["a", "b", "c"]);
    state.getMounted()!.selected.add("b");
    selection.syncSelectionDom();
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".wall-note"));
    expect(nodes.map((n) => n.classList.contains("wall-note--selected"))).toEqual([
      false, true, false,
    ]);
  });

  it("setSelection replaces selection and reflects in DOM", async () => {
    const { state, selection } = await loadWithNotes(["a", "b", "c"]);
    selection.setSelection(["a", "c"]);
    expect(Array.from(state.getMounted()!.selected)).toEqual(["a", "c"]);
    expect(document.querySelectorAll(".wall-note--selected").length).toBe(2);
  });

  it("toggleSelection adds/removes a single id", async () => {
    const { state, selection } = await loadWithNotes(["a", "b"]);
    selection.toggleSelection("a");
    expect(state.getMounted()!.selected.has("a")).toBe(true);
    selection.toggleSelection("a");
    expect(state.getMounted()!.selected.has("a")).toBe(false);
  });

  it("clearSelection empties the set and clears all --selected classes", async () => {
    const { state, selection } = await loadWithNotes(["a", "b"]);
    selection.setSelection(["a", "b"]);
    selection.clearSelection();
    expect(state.getMounted()!.selected.size).toBe(0);
    expect(document.querySelectorAll(".wall-note--selected").length).toBe(0);
  });

  it("pruneSelection drops ids that are no longer in the doc", async () => {
    const { state, selection } = await loadWithNotes(["a", "b"]);
    state.getMounted()!.selected.add("a");
    state.getMounted()!.selected.add("ghost");
    selection.pruneSelection();
    expect(Array.from(state.getMounted()!.selected)).toEqual(["a"]);
  });

  it("helpers no-op when nothing is mounted", async () => {
    const selection = await import("./wall-selection.js");
    expect(() => selection.syncSelectionDom()).not.toThrow();
    expect(() => selection.pruneSelection()).not.toThrow();
    expect(() => selection.clearSelection()).not.toThrow();
    expect(() => selection.setSelection(["x"])).not.toThrow();
    expect(() => selection.toggleSelection("x")).not.toThrow();
  });
});
