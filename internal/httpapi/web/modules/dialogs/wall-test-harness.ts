// Shared test helpers for the wall feature's interaction tests.
//
// These helpers are **non-hoisted** by design: any `vi.hoisted` / `vi.mock`
// call must stay in the test file itself so that vitest wires the module
// graph correctly. Only DOM / event-dispatch utilities live here.

export function installDialogPolyfill(): void {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    },
  });
}

export interface WallDomRefs {
  wallDialogEl: HTMLDialogElement;
  wallSurfaceEl: HTMLElement;
  closeWallBtnEl: HTMLElement;
  wallTrashEl: HTMLElement;
}

export function setupWallDom(refs: WallDomRefs): void {
  document.body.innerHTML = "";
  refs.wallDialogEl.innerHTML = "";
  refs.wallSurfaceEl.innerHTML = "";
  refs.wallDialogEl.appendChild(refs.wallSurfaceEl);
  document.body.appendChild(refs.wallDialogEl);
  document.body.appendChild(refs.closeWallBtnEl);
  document.body.appendChild(refs.wallTrashEl);
}

export interface TestNote {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text: string;
  version: number;
}

export interface TestEdge {
  id: string;
  from: string;
  to: string;
}

export function makeNote(overrides: Partial<TestNote> = {}): TestNote {
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

export function makeWallDoc(notes: TestNote[] = [makeNote()], edges: TestEdge[] = []) {
  return { notes, edges, version: 1 };
}

/** Fire a generic event with pointer/mouse-like properties. */
export function dispatchPointer(
  target: EventTarget,
  type: string,
  extra: Record<string, unknown> = {},
): void {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>;
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
export function dispatchMouse(
  target: EventTarget,
  type: string,
  extra: MouseEventInit = {},
): void {
  target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, ...extra }),
  );
}

/** Advance microtasks so `await apiFetch(...)` chains can resolve. */
export async function flushPromises(count = 8): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve();
  }
}

/** Advance one or more `requestAnimationFrame` ticks manually. */
export async function flushRaf(frames = 1): Promise<void> {
  for (let i = 0; i < frames; i += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

/** Build a DOMRect-like rect for `getBoundingClientRect` stubs. */
export function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON() { /* noop */ },
  } as DOMRect;
}

/**
 * URL-pattern router factory for the `apiFetch` mock. Caller supplies a list
 * of matchers and a fallback; each scenario asks the router to return the
 * desired response shape.
 */
export type ApiMatcher = (url: string, init?: RequestInit) => unknown | undefined;

export function apiFetchRouter(matchers: ApiMatcher[], fallback: unknown = {}):
  (url: string, init?: RequestInit) => Promise<unknown> {
  return async (url, init) => {
    for (const m of matchers) {
      const result = m(url, init);
      if (result !== undefined) return result;
    }
    return fallback;
  };
}
