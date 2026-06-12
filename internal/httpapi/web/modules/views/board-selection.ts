import { initBulkEditDialog, openBulkEditDialog } from '../dialogs/bulk-edit.js';
import { I18N_LOCALE_CHANGED, t } from '../i18n/index.js';

let selectedTodoIds = new Set<number>();
let bulkEditUiInitialized = false;

function selectionLabel(count: number): string {
  return count === 1
    ? t("board.selection.single")
    : t("board.selection.multiple", { count });
}

export function __selectionLabelForTest(count: number): string {
  return selectionLabel(count);
}

export function getSelectedTodoIds(): Set<number> {
  return selectedTodoIds;
}

export function clearTodoMultiSelection(): void {
  selectedTodoIds.clear();
  const bar = document.getElementById("bulkEditBar");
  const btn = document.getElementById("bulkEditBarBtn");
  if (bar) bar.style.display = "none";
  if (btn) btn.textContent = "";
  document.querySelectorAll(".board .card--selected").forEach((el) => el.classList.remove("card--selected"));
}

export function updateBulkEditBar(): void {
  const bar = document.getElementById("bulkEditBar");
  const btn = document.getElementById("bulkEditBarBtn");
  if (!bar || !btn) return;
  const n = selectedTodoIds.size;
  if (n >= 2) {
    bar.style.display = "";
    btn.textContent = selectionLabel(n);
  } else {
    bar.style.display = "none";
    btn.textContent = "";
  }
}

export function toggleTodoSelection(id: number): void {
  if (selectedTodoIds.has(id)) selectedTodoIds.delete(id);
  else selectedTodoIds.add(id);
  updateBulkEditBar();
  const card = document.querySelector(`[data-todo-id="${id}"]`);
  if (card) card.classList.toggle("card--selected", selectedTodoIds.has(id));
}

export function ensureBulkEditUi(opts: {
  getRole: () => string | null;
  syncSelectionClasses: (selectedIds: ReadonlySet<number>) => void;
}): void {
  if (bulkEditUiInitialized) return;
  bulkEditUiInitialized = true;
  initBulkEditDialog(() => {
    clearTodoMultiSelection();
    updateBulkEditBar();
  });
  document.addEventListener(I18N_LOCALE_CHANGED, () => {
    updateBulkEditBar();
  });
  const barBtn = document.getElementById("bulkEditBarBtn");
  barBtn?.addEventListener("click", () => {
    void openBulkEditDialog(Array.from(selectedTodoIds), {
      role: opts.getRole(),
      onPruned: (remaining) => {
        selectedTodoIds = new Set(remaining);
        updateBulkEditBar();
        opts.syncSelectionClasses(selectedTodoIds);
      },
    });
  });
}
