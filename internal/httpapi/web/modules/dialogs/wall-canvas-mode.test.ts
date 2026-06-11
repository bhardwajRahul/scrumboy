// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dispatchMouse,
  dispatchPointer,
  flushPromises,
  flushRaf,
  initWallTestI18n,
  installDialogPolyfill,
  makeNote,
  makeWallDoc,
  rect,
  setupWallDom,
  type TestNote,
} from "./wall-test-harness.js";
import enCatalog from "../i18n/locales/en.json";

const apiFetchMock = vi.hoisted(() => vi.fn());
const confirmDeleteMock = vi.hoisted(() => vi.fn());
const onMock = vi.hoisted(() => vi.fn());
const offMock = vi.hoisted(() => vi.fn());
const showToastMock = vi.hoisted(() => vi.fn());

const wallDialogEl = vi.hoisted(() => document.createElement("dialog") as HTMLDialogElement);
const wallSurfaceEl = vi.hoisted(() => document.createElement("div"));
const closeWallBtnEl = vi.hoisted(() => document.createElement("button"));
const wallTrashEl = vi.hoisted(() => document.createElement("div"));

vi.mock("../api.js", () => ({ apiFetch: apiFetchMock }));

vi.mock("../utils.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils.js")>();
  return { ...actual, confirmDelete: confirmDeleteMock, showToast: showToastMock };
});

vi.mock("../events.js", () => ({ on: onMock, off: offMock }));

vi.mock("../state/selectors.js", () => ({ getUser: () => ({ id: 1 }) }));

vi.mock("../dom/elements.js", () => ({
  wallDialog: wallDialogEl,
  wallSurface: wallSurfaceEl,
  closeWallBtn: closeWallBtnEl,
  wallTrash: wallTrashEl,
}));

function defaultNotes(): TestNote[] {
  return [
    makeNote({
      id: "n1",
      x: 20,
      y: 20,
      width: 160,
      height: 100,
      color: "#B0E0E6",
      text: "Hello",
      version: 1,
    }),
  ];
}

function edgeNotes(): TestNote[] {
  return [
    makeNote({
      id: "n1",
      x: 20,
      y: 20,
      width: 160,
      height: 100,
      color: "#B0E0E6",
      text: "One",
      version: 1,
    }),
    makeNote({
      id: "n2",
      x: 260,
      y: 20,
      width: 160,
      height: 100,
      color: "#B0E0E6",
      text: "Two",
      version: 1,
    }),
  ];
}

async function currentViewport() {
  const { getViewportState } = await import("./wall-viewport.js");
  return getViewportState();
}

function lastNotePatch(id: string): Record<string, unknown> | null {
  for (let i = apiFetchMock.mock.calls.length - 1; i >= 0; i -= 1) {
    const [url, init] = apiFetchMock.mock.calls[i];
    if (
      typeof url === "string" &&
      url.includes(`/wall/notes/${id}`) &&
      (init as RequestInit | undefined)?.method === "PATCH"
    ) {
      const body = (init as RequestInit | undefined)?.body;
      return body ? JSON.parse(String(body)) : {};
    }
  }
  return null;
}

async function openWall(notes: TestNote[] = defaultNotes()) {
  apiFetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (typeof url === "string" && url.endsWith("/wall") && !init?.method) {
      return makeWallDoc(notes);
    }
    if (typeof url === "string" && init?.method === "PATCH" && url.includes("/wall/notes/")) {
      const id = url.split("/").pop() || "";
      const note = notes.find((n) => n.id === id) ?? notes[0];
      const body = init.body ? JSON.parse(String(init.body)) : {};
      Object.assign(note, body, { version: (note.version ?? 1) + 1 });
      return note;
    }
    if (typeof url === "string" && init?.method === "POST" && url.endsWith("/wall/edges")) {
      const body = init.body ? JSON.parse(String(init.body)) : {};
      return { id: "e1", from: body.from, to: body.to };
    }
    if (typeof url === "string" && init?.method === "POST" && url.endsWith("/wall/notes")) {
      const body = init.body ? JSON.parse(String(init.body)) : {};
      return { id: "created-1", version: 1, text: "", width: 160, height: 100, color: "#B0E0E6", ...body };
    }
    if (typeof url === "string" && init?.method === "POST" && url.endsWith("/wall/transient")) {
      return {};
    }
    if (init?.method === "DELETE") return {};
    return {};
  });

  const mod = await import("./wall.js");
  await mod.openWallDialog({ projectId: 1, slug: "alpha", role: "maintainer" });
  await flushPromises();
  return mod;
}

function getModeBtn(): HTMLButtonElement {
  const btn = document.getElementById("wallModeToggleBtn");
  if (!(btn instanceof HTMLButtonElement)) throw new Error("missing wall mode toggle button");
  return btn;
}

function getNoteEl(id: string): HTMLElement {
  const noteEl = wallSurfaceEl.querySelector<HTMLElement>(`.wall-note[data-note-id="${id}"]`);
  if (!noteEl) throw new Error(`missing note ${id}`);
  return noteEl;
}

describe("wall canvas mode toggle", () => {
  beforeEach(async () => {
    vi.resetModules();
    await initWallTestI18n({ en: enCatalog as Record<string, string> });
    installDialogPolyfill();
    localStorage.clear();
    setupWallDom({ wallDialogEl, wallSurfaceEl, closeWallBtnEl, wallTrashEl });
    apiFetchMock.mockReset();
    confirmDeleteMock.mockReset();
    onMock.mockReset();
    offMock.mockReset();
    showToastMock.mockReset();
    wallSurfaceEl.getBoundingClientRect = () => rect(0, 0, 800, 600);
  });

  afterEach(async () => {
    if (wallDialogEl.open) wallDialogEl.close();
    const { __resetNavStateForTest } = await import("./wall-viewport-nav.js");
    const { resetWallCanvasMode } = await import("./wall-canvas-mode.js");
    __resetNavStateForTest();
    resetWallCanvasMode();
    localStorage.clear();
    vi.useRealTimers();
  });

  it("opens in Select mode, toggles to Pan mode, and toggles back", async () => {
    await openWall();

    const btn = getModeBtn();
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.getAttribute("aria-label")).toBe("Canvas mode: Select");
    expect(btn.getAttribute("title")).toBe("Canvas mode: Select — drag empty canvas to select notes");
    expect(btn.innerHTML).toContain("lucide-square-dashed");
    expect(wallSurfaceEl.classList.contains("wall-surface--pan-mode")).toBe(false);

    btn.click();
    await flushPromises();

    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.getAttribute("aria-label")).toBe("Canvas mode: Pan");
    expect(btn.getAttribute("title")).toBe("Canvas mode: Pan — drag empty canvas to move around");
    expect(btn.innerHTML).toContain("lucide-hand");
    expect(wallSurfaceEl.classList.contains("wall-surface--pan-mode")).toBe(true);

    btn.click();
    await flushPromises();

    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.getAttribute("aria-label")).toBe("Canvas mode: Select");
    expect(btn.innerHTML).toContain("lucide-square-dashed");
    expect(wallSurfaceEl.classList.contains("wall-surface--pan-mode")).toBe(false);
  });

  it("persists Pan mode globally after close and reopen", async () => {
    await openWall();
    const btn = getModeBtn();
    btn.click();
    await flushPromises();
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem("scrumboy.wall.canvasMode")).toBe("pan");

    wallDialogEl.close();
    await flushPromises();

    // Reopen a different project's wall: the global preference still applies.
    await openWall();
    const reopened = getModeBtn();
    expect(reopened.getAttribute("aria-pressed")).toBe("true");
    expect(reopened.innerHTML).toContain("lucide-hand");
    expect(wallSurfaceEl.classList.contains("wall-surface--pan-mode")).toBe(true);
  });

  it("opens in Select mode when no saved preference exists", async () => {
    await openWall();
    const btn = getModeBtn();
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.innerHTML).toContain("lucide-square-dashed");
    expect(wallSurfaceEl.classList.contains("wall-surface--pan-mode")).toBe(false);
  });

  it("keeps touch marquee selection in Select mode", async () => {
    await openWall();

    dispatchPointer(wallSurfaceEl, "pointerdown", {
      button: 0,
      pointerId: 1,
      pointerType: "touch",
      clientX: 5,
      clientY: 5,
    });
    dispatchPointer(document, "pointermove", {
      button: 0,
      pointerId: 1,
      pointerType: "touch",
      clientX: 400,
      clientY: 400,
    });
    dispatchPointer(document, "pointerup", {
      button: 0,
      pointerId: 1,
      pointerType: "touch",
      clientX: 400,
      clientY: 400,
    });
    await flushPromises();

    expect(getNoteEl("n1").classList.contains("wall-note--selected")).toBe(true);
    expect(await currentViewport()).toEqual({ panX: 0, panY: 0, zoom: 1 });
  });

  it("pans on empty-canvas mouse drag in Pan mode without starting marquee", async () => {
    await openWall();
    getModeBtn().click();
    await flushPromises();

    dispatchPointer(wallSurfaceEl, "pointerdown", {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      clientX: 50,
      clientY: 50,
    });
    dispatchPointer(document, "pointermove", {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      clientX: 150,
      clientY: 120,
    });
    dispatchPointer(document, "pointerup", {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      clientX: 150,
      clientY: 120,
    });
    await flushPromises();

    expect(await currentViewport()).toEqual({ panX: 100, panY: 70, zoom: 1 });
    expect(getNoteEl("n1").classList.contains("wall-note--selected")).toBe(false);
  });

  it("pans on empty-canvas touch swipe in Pan mode", async () => {
    await openWall();
    getModeBtn().click();
    await flushPromises();

    dispatchPointer(wallSurfaceEl, "pointerdown", {
      button: 0,
      pointerId: 1,
      pointerType: "touch",
      clientX: 60,
      clientY: 60,
    });
    dispatchPointer(document, "pointermove", {
      button: 0,
      pointerId: 1,
      pointerType: "touch",
      clientX: 160,
      clientY: 135,
    });
    dispatchPointer(document, "pointerup", {
      button: 0,
      pointerId: 1,
      pointerType: "touch",
      clientX: 160,
      clientY: 135,
    });
    await flushPromises();

    expect(await currentViewport()).toEqual({ panX: 100, panY: 75, zoom: 1 });
  });

  it("keeps note drag behavior in Pan mode without panning the viewport", async () => {
    await openWall();
    getModeBtn().click();
    await flushPromises();

    const noteEl = getNoteEl("n1");
    noteEl.getBoundingClientRect = () => rect(20, 20, 160, 100);

    dispatchPointer(noteEl, "pointerdown", { button: 0, pointerId: 1, pointerType: "mouse", clientX: 50, clientY: 50 });
    dispatchPointer(document, "pointermove", { button: 0, pointerId: 1, pointerType: "mouse", clientX: 120, clientY: 120 });
    dispatchPointer(document, "pointermove", { button: 0, pointerId: 1, pointerType: "mouse", clientX: 130, clientY: 130 });
    await flushRaf();
    dispatchPointer(document, "pointerup", { button: 0, pointerId: 1, pointerType: "mouse", clientX: 130, clientY: 130 });
    await flushPromises();

    expect(await currentViewport()).toEqual({ panX: 0, panY: 0, zoom: 1 });
    const patch = lastNotePatch("n1");
    expect(patch?.x).toBeTypeOf("number");
    expect(patch?.y).toBeTypeOf("number");
  });

  it("keeps Shift-drag edge creation behavior in Pan mode without panning", async () => {
    await openWall(edgeNotes());
    getModeBtn().click();
    await flushPromises();

    const n1 = getNoteEl("n1");
    const n2 = getNoteEl("n2");
    (document as Document & { elementFromPoint?: (x: number, y: number) => Element | null }).elementFromPoint =
      () => n2;

    dispatchPointer(n1, "pointerdown", { button: 0, pointerId: 1, pointerType: "mouse", shiftKey: true, clientX: 80, clientY: 80 });
    dispatchPointer(document, "pointermove", { button: 0, pointerId: 1, pointerType: "mouse", shiftKey: true, clientX: 320, clientY: 70 });
    dispatchPointer(document, "pointerup", { button: 0, pointerId: 1, pointerType: "mouse", shiftKey: true, clientX: 320, clientY: 70 });
    await flushPromises();

    expect(await currentViewport()).toEqual({ panX: 0, panY: 0, zoom: 1 });
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/board/alpha/wall/edges",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("suppresses Pan-mode gestures from editing controls", async () => {
    await openWall();
    const noteEl = getNoteEl("n1");
    dispatchMouse(noteEl, "dblclick", { button: 0, clientX: 32, clientY: 32 });
    await flushPromises();

    getModeBtn().click();
    await flushPromises();

    const editor = noteEl.querySelector<HTMLTextAreaElement>("textarea.wall-note__editor");
    if (!editor) throw new Error("missing note editor");

    dispatchPointer(editor, "pointerdown", {
      button: 0,
      pointerId: 1,
      pointerType: "touch",
      clientX: 40,
      clientY: 40,
    });
    dispatchPointer(document, "pointermove", {
      button: 0,
      pointerId: 1,
      pointerType: "touch",
      clientX: 180,
      clientY: 160,
    });
    dispatchPointer(document, "pointerup", {
      button: 0,
      pointerId: 1,
      pointerType: "touch",
      clientX: 180,
      clientY: 160,
    });
    await flushPromises();

    expect(await currentViewport()).toEqual({ panX: 0, panY: 0, zoom: 1 });
  });

  it("keeps right-click create-note working in both Select and Pan mode", async () => {
    await openWall([]);

    dispatchMouse(wallSurfaceEl, "contextmenu", { button: 2, clientX: 200, clientY: 150 });
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/board/alpha/wall/notes",
      expect.objectContaining({ method: "POST" }),
    );

    apiFetchMock.mockClear();
    getModeBtn().click();
    await flushPromises();

    dispatchMouse(wallSurfaceEl, "contextmenu", { button: 2, clientX: 300, clientY: 250 });
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/board/alpha/wall/notes",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("wall-canvas-mode persistence", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("normalizeWallCanvasMode rejects garbage and defaults to select", async () => {
    const { normalizeWallCanvasMode } = await import("./wall-canvas-mode.js");
    expect(normalizeWallCanvasMode("pan")).toBe("pan");
    expect(normalizeWallCanvasMode("select")).toBe("select");
    expect(normalizeWallCanvasMode("nonsense")).toBe("select");
    expect(normalizeWallCanvasMode(null)).toBe("select");
    expect(normalizeWallCanvasMode(undefined)).toBe("select");
    expect(normalizeWallCanvasMode(42)).toBe("select");
  });

  it("loadWallCanvasMode reads a saved pan preference", async () => {
    localStorage.setItem("scrumboy.wall.canvasMode", "pan");
    const { loadWallCanvasMode, getWallCanvasMode } = await import("./wall-canvas-mode.js");
    expect(loadWallCanvasMode()).toBe("pan");
    expect(getWallCanvasMode()).toBe("pan");
  });

  it("loadWallCanvasMode defaults to select when unset or invalid", async () => {
    const { loadWallCanvasMode } = await import("./wall-canvas-mode.js");
    expect(loadWallCanvasMode()).toBe("select");
    localStorage.setItem("scrumboy.wall.canvasMode", "bogus");
    expect(loadWallCanvasMode()).toBe("select");
  });

  it("toggleWallCanvasMode and setWallCanvasMode write to localStorage", async () => {
    const { toggleWallCanvasMode, setWallCanvasMode } = await import("./wall-canvas-mode.js");
    expect(toggleWallCanvasMode()).toBe("pan");
    expect(localStorage.getItem("scrumboy.wall.canvasMode")).toBe("pan");
    setWallCanvasMode("select");
    expect(localStorage.getItem("scrumboy.wall.canvasMode")).toBe("select");
  });
});
