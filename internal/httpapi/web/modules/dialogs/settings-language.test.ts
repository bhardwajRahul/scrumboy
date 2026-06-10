// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  apiFetchMock,
  fetchProjectMembersMock,
  loadTagSettingsContentMock,
  windowFetchMock,
} = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  fetchProjectMembersMock: vi.fn(),
  loadTagSettingsContentMock: vi.fn().mockResolvedValue(''),
  windowFetchMock: vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({}),
  }),
}));

vi.mock('../api.js', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('../members-cache.js', () => ({
  fetchProjectMembers: fetchProjectMembersMock,
}));

vi.mock('../utils.js', () => ({
  escapeHTML: (s: string) =>
    String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;'),
  showToast: vi.fn(),
  getAppVersion: () => 'test-version',
  showConfirmDialog: vi.fn(),
  confirmDelete: vi.fn(),
  isAnonymousBoard: () => false,
  renderUserAvatar: () => '',
  processImageFile: vi.fn(),
  processWallpaperFileForUpload: vi.fn(),
  renderAvatarContent: () => '',
  sanitizeHexColor: (color?: string | null, fallback?: string | null) => color ?? fallback ?? null,
}));

vi.mock('../theme.js', () => ({
  getStoredTheme: () => 'system',
  handleThemeChange: vi.fn(),
  THEME_SYSTEM: 'system',
  THEME_DARK: 'dark',
  THEME_LIGHT: 'light',
}));

vi.mock('../wallpaper.js', () => ({
  getStoredWallpaperState: () => ({ mode: 'off' }),
  setWallpaperOff: vi.fn(),
  setWallpaperColor: vi.fn(),
  uploadWallpaperImage: vi.fn(),
}));

vi.mock('../charts/burndown.js', () => ({
  renderRealBurndownChart: () => '<div></div>',
  destroyBurndownChart: vi.fn(),
  mountBurndownChart: vi.fn(),
}));

vi.mock('../events.js', () => ({
  emit: vi.fn(),
}));

vi.mock('../sprints.js', () => ({
  normalizeSprints: (value: unknown) => value,
}));

vi.mock('../core/keybindings.js', () => ({
  KEY_ACTION_LIST: [],
  chordFromKeyboardEvent: vi.fn(),
  formatChordForDisplay: () => '',
  getResolvedChordForAction: () => '',
  isTypingInTextField: () => false,
  reloadKeybindingsFromStorage: vi.fn(),
  saveKeybindingOverride: vi.fn(),
  setKeybindingsCaptureListening: vi.fn(),
}));

vi.mock('../core/assignmentNotify.js', () => ({
  requestDesktopNotificationPermission: vi.fn(),
  getDesktopNotificationStatusDescription: () => '',
}));

vi.mock('../core/push.js', () => ({
  isPushSubscribed: vi.fn(),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}));

vi.mock('../core/voiceflow-preferences.js', () => ({
  getVoiceFlowEnabledPreference: () => false,
  setVoiceFlowEnabledPreference: vi.fn(),
}));

vi.mock('./settings-workflow.js', () => ({
  bindWorkflowTabInteractions: vi.fn(),
  clearWorkflowDraftState: vi.fn(),
  invalidateWorkflowLaneCountsCache: vi.fn(),
  isWorkflowDraftDirty: () => false,
  loadWorkflowTabContent: () => '',
  resetWorkflowDraftToBaseline: vi.fn(),
}));

vi.mock('./settings-tags.js', () => ({
  bindTagTabInteractions: vi.fn(),
  invalidateTagsCache: vi.fn(),
  loadTagSettingsContent: loadTagSettingsContentMock,
}));

vi.mock('./settings-sprints.js', () => ({
  bindSprintsTabInteractions: vi.fn(),
  renderSprintsTabContent: vi.fn().mockResolvedValue(''),
}));

const enCatalog = {
  "settings.language.description": "Choose the language used for Scrumboy on this browser.",
  "settings.language.selectLabel": "Language",
  "settings.language.title": "Language",
  "test.shell": "Shell text",
};

const deCatalog = {
  "settings.language.description": "Wähle die Sprache, die Scrumboy in diesem Browser verwendet.",
  "settings.language.selectLabel": "Sprache",
  "settings.language.title": "Sprache",
  "test.shell": "Shell-Text",
};

const pseudoCatalog = {
  "settings.language.description": "[!! Choose the language used for Scrumboy on this browser. !!]",
  "settings.language.selectLabel": "[!! Language !!]",
  "settings.language.title": "[!! Language !!]",
  "test.shell": "[!! Shell text !!]",
};

function installBaseDOM(): void {
  document.body.innerHTML = `
    <button id="shellProbe" data-i18n-text="test.shell"></button>
    <dialog id="settingsDialog">
      <div class="dialog__title"></div>
      <div class="dialog__content"></div>
    </dialog>
    <button id="closeSettingsBtn" type="button"></button>
  `;
}

function loader(catalogs: Record<string, Record<string, string>>) {
  return vi.fn(async (locale: "en" | "de" | "pseudo") => catalogs[locale]);
}

async function flushPromises(count = 8): Promise<void> {
  for (let i = 0; i < count; i++) {
    await Promise.resolve();
  }
}

async function loadSettingsModule() {
  return import('./settings.js');
}

async function loadStateMutations() {
  return import('../state/mutations.js');
}

async function setupCustomizationSettings() {
  const i18n = await import('../i18n/index.js');
  await i18n.initI18n({ locale: 'en', loadLocale: loader({ en: enCatalog, de: deCatalog, pseudo: pseudoCatalog }) });
  const hydrateOnLocaleChange = () => i18n.hydrateI18n(document.body);
  document.addEventListener(i18n.I18N_LOCALE_CHANGED, hydrateOnLocaleChange);
  const settings = await loadSettingsModule();
  const state = await loadStateMutations();
  state.setAuthStatusAvailable(false);
  state.setUser(null);
  state.setSlug(null);
  state.setBoard(null);
  state.setProjects(null);
  state.setProjectId(null);
  state.setSettingsProjectId(null);
  state.setSettingsActiveTab('customization');
  state.setBoardMembers([]);
  return { i18n, settings, cleanup: () => document.removeEventListener(i18n.I18N_LOCALE_CHANGED, hydrateOnLocaleChange) };
}

describe('settings language selector', () => {
  beforeEach(() => {
    vi.resetModules();
    installBaseDOM();
    window.history.replaceState({}, '', '/');
    apiFetchMock.mockReset();
    fetchProjectMembersMock.mockReset();
    fetchProjectMembersMock.mockResolvedValue([]);
    loadTagSettingsContentMock.mockClear();
    windowFetchMock.mockClear();
    vi.stubGlobal('fetch', windowFetchMock);
  });

  afterEach(async () => {
    const i18n = await import('../i18n/index.js');
    i18n.resetI18nForTests();
    document.body.innerHTML = '';
    document.documentElement.lang = 'en';
    document.documentElement.removeAttribute('data-locale');
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('renders public locale options only', async () => {
    const { settings, cleanup } = await setupCustomizationSettings();
    try {
      await settings.renderSettingsModal();

      const select = document.getElementById('settingsLocaleSelect') as HTMLSelectElement | null;
      expect(select).toBeTruthy();
      expect(Array.from(select?.options ?? []).map((option) => [option.value, option.textContent])).toEqual([
        ['en', 'English'],
        ['de', 'Deutsch'],
        ['fr', 'Français'],
        ['pt', 'Português (Brasil)'],
      ]);
      expect(Array.from(select?.options ?? []).some((option) => option.value === 'pseudo')).toBe(false);
      expect(document.querySelector('label[for="settingsLocaleSelect"]')?.textContent).toBe('Language');
    } finally {
      cleanup();
    }
  });

  it('selecting German persists locale, updates lang, and hydrates migrated shell text', async () => {
    const { i18n, settings, cleanup } = await setupCustomizationSettings();
    try {
      await settings.renderSettingsModal();
      i18n.hydrateI18n(document.body);
      expect(document.getElementById('shellProbe')?.textContent).toBe('Shell text');

      const select = document.getElementById('settingsLocaleSelect') as HTMLSelectElement | null;
      if (!select) throw new Error('missing locale selector');
      select.value = 'de';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await flushPromises();

      expect(i18n.getLocale()).toBe('de');
      expect(localStorage.getItem(i18n.LOCALE_STORAGE_KEY)).toBe('de');
      expect(document.documentElement.lang).toBe('de');
      expect(document.documentElement.getAttribute('data-locale')).toBe('de');
      expect(document.getElementById('shellProbe')?.textContent).toBe('Shell-Text');
      expect(document.querySelector('label[for="settingsLocaleSelect"]')?.textContent).toBe('Sprache');
    } finally {
      cleanup();
    }
  });

  it('keeps pseudo hidden from Settings while the developer QA helper still works', async () => {
    const { i18n, settings, cleanup } = await setupCustomizationSettings();
    try {
      const qa = await import('../i18n/qa.js');
      const helper = qa.installI18nQa({
        target: window,
        storage: localStorage,
        location: { hostname: 'localhost' },
        nodeEnv: 'production',
      });
      await helper?.enablePseudo();
      await settings.renderSettingsModal();

      expect(i18n.getLocale()).toBe('pseudo');
      const select = document.getElementById('settingsLocaleSelect') as HTMLSelectElement | null;
      expect(Array.from(select?.options ?? []).map((option) => option.value)).toEqual(['en', 'de', 'fr', 'pt']);
      expect(Array.from(select?.options ?? []).some((option) => option.value === 'pseudo')).toBe(false);
    } finally {
      cleanup();
    }
  });
});
