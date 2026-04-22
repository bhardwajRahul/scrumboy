// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initModalOutsideClickClose } from "./modal-outside-click.js";

function installDialogPolyfill(): void {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  });
}

function makeDialog(params: {
  id: string;
  contentSelector: "legacy" | "explicit";
  optOut?: boolean;
}): { dialog: HTMLDialogElement; content: HTMLElement; outside: HTMLElement } {
  const dialog = document.createElement("dialog");
  dialog.id = params.id;
  if (params.optOut) dialog.setAttribute("data-no-outside-close", "");

  const content = document.createElement("div");
  if (params.contentSelector === "legacy") content.className = "dialog__form";
  else content.setAttribute("data-dialog-content-root", "");

  const insideBtn = document.createElement("button");
  insideBtn.id = `${params.id}-inside`;
  content.appendChild(insideBtn);

  dialog.appendChild(content);
  document.body.appendChild(dialog);

  const outside = document.createElement("button");
  outside.id = `${params.id}-outside`;
  document.body.appendChild(outside);

  dialog.showModal();
  return { dialog, content, outside };
}

function dispatchPointerAndClick(target: Element): void {
  target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("modal-outside-click", () => {
  beforeEach(() => {
    installDialogPolyfill();
    document.body.innerHTML = "";
    initModalOutsideClickClose();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("closes the topmost dialog when the outside click target is the dialog backdrop", () => {
    const { dialog } = makeDialog({ id: "d-legacy", contentSelector: "legacy" });
    dispatchPointerAndClick(dialog);
    expect(dialog.hasAttribute("open")).toBe(false);
  });

  it("does not close when the click lands inside the content box (legacy selector)", () => {
    const { dialog, content } = makeDialog({ id: "d-legacy-inside", contentSelector: "legacy" });
    dispatchPointerAndClick(content);
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("treats [data-dialog-content-root] as inside (explicit opt-in)", () => {
    const { dialog, content } = makeDialog({ id: "d-explicit", contentSelector: "explicit" });
    dispatchPointerAndClick(content);
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("still closes a [data-dialog-content-root] dialog on a true backdrop click", () => {
    const { dialog } = makeDialog({ id: "d-explicit-outside", contentSelector: "explicit" });
    dispatchPointerAndClick(dialog);
    expect(dialog.hasAttribute("open")).toBe(false);
  });

  it("never closes a dialog with data-no-outside-close (wall opt-out)", () => {
    const { dialog } = makeDialog({
      id: "d-optout",
      contentSelector: "explicit",
      optOut: true,
    });
    dispatchPointerAndClick(dialog);
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("does not close a dialog that became topmost AFTER pointerdown (mid-gesture modal)", () => {
    // Simulate wall drag-to-trash: a note drag starts (pointerdown on
    // something outside any dialog), and AFTER pointerup a confirm dialog
    // opens. The synthetic click fired at the original note element must not
    // treat the newly opened dialog as "outside" and dismiss it.
    const note = document.createElement("div");
    note.id = "note-surface";
    document.body.appendChild(note);

    note.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    const { dialog } = makeDialog({ id: "d-mid-gesture", contentSelector: "legacy" });
    note.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(dialog.hasAttribute("open")).toBe(true);
  });
});
