export const SUPPORTED_LOCALES = ["en", "de", "pseudo"] as const;
export type LocaleId = typeof SUPPORTED_LOCALES[number];
export const PUBLIC_LOCALES = ["en", "de"] as const;
export type PublicLocaleId = typeof PUBLIC_LOCALES[number];
export type MessageCatalog = Record<string, string>;
export type MessageValues = Record<string, string | number | boolean | null | undefined>;

export const LOCALE_STORAGE_KEY = "scrumboy.locale";
export const I18N_LOCALE_CHANGED = "scrumboy:i18n-locale-changed";
export const LOCALE_LABELS: Record<LocaleId, string> = {
  en: "English",
  de: "Deutsch",
  pseudo: "Pseudo",
};

const BOOTSTRAP_EN_CATALOG: MessageCatalog = {
  "common.add": "Add",
  "common.apply": "Apply",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.confirm": "Confirm",
  "common.delete": "Delete",
  "common.prompt": "Prompt",
  "common.save": "Save",
  "common.value": "Value",
  "errors.generic": "Something went wrong.",
  "errors.httpStatus": "HTTP {status}",
  "nav.temporaryBoards.long": "Temporary Boards",
  "nav.temporaryBoards.short": "Temporary",
  "shell.bulkEdit.addTags": "Add tags",
  "shell.bulkEdit.assignSprint": "Assign sprint",
  "shell.bulkEdit.assignTo": "Assign to",
  "shell.bulkEdit.assignUser": "Assign user",
  "shell.bulkEdit.changeStatus": "Change status",
  "shell.bulkEdit.estimationPoints": "Estimation points",
  "shell.bulkEdit.noEstimate": "No estimate",
  "shell.bulkEdit.setEstimationPoints": "Set estimation points",
  "shell.bulkEdit.sprint": "Sprint",
  "shell.bulkEdit.status": "Status",
  "shell.bulkEdit.tagsPlaceholder": "Type tag and press Enter",
  "shell.contextMenu.newTodo": "New Todo",
  "settings.language.description": "Choose the language used for Scrumboy on this browser.",
  "settings.language.selectLabel": "Language",
  "settings.language.title": "Language",
  "tooltips.boardSearch": "Search titles and notes. Combine with tag and sprint chips to narrow the board.",
  "tooltips.doneLane": "Exactly one lane counts as done. Stories there get a completion timestamp used for dashboard stats and burndown, even if the lane is named Shipped instead of Done.",
  "tooltips.estimationPoints": "Relative effort, not hours. Uses a modified Fibonacci scale (1\u201340). Compare to similar work on this board.",
  "tooltips.linkedStories": "Link related stories (dependencies, parent/child, duplicates). Search by local ID (#12) or title. Links are informational \u2014 they do not move cards automatically.",
  "tooltips.memberRole": "Viewer: read-only. Contributor: edit notes when assigned. Maintainer: create, move, assign, sprints, and settings.",
  "tooltips.sprintDefaultWeeks": "When you create a sprint, the end date defaults to this many weeks after the start date.",
  "tooltips.sprintEnd": "Planned end of this sprint. Burndown and dashboard completion stats use the sprint date range.",
  "tooltips.sprintFilterActive": "Currently active iteration \u2014 only one sprint can be active at a time.",
  "tooltips.sprintFilterScheduled": "Stories assigned to any sprint.",
  "tooltips.sprintFilterUnscheduled": "Stories not in a sprint yet (often your backlog).",
  "tooltips.sprintName": "A label for this iteration, e.g. Sprint 12 or 2026 Q1 Sprint 1.",
  "tooltips.sprintStart": "Planned start of this sprint. Burndown and dashboard completion stats use the sprint date range.",
  "tooltips.sprintTodo": "Which time-boxed iteration this story belongs to. Leave empty if not scheduled yet.",
  "tooltips.status": "Which workflow lane this story is in. Done is whichever lane is marked as done in Settings \u2192 Workflow; that lane drives dashboard completion stats.",
  "tooltips.tags": "Free-form labels for filtering and grouping. On shared boards, tag colors are the same for everyone; your personal tag colors apply across your projects.",
  "tooltips.voiceCommand": "Story and todo mean the same thing. Use a local ID (12, #12) or a title phrase. One clear command per line \u2014 no pronouns like it or that.",
  "tooltips.workflowAddLane": "Adds a new column before the done lane. Lane names can be renamed later; internal keys stay fixed.",
};

type LocaleLoader = (locale: LocaleId) => Promise<MessageCatalog>;

export interface InitI18nOptions {
  locale?: string | null;
  storage?: Storage | null;
  languages?: readonly string[];
  documentElement?: HTMLElement | null;
  loadLocale?: LocaleLoader;
  persist?: boolean;
}

export interface DetectLocaleOptions {
  storage?: Storage | null;
  languages?: readonly string[];
}

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown> | null;
  };
};

const HYDRATION_BINDINGS = [
  ["data-i18n-text", "textContent"],
  ["data-i18n-aria-label", "aria-label"],
  ["data-i18n-placeholder", "placeholder"],
  ["data-i18n-title", "title"],
] as const;

let activeLocale: LocaleId = "en";
let activeCatalog: MessageCatalog = BOOTSTRAP_EN_CATALOG;
let englishCatalog: MessageCatalog = BOOTSTRAP_EN_CATALOG;
let loader: LocaleLoader = defaultLoadLocale;
const catalogCache = new Map<LocaleId, MessageCatalog>();
const warnedMissingKeys = new Set<string>();

function getNodeEnv(): string {
  return String(((globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV) || "");
}

function getDefaultStorage(): Storage | null {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function getDefaultLanguages(): readonly string[] {
  const nav = globalThis.navigator;
  if (Array.isArray(nav?.languages) && nav.languages.length > 0) {
    return nav.languages;
  }
  return nav?.language ? [nav.language] : [];
}

function getDefaultDocumentElement(): HTMLElement | null {
  return globalThis.document?.documentElement || null;
}

export function normalizeLocale(value: string | null | undefined): LocaleId | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace("_", "-");
  if (normalized === "pseudo") return "pseudo";
  if (normalized === "de" || normalized.startsWith("de-")) return "de";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return null;
}

export function isPublicLocale(locale: string): locale is PublicLocaleId {
  return (PUBLIC_LOCALES as readonly string[]).includes(locale);
}

export function publicLocaleOptions(): Array<{ id: PublicLocaleId; label: string }> {
  return PUBLIC_LOCALES.map((id) => ({ id, label: LOCALE_LABELS[id] }));
}

export function detectLocale(options: DetectLocaleOptions = {}): LocaleId {
  const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
  try {
    const stored = normalizeLocale(storage?.getItem(LOCALE_STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // localStorage may be blocked; fall through to browser language.
  }

  const languages = options.languages ?? getDefaultLanguages();
  for (const language of languages) {
    const locale = normalizeLocale(language);
    if (locale) return locale;
  }
  return "en";
}

function getAppVersion(): string {
  const meta = globalThis.document?.querySelector?.('meta[name="app-version"]');
  return meta?.getAttribute("content") || "";
}

async function defaultLoadLocale(locale: LocaleId): Promise<MessageCatalog> {
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

function normalizeCatalog(raw: unknown, locale: LocaleId): MessageCatalog {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Invalid i18n catalog ${locale}: expected object`);
  }
  const catalog: MessageCatalog = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "string") {
      throw new Error(`Invalid i18n catalog ${locale}: ${key} must be a string`);
    }
    catalog[key] = value;
  }
  return catalog;
}

async function ensureLocaleLoaded(locale: LocaleId): Promise<MessageCatalog> {
  const cached = catalogCache.get(locale);
  if (cached) return cached;
  const catalog = await loader(locale);
  catalogCache.set(locale, catalog);
  if (locale === "en") englishCatalog = catalog;
  return catalog;
}

function updateDocumentLang(locale: LocaleId, element = getDefaultDocumentElement()): void {
  if (!element) return;
  element.lang = locale === "pseudo" ? "en" : locale;
  element.setAttribute("data-locale", locale);
}

function persistLocale(locale: LocaleId, storage = getDefaultStorage()): void {
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage is best effort; the active in-memory locale still changes.
  }
}

function dispatchLocaleChanged(locale: LocaleId): void {
  const eventTarget = globalThis.document;
  if (!eventTarget || typeof eventTarget.dispatchEvent !== "function") return;
  eventTarget.dispatchEvent(new CustomEvent(I18N_LOCALE_CHANGED, { detail: { locale } }));
}

export async function initI18n(options: InitI18nOptions = {}): Promise<LocaleId> {
  if (options.loadLocale) {
    loader = options.loadLocale;
    catalogCache.clear();
    activeLocale = "en";
    englishCatalog = BOOTSTRAP_EN_CATALOG;
    activeCatalog = BOOTSTRAP_EN_CATALOG;
  }

  const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
  const desiredLocale =
    normalizeLocale(options.locale) ||
    detectLocale({ storage, languages: options.languages });

  const en = await ensureLocaleLoaded("en");
  let nextLocale = desiredLocale;
  let nextCatalog = en;

  if (desiredLocale !== "en") {
    try {
      nextCatalog = await ensureLocaleLoaded(desiredLocale);
    } catch (err) {
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

export async function setLocale(locale: string): Promise<LocaleId> {
  const previousLocale = activeLocale;
  const previousCatalog = activeCatalog;
  const nextLocale = normalizeLocale(locale) || "en";
  const en = await ensureLocaleLoaded("en");
  let nextCatalog = en;
  let resolvedLocale = nextLocale;

  if (nextLocale !== "en") {
    try {
      nextCatalog = await ensureLocaleLoaded(nextLocale);
    } catch (err) {
      console.warn(`Falling back to English because locale "${nextLocale}" failed to load.`, err);
      resolvedLocale = "en";
    }
  }

  activeLocale = resolvedLocale;
  activeCatalog = nextCatalog;
  persistLocale(activeLocale);
  updateDocumentLang(activeLocale);
  if (previousLocale !== activeLocale || previousCatalog !== activeCatalog) {
    dispatchLocaleChanged(activeLocale);
  }
  return activeLocale;
}

export function getLocale(): LocaleId {
  return activeLocale;
}

function hasOwnMessage(catalog: MessageCatalog, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(catalog, key);
}

function strictMissingKeyMode(): "throw" | "warn" | "off" {
  const env = getNodeEnv();
  if (env === "test") return "throw";
  if (env === "development") return "warn";
  if (env === "production") return "off";
  const hostname = globalThis.location?.hostname || "";
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return "warn";
  }
  return "off";
}

function reportMissingKey(locale: LocaleId, key: string): void {
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

function resolveMessage(key: string): string {
  if (hasOwnMessage(activeCatalog, key)) {
    return activeCatalog[key];
  }
  const fallback = englishCatalog[key];
  reportMissingKey(activeLocale, key);
  return fallback || key;
}

function interpolate(message: string, values: MessageValues): string {
  return message.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, name) => {
    const value = values[name];
    return value == null ? match : String(value);
  });
}

export function t(key: string, values: MessageValues = {}): string {
  return interpolate(resolveMessage(key), values);
}

function elementsForAttribute(root: ParentNode, attributeName: string): Element[] {
  const elements: Element[] = [];
  if (typeof Element !== "undefined" && root instanceof Element && root.hasAttribute(attributeName)) {
    elements.push(root);
  }
  root.querySelectorAll?.(`[${attributeName}]`).forEach((element) => elements.push(element));
  return elements;
}

export function hydrateI18n(root: ParentNode | null | undefined = globalThis.document): void {
  if (!root) return;
  for (const [sourceAttribute, targetAttribute] of HYDRATION_BINDINGS) {
    for (const element of elementsForAttribute(root, sourceAttribute)) {
      const key = element.getAttribute(sourceAttribute);
      if (!key) continue;
      const message = t(key);
      if (targetAttribute === "textContent") {
        element.textContent = message;
      } else {
        element.setAttribute(targetAttribute, message);
      }
    }
  }
}

export function hasI18nKey(key: string): boolean {
  return hasOwnMessage(activeCatalog, key) || hasOwnMessage(englishCatalog, key);
}

function intlLocale(locale = activeLocale): string {
  return locale === "pseudo" ? "en" : locale;
}

export function formatDate(
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(intlLocale(), options).format(date);
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(intlLocale(), options).format(value);
}

function extractErrorBody(err: unknown): ApiErrorBody | null {
  const maybe = err as { data?: unknown };
  const data = maybe?.data ?? err;
  return data && typeof data === "object" ? (data as ApiErrorBody) : null;
}

export function apiErrorMessage(err: unknown): string {
  const body = extractErrorBody(err);
  const error = body?.error;
  const details = error?.details || undefined;
  const reason = typeof details?.reason === "string" ? details.reason : "";
  const code = typeof error?.code === "string" ? error.code : "";

  if (code) {
    const reasonKey = reason ? `errors.${code}.${reason}` : "";
    if (reasonKey && hasI18nKey(reasonKey)) {
      return t(reasonKey, details as MessageValues);
    }
    const codeKey = `errors.${code}`;
    if (hasI18nKey(codeKey)) {
      return t(codeKey, (details || {}) as MessageValues);
    }
  }

  const message =
    (typeof error?.message === "string" && error.message) ||
    (typeof (err as { message?: unknown })?.message === "string" && (err as { message: string }).message);
  if (message) return message;

  const status = (err as { status?: unknown })?.status;
  if (typeof status === "number" && Number.isFinite(status)) {
    return t("errors.httpStatus", { status });
  }

  return t("errors.generic");
}

export function resetI18nForTests(): void {
  activeLocale = "en";
  activeCatalog = BOOTSTRAP_EN_CATALOG;
  englishCatalog = BOOTSTRAP_EN_CATALOG;
  loader = defaultLoadLocale;
  catalogCache.clear();
  warnedMissingKeys.clear();
}
