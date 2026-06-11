// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  apiFetchMock,
  fetchProjectMembersMock,
  loadTagSettingsContentMock,
  mountBurndownChartMock,
  destroyBurndownChartMock,
  requestDesktopNotificationPermissionMock,
  handleThemeChangeMock,
  saveKeybindingOverrideMock,
  setKeybindingsCaptureListeningMock,
  state,
} = vi.hoisted(() => {
  const state = {
    theme: 'system',
    wallpaperState: { v: 1, mode: 'off', hex: '#8b919a' },
    desktopNotificationKind: 'default',
    captureListening: false,
    savedChords: { openSettings: 'shift+s' } as Record<string, string>,
  };
  return {
    apiFetchMock: vi.fn(),
    fetchProjectMembersMock: vi.fn(),
    loadTagSettingsContentMock: vi.fn().mockResolvedValue(''),
    mountBurndownChartMock: vi.fn(),
    destroyBurndownChartMock: vi.fn(),
    requestDesktopNotificationPermissionMock: vi.fn(),
    handleThemeChangeMock: vi.fn((value: string) => {
      state.theme = value;
    }),
    saveKeybindingOverrideMock: vi.fn((actionId: string, chord: string) => {
      state.savedChords[actionId] = chord;
      return true;
    }),
    setKeybindingsCaptureListeningMock: vi.fn((active: boolean) => {
      state.captureListening = active;
    }),
    state,
  };
});

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
  getStoredTheme: () => state.theme,
  handleThemeChange: handleThemeChangeMock,
  THEME_SYSTEM: 'system',
  THEME_DARK: 'dark',
  THEME_LIGHT: 'light',
}));

vi.mock('../wallpaper.js', () => ({
  getStoredWallpaperState: () => state.wallpaperState,
  setWallpaperOff: vi.fn(),
  setWallpaperColor: vi.fn(),
  uploadWallpaperImage: vi.fn(),
}));

vi.mock('../charts/burndown.js', () => ({
  renderRealBurndownChart: (
    _data: any[],
    currentSprint?: { id?: number; name?: string } | null,
    sprintNav?: { canPrev: boolean; canNext: boolean },
  ) => `
    <div class="burndown-chart" data-current-sprint-id="${currentSprint?.id ?? ''}">
      <button id="burndown-prev" ${!sprintNav?.canPrev ? 'disabled' : ''} type="button">Prev</button>
      <div id="burndown-current-sprint">${currentSprint?.name ?? 'No sprint'}</div>
      <button id="burndown-next" ${!sprintNav?.canNext ? 'disabled' : ''} type="button">Next</button>
      <div id="burndown-uplot-mount"></div>
    </div>
  `,
  destroyBurndownChart: destroyBurndownChartMock,
  mountBurndownChart: mountBurndownChartMock,
}));

vi.mock('../events.js', () => ({
  emit: vi.fn(),
}));

vi.mock('../sprints.js', () => ({
  normalizeSprints: (value: { sprints?: any[] } | null | undefined) => value?.sprints ?? [],
}));

vi.mock('../core/keybindings.js', () => ({
  KEY_ACTION_LIST: [
    {
      id: 'openSettings',
      label: 'Open Settings',
      labelKey: 'settings.customization.keybindings.actions.openSettings',
      contexts: ['unknown'],
    },
  ],
  chordFromKeyboardEvent: (event: KeyboardEvent) => {
    if (event.key === 'Escape') return 'escape';
    if (event.ctrlKey && event.key.toLowerCase() === 'k') return 'ctrl+k';
    return null;
  },
  formatChordForDisplay: (chord: string) => (chord === 'ctrl+k' ? 'Ctrl+K' : chord === 'shift+s' ? 'Shift+S' : chord),
  getResolvedChordForAction: (actionId: string) => state.savedChords[actionId] ?? 'shift+s',
  isTypingInTextField: () => false,
  reloadKeybindingsFromStorage: vi.fn(),
  saveKeybindingOverride: saveKeybindingOverrideMock,
  setKeybindingsCaptureListening: setKeybindingsCaptureListeningMock,
}));

vi.mock('../core/assignmentNotify.js', () => ({
  requestDesktopNotificationPermission: requestDesktopNotificationPermissionMock,
  getDesktopNotificationStatusKind: () => state.desktopNotificationKind,
  getDesktopNotificationStatusDescription: () => {
    switch (state.desktopNotificationKind) {
      case 'unsupported':
        return 'Not supported in this browser.';
      case 'granted':
        return 'Enabled - you will receive OS notifications for new assignments.';
      case 'denied':
        return 'Blocked — allow notifications for this site in your browser settings.';
      default:
        return 'Not enabled yet — click the button below (your browser will ask for permission).';
    }
  },
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
  'common.close': 'Close',
  'settings.shell.title': 'Settings',
  'settings.language.title': 'Language',
  'settings.language.description': 'Choose the language used for Scrumboy on this browser.',
  'settings.language.selectLabel': 'Language',
  'settings.tabs.profile': 'Profile',
  'settings.tabs.users': 'Users',
  'settings.tabs.sprints': 'Sprints',
  'settings.tabs.workflow': 'Workflow',
  'settings.tabs.customization': 'Customization',
  'settings.tabs.tagColors': 'Tag Colors',
  'settings.tabs.charts': 'Charts',
  'settings.tabs.backup': 'Backup',
  'settings.customization.theme.title': 'Theme',
  'settings.customization.theme.description': 'Choose your preferred color scheme.',
  'settings.customization.theme.option.system': 'System',
  'settings.customization.theme.option.dark': 'Dark',
  'settings.customization.theme.option.light': 'Light',
  'settings.customization.wallpaper.title': 'Wallpaper',
  'settings.customization.wallpaper.description': 'Optional background behind the app. A scrim keeps text readable. Boards and cards stay solid; Settings can show the wallpaper when it is active.',
  'settings.customization.wallpaper.summary.off': 'Off: default appearance',
  'settings.customization.wallpaper.summary.color': 'Solid color: active',
  'settings.customization.wallpaper.summary.builtin': 'Default image: active',
  'settings.customization.wallpaper.summary.image': 'Custom image: active',
  'settings.customization.wallpaper.mode.off': 'Off',
  'settings.customization.wallpaper.mode.color': 'Solid color',
  'settings.customization.wallpaper.mode.image': 'Custom image',
  'settings.customization.wallpaper.colorLabel': 'Color',
  'settings.customization.wallpaper.actions.upload': 'Upload image…',
  'settings.customization.wallpaper.actions.replace': 'Replace image…',
  'settings.customization.wallpaper.actions.remove': 'Remove wallpaper',
  'settings.customization.wallpaper.signInHint': 'Sign in to use a custom image. Solid color and Off work without signing in.',
  'settings.customization.wallpaper.toast.updated': 'Wallpaper updated',
  'settings.customization.wallpaper.toast.uploadFailed': 'Upload failed',
  'settings.customization.wallpaper.toast.signInRequired': 'Sign in to use a custom image',
  'settings.customization.wallpaper.toast.removed': 'Wallpaper removed',
  'settings.customization.notifications.title': 'Desktop notifications',
  'settings.customization.notifications.description': 'OS-level alerts when someone assigns you a todo (works when this tab is in the background).',
  'settings.customization.notifications.status.unsupported': 'Not supported in this browser.',
  'settings.customization.notifications.status.granted': 'Enabled - you will receive OS notifications for new assignments.',
  'settings.customization.notifications.status.denied': 'Blocked — allow notifications for this site in your browser settings.',
  'settings.customization.notifications.status.default': 'Not enabled yet — click the button below (your browser will ask for permission).',
  'settings.customization.notifications.actions.enable': 'Enable notifications',
  'settings.customization.notifications.actions.enabled': 'Notifications enabled',
  'settings.customization.notifications.toast.enabled': 'Desktop notifications enabled',
  'settings.customization.notifications.toast.blocked': 'Notifications blocked. You can allow them in your browser settings for this site.',
  'settings.customization.notifications.toast.notGranted': 'Notification permission not granted',
  'settings.customization.keybindings.title': 'Keybindings',
  'settings.customization.keybindings.description': 'Click a key to record a new shortcut. Press Esc to cancel while listening.',
  'settings.customization.keybindings.capturePrompt': 'Press a shortcut for {action}',
  'settings.customization.keybindings.actions.openSettings': 'Open Settings',
};

function prefixCatalog(prefix: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(enCatalog).map(([key, value]) => [
      key,
      prefix === '[!!' ? `[!! ${value} !!]` : `${prefix}${value}`,
    ]),
  );
}

const deCatalog = prefixCatalog('DE ');
const pseudoCatalog = prefixCatalog('[!!');

function installBaseDOM(): void {
  document.body.innerHTML = `
    <dialog id="settingsDialog">
      <div class="dialog__header">
        <div class="dialog__title">
          <span id="settingsDialogTitleLabel" data-i18n-text="settings.shell.title">Settings</span>
          <span id="settingsDialogVersion"></span>
        </div>
        <button id="closeSettingsBtn" type="button" data-i18n-aria-label="common.close"></button>
      </div>
      <div class="dialog__content"></div>
    </dialog>
  `;
}

function loader(catalogs: Record<string, Record<string, string>>) {
  return vi.fn(async (locale: 'en' | 'de' | 'pseudo') => catalogs[locale]);
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

async function initSettingsI18n(locale: 'en' | 'de' | 'pseudo' = 'en') {
  const i18n = await import('../i18n/index.js');
  await i18n.initI18n({
    locale,
    loadLocale: loader({ en: enCatalog, de: deCatalog, pseudo: pseudoCatalog }),
  });
  return i18n;
}

async function setupSettingsView(options: {
  locale?: 'en' | 'de' | 'pseudo';
  activeTab?: string;
  authStatusAvailable?: boolean;
  slug?: string | null;
  board?: Record<string, unknown> | null;
  pushConfigured?: boolean;
} = {}) {
  const i18n = await initSettingsI18n(options.locale ?? 'en');
  const settings = await loadSettingsModule();
  const mutations = await loadStateMutations();
  mutations.setAuthStatusAvailable(options.authStatusAvailable ?? true);
  mutations.setPushConfigured(options.pushConfigured ?? false);
  mutations.setUser(null);
  mutations.setSlug(options.slug ?? null);
  mutations.setBoard((options.board as any) ?? null);
  mutations.setProjects(null);
  mutations.setProjectId(null);
  mutations.setSettingsProjectId(null);
  mutations.setSettingsActiveTab(options.activeTab ?? 'customization');
  mutations.setBoardMembers([]);
  await settings.renderSettingsModal();
  return { i18n, settings };
}

describe('settings customization i18n', () => {
  beforeEach(() => {
    vi.resetModules();
    installBaseDOM();
    window.history.replaceState({}, '', '/');
    apiFetchMock.mockReset();
    fetchProjectMembersMock.mockReset();
    fetchProjectMembersMock.mockResolvedValue([]);
    loadTagSettingsContentMock.mockClear();
    mountBurndownChartMock.mockClear();
    destroyBurndownChartMock.mockClear();
    requestDesktopNotificationPermissionMock.mockReset();
    handleThemeChangeMock.mockClear();
    saveKeybindingOverrideMock.mockClear();
    setKeybindingsCaptureListeningMock.mockClear();
    state.theme = 'system';
    state.wallpaperState = { v: 1, mode: 'off', hex: '#8b919a' };
    state.desktopNotificationKind = 'default';
    state.captureListening = false;
    state.savedChords = { openSettings: 'shift+s' };
  });

  afterEach(async () => {
    const i18n = await import('../i18n/index.js');
    const settingsGlobal = globalThis as { __scrumboySettingsLocaleListener?: EventListener };
    if (settingsGlobal.__scrumboySettingsLocaleListener) {
      document.removeEventListener('scrumboy:i18n-locale-changed', settingsGlobal.__scrumboySettingsLocaleListener);
      delete settingsGlobal.__scrumboySettingsLocaleListener;
    }
    i18n.resetI18nForTests();
    document.body.innerHTML = '';
    document.documentElement.lang = 'en';
    document.documentElement.removeAttribute('data-locale');
    localStorage.clear();
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('renders English shell and customization copy by default', async () => {
    await setupSettingsView();

    expect(document.getElementById('settingsDialogTitleLabel')?.textContent).toBe('Settings');
    expect(document.getElementById('settingsDialogVersion')?.textContent).toBe(' vtest-version');
    expect(document.querySelector('.settings-tab[data-tab="customization"]')?.textContent).toBe('Customization');
    expect(document.querySelector('.settings-tab[data-tab="profile"]')?.textContent).toBe('Profile');
    expect(document.querySelector('.settings-section__title')?.textContent).toBe('Language');
    expect(document.getElementById('desktopNotifyStatus')?.textContent).toBe(enCatalog['settings.customization.notifications.status.default']);
    expect(document.querySelector('.settings-section--keybindings .settings-section__title')?.textContent).toBe('Keybindings');
  });

  it('renders catalog-backed pseudo strings on first render', async () => {
    await setupSettingsView({ locale: 'pseudo' });

    expect(document.getElementById('settingsDialogTitleLabel')?.textContent).toBe('[!! Settings !!]');
    expect(document.querySelector('.settings-tab[data-tab="customization"]')?.textContent).toBe('[!! Customization !!]');
    expect(document.querySelector('.settings-section--keybindings .settings-section__title')?.textContent).toBe('[!! Keybindings !!]');
  });

  it('updates visible customization copy in place on locale change while preserving version, options, and unsaved state', async () => {
    const { i18n } = await setupSettingsView();

    const titleLabel = document.getElementById('settingsDialogTitleLabel');
    const version = document.getElementById('settingsDialogVersion');
    const themeLight = document.querySelector<HTMLInputElement>('input[name="theme"][value="light"]');
    const languageSelect = document.getElementById('settingsLocaleSelect') as HTMLSelectElement | null;
    const wallpaperRemoveBtn = document.getElementById('wallpaperRemoveBtn');

    if (!titleLabel || !version || !themeLight || !languageSelect || !wallpaperRemoveBtn) {
      throw new Error('missing customization controls');
    }

    themeLight.checked = true;
    const versionBefore = version.textContent;

    languageSelect.value = 'de';
    languageSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await flushPromises();

    expect(i18n.getLocale()).toBe('de');
    expect(titleLabel.textContent).toBe('DE Settings');
    expect(version.textContent).toBe(versionBefore);
    expect(themeLight.checked).toBe(true);
    expect(languageSelect.value).toBe('de');
    expect(Array.from(languageSelect.options).map((option) => [option.value, option.textContent])).toEqual([
      ['en', 'English'],
      ['de', 'Deutsch'],
      ['fr', 'Français'],
      ['pt', 'Português (Brasil)'],
    ]);
    expect(wallpaperRemoveBtn.textContent).toBe('DE Remove wallpaper');
  });

  it('preserves active keybinding capture across locale change and does not duplicate listeners', async () => {
    await setupSettingsView();

    const captureBtn = document.querySelector<HTMLElement>('[data-keybinding-capture][data-keybinding-action="openSettings"]');
    if (!captureBtn) {
      throw new Error('missing keybinding capture button');
    }

    captureBtn.click();
    expect(captureBtn.classList.contains('keybinding-capture--listening')).toBe(true);
    expect(captureBtn.textContent).toBe('Press a shortcut for Open Settings');

    const i18n = await import('../i18n/index.js');
    await i18n.setLocale('de');
    await flushPromises();

    expect(captureBtn.classList.contains('keybinding-capture--listening')).toBe(true);
    expect(captureBtn.textContent).toBe('DE Press a shortcut for DE Open Settings');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    await flushPromises();

    expect(saveKeybindingOverrideMock).toHaveBeenCalledTimes(1);
    expect(saveKeybindingOverrideMock).toHaveBeenCalledWith('openSettings', 'ctrl+k');
    expect(captureBtn.classList.contains('keybinding-capture--listening')).toBe(false);
    expect(captureBtn.textContent).toBe('Ctrl+K');
  });

  it('updates desktop notification labels on locale change without requesting permission', async () => {
    state.desktopNotificationKind = 'granted';
    const { i18n } = await setupSettingsView();

    const status = document.getElementById('desktopNotifyStatus');
    const button = document.getElementById('desktopNotifyEnableBtn') as HTMLButtonElement | null;
    if (!status || !button) {
      throw new Error('missing desktop notification controls');
    }

    expect(status.textContent).toBe(enCatalog['settings.customization.notifications.status.granted']);
    expect(button.textContent).toBe(enCatalog['settings.customization.notifications.actions.enabled']);
    expect(button.disabled).toBe(true);

    await i18n.setLocale('de');
    await flushPromises();

    expect(status.textContent).toBe(`DE ${enCatalog['settings.customization.notifications.status.granted']}`);
    expect(button.textContent).toBe(`DE ${enCatalog['settings.customization.notifications.actions.enabled']}`);
    expect(button.disabled).toBe(true);
    expect(requestDesktopNotificationPermissionMock).not.toHaveBeenCalled();
  });

  it('keeps a non-customization tab active and leaves its content untouched on locale change', async () => {
    apiFetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/board/alpha/sprints') {
        return {
          sprints: [
            { id: 1, name: 'Sprint 1', state: 'ACTIVE', plannedStartAt: 1000, plannedEndAt: 2000 },
          ],
        };
      }
      if (url === '/api/board/alpha/sprints/1/burndown') {
        return [{ date: '2026-04-13T00:00:00Z', remainingWork: 5, initialScope: 5 }];
      }
      throw new Error(`unexpected apiFetch url: ${url}`);
    });

    const { i18n } = await setupSettingsView({
      activeTab: 'charts',
      slug: 'alpha',
      board: { project: {} },
    });

    const activeTab = document.querySelector('.settings-tab--active[data-tab="charts"]');
    const sprintEl = document.getElementById('burndown-current-sprint');
    if (!(activeTab instanceof HTMLElement) || !(sprintEl instanceof HTMLElement)) {
      throw new Error('missing charts tab content');
    }

    const sprintNodeBefore = sprintEl;
    apiFetchMock.mockClear();
    mountBurndownChartMock.mockClear();

    await i18n.setLocale('de');
    await flushPromises();

    expect(document.querySelector('.settings-tab--active[data-tab="charts"]')).toBe(activeTab);
    expect(document.getElementById('burndown-current-sprint')).toBe(sprintNodeBefore);
    expect(document.getElementById('settingsDialogTitleLabel')?.textContent).toBe('DE Settings');
    expect(document.querySelector('.settings-tab[data-tab="charts"]')?.textContent).toBe('DE Charts');
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(mountBurndownChartMock).not.toHaveBeenCalled();
  });
});
