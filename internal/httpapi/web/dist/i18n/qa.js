import { getLocale, LOCALE_STORAGE_KEY, setLocale } from './index.js';
function getNodeEnv() {
    return String((globalThis.process?.env?.NODE_ENV) || "");
}
function getDefaultTarget() {
    return globalThis.window || null;
}
function getDefaultStorage(target) {
    try {
        return target?.localStorage || globalThis.localStorage || null;
    }
    catch {
        return null;
    }
}
function removeStoredLocale(storage) {
    try {
        storage?.removeItem(LOCALE_STORAGE_KEY);
    }
    catch {
        // Storage can be blocked; the in-memory locale still resets.
    }
}
function isLocalQaHost(hostname) {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}
export function shouldInstallI18nQa(options = {}) {
    const nodeEnv = options.nodeEnv ?? getNodeEnv();
    if (nodeEnv === "test")
        return true;
    const target = options.target === undefined ? getDefaultTarget() : options.target;
    const hostname = options.location?.hostname ||
        target?.location?.hostname ||
        globalThis.location?.hostname ||
        "";
    return isLocalQaHost(hostname);
}
export function createI18nQa(storage = getDefaultStorage(getDefaultTarget())) {
    return {
        enablePseudo: () => setLocale("pseudo"),
        useEnglish: () => setLocale("en"),
        getLocale,
        clearPreference: async () => {
            const locale = await setLocale("en");
            removeStoredLocale(storage);
            return locale;
        },
    };
}
export function installI18nQa(options = {}) {
    const target = options.target === undefined ? getDefaultTarget() : options.target;
    if (!target || !shouldInstallI18nQa({ ...options, target }))
        return null;
    const helper = createI18nQa(options.storage === undefined ? getDefaultStorage(target) : options.storage);
    target.scrumboyI18nQa = helper;
    return helper;
}
