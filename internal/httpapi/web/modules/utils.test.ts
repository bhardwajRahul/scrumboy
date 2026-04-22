// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { confirmDelete, showConfirmDialog } from "./utils.js";

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

describe("confirmDelete", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    installDialogPolyfill();
  });

  it("uses default delete title and label", async () => {
    const resultPromise = confirmDelete("Delete this project?");
    const title = document.querySelector(".dialog__title");
    const confirmBtn = document.getElementById("confirmDialogConfirm");
    const message = document.querySelector(".dialog__content p");
    if (!(title instanceof HTMLElement)) throw new Error("missing confirm title");
    if (!(confirmBtn instanceof HTMLButtonElement)) throw new Error("missing confirm button");
    if (!(message instanceof HTMLElement)) throw new Error("missing confirm message");

    expect(title.textContent).toBe("Delete");
    expect(confirmBtn.textContent).toBe("Delete");
    expect(message.textContent).toBe("Delete this project?");

    confirmBtn.click();
    await expect(resultPromise).resolves.toBe(true);
  });

  it("supports custom title/label and resolves false on cancel", async () => {
    const resultPromise = confirmDelete({
      message: "Delete this user?",
      title: "Delete User",
      confirmLabel: "Yes, delete",
    });
    const title = document.querySelector(".dialog__title");
    const confirmBtn = document.getElementById("confirmDialogConfirm");
    const cancelBtn = document.getElementById("confirmDialogCancel");
    if (!(title instanceof HTMLElement)) throw new Error("missing custom title");
    if (!(confirmBtn instanceof HTMLButtonElement)) throw new Error("missing custom confirm button");
    if (!(cancelBtn instanceof HTMLButtonElement)) throw new Error("missing cancel button");

    expect(title.textContent).toBe("Delete User");
    expect(confirmBtn.textContent).toBe("Yes, delete");

    cancelBtn.click();
    await expect(resultPromise).resolves.toBe(false);
  });
});

describe("showConfirmDialog lifecycle", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    installDialogPolyfill();
  });

  it("resolves true exactly once even on double-click confirm", async () => {
    const resultPromise = showConfirmDialog("Proceed?");
    const confirmBtn = document.getElementById("confirmDialogConfirm") as HTMLButtonElement;
    confirmBtn.click();
    confirmBtn.click();
    await expect(resultPromise).resolves.toBe(true);
    // Dialog DOM cleaned up after settle.
    expect(document.getElementById("confirmDialogConfirm")).toBeNull();
  });

  it("resolves false when the close (x) button is pressed", async () => {
    const resultPromise = showConfirmDialog("Proceed?");
    const closeBtn = document.getElementById("confirmDialogClose") as HTMLButtonElement;
    closeBtn.click();
    await expect(resultPromise).resolves.toBe(false);
  });

  it("resolves false when the dialog is closed externally (regression for drag-to-trash)", async () => {
    const resultPromise = showConfirmDialog("Proceed?");
    const dialog = document.querySelector("dialog") as HTMLDialogElement;
    // Simulate a global outside-click helper calling close() without ever
    // interacting with any button inside the confirm dialog.
    dialog.close();
    await expect(resultPromise).resolves.toBe(false);
  });

  it("resolves false once and ignores subsequent close() calls", async () => {
    const resultPromise = showConfirmDialog("Proceed?");
    const dialog = document.querySelector("dialog") as HTMLDialogElement;
    dialog.close();
    // Second programmatic close should not dispatch a second event (polyfill
    // guards against double-close) and the Promise must already be settled.
    dialog.close();
    await expect(resultPromise).resolves.toBe(false);
  });

  it("resolves false when the native cancel (ESC) event fires", async () => {
    const resultPromise = showConfirmDialog("Proceed?");
    const dialog = document.querySelector("dialog") as HTMLDialogElement;
    dialog.dispatchEvent(new Event("cancel"));
    dialog.close();
    await expect(resultPromise).resolves.toBe(false);
  });
});
