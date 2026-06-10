// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

const enCatalog = {
  "test.shell": "Shell text",
};

const pseudoCatalog = {
  "test.shell": "[!! Shell text !!]",
};

async function loadModules() {
  vi.resetModules();
  const i18n = await import("./index.js");
  const qa = await import("./qa.js");
  return { i18n, qa };
}

function loader(catalogs: Record<string, Record<string, string>>) {
  return vi.fn(async (locale: "en" | "de" | "pseudo") => catalogs[locale]);
}

describe("i18n pseudo QA helper", () => {
  afterEach(async () => {
    const i18n = await import("./index.js");
    i18n.resetI18nForTests();
    delete window.scrumboyI18nQa;
    document.body.innerHTML = "";
    document.documentElement.lang = "en";
    document.documentElement.removeAttribute("data-locale");
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("allows installation only for local hosts or test environments", async () => {
    const { qa } = await loadModules();

    expect(qa.shouldInstallI18nQa({ nodeEnv: "production", location: { hostname: "localhost" } })).toBe(true);
    expect(qa.shouldInstallI18nQa({ nodeEnv: "production", location: { hostname: "127.0.0.1" } })).toBe(true);
    expect(qa.shouldInstallI18nQa({ nodeEnv: "production", location: { hostname: "::1" } })).toBe(true);
    expect(qa.shouldInstallI18nQa({ nodeEnv: "production", location: { hostname: "[::1]" } })).toBe(true);
    expect(qa.shouldInstallI18nQa({ nodeEnv: "test", location: { hostname: "scrumboy.example" } })).toBe(true);
    expect(qa.shouldInstallI18nQa({ nodeEnv: "production", location: { hostname: "scrumboy.example" } })).toBe(false);
  });

  it("does not install the global helper for a production-like non-local host", async () => {
    const { qa } = await loadModules();
    const target = { location: { hostname: "scrumboy.example" }, localStorage };

    const helper = qa.installI18nQa({ target, nodeEnv: "production" });

    expect(helper).toBeNull();
    expect(target.scrumboyI18nQa).toBeUndefined();
  });

  it("installs the global helper for local hosts", async () => {
    const { qa } = await loadModules();
    const target = { location: { hostname: "localhost" }, localStorage };

    const helper = qa.installI18nQa({ target, nodeEnv: "production" });

    expect(helper).not.toBeNull();
    expect(target.scrumboyI18nQa).toBe(helper);
  });

  it("enables pseudo through setLocale and persists the existing locale preference", async () => {
    const { i18n, qa } = await loadModules();
    await i18n.initI18n({ locale: "en", loadLocale: loader({ en: enCatalog, pseudo: pseudoCatalog }) });
    const events: string[] = [];
    document.addEventListener(i18n.I18N_LOCALE_CHANGED, ((event: CustomEvent<{ locale: string }>) => {
      events.push(event.detail.locale);
    }) as EventListener);
    const helper = qa.installI18nQa({
      target: window,
      storage: localStorage,
      location: { hostname: "localhost" },
      nodeEnv: "production",
    })!;

    await helper.enablePseudo();
    await helper.enablePseudo();

    expect(helper.getLocale()).toBe("pseudo");
    expect(localStorage.getItem(i18n.LOCALE_STORAGE_KEY)).toBe("pseudo");
    expect(events).toEqual(["pseudo"]);
  });

  it("returns to English and clears the stored locale preference", async () => {
    const { i18n, qa } = await loadModules();
    await i18n.initI18n({ locale: "en", loadLocale: loader({ en: enCatalog, pseudo: pseudoCatalog }) });
    const helper = qa.installI18nQa({
      target: window,
      storage: localStorage,
      location: { hostname: "localhost" },
      nodeEnv: "production",
    })!;

    await helper.enablePseudo();
    expect(localStorage.getItem(i18n.LOCALE_STORAGE_KEY)).toBe("pseudo");

    await helper.clearPreference();

    expect(helper.getLocale()).toBe("en");
    expect(localStorage.getItem(i18n.LOCALE_STORAGE_KEY)).toBeNull();
  });

  it("updates hydrated shell text through the existing locale-change event path", async () => {
    const { i18n, qa } = await loadModules();
    await i18n.initI18n({ locale: "en", loadLocale: loader({ en: enCatalog, pseudo: pseudoCatalog }) });
    const hydrateOnLocaleChange = () => i18n.hydrateI18n(document.body);
    document.addEventListener(i18n.I18N_LOCALE_CHANGED, hydrateOnLocaleChange);
    document.body.innerHTML = `<button id="shell" data-i18n-text="test.shell"></button>`;
    const helper = qa.installI18nQa({
      target: window,
      storage: localStorage,
      location: { hostname: "localhost" },
      nodeEnv: "production",
    })!;

    try {
      i18n.hydrateI18n(document.body);
      expect(document.getElementById("shell")?.textContent).toBe("Shell text");

      await helper.enablePseudo();

      expect(document.getElementById("shell")?.textContent).toBe("[!! Shell text !!]");
    } finally {
      document.removeEventListener(i18n.I18N_LOCALE_CHANGED, hydrateOnLocaleChange);
    }
  });
});
