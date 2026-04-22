/**
 * Close the topmost open <dialog> on outside interaction.
 *
 * Invariants:
 *   - Only the interactive content box counts as "inside". That box is found
 *     via the explicit `[data-dialog-content-root]` opt-in attribute, falling
 *     back to the legacy `.dialog__form, .dialog__content` selectors for
 *     backward compatibility with dialogs that haven't been updated yet.
 *   - A dialog marked with `data-no-outside-close` opts out of the close
 *     behavior entirely (e.g. the fullscreen wall dialog, which has no visible
 *     backdrop to click on).
 *   - The <dialog> node itself is treated as outside (backdrop / dimmed chrome),
 *     including when the click target is the dialog node - because
 *     Node.contains() is true for the node itself, dialog.contains(dialog) would
 *     wrongly suppress close without an explicit `target === dialog` branch.
 *
 * Gesture guards:
 *   - `pointerStartedInsideContent`: if the gesture started inside the content
 *     box, do not close on click (e.g. drag from inside to outside).
 *   - `topAtPointerDown`: if a newer dialog became topmost during the gesture
 *     (e.g. drag-to-trash opens a confirm dialog after pointerup), the synthetic
 *     `click` fired at the original target must not be treated as "outside" the
 *     newly opened dialog.
 */

let pointerStartedInsideContent = false;
let topAtPointerDown: HTMLDialogElement | null = null;
let initialized = false;

function getTopOpenDialog(): HTMLDialogElement | null {
  const openDialogs = Array.from(document.querySelectorAll("dialog[open]")) as HTMLDialogElement[];
  if (openDialogs.length === 0) return null;
  return openDialogs[openDialogs.length - 1];
}

function shouldIgnoreDialog(dialog: HTMLDialogElement): boolean {
  return dialog.hasAttribute("data-no-outside-close");
}

function getDialogContentBox(dialog: HTMLDialogElement): Element | null {
  return (
    dialog.querySelector("[data-dialog-content-root]") ||
    dialog.querySelector(".dialog__form, .dialog__content")
  );
}

function onPointerDown(ev: PointerEvent): void {
  const t = ev.target;
  topAtPointerDown = getTopOpenDialog();
  if (t == null || !(t instanceof Node)) {
    pointerStartedInsideContent = false;
    return;
  }
  const top = topAtPointerDown;
  if (!top) {
    pointerStartedInsideContent = false;
    return;
  }
  const content = getDialogContentBox(top);
  if (!content) {
    pointerStartedInsideContent = false;
    return;
  }
  pointerStartedInsideContent = content.contains(t);
}

function onDocumentClick(ev: MouseEvent): void {
  if (pointerStartedInsideContent) return;

  const t = ev.target;
  if (t == null || !(t instanceof Node)) return;

  const top = getTopOpenDialog();
  if (!top) return;
  if (shouldIgnoreDialog(top)) return;
  // A dialog opened during this gesture (e.g. a confirm after drag-release).
  // Do not treat the follow-up synthetic click as "outside" the new topmost.
  if (topAtPointerDown !== top) return;

  const content = getDialogContentBox(top);
  if (!content) return;

  if (t === top) {
    top.close();
    return;
  }
  if (content.contains(t)) {
    return;
  }
  top.close();
}

export function initModalOutsideClickClose(): void {
  if (initialized) return;
  initialized = true;
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("click", onDocumentClick, true);
}
