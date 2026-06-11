// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Board } from "../types.js";

const apiFetchMock = vi.hoisted(() => vi.fn());
const initDnDMock = vi.hoisted(() => vi.fn());
const setDnDColumnsMock = vi.hoisted(() => vi.fn());

vi.mock("../dom/elements.js", () => ({
  app: document.body,
  settingsDialog: document.createElement("dialog"),
}));

vi.mock("../api.js", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("../members-cache.js", () => ({
  fetchProjectMembers: vi.fn(async () => []),
  invalidateMembersCache: vi.fn(),
}));

vi.mock("../router.js", () => ({
  navigate: vi.fn(),
}));

vi.mock("../utils.js", () => ({
  escapeHTML: (s: string) =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;"),
  showToast: vi.fn(),
  renderAvatarContent: vi.fn(() => ""),
  renderUserAvatar: vi.fn(() => ""),
  processImageFile: vi.fn(),
  confirmDelete: vi.fn(),
  showConfirmDialog: vi.fn(),
  showPromptDialog: vi.fn(),
  sanitizeHexColor: (color?: string, fallback?: string) =>
    typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) ? color : (fallback ?? null),
  isAnonymousBoard: (board: Board | null) => !!(board?.project?.expiresAt && board.project.creatorUserId == null),
  isTemporaryBoard: (board: Board | null) => !!board?.project?.expiresAt,
}));

vi.mock("../field-tooltips.js", () => ({
  FIELD_TOOLTIPS: {},
  titleAttr: () => "",
  fieldLabelHTML: (label: string) => `<div class="field__label">${label}</div>`,
}));

vi.mock("../dialogs/todo.js", () => ({
  openTodoDialog: vi.fn(),
}));

vi.mock("../dialogs/settings.js", () => ({
  renderSettingsModal: vi.fn(),
}));

vi.mock("../features/drag-drop.js", () => ({
  initDnD: initDnDMock,
  setDnDColumns: setDnDColumnsMock,
  columnsSpec: () => [
    { key: "backlog", title: "Backlog" },
    { key: "done", title: "Done" },
  ],
  dragInProgress: false,
  dragJustEnded: false,
}));

vi.mock("../features/context-menu-button.js", () => ({
  setContextMenuStatus: vi.fn(),
  setContextMenuRole: vi.fn(),
}));

vi.mock("../events.js", () => ({
  on: vi.fn(),
  off: vi.fn(),
}));

vi.mock("../realtime/guard.js", () => ({
  recordLocalMutation: vi.fn(),
}));

vi.mock("../orchestration/board-refresh.js", () => ({
  registerBoardRefresher: vi.fn(),
  registerSprintsRefresher: vi.fn(),
  invalidateBoard: vi.fn(),
  getBoardLimitPerLaneFloor: () => 20,
  resetBoardLimitPerLaneFloor: vi.fn(),
  setBoardLimitPerLaneFloor: vi.fn(),
}));

vi.mock("../sprints.js", () => ({
  normalizeSprints: vi.fn(() => []),
}));

vi.mock("./mobile-lane-tabs.js", () => ({
  applyMobileLaneTabStyles: vi.fn(),
  buildMobileTabsInnerHtml: vi.fn(() => ""),
  mobileLaneTabStyleAttrForHtml: vi.fn(() => ({ tab: "", drop: "" })),
}));

vi.mock("./board-realtime.js", () => ({
  attachBoardInteractionListeners: vi.fn(),
  clearPendingRealtimeRefresh: vi.fn(),
  connectBoardEvents: vi.fn(),
  debugLog: vi.fn(),
  disconnectBoardEvents: vi.fn(),
  markBoardLoadSucceeded: vi.fn(),
  runWhileTodoDialogOpening: vi.fn(async (fn: () => unknown) => fn()),
  setInitialBoardLoadInFlight: vi.fn(),
}));

vi.mock("./board-command-capabilities.js", () => ({
  canShowVoiceCommands: vi.fn(() => false),
}));

vi.mock("../core/voiceflow-preferences.js", () => ({
  getVoiceFlowEnabledPreference: vi.fn(() => false),
}));

vi.mock("../dialogs/bulk-edit.js", () => ({
  initBulkEditDialog: vi.fn(),
  openBulkEditDialog: vi.fn(),
}));

const enCatalog = {
  "board.actions.changeProjectImage": "Change project image",
  "board.actions.clearSearch": "Clear search",
  "board.actions.deleteProject": "Delete project",
  "board.actions.manageMembers": "Members",
  "board.actions.newTodo": "New Todo",
  "board.actions.openWall": "Open wall",
  "board.actions.renameProject": "Rename",
  "board.actions.settings": "Settings",
  "board.backToProjects": "\u2190 Projects",
  "board.filters.all": "All",
  "board.filters.label": "Tags:",
  "board.filters.next": "Next tags",
  "board.filters.previous": "Previous tags",
  "board.filters.scheduled": "Scheduled",
  "board.filters.unscheduled": "Unscheduled",
  "board.loadMore": "Load more",
  "board.noResults": "No todos found matching \"{search}\"",
  "board.search.placeholder.desktop": "Search todos...",
  "board.search.placeholder.mobile": "Search",
  "board.todo.dragToReorder": "Drag to reorder",
};

const pseudoCatalog = Object.fromEntries(
  Object.entries(enCatalog).map(([key, value]) => [key, `[!! ${value} !!]`]),
) as typeof enCatalog;

function board(): Board {
  return {
    project: {
      id: 1,
      name: "Alpha",
      slug: "alpha",
      dominantColor: "#123456",
      creatorUserId: 1,
    },
    tags: [],
    columnOrder: [
      { key: "backlog", name: "Backlog", color: "#9ca3af", isDone: false },
      { key: "done", name: "Done", color: "#ef4444", isDone: true },
    ],
    columns: {
      backlog: [],
      done: [],
    },
  };
}

async function flushPromises(count = 6): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve();
  }
}

describe("board i18n locale switching", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
    localStorage.clear();
    window.history.replaceState({}, "", "/alpha?search=needle");
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue(null);
    initDnDMock.mockReset();
    setDnDColumnsMock.mockReset();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(async () => {
    const i18n = await import("../i18n/index.js");
    i18n.resetI18nForTests();
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("re-renders visible board chrome from cached board state after locale change without refetching", async () => {
    const i18n = await import("../i18n/index.js");
    await i18n.initI18n({
      locale: "en",
      loadLocale: vi.fn(async (locale: "en" | "pseudo") => (locale === "pseudo" ? pseudoCatalog : enCatalog)),
    });
    const mod = await import("./board.js");

    await mod.renderBoard("alpha", "", "needle", null, null, null, { prefetchedBoard: board() });
    await flushPromises();
    apiFetchMock.mockClear();

    expect(document.getElementById("backBtn")?.textContent).toBe("\u2190 Projects");
    expect((document.getElementById("searchInput") as HTMLInputElement | null)?.getAttribute("placeholder")).toBe("Search todos...");
    expect(document.querySelector(".filters__label")?.textContent).toBe("Tags:");
    expect(document.querySelector("[data-tag='']")?.textContent).toBe("All");
    expect(document.querySelector(".no-results")?.textContent).toBe("No todos found matching \"needle\"");

    await i18n.setLocale("pseudo");
    await flushPromises();

    expect(document.getElementById("backBtn")?.textContent).toBe("[!! \u2190 Projects !!]");
    expect((document.getElementById("searchInput") as HTMLInputElement | null)?.getAttribute("placeholder")).toBe("[!! Search todos... !!]");
    expect(document.querySelector(".filters__label")?.textContent).toBe("[!! Tags: !!]");
    expect(document.querySelector("[data-tag='']")?.textContent).toBe("[!! All !!]");
    expect(document.querySelector(".no-results")?.textContent).toBe("[!! No todos found matching \"needle\" !!]");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
