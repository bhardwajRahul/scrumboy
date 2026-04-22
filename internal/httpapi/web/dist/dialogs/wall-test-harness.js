// Shared test helpers for the wall feature's interaction tests.
//
// These helpers are **non-hoisted** by design: any `vi.hoisted` / `vi.mock`
// call must stay in the test file itself so that vitest wires the module
// graph correctly. Only DOM / event-dispatch utilities live here.
export function installDialogPolyfill() {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
        configurable: true,
        value() {
            this.open = true;
        },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
        configurable: true,
        value() {
            this.open = false;
            this.dispatchEvent(new Event("close"));
        },
    });
}
export function setupWallDom(refs) {
    document.body.innerHTML = "";
    refs.wallDialogEl.innerHTML = "";
    refs.wallSurfaceEl.innerHTML = "";
    refs.wallDialogEl.appendChild(refs.wallSurfaceEl);
    document.body.appendChild(refs.wallDialogEl);
    document.body.appendChild(refs.closeWallBtnEl);
    document.body.appendChild(refs.wallTrashEl);
}
export function makeNote(overrides = {}) {
    return {
        id: "n1",
        x: 20,
        y: 20,
        width: 160,
        height: 100,
        color: "#B0E0E6",
        text: "Hello",
        version: 1,
        ...overrides,
    };
}
export function makeWallDoc(notes = [makeNote()], edges = []) {
    return { notes, edges, version: 1 };
}
/** Fire a generic event with pointer/mouse-like properties. */
export function dispatchPointer(target, type, extra = {}) {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(ev, {
        clientX: 30,
        clientY: 30,
        button: 0,
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        ...extra,
    });
    target.dispatchEvent(ev);
}
/** Fire a real MouseEvent (used for contextmenu / dblclick). */
export function dispatchMouse(target, type, extra = {}) {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...extra }));
}
/** Advance microtasks so `await apiFetch(...)` chains can resolve. */
export async function flushPromises(count = 8) {
    for (let i = 0; i < count; i += 1) {
        await Promise.resolve();
    }
}
/** Advance one or more `requestAnimationFrame` ticks manually. */
export async function flushRaf(frames = 1) {
    for (let i = 0; i < frames; i += 1) {
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
}
/** Build a DOMRect-like rect for `getBoundingClientRect` stubs. */
export function rect(left, top, width, height) {
    return {
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        x: left,
        y: top,
        toJSON() { },
    };
}
export function apiFetchRouter(matchers, fallback = {}) {
    return async (url, init) => {
        for (const m of matchers) {
            const result = m(url, init);
            if (result !== undefined)
                return result;
        }
        return fallback;
    };
}
