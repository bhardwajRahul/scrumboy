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

function installBaseDOM(): void {
  document.body.innerHTML = `
    <dialog id="settingsDialog">
      <div class="dialog__title"></div>
      <div class="dialog__content"></div>
    </dialog>
    <button id="closeSettingsBtn" type="button"></button>
  `;
}

async function loadSettingsModule() {
  return import('./settings.js');
}

async function loadStateMutations() {
  return import('../state/mutations.js');
}

describe('settings-push', () => {
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

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('renders the disabled push notice from auth status without probing the vapid route', async () => {
    const settings = await loadSettingsModule();
    const state = await loadStateMutations();
    state.setAuthStatusAvailable(true);
    state.setPushConfigured(false);
    state.setUser(null);
    state.setSlug(null);
    state.setBoard(null);
    state.setProjects(null);
    state.setProjectId(null);
    state.setSettingsProjectId(null);
    state.setSettingsActiveTab('customization');
    state.setBoardMembers([]);

    await settings.renderSettingsModal();

    expect(windowFetchMock).not.toHaveBeenCalled();
    const notice = document.querySelector('.settings-push-vapid-notice');
    if (!(notice instanceof HTMLElement)) {
      throw new Error('missing push notice');
    }
    expect(notice.textContent ?? '').toContain('SCRUMBOY_VAPID_PUBLIC_KEY');
    const pushToggle = document.getElementById('pushNotifyToggle');
    if (!(pushToggle instanceof HTMLInputElement)) {
      throw new Error('missing push toggle');
    }
    expect(pushToggle.disabled).toBe(true);
  });
});
