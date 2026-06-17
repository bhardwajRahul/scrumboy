import {
  getLocale,
  isPublicLocale,
  publicLocaleOptions,
  setLocale,
  t,
  type PublicLocaleId,
} from './index.js';

const DEFAULT_LABEL_KEY = "settings.language.selectLabel";

function escapeHTML(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function getSelectedPublicLocale(): PublicLocaleId {
  const currentLocale = getLocale();
  return isPublicLocale(currentLocale) ? currentLocale : "en";
}

export function renderPublicLocaleSelectHTML(options: {
  id: string;
  className?: string;
  style?: string;
  labelKey?: string;
}): string {
  const labelKey = options.labelKey || DEFAULT_LABEL_KEY;
  const classNames = ["select", options.className].filter(Boolean).join(" ");
  const styleAttr = options.style ? ` style="${escapeHTML(options.style)}"` : "";
  const selectedLocale = getSelectedPublicLocale();
  const optionHTML = publicLocaleOptions()
    .map((option) => {
      const selectedAttr = option.id === selectedLocale ? " selected" : "";
      return `<option value="${escapeHTML(option.id)}"${selectedAttr}>${escapeHTML(option.label)}</option>`;
    })
    .join("");

  return `<select class="${escapeHTML(classNames)}" id="${escapeHTML(options.id)}" aria-label="${escapeHTML(t(labelKey))}" data-i18n-aria-label="${escapeHTML(labelKey)}"${styleAttr}>${optionHTML}</select>`;
}

export function syncPublicLocaleSelect(select: HTMLSelectElement | null): void {
  if (!select) return;

  const options = publicLocaleOptions();
  const needsRebuild =
    select.options.length !== options.length ||
    options.some((option, index) => {
      const existing = select.options[index];
      return !existing || existing.value !== option.id || existing.textContent !== option.label;
    });

  if (needsRebuild) {
    select.innerHTML = options
      .map((option) => `<option value="${escapeHTML(option.id)}">${escapeHTML(option.label)}</option>`)
      .join("");
  }

  const labelKey = select.getAttribute("data-i18n-aria-label") || DEFAULT_LABEL_KEY;
  select.setAttribute("aria-label", t(labelKey));
  select.value = getSelectedPublicLocale();
}

export function bindPublicLocaleSelect(
  select: HTMLSelectElement | null,
  options: { signal?: AbortSignal } = {},
): void {
  if (!select) return;
  syncPublicLocaleSelect(select);
  select.addEventListener(
    "change",
    async () => {
      const nextLocale = select.value;
      if (!isPublicLocale(nextLocale)) {
        syncPublicLocaleSelect(select);
        return;
      }
      await setLocale(nextLocale);
      syncPublicLocaleSelect(select);
    },
    options,
  );
}
