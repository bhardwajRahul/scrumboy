export const SUPPORTED_LOCALES = ["en", "pseudo"];
export const LOCALE_STORAGE_KEY = "scrumboy.locale";
const BOOTSTRAP_EN_CATALOG = {
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.confirm": "Confirm",
    "common.delete": "Delete",
    "common.prompt": "Prompt",
    "common.save": "Save",
    "common.value": "Value",
    "errors.generic": "Something went wrong.",
    "errors.httpStatus": "HTTP {status}",
};
let activeLocale = "en";
let activeCatalog = BOOTSTRAP_EN_CATALOG;
let englishCatalog = BOOTSTRAP_EN_CATALOG;
let loader = defaultLoadLocale;
const catalogCache = new Map();
const warnedMissingKeys = new Set();
function getNodeEnv() {
    return String((globalThis.process?.env?.NODE_ENV) || "");
}
function getDefaultStorage() {
    try {
        return globalThis.localStorage || null;
    }
    catch {
        return null;
    }
}
function getDefaultLanguages() {
    const nav = globalThis.navigator;
    if (Array.isArray(nav?.languages) && nav.languages.length > 0) {
        return nav.languages;
    }
    return nav?.language ? [nav.language] : [];
}
function getDefaultDocumentElement() {
    return globalThis.document?.documentElement || null;
}
export function normalizeLocale(value) {
    if (!value)
        return null;
    const normalized = value.trim().toLowerCase().replace("_", "-");
    if (normalized === "pseudo")
        return "pseudo";
    if (normalized === "en" || normalized.startsWith("en-"))
        return "en";
    return null;
}
export function detectLocale(options = {}) {
    const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
    try {
        const stored = normalizeLocale(storage?.getItem(LOCALE_STORAGE_KEY));
        if (stored)
            return stored;
    }
    catch {
        // localStorage may be blocked; fall through to browser language.
    }
    const languages = options.languages ?? getDefaultLanguages();
    for (const language of languages) {
        const locale = normalizeLocale(language);
        if (locale)
            return locale;
    }
    return "en";
}
function getAppVersion() {
    const meta = globalThis.document?.querySelector?.('meta[name="app-version"]');
    return meta?.getAttribute("content") || "";
}
async function defaultLoadLocale(locale) {
    if (typeof fetch !== "function") {
        throw new Error("Cannot load i18n catalog: fetch is unavailable");
    }
    const version = getAppVersion();
    const suffix = version ? `?v=${encodeURIComponent(version)}` : "";
    const res = await fetch(`/dist/i18n/locales/${locale}.json${suffix}`, {
        headers: { Accept: "application/json" },
    });
    if (!res.ok) {
        throw new Error(`Failed to load i18n catalog ${locale}: HTTP ${res.status}`);
    }
    return normalizeCatalog(await res.json(), locale);
}
function normalizeCatalog(raw, locale) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error(`Invalid i18n catalog ${locale}: expected object`);
    }
    const catalog = {};
    for (const [key, value] of Object.entries(raw)) {
        if (typeof value !== "string") {
            throw new Error(`Invalid i18n catalog ${locale}: ${key} must be a string`);
        }
        catalog[key] = value;
    }
    return catalog;
}
async function ensureLocaleLoaded(locale) {
    const cached = catalogCache.get(locale);
    if (cached)
        return cached;
    const catalog = await loader(locale);
    catalogCache.set(locale, catalog);
    if (locale === "en")
        englishCatalog = catalog;
    return catalog;
}
function updateDocumentLang(locale, element = getDefaultDocumentElement()) {
    if (!element)
        return;
    element.lang = locale === "pseudo" ? "en" : locale;
    element.setAttribute("data-locale", locale);
}
function persistLocale(locale, storage = getDefaultStorage()) {
    try {
        storage?.setItem(LOCALE_STORAGE_KEY, locale);
    }
    catch {
        // Storage is best effort; the active in-memory locale still changes.
    }
}
export async function initI18n(options = {}) {
    if (options.loadLocale) {
        loader = options.loadLocale;
        catalogCache.clear();
        activeLocale = "en";
        englishCatalog = BOOTSTRAP_EN_CATALOG;
        activeCatalog = BOOTSTRAP_EN_CATALOG;
    }
    const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
    const desiredLocale = normalizeLocale(options.locale) ||
        detectLocale({ storage, languages: options.languages });
    const en = await ensureLocaleLoaded("en");
    let nextLocale = desiredLocale;
    let nextCatalog = en;
    if (desiredLocale !== "en") {
        try {
            nextCatalog = await ensureLocaleLoaded(desiredLocale);
        }
        catch (err) {
            console.warn(`Falling back to English because locale "${desiredLocale}" failed to load.`, err);
            nextLocale = "en";
            nextCatalog = en;
        }
    }
    activeLocale = nextLocale;
    activeCatalog = nextCatalog;
    updateDocumentLang(activeLocale, options.documentElement ?? getDefaultDocumentElement());
    if (options.persist === true && storage) {
        persistLocale(activeLocale, storage);
    }
    return activeLocale;
}
export async function setLocale(locale) {
    const nextLocale = normalizeLocale(locale) || "en";
    const en = await ensureLocaleLoaded("en");
    let nextCatalog = en;
    let resolvedLocale = nextLocale;
    if (nextLocale !== "en") {
        try {
            nextCatalog = await ensureLocaleLoaded(nextLocale);
        }
        catch (err) {
            console.warn(`Falling back to English because locale "${nextLocale}" failed to load.`, err);
            resolvedLocale = "en";
        }
    }
    activeLocale = resolvedLocale;
    activeCatalog = nextCatalog;
    persistLocale(activeLocale);
    updateDocumentLang(activeLocale);
    return activeLocale;
}
export function getLocale() {
    return activeLocale;
}
function hasOwnMessage(catalog, key) {
    return Object.prototype.hasOwnProperty.call(catalog, key);
}
function strictMissingKeyMode() {
    const env = getNodeEnv();
    if (env === "test")
        return "throw";
    if (env === "development")
        return "warn";
    if (env === "production")
        return "off";
    const hostname = globalThis.location?.hostname || "";
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
        return "warn";
    }
    return "off";
}
function reportMissingKey(locale, key) {
    const message = `Missing i18n key "${key}" for locale "${locale}"`;
    const mode = strictMissingKeyMode();
    if (mode === "throw") {
        throw new Error(message);
    }
    if (mode === "warn" && !warnedMissingKeys.has(message)) {
        warnedMissingKeys.add(message);
        console.warn(message);
    }
}
function resolveMessage(key) {
    if (hasOwnMessage(activeCatalog, key)) {
        return activeCatalog[key];
    }
    const fallback = englishCatalog[key];
    reportMissingKey(activeLocale, key);
    return fallback || key;
}
function interpolate(message, values) {
    return message.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, name) => {
        const value = values[name];
        return value == null ? match : String(value);
    });
}
export function t(key, values = {}) {
    return interpolate(resolveMessage(key), values);
}
export function hasI18nKey(key) {
    return hasOwnMessage(activeCatalog, key) || hasOwnMessage(englishCatalog, key);
}
function intlLocale(locale = activeLocale) {
    return locale === "pseudo" ? "en" : locale;
}
export function formatDate(value, options) {
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat(intlLocale(), options).format(date);
}
export function formatNumber(value, options) {
    return new Intl.NumberFormat(intlLocale(), options).format(value);
}
function extractErrorBody(err) {
    const maybe = err;
    const data = maybe?.data ?? err;
    return data && typeof data === "object" ? data : null;
}
export function apiErrorMessage(err) {
    const body = extractErrorBody(err);
    const error = body?.error;
    const details = error?.details || undefined;
    const reason = typeof details?.reason === "string" ? details.reason : "";
    const code = typeof error?.code === "string" ? error.code : "";
    if (code) {
        const reasonKey = reason ? `errors.${code}.${reason}` : "";
        if (reasonKey && hasI18nKey(reasonKey)) {
            return t(reasonKey, details);
        }
        const codeKey = `errors.${code}`;
        if (hasI18nKey(codeKey)) {
            return t(codeKey, (details || {}));
        }
    }
    const message = (typeof error?.message === "string" && error.message) ||
        (typeof err?.message === "string" && err.message);
    if (message)
        return message;
    const status = err?.status;
    if (typeof status === "number" && Number.isFinite(status)) {
        return t("errors.httpStatus", { status });
    }
    return t("errors.generic");
}
export function resetI18nForTests() {
    activeLocale = "en";
    activeCatalog = BOOTSTRAP_EN_CATALOG;
    englishCatalog = BOOTSTRAP_EN_CATALOG;
    loader = defaultLoadLocale;
    catalogCache.clear();
    warnedMissingKeys.clear();
}
