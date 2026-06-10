// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enCatalog = {
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.confirm": "Confirm",
  "common.delete": "Delete",
  "common.prompt": "Prompt",
  "common.save": "Save",
  "common.value": "Value",
  "errors.NOT_FOUND": "Not found",
  "errors.generic": "Something went wrong.",
  "errors.httpStatus": "HTTP {status}",
  "test.greeting": "Hello, {name}",
};

const pseudoCatalog = {
  "common.cancel": "[!! Cancel !!]",
  "common.close": "[!! Close !!]",
  "common.confirm": "[!! Confirm !!]",
  "common.delete": "[!! Delete !!]",
  "common.prompt": "[!! Prompt !!]",
  "common.save": "[!! Save !!]",
  "common.value": "[!! Value !!]",
  "errors.NOT_FOUND": "[!! Not found !!]",
  "errors.generic": "[!! Something went wrong. !!]",
  "errors.httpStatus": "[!! HTTP {status} !!]",
  "test.greeting": "[!! Hello, {name} !!]",
};

async function loadModule() {
  vi.resetModules();
  return await import("./index.js");
}

function loader(catalogs: Record<string, Record<string, string>>) {
  return vi.fn(async (locale: "en" | "pseudo") => catalogs[locale]);
}

describe("i18n locale detection", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("uses localStorage before browser languages", async () => {
    const i18n = await loadModule();
    localStorage.setItem(i18n.LOCALE_STORAGE_KEY, "pseudo");

    expect(i18n.detectLocale({ languages: ["en-US"] })).toBe("pseudo");
  });

  it("falls back to navigator language aliases and then English", async () => {
    const i18n = await loadModule();

    expect(i18n.detectLocale({ storage: null, languages: ["fr-FR", "en-US"] })).toBe("en");
    expect(i18n.detectLocale({ storage: null, languages: ["fr-FR"] })).toBe("en");
    expect(i18n.normalizeLocale("en_GB")).toBe("en");
  });
});

describe("i18n catalog loading", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
    document.documentElement.removeAttribute("data-locale");
  });

  afterEach(async () => {
    const i18n = await import("./index.js");
    i18n.resetI18nForTests();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads English first, then the active locale", async () => {
    const i18n = await loadModule();
    const loadLocale = loader({ en: enCatalog, pseudo: pseudoCatalog });

    await i18n.initI18n({ locale: "pseudo", loadLocale });

    expect(loadLocale.mock.calls.map(([locale]) => locale)).toEqual(["en", "pseudo"]);
    expect(i18n.getLocale()).toBe("pseudo");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.getAttribute("data-locale")).toBe("pseudo");
    expect(i18n.t("common.cancel")).toBe("[!! Cancel !!]");
  });

  it("keeps the bootstrap English fallback when a custom loader fails loading English", async () => {
    const i18n = await loadModule();
    const loadLocale = vi.fn(async () => {
      throw new Error("catalog unavailable");
    });

    await expect(i18n.initI18n({ locale: "pseudo", loadLocale })).rejects.toThrow("catalog unavailable");

    expect(i18n.getLocale()).toBe("en");
    expect(i18n.t("common.cancel")).toBe("Cancel");
  });

  it("persists locale changes to localStorage", async () => {
    const i18n = await loadModule();
    await i18n.initI18n({ locale: "en", loadLocale: loader({ en: enCatalog, pseudo: pseudoCatalog }) });

    await i18n.setLocale("pseudo");

    expect(i18n.getLocale()).toBe("pseudo");
    expect(localStorage.getItem(i18n.LOCALE_STORAGE_KEY)).toBe("pseudo");
  });

  it("supports simple placeholder interpolation", async () => {
    const i18n = await loadModule();
    await i18n.initI18n({ locale: "pseudo", loadLocale: loader({ en: enCatalog, pseudo: pseudoCatalog }) });

    expect(i18n.t("test.greeting", { name: "Ada" })).toBe("[!! Hello, Ada !!]");
  });

  it("fails loudly for missing keys in tests", async () => {
    const i18n = await loadModule();
    const incompletePseudo = { ...pseudoCatalog };
    delete incompletePseudo["common.save"];
    await i18n.initI18n({ locale: "pseudo", loadLocale: loader({ en: enCatalog, pseudo: incompletePseudo }) });

    expect(() => i18n.t("common.save")).toThrow('Missing i18n key "common.save" for locale "pseudo"');
  });

  it("falls back to English for missing keys in production mode", async () => {
    const i18n = await loadModule();
    const incompletePseudo = { ...pseudoCatalog };
    delete incompletePseudo["common.save"];
    await i18n.initI18n({ locale: "pseudo", loadLocale: loader({ en: enCatalog, pseudo: incompletePseudo }) });
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      expect(i18n.t("common.save")).toBe("Save");
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it("formats dates and numbers with the active locale", async () => {
    const i18n = await loadModule();
    await i18n.initI18n({ locale: "en", loadLocale: loader({ en: enCatalog, pseudo: pseudoCatalog }) });

    expect(i18n.formatDate(Date.parse("2026-04-13T12:00:00Z"), {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })).toBe("Apr 13");
    expect(i18n.formatNumber(1234.5)).toBe("1,234.5");
  });

  it("keeps API error message fallback behavior available", async () => {
    const i18n = await loadModule();
    await i18n.initI18n({ locale: "en", loadLocale: loader({ en: enCatalog, pseudo: pseudoCatalog }) });
    const err = new Error("server fallback") as Error & { data?: unknown; status?: number };
    err.status = 418;
    err.data = { error: { code: "TEAPOT", message: "server fallback" } };

    expect(i18n.apiErrorMessage(err)).toBe("server fallback");
    expect(i18n.apiErrorMessage({ status: 503 })).toBe("HTTP 503");
  });
});
