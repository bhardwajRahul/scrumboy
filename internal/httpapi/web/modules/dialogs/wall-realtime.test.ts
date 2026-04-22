// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api.js", () => ({ apiFetch: vi.fn() }));
vi.mock("../dom/elements.js", () => {
  const wallSurface = document.createElement("div");
  wallSurface.id = "wallSurface";
  document.body.appendChild(wallSurface);
  return {
    wallDialog: null,
    wallSurface,
    wallTrash: null,
    closeWallBtn: null,
  };
});

import { apiFetch } from "../api.js";
import { refetchDoc, applyTransient } from "./wall-realtime.js";
import {
  setMounted,
  setActiveEditNoteId,
  setPendingRefetch,
  getPendingRefetch,
  resetEditGuards,
  type Mounted,
} from "./wall-state.js";

const mock = apiFetch as unknown as ReturnType<typeof vi.fn>;

function makeState(overrides: Partial<Mounted> = {}): Mounted {
  return {
    projectId: 1,
    slug: "abc",
    role: "editor" as any,
    canEdit: true,
    doc: { notes: [], edges: [], version: 0 } as any,
    userId: 42,
    onRefreshNeeded: () => { /* noop */ },
    onTransient: () => { /* noop */ },
    abort: new AbortController(),
    prevHtmlOverflow: "",
    transient: new Map(),
    colorTimers: new Map(),
    lastTapAt: new Map(),
    selected: new Set<string>(),
    ...overrides,
  } as Mounted;
}

describe("wall-realtime.refetchDoc", () => {
  beforeEach(() => {
    mock.mockReset();
    resetEditGuards();
    setMounted(null);
  });

  it("no-ops when nothing is mounted", async () => {
    const onApplyDoc = vi.fn();
    await refetchDoc({ onApplyDoc });
    expect(mock).not.toHaveBeenCalled();
    expect(onApplyDoc).not.toHaveBeenCalled();
  });

  it("defers (no GET) when an edit is in progress, and raises the pending flag", async () => {
    setMounted(makeState());
    setActiveEditNoteId("n1");
    const onApplyDoc = vi.fn();
    await refetchDoc({ onApplyDoc });
    expect(mock).not.toHaveBeenCalled();
    expect(onApplyDoc).not.toHaveBeenCalled();
    expect(getPendingRefetch()).toBe(true);
  });

  it("defers if an edit begins during the in-flight GET (second guard)", async () => {
    const state = makeState();
    setMounted(state);
    let resolveFetch: (v: any) => void = () => {};
    mock.mockImplementationOnce(() => new Promise((r) => { resolveFetch = r; }));
    const onApplyDoc = vi.fn();
    const p = refetchDoc({ onApplyDoc });
    // Edit starts while the GET is in flight.
    setActiveEditNoteId("n2");
    resolveFetch({ notes: [], edges: [], version: 1 });
    await p;
    expect(onApplyDoc).not.toHaveBeenCalled();
    expect(getPendingRefetch()).toBe(true);
  });

  it("applies the fetched doc when no edit is active", async () => {
    const state = makeState();
    setMounted(state);
    mock.mockResolvedValueOnce({ notes: [{ id: "x" }], edges: [], version: 2 });
    const onApplyDoc = vi.fn();
    await refetchDoc({ onApplyDoc });
    expect(onApplyDoc).toHaveBeenCalledWith(state, { notes: [{ id: "x" }], edges: [], version: 2 });
  });

  it("logs but does not throw when the GET rejects with a non-404", async () => {
    setMounted(makeState());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => { /* noop */ });
    mock.mockRejectedValueOnce(new Error("boom"));
    await refetchDoc({ onApplyDoc: vi.fn() });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("wall-realtime.applyTransient", () => {
  beforeEach(() => {
    resetEditGuards();
    setMounted(null);
  });

  function mountWithNote(id: string, opts: { dragging?: boolean } = {}): HTMLElement {
    const state = makeState();
    setMounted(state);
    const el = document.createElement("div");
    el.className = "wall-note" + (opts.dragging ? " wall-note--dragging" : "");
    el.dataset.noteId = id;
    el.style.left = "0px";
    el.style.top = "0px";
    // offsetWidth/offsetHeight are 0 in happy-dom; avoid NaN assertions.
    return el;
  }

  it("moves the element to the transient coordinates", () => {
    const el = mountWithNote("n1");
    const lookup = (id: string) => (id === "n1" ? el : null);
    applyTransient({ payload: { noteId: "n1", x: 42, y: 84, by: 7 } }, lookup);
    expect(el.style.left).toBe("42px");
    expect(el.style.top).toBe("84px");
  });

  it("ignores transients originated by the local user (echo suppression)", () => {
    setMounted(makeState({ userId: 7 }));
    const el = document.createElement("div");
    el.className = "wall-note";
    el.dataset.noteId = "n1";
    el.style.left = "1px";
    el.style.top = "2px";
    const lookup = (id: string) => (id === "n1" ? el : null);
    applyTransient({ payload: { noteId: "n1", x: 42, y: 84, by: 7 } }, lookup);
    expect(el.style.left).toBe("1px");
  });

  it("ignores notes the local user is currently dragging", () => {
    const el = mountWithNote("n1", { dragging: true });
    el.style.left = "1px";
    el.style.top = "2px";
    const lookup = (id: string) => (id === "n1" ? el : null);
    applyTransient({ payload: { noteId: "n1", x: 42, y: 84, by: 99 } }, lookup);
    expect(el.style.left).toBe("1px");
  });
});
