// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../dialogs/bulk-edit.js", () => ({
  initBulkEditDialog: vi.fn(),
  openBulkEditDialog: vi.fn(),
}));

const enCatalog = {
  "board.selection.multiple": "Edit {count} selected",
  "board.selection.single": "Edit 1 selected",
};

const deCatalog = {
  "board.selection.multiple": "{count} ausgew\u00e4hlte Eintr\u00e4ge bearbeiten",
  "board.selection.single": "1 ausgew\u00e4hlten Eintrag bearbeiten",
};

async function loadSelectionModule() {
  return await import("./board-selection.js");
}

describe("board selection i18n", () => {
  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = `
      <div id="bulkEditBar" style="display: none"></div>
      <button id="bulkEditBarBtn" type="button"></button>
      <button data-todo-id="1" class="card"></button>
      <button data-todo-id="2" class="card"></button>
    `;
    const i18n = await import("../i18n/index.js");
    await i18n.initI18n({
      locale: "en",
      loadLocale: vi.fn(async (locale: "en" | "de" | "pseudo") => (locale === "de" ? deCatalog : enCatalog)),
    });
  });

  afterEach(async () => {
    const i18n = await import("../i18n/index.js");
    i18n.resetI18nForTests();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders English and German singular/plural selection copy", async () => {
    const i18n = await import("../i18n/index.js");
    const selection = await loadSelectionModule();

    expect(selection.__selectionLabelForTest(1)).toBe("Edit 1 selected");
    expect(selection.__selectionLabelForTest(3)).toBe("Edit 3 selected");

    await i18n.setLocale("de");

    expect(selection.__selectionLabelForTest(1)).toBe("1 ausgew\u00e4hlten Eintrag bearbeiten");
    expect(selection.__selectionLabelForTest(3)).toBe("3 ausgew\u00e4hlte Eintr\u00e4ge bearbeiten");
  });

  it("keeps the bulk edit bar hidden for a single selected todo", async () => {
    const selection = await loadSelectionModule();

    selection.clearTodoMultiSelection();
    selection.toggleTodoSelection(1);

    expect((document.getElementById("bulkEditBar") as HTMLElement).style.display).toBe("none");
    expect(document.getElementById("bulkEditBarBtn")?.textContent).toBe("");
  });

  it("shows the bulk edit bar for two selected todos", async () => {
    const selection = await loadSelectionModule();

    selection.clearTodoMultiSelection();
    selection.toggleTodoSelection(1);
    selection.toggleTodoSelection(2);

    expect((document.getElementById("bulkEditBar") as HTMLElement).style.display).toBe("");
    expect(document.getElementById("bulkEditBarBtn")?.textContent).toBe("Edit 2 selected");
  });
});
