// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enCatalog = {
  "settings.language.selectLabel": "Language",
};

const deCatalog = {
  "settings.language.selectLabel": "Sprache",
};

const zhCatalog = {
  "settings.language.selectLabel": "语言",
};

function loader(catalogs: Record<string, Record<string, string>>) {
  return vi.fn(async (locale: "en" | "de" | "zh") => catalogs[locale]);
}

async function flushPromises(count = 8): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve();
  }
}

async function setupI18n(locale: "en" | "de" = "en") {
  const i18n = await import("./index.js");
  await i18n.initI18n({
    locale,
    loadLocale: loader({ en: enCatalog, de: deCatalog }),
  });
  return i18n;
}

function localeCookieValue(): string | null {
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("scrumboy.locale="))
    ?.slice("scrumboy.locale=".length) ?? null;
}

function clearLocaleCookieForTests(): void {
  document.cookie = "scrumboy.locale=; Path=/; Max-Age=0";
}

describe("locale-select custom picker", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
    localStorage.clear();
    clearLocaleCookieForTests();
  });

  afterEach(async () => {
    const i18n = await import("./index.js");
    i18n.resetI18nForTests();
    document.body.innerHTML = "";
    localStorage.clear();
    clearLocaleCookieForTests();
    vi.restoreAllMocks();
  });

  it("opens and closes on button click and outside click", async () => {
    await setupI18n("en");
    const localeSelect = await import("./locale-select.js");
    document.body.innerHTML = localeSelect.renderPublicLocaleSelectHTML({ id: "testLocaleSelect" });
    const button = document.getElementById("testLocaleSelect") as HTMLButtonElement;
    localeSelect.bindPublicLocaleSelect(button);

    const list = button.closest(".locale-picker")?.querySelector(".locale-picker__list") as HTMLUListElement;
    expect(list.hidden).toBe(true);

    button.click();
    expect(list.hidden).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");

    document.body.click();
    expect(list.hidden).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("selects a locale from the listbox and persists it", async () => {
    const i18n = await setupI18n("en");
    const localeSelect = await import("./locale-select.js");
    document.body.innerHTML = localeSelect.renderPublicLocaleSelectHTML({ id: "testLocaleSelect" });
    const button = document.getElementById("testLocaleSelect") as HTMLButtonElement;
    localeSelect.bindPublicLocaleSelect(button);

    button.click();
    const deOption = button.closest(".locale-picker")?.querySelector('[role="option"][data-locale="de"]') as HTMLElement;
    deOption.click();
    await flushPromises();

    expect(i18n.getLocale()).toBe("de");
    expect(localStorage.getItem(i18n.LOCALE_STORAGE_KEY)).toBe("de");
    expect(localeCookieValue()).toBe("de");
    expect(button.querySelector(".locale-picker__label")?.textContent).toBe("Deutsch");
    expect((button.querySelector(".locale-picker__flag") as HTMLImageElement).getAttribute("src")).toBe("/assets/flags/de.svg");
  });

  it("supports keyboard navigation and Enter to select", async () => {
    const i18n = await import("./index.js");
    await i18n.initI18n({
      locale: "en",
      loadLocale: loader({ en: enCatalog, de: deCatalog, zh: zhCatalog }),
    });
    const localeSelect = await import("./locale-select.js");
    document.body.innerHTML = localeSelect.renderPublicLocaleSelectHTML({ id: "testLocaleSelect" });
    const button = document.getElementById("testLocaleSelect") as HTMLButtonElement;
    localeSelect.bindPublicLocaleSelect(button);

    button.focus();
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    const list = button.closest(".locale-picker")?.querySelector(".locale-picker__list") as HTMLUListElement;
    expect(list.hidden).toBe(false);

    button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    const highlighted = list.querySelector(".locale-picker__option--highlight");
    expect(highlighted?.getAttribute("data-locale")).toBe("zh");

    button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flushPromises();

    expect(i18n.getLocale()).toBe("zh");
    expect(localStorage.getItem(i18n.LOCALE_STORAGE_KEY)).toBe("zh");
    expect(localeCookieValue()).toBe("zh");
    expect(button.querySelector(".locale-picker__label")?.textContent).toBe("简体中文");
    expect((button.querySelector(".locale-picker__flag") as HTMLImageElement).getAttribute("src")).toBe("/assets/flags/cn.svg");
    expect(list.hidden).toBe(true);
  });

  it("syncPublicLocaleSelect refreshes aria-label and selected option", async () => {
    const i18n = await setupI18n("en");
    const localeSelect = await import("./locale-select.js");
    document.body.innerHTML = localeSelect.renderPublicLocaleSelectHTML({ id: "testLocaleSelect" });
    const button = document.getElementById("testLocaleSelect") as HTMLButtonElement;
    localeSelect.bindPublicLocaleSelect(button);

    await i18n.setLocale("de");
    localeSelect.syncPublicLocaleSelect(button);

    expect(button.getAttribute("aria-label")).toBe("Sprache");
    expect(button.querySelector(".locale-picker__label")?.textContent).toBe("Deutsch");
    expect(
      button.closest(".locale-picker")?.querySelector('[role="option"][aria-selected="true"]')?.getAttribute("data-locale"),
    ).toBe("de");
  });

  it("keeps absolute positioning for non-auth pickers", async () => {
    await setupI18n("en");
    const localeSelect = await import("./locale-select.js");
    document.body.innerHTML = localeSelect.renderPublicLocaleSelectHTML({ id: "testLocaleSelect" });
    const button = document.getElementById("testLocaleSelect") as HTMLButtonElement;
    localeSelect.bindPublicLocaleSelect(button);

    const list = button.closest(".locale-picker")?.querySelector(".locale-picker__list") as HTMLUListElement;
    button.click();

    expect(list.hidden).toBe(false);
    expect(list.style.position).toBe("");
    expect(list.style.top).toBe("");
    expect(list.style.left).toBe("");
    expect(list.style.right).toBe("");
    expect(list.style.minWidth).toBe("");
    expect(list.style.zIndex).toBe("");
  });

  it("pins the open auth-scoped list with fixed positioning and clears inline styles on close", async () => {
    const i18n = await import("./index.js");
    await setupI18n("en");
    const localeSelect = await import("./locale-select.js");
    document.body.innerHTML = `
      <div class="page page--auth">
        ${localeSelect.renderPublicLocaleSelectHTML({ id: "testLocaleSelect", className: "auth-locale-select" })}
      </div>
    `;
    const button = document.getElementById("testLocaleSelect") as HTMLButtonElement;
    localeSelect.bindPublicLocaleSelect(button);

    const list = button.closest(".locale-picker")?.querySelector(".locale-picker__list") as HTMLUListElement;
    button.click();

    expect(list.hidden).toBe(false);
    expect(list.style.position).toBe("fixed");
    expect(list.style.top).toMatch(/px$/);
    expect(list.style.left || list.style.right).toMatch(/px$/);
    expect(list.style.minWidth).toMatch(/px$/);
    expect(list.style.zIndex).toBe("1000");
    expect(list.querySelectorAll('[role="option"]').length).toBe(i18n.PUBLIC_LOCALES.length);

    document.body.click();

    expect(list.hidden).toBe(true);
    expect(list.style.position).toBe("");
    expect(list.style.top).toBe("");
    expect(list.style.left).toBe("");
    expect(list.style.right).toBe("");
    expect(list.style.minWidth).toBe("");
    expect(list.style.zIndex).toBe("");
  });

  it("renders all public locales when an auth-scoped picker opens inside an overflow:hidden wrapper", async () => {
    const i18n = await import("./index.js");
    await setupI18n("en");
    const localeSelect = await import("./locale-select.js");

    const wrapper = document.createElement("div");
    wrapper.className = "page page--auth";
    wrapper.style.overflow = "hidden";
    document.body.appendChild(wrapper);
    wrapper.innerHTML = localeSelect.renderPublicLocaleSelectHTML({
      id: "testLocaleSelect",
      className: "auth-locale-select",
    });

    const button = document.getElementById("testLocaleSelect") as HTMLButtonElement;
    localeSelect.bindPublicLocaleSelect(button);

    const list = button.closest(".locale-picker")?.querySelector(".locale-picker__list") as HTMLUListElement;
    button.click();

    expect(list.style.position).toBe("fixed");
    expect(list.querySelectorAll('[role="option"]').length).toBe(i18n.PUBLIC_LOCALES.length);
  });
});
