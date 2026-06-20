// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({ route: "boardBySlug" as string }));

vi.mock("../api.js", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("../router.js", () => ({
  navigate: vi.fn(),
}));

vi.mock("../utils.js", () => ({
  showToast: vi.fn(),
}));

vi.mock("../state/mutations.js", () => ({
  setProjectsTab: vi.fn(),
}));

vi.mock("../state/selectors.js", () => ({
  getAuthStatusAvailable: () => true,
  getBoard: () => ({ id: 1 }),
  getProjectsTab: () => "projects",
  getRoute: () => routeState.route,
  getUser: () => ({ id: 1 }),
}));

function installBaseDOM(): void {
  document.body.innerHTML = `
    <dialog id="settingsDialog"></dialog>
    <dialog id="todoDialog"></dialog>
  `;
}

function visibleWallBtn(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.id = "wallBtn";
  document.body.appendChild(btn);
  return btn;
}

describe("openWall keybinding", () => {
  beforeEach(() => {
    vi.resetModules();
    installBaseDOM();
    localStorage.clear();
    routeState.route = "boardBySlug";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("executeAction clicks visible #wallBtn on board view", async () => {
    const btn = visibleWallBtn();
    const clickSpy = vi.spyOn(btn, "click");
    const keybindings = await import("./keybindings.js");

    keybindings.executeAction("openWall");

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("executeAction no-ops when #wallBtn is absent", async () => {
    const clickSpy = vi.spyOn(HTMLButtonElement.prototype, "click");
    const keybindings = await import("./keybindings.js");

    expect(() => keybindings.executeAction("openWall")).not.toThrow();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("executeAction no-ops when #wallBtn is hidden", async () => {
    const btn = visibleWallBtn();
    Object.defineProperty(btn, "offsetParent", { get: () => null, configurable: true });
    const clickSpy = vi.spyOn(btn, "click");
    const keybindings = await import("./keybindings.js");

    keybindings.executeAction("openWall");

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("onGlobalKeydown with w clicks visible #wallBtn on board route", async () => {
    const btn = visibleWallBtn();
    const clickSpy = vi.spyOn(btn, "click");
    const keybindings = await import("./keybindings.js");
    keybindings.initKeybindings({ openSettings: vi.fn() });

    document.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyW", key: "w", bubbles: true, cancelable: true }),
    );

    expect(clickSpy).toHaveBeenCalledOnce();
  });
});
