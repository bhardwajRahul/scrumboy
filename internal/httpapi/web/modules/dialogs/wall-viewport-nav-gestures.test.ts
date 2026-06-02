// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureWallContent,
  getViewportState,
  initWallViewport,
  teardownWallViewport,
} from "./wall-viewport.js";
import {
  bindWallNavigation,
  cancelWallNavigationGestures,
  __resetNavStateForTest,
} from "./wall-viewport-nav.js";
import {
  resetWallCanvasMode,
  setWallCanvasMode,
} from "./wall-canvas-mode.js";
import { dispatchPointer, rect } from "./wall-test-harness.js";

describe("wall-viewport-nav pan-mode gestures", () => {
  let surface: HTMLElement;
  let abort: AbortController;

  beforeEach(() => {
    document.body.innerHTML = "";
    surface = document.createElement("div");
    surface.id = "wallSurface";
    surface.className = "wall-surface";
    document.body.appendChild(surface);
    surface.getBoundingClientRect = () => rect(0, 0, 800, 600);
    initWallViewport(surface, ensureWallContent(surface), "nav-gesture-proj");
    abort = new AbortController();
    __resetNavStateForTest();
    resetWallCanvasMode();
  });

  afterEach(() => {
    abort.abort();
    cancelWallNavigationGestures();
    __resetNavStateForTest();
    resetWallCanvasMode();
    teardownWallViewport();
    localStorage.clear();
  });

  it("pinch zooms in Pan mode", () => {
    setWallCanvasMode("pan");
    bindWallNavigation(surface, abort.signal);

    dispatchPointer(surface, "pointerdown", {
      button: 0,
      pointerId: 1,
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
    });
    dispatchPointer(surface, "pointerdown", {
      button: 0,
      pointerId: 2,
      pointerType: "touch",
      clientX: 200,
      clientY: 100,
    });
    dispatchPointer(document, "pointermove", {
      button: 0,
      pointerId: 2,
      pointerType: "touch",
      clientX: 220,
      clientY: 100,
    });

    expect(getViewportState().zoom).toBeGreaterThan(1);
  });

  it("does not pinch zoom in Select mode", () => {
    bindWallNavigation(surface, abort.signal);

    dispatchPointer(surface, "pointerdown", {
      button: 0,
      pointerId: 1,
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
    });
    dispatchPointer(surface, "pointerdown", {
      button: 0,
      pointerId: 2,
      pointerType: "touch",
      clientX: 200,
      clientY: 100,
    });
    dispatchPointer(document, "pointermove", {
      button: 0,
      pointerId: 2,
      pointerType: "touch",
      clientX: 220,
      clientY: 100,
    });

    expect(getViewportState().zoom).toBe(1);
  });

  it("does not resume one-finger pan after pinch ends", () => {
    setWallCanvasMode("pan");
    bindWallNavigation(surface, abort.signal);

    dispatchPointer(surface, "pointerdown", {
      button: 0,
      pointerId: 1,
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
    });
    dispatchPointer(surface, "pointerdown", {
      button: 0,
      pointerId: 2,
      pointerType: "touch",
      clientX: 200,
      clientY: 100,
    });
    dispatchPointer(document, "pointermove", {
      button: 0,
      pointerId: 2,
      pointerType: "touch",
      clientX: 220,
      clientY: 100,
    });
    dispatchPointer(document, "pointerup", {
      button: 0,
      pointerId: 1,
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
    });

    const afterPinch = { ...getViewportState() };
    dispatchPointer(document, "pointermove", {
      button: 0,
      pointerId: 2,
      pointerType: "touch",
      clientX: 320,
      clientY: 180,
    });

    expect(getViewportState()).toEqual(afterPinch);
  });

  it("clears active pan state when canceled mid-gesture", () => {
    setWallCanvasMode("pan");
    surface.classList.add("wall-surface--pan-mode");
    bindWallNavigation(surface, abort.signal);

    dispatchPointer(surface, "pointerdown", {
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
      clientX: 120,
      clientY: 95,
    });
    expect(getViewportState()).toEqual({ panX: 70, panY: 45, zoom: 1 });

    cancelWallNavigationGestures();
    const canceledAt = { ...getViewportState() };
    expect(surface.classList.contains("wall-surface--panning")).toBe(false);

    dispatchPointer(document, "pointermove", {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      clientX: 180,
      clientY: 160,
    });

    expect(getViewportState()).toEqual(canceledAt);
  });

  it("removes document listeners and the panning class on abort", () => {
    setWallCanvasMode("pan");
    surface.classList.add("wall-surface--pan-mode");
    bindWallNavigation(surface, abort.signal);

    dispatchPointer(surface, "pointerdown", {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      clientX: 40,
      clientY: 40,
    });
    dispatchPointer(document, "pointermove", {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      clientX: 100,
      clientY: 80,
    });

    abort.abort();
    const abortedAt = { ...getViewportState() };
    expect(surface.classList.contains("wall-surface--panning")).toBe(false);

    dispatchPointer(document, "pointermove", {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      clientX: 180,
      clientY: 150,
    });

    expect(getViewportState()).toEqual(abortedAt);
  });
});
