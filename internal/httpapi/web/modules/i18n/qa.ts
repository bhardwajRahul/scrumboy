import { getLocale, LOCALE_STORAGE_KEY, type LocaleId, setLocale } from './index.js';

export interface ScrumboyI18nQa {
  enablePseudo(): Promise<LocaleId>;
  useEnglish(): Promise<LocaleId>;
  getLocale(): LocaleId;
  clearPreference(): Promise<LocaleId>;
}

export interface I18nQaInstallOptions {
  target?: I18nQaTarget | null;
  location?: { hostname?: string } | null;
  storage?: Storage | null;
  nodeEnv?: string | null;
}

export type I18nQaTarget = {
  scrumboyI18nQa?: ScrumboyI18nQa;
  location?: { hostname?: string };
  localStorage?: Storage;
};

declare global {
  interface Window {
    scrumboyI18nQa?: ScrumboyI18nQa;
  }
}

function getNodeEnv(): string {
  return String(((globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV) || "");
}

function getDefaultTarget(): I18nQaTarget | null {
  return (globalThis as unknown as { window?: I18nQaTarget }).window || null;
}

function getDefaultStorage(target: I18nQaTarget | null): Storage | null {
  try {
    return target?.localStorage || globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function removeStoredLocale(storage: Storage | null): void {
  try {
    storage?.removeItem(LOCALE_STORAGE_KEY);
  } catch {
    // Storage can be blocked; the in-memory locale still resets.
  }
}

function isLocalQaHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

export function shouldInstallI18nQa(options: I18nQaInstallOptions = {}): boolean {
  const nodeEnv = options.nodeEnv ?? getNodeEnv();
  if (nodeEnv === "test") return true;

  const target = options.target === undefined ? getDefaultTarget() : options.target;
  const hostname =
    options.location?.hostname ||
    target?.location?.hostname ||
    globalThis.location?.hostname ||
    "";
  return isLocalQaHost(hostname);
}

export function createI18nQa(storage: Storage | null = getDefaultStorage(getDefaultTarget())): ScrumboyI18nQa {
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

export function installI18nQa(options: I18nQaInstallOptions = {}): ScrumboyI18nQa | null {
  const target = options.target === undefined ? getDefaultTarget() : options.target;
  if (!target || !shouldInstallI18nQa({ ...options, target })) return null;

  const helper = createI18nQa(options.storage === undefined ? getDefaultStorage(target) : options.storage);
  target.scrumboyI18nQa = helper;
  return helper;
}
