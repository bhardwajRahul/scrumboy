// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureWallContent,
  getViewportState,
  initWallViewport,
  teardownWallViewport,
} from "./wall-viewport.js";
import { __onArrowKeyDownForTest, __onWheelForTest } from "./wall-viewport-nav.js";
import { rect } from "./wall-test-harness.js";

const STEP = 64;
const COARSE = STEP * 4;

function arrow(key: string, extra: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra });
}

describe("wall-viewport-nav arrow pan", () => {
  let surface: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    surface = document.createElement("div");
    surface.id = "wallSurface";
    document.body.appendChild(surface);
    surface.getBoundingClientRect = () => rect(0, 0, 800, 600);
    initWallViewport(surface, ensureWallContent(surface), "nav-proj");
  });

  afterEach(() => {
    teardownWallViewport();
    localStorage.clear();
  });

  it("ArrowRight pans content left (negative panX) by one step", () => {
    __onArrowKeyDownForTest(arrow("ArrowRight"));
    expect(getViewportState().panX).toBe(-STEP);
  });

  it("ArrowLeft pans content right (positive panX)", () => {
    __onArrowKeyDownForTest(arrow("ArrowLeft"));
    expect(getViewportState().panX).toBe(STEP);
  });

  it("ArrowDown / ArrowUp pan vertically", () => {
    __onArrowKeyDownForTest(arrow("ArrowDown"));
    expect(getViewportState().panY).toBe(-STEP);
    __onArrowKeyDownForTest(arrow("ArrowUp"));
    expect(getViewportState().panY).toBe(0);
  });

  it("Shift pans in coarse steps", () => {
    __onArrowKeyDownForTest(arrow("ArrowRight", { shiftKey: true }));
    expect(getViewportState().panX).toBe(-COARSE);
  });

  it("calls preventDefault when it pans", () => {
    const ev = arrow("ArrowRight");
    __onArrowKeyDownForTest(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("does nothing when the wall is closed", () => {
    __onArrowKeyDownForTest(arrow("ArrowRight"), () => false);
    expect(getViewportState().panX).toBe(0);
  });

  it("is suppressed while editing a note", () => {
    const note = document.createElement("div");
    note.className = "wall-note wall-note--editing";
    const ta = document.createElement("textarea");
    note.appendChild(ta);
    surface.appendChild(note);
    const ev = arrow("ArrowRight");
    Object.defineProperty(ev, "target", { value: ta });
    __onArrowKeyDownForTest(ev);
    expect(getViewportState().panX).toBe(0);
  });

  it("is ignored with ctrl/meta/alt modifiers", () => {
    __onArrowKeyDownForTest(arrow("ArrowRight", { ctrlKey: true }));
    __onArrowKeyDownForTest(arrow("ArrowRight", { metaKey: true }));
    __onArrowKeyDownForTest(arrow("ArrowRight", { altKey: true }));
    expect(getViewportState().panX).toBe(0);
  });

  it("ignores non-arrow keys", () => {
    __onArrowKeyDownForTest(arrow("a"));
    expect(getViewportState()).toEqual({ panX: 0, panY: 0, zoom: 1 });
  });
});

describe("wall-viewport-nav wheel zoom/pan", () => {
  let surface: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    surface = document.createElement("div");
    surface.id = "wallSurface";
    document.body.appendChild(surface);
    surface.getBoundingClientRect = () => rect(0, 0, 800, 600);
    initWallViewport(surface, ensureWallContent(surface), "wheel-proj");
  });

  afterEach(() => {
    teardownWallViewport();
    localStorage.clear();
  });

  // happy-dom's WheelEvent constructor ignores MouseEvent modifier init
  // (shiftKey/ctrlKey come back false), so build a plain Event and assign the
  // fields onUp() reads — mirroring dispatchPointer in wall-test-harness.
  function wheel(extra: Record<string, unknown> = {}): WheelEvent {
    const ev = new Event("wheel", { bubbles: true, cancelable: true });
    Object.assign(ev, {
      clientX: 400,
      clientY: 300,
      deltaX: 0,
      deltaY: 0,
      deltaMode: 0,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      ...extra,
    });
    return ev as unknown as WheelEvent;
  }

  it("Shift+wheel up zooms in", () => {
    __onWheelForTest(wheel({ shiftKey: true, deltaY: -100 }));
    expect(getViewportState().zoom).toBeGreaterThan(1);
  });

  it("Shift+wheel down zooms out", () => {
    __onWheelForTest(wheel({ shiftKey: true, deltaY: 100 }));
    expect(getViewportState().zoom).toBeLessThan(1);
  });

  it("Shift+wheel with only deltaX (Windows axis remap) still zooms by direction", () => {
    // Browsers remap Shift+wheel to horizontal scroll, so the magnitude lands
    // in deltaX with deltaY ~ 0. Negative dx should zoom in, not out.
    __onWheelForTest(wheel({ shiftKey: true, deltaX: -100, deltaY: 0 }));
    expect(getViewportState().zoom).toBeGreaterThan(1);
  });

  it("Ctrl+wheel still zooms (trackpad pinch path preserved)", () => {
    __onWheelForTest(wheel({ ctrlKey: true, deltaY: -100 }));
    expect(getViewportState().zoom).toBeGreaterThan(1);
  });

  it("modifier wheel with zero delta is a no-op (does not zoom out)", () => {
    __onWheelForTest(wheel({ shiftKey: true, deltaX: 0, deltaY: 0 }));
    expect(getViewportState().zoom).toBe(1);
  });

  it("plain wheel pans without changing zoom", () => {
    __onWheelForTest(wheel({ deltaY: 100 }));
    const st = getViewportState();
    expect(st.zoom).toBe(1);
    expect(st.panY).toBe(-100);
  });
});
