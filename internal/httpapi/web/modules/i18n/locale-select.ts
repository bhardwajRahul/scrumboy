import {
  getLocale,
  isPublicLocale,
  publicLocaleOptions,
  setLocale,
  t,
  type PublicLocaleId,
  type PublicLocaleOption,
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

function renderFlagImg(flagSrc: string): string {
  return `<img class="locale-picker__flag" src="${escapeHTML(flagSrc)}" alt="" aria-hidden="true" />`;
}

function renderOptionHTML(option: PublicLocaleOption, selected: boolean): string {
  const selectedAttr = selected ? ' aria-selected="true"' : ' aria-selected="false"';
  return `<li class="locale-picker__option" role="option" data-locale="${escapeHTML(option.id)}"${selectedAttr} tabindex="-1">${renderFlagImg(option.flagSrc)}<span class="locale-picker__label">${escapeHTML(option.label)}</span></li>`;
}

function getPickerRoot(button: HTMLElement | null): HTMLElement | null {
  return button?.closest(".locale-picker") ?? null;
}

function getPickerList(button: HTMLElement | null): HTMLUListElement | null {
  const root = getPickerRoot(button);
  return root?.querySelector(".locale-picker__list") as HTMLUListElement | null;
}

function getPickerOptions(button: HTMLElement | null): HTMLElement[] {
  const list = getPickerList(button);
  if (!list) return [];
  return Array.from(list.querySelectorAll('[role="option"]')) as HTMLElement[];
}

function getSelectedOption(button: HTMLElement | null): HTMLElement | null {
  return getPickerOptions(button).find((option) => option.getAttribute("aria-selected") === "true") ?? null;
}

function getHighlightedOption(button: HTMLElement | null): HTMLElement | null {
  const list = getPickerList(button);
  if (!list || list.hidden) return null;
  return list.querySelector(".locale-picker__option--highlight") as HTMLElement | null;
}

function setHighlightedOption(button: HTMLElement | null, option: HTMLElement | null): void {
  for (const item of getPickerOptions(button)) {
    item.classList.toggle("locale-picker__option--highlight", item === option);
  }
}

function isPickerOpen(button: HTMLElement | null): boolean {
  const list = getPickerList(button);
  return !!list && !list.hidden;
}

function setPickerOpen(button: HTMLElement | null, open: boolean): void {
  const list = getPickerList(button);
  if (!button || !list) return;
  list.hidden = !open;
  button.setAttribute("aria-expanded", open ? "true" : "false");
  if (!open) {
    setHighlightedOption(button, null);
    return;
  }
  setHighlightedOption(button, getSelectedOption(button));
}

function syncButtonFromOption(button: HTMLButtonElement, option: PublicLocaleOption): void {
  const flag = button.querySelector(".locale-picker__flag") as HTMLImageElement | null;
  const label = button.querySelector(".locale-picker__label");
  if (flag) flag.src = option.flagSrc;
  if (label) label.textContent = option.label;
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
  const buttonClassNames = ["locale-picker__button", "select", options.className].filter(Boolean).join(" ");
  const styleAttr = options.style ? ` style="${escapeHTML(options.style)}"` : "";
  const selectedLocale = getSelectedPublicLocale();
  const localeOptions = publicLocaleOptions();
  const selectedOption = localeOptions.find((option) => option.id === selectedLocale) ?? localeOptions[0];
  const optionHTML = localeOptions
    .map((option) => renderOptionHTML(option, option.id === selectedLocale))
    .join("");

  return `<div class="locale-picker"><button type="button" class="${escapeHTML(buttonClassNames)}" id="${escapeHTML(options.id)}" aria-haspopup="listbox" aria-expanded="false" aria-label="${escapeHTML(t(labelKey))}" data-i18n-aria-label="${escapeHTML(labelKey)}"${styleAttr}>${renderFlagImg(selectedOption.flagSrc)}<span class="locale-picker__label">${escapeHTML(selectedOption.label)}</span></button><ul class="locale-picker__list" role="listbox" hidden>${optionHTML}</ul></div>`;
}

export function syncPublicLocaleSelect(button: HTMLButtonElement | null): void {
  if (!button) return;

  const localeOptions = publicLocaleOptions();
  const selectedLocale = getSelectedPublicLocale();
  const selectedOption = localeOptions.find((option) => option.id === selectedLocale) ?? localeOptions[0];
  const list = getPickerList(button);
  const labelKey = button.getAttribute("data-i18n-aria-label") || DEFAULT_LABEL_KEY;

  button.setAttribute("aria-label", t(labelKey));

  if (list) {
    const needsRebuild =
      getPickerOptions(button).length !== localeOptions.length ||
      localeOptions.some((option, index) => {
        const existing = getPickerOptions(button)[index];
        return (
          !existing ||
          existing.getAttribute("data-locale") !== option.id ||
          existing.querySelector(".locale-picker__label")?.textContent !== option.label
        );
      });

    if (needsRebuild) {
      list.innerHTML = localeOptions
        .map((option) => renderOptionHTML(option, option.id === selectedLocale))
        .join("");
    } else {
      for (const option of localeOptions) {
        const existing = getPickerOptions(button).find((item) => item.getAttribute("data-locale") === option.id);
        if (!existing) continue;
        existing.setAttribute("aria-selected", option.id === selectedLocale ? "true" : "false");
        const flag = existing.querySelector(".locale-picker__flag") as HTMLImageElement | null;
        const label = existing.querySelector(".locale-picker__label");
        if (flag) flag.src = option.flagSrc;
        if (label) label.textContent = option.label;
      }
    }
  }

  syncButtonFromOption(button, selectedOption);
  if (!isPickerOpen(button)) {
    button.setAttribute("aria-expanded", "false");
  }
}

async function selectLocaleOption(button: HTMLButtonElement, locale: PublicLocaleId): Promise<void> {
  if (!isPublicLocale(locale)) {
    syncPublicLocaleSelect(button);
    return;
  }
  await setLocale(locale);
  setPickerOpen(button, false);
  syncPublicLocaleSelect(button);
}

function moveHighlight(button: HTMLButtonElement, delta: number): void {
  const options = getPickerOptions(button);
  if (options.length === 0) return;

  const current = getHighlightedOption(button) ?? getSelectedOption(button) ?? options[0];
  const currentIndex = options.indexOf(current);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + delta + options.length) % options.length;
  setHighlightedOption(button, options[nextIndex]);
  options[nextIndex]?.scrollIntoView({ block: "nearest" });
}

export function bindPublicLocaleSelect(
  button: HTMLButtonElement | null,
  options: { signal?: AbortSignal } = {},
): void {
  if (!button) return;
  syncPublicLocaleSelect(button);

  const signal = options.signal;
  const onAbort = signal ? () => setPickerOpen(button, false) : undefined;
  onAbort && signal?.addEventListener("abort", onAbort, { once: true });

  button.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();
      setPickerOpen(button, !isPickerOpen(button));
    },
    signal ? { signal } : undefined,
  );

  button.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!isPickerOpen(button)) {
          setPickerOpen(button, true);
          return;
        }
        moveHighlight(button, 1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!isPickerOpen(button)) {
          setPickerOpen(button, true);
          return;
        }
        moveHighlight(button, -1);
        return;
      }
      if (event.key === "Escape") {
        if (!isPickerOpen(button)) return;
        event.preventDefault();
        setPickerOpen(button, false);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        if (!isPickerOpen(button)) {
          event.preventDefault();
          setPickerOpen(button, true);
          return;
        }
        const highlighted = getHighlightedOption(button) ?? getSelectedOption(button);
        const locale = highlighted?.getAttribute("data-locale");
        if (!locale || !isPublicLocale(locale)) return;
        event.preventDefault();
        void selectLocaleOption(button, locale);
      }
    },
    signal ? { signal } : undefined,
  );

  const list = getPickerList(button);
  list?.addEventListener(
    "click",
    (event) => {
      const target = (event.target as HTMLElement | null)?.closest('[role="option"]') as HTMLElement | null;
      const locale = target?.getAttribute("data-locale");
      if (!locale || !isPublicLocale(locale)) return;
      event.preventDefault();
      void selectLocaleOption(button, locale);
    },
    signal ? { signal } : undefined,
  );

  document.addEventListener(
    "click",
    (event) => {
      if (!isPickerOpen(button)) return;
      const root = getPickerRoot(button);
      if (root && event.target instanceof Node && root.contains(event.target)) return;
      setPickerOpen(button, false);
    },
    signal ? { signal } : undefined,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape" || !isPickerOpen(button)) return;
      setPickerOpen(button, false);
      button.focus();
    },
    signal ? { signal } : undefined,
  );
}
