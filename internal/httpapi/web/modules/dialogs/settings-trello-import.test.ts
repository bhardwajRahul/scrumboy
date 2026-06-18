// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enCatalog from '../i18n/locales/en.json';
import deCatalog from '../i18n/locales/de.json';

const apiFetchMock = vi.fn();
const showToastMock = vi.fn();

vi.mock('../api.js', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('../members-cache.js', () => ({
  fetchProjectMembers: vi.fn(),
}));

vi.mock('../utils.js', () => ({
  escapeHTML: (s: string) =>
    String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;'),
  showToast: showToastMock,
  getAppVersion: () => 'test-version',
  showConfirmDialog: vi.fn(),
  confirmDelete: vi.fn(),
  isAnonymousBoard: () => false,
  renderUserAvatar: () => '',
  processImageFile: vi.fn(),
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
  getDesktopNotificationStatusKind: () => 'default',
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
  loadTagSettingsContent: vi.fn().mockResolvedValue(''),
}));

vi.mock('./settings-sprints.js', () => ({
  bindSprintsTabInteractions: vi.fn(),
  renderSprintsTabContent: vi.fn().mockResolvedValue(''),
}));

function installBaseDOM(): void {
  document.body.innerHTML = `
    <dialog id="settingsDialog">
      <div class="dialog__header">
        <div class="dialog__title">
          <span id="settingsDialogTitleLabel">Settings</span>
          <span id="settingsDialogVersion"></span>
        </div>
        <button id="closeSettingsBtn" type="button"></button>
      </div>
      <div class="dialog__content"></div>
    </dialog>
  `;
}

function loader() {
  const catalogs: Record<string, Record<string, string>> = {
    en: enCatalog as Record<string, string>,
    de: deCatalog as Record<string, string>,
  };
  return vi.fn(async (locale: string) => catalogs[locale]);
}

async function initI18nFor(locale: 'en' | 'de' = 'en') {
  const i18n = await import('../i18n/index.js');
  await i18n.initI18n({ locale, loadLocale: loader() });
  return i18n;
}

async function loadSettingsModule() {
  const mod = await import('./settings.js');
  return mod;
}

async function loadStateMutations() {
  const mod = await import('../state/mutations.js');
  return mod;
}

describe('settings-trello-import', () => {
  beforeEach(async () => {
    vi.resetModules();
    installBaseDOM();
    apiFetchMock.mockReset();
    showToastMock.mockClear();
    await initI18nFor('en');
  });

  afterEach(async () => {
    const i18n = await import('../i18n/index.js');
    i18n.resetI18nForTests();
    document.body.innerHTML = '';
    showToastMock.mockClear();
  });

  it('renders the Trello import section and only enables import after a clean preview', async () => {
    const mod = await loadSettingsModule();
    const mutations = await loadStateMutations();

    document.body.innerHTML += mod.renderBackupTabHTML();
    const previewBtn = document.getElementById('trelloImportPreviewBtn');
    const importBtn = document.getElementById('trelloImportBtn');
    if (!(previewBtn instanceof HTMLButtonElement)) throw new Error('missing preview button');
    if (!(importBtn instanceof HTMLButtonElement)) throw new Error('missing import button');
    mutations.setTrelloImportBtn(importBtn);

    mod.updateTrelloImportUI();
    expect(previewBtn.disabled).toBe(true);
    expect(importBtn.disabled).toBe(true);

    mutations.setTrelloImportData('{"name":"board"}');
    mod.updateTrelloImportUI();
    expect(previewBtn.disabled).toBe(false);
    expect(importBtn.disabled).toBe(true);

    mutations.setTrelloImportPreview({
      boardName: 'Board',
      openLists: 2,
      closedLists: 1,
      cards: 3,
      archivedCards: 1,
      labels: 2,
      membersReferenced: 1,
      checklists: 1,
      checklistItems: 2,
      commentCardActions: 1,
      attachments: 1,
      customFieldItems: 1,
      detectedDoneColumn: 'Done',
      detectedDoneReason: 'matched done name',
      hardErrors: ['Too many lists'],
      warnings: ['Comments may be incomplete'],
    });
    mod.updateTrelloImportUI();
    expect(importBtn.disabled).toBe(true);

    mutations.setTrelloImportPreview({
      boardName: 'Board',
      openLists: 2,
      closedLists: 1,
      cards: 3,
      archivedCards: 1,
      labels: 2,
      membersReferenced: 1,
      checklists: 1,
      checklistItems: 2,
      commentCardActions: 1,
      attachments: 1,
      customFieldItems: 1,
      detectedDoneColumn: 'Done',
      detectedDoneReason: 'matched done name',
      hardErrors: [],
      warnings: ['Comments may be incomplete'],
    });
    mod.updateTrelloImportUI();
    expect(importBtn.disabled).toBe(false);
  });

  it('renders Trello preview, warnings, and import result details', async () => {
    const mod = await loadSettingsModule();

    document.body.innerHTML += mod.renderBackupTabHTML();
    mod.renderTrelloPreview({
      boardName: 'Sanitized Board',
      openLists: 2,
      closedLists: 1,
      cards: 3,
      archivedCards: 1,
      labels: 2,
      membersReferenced: 2,
      checklists: 1,
      checklistItems: 3,
      commentCardActions: 2,
      attachments: 1,
      customFieldItems: 1,
      detectedDoneColumn: 'Done',
      detectedDoneReason: 'rightmost open list',
      hardErrors: [],
      warnings: ['Attachments import as links only'],
    });
    mod.renderTrelloWarnings({
      boardName: 'Sanitized Board',
      openLists: 2,
      closedLists: 1,
      cards: 3,
      archivedCards: 1,
      labels: 2,
      membersReferenced: 2,
      checklists: 1,
      checklistItems: 3,
      commentCardActions: 2,
      attachments: 1,
      customFieldItems: 1,
      detectedDoneColumn: 'Done',
      detectedDoneReason: 'rightmost open list',
      hardErrors: ['Missing list id list-x'],
      warnings: ['Attachments import as links only'],
    });
    mod.renderTrelloImportResult({
      project: {
        id: 7,
        name: 'Sanitized Board',
        slug: 'sanitized-board',
      },
      summary: {
        projects: 1,
        todos: 3,
        labels: 2,
        openLists: 2,
        closedLists: 1,
        archivedCards: 1,
        checklists: 1,
        checklistItems: 3,
        commentCardActions: 2,
        attachments: 1,
        customFieldItems: 1,
      },
      warnings: ['Attachments import as links only'],
    });

    expect(document.getElementById('trelloImportPreview')?.textContent).toContain('Sanitized Board');
    expect(document.getElementById('trelloImportPreview')?.textContent).toContain('Done');
    expect(document.getElementById('trelloImportWarnings')?.textContent).toContain('Hard errors');
    expect(document.getElementById('trelloImportWarnings')?.textContent).toContain('Attachments import as links only');

    const resultEl = document.getElementById('trelloImportResult');
    const link = resultEl?.querySelector('a');
    expect(resultEl?.textContent).toContain('Import complete');
    expect(link?.getAttribute('href')).toBe('/sanitized-board');
  });

  it('localizes Trello preview/warnings/result labels while keeping raw payload values unchanged', async () => {
    const mod = await loadSettingsModule();
    const i18n = await import('../i18n/index.js');

    const preview = {
      boardName: 'Quarterly Roadmap',
      openLists: 2,
      closedLists: 1,
      cards: 3,
      archivedCards: 1,
      labels: 2,
      membersReferenced: 2,
      checklists: 1,
      checklistItems: 3,
      commentCardActions: 2,
      attachments: 1,
      customFieldItems: 1,
      detectedDoneColumn: 'Shipped',
      detectedDoneReason: 'rightmost open list',
      hardErrors: ['Missing list id list-x'],
      warnings: ['Attachments import as links only'],
    };
    const result = {
      project: { id: 7, name: 'Quarterly Roadmap', slug: 'quarterly-roadmap' },
      summary: {
        projects: 1,
        todos: 3,
        labels: 2,
        openLists: 2,
        closedLists: 1,
        archivedCards: 1,
        checklists: 1,
        checklistItems: 3,
        commentCardActions: 2,
        attachments: 1,
        customFieldItems: 1,
      },
      warnings: ['Attachments import as links only'],
    };

    document.body.innerHTML += mod.renderBackupTabHTML();
    mod.renderTrelloPreview(preview);
    mod.renderTrelloWarnings(preview);
    mod.renderTrelloImportResult(result);

    expect(document.getElementById('trelloImportPreview')?.textContent).toContain('Open lists: 2');
    expect(document.getElementById('trelloImportWarnings')?.textContent).toContain('Hard errors');
    expect(document.getElementById('trelloImportResult')?.textContent).toContain('Import complete');

    await i18n.setLocale('de');
    // Re-render from the same payload, mirroring the locale-change rebuild path.
    mod.renderTrelloPreview(preview);
    mod.renderTrelloWarnings(preview);
    mod.renderTrelloImportResult(result);

    const previewText = document.getElementById('trelloImportPreview')?.textContent ?? '';
    const warningsText = document.getElementById('trelloImportWarnings')?.textContent ?? '';
    const resultText = document.getElementById('trelloImportResult')?.textContent ?? '';

    // Localized chrome changes...
    expect(previewText).toContain('Offene Listen: 2');
    expect(warningsText).toContain('Schwerwiegende Fehler');
    expect(resultText).toContain('Import abgeschlossen');
    // ...while raw backend/payload values stay exactly as provided.
    expect(previewText).toContain('Quarterly Roadmap');
    expect(previewText).toContain('Shipped');
    expect(previewText).toContain('rightmost open list');
    expect(warningsText).toContain('Missing list id list-x');
    expect(warningsText).toContain('Attachments import as links only');
    const link = document.getElementById('trelloImportResult')?.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/quarterly-roadmap');
    expect(link?.textContent).toBe('Quarterly Roadmap');
  });

  it('sends the exact raw Trello JSON string to preview and import endpoints', async () => {
    const mod = await loadSettingsModule();
    const mutations = await loadStateMutations();
    const raw = '{"id":"board-raw","name":"Raw Trello"}';

    document.body.innerHTML += mod.renderBackupTabHTML();
    const importBtn = document.getElementById('trelloImportBtn');
    if (!(importBtn instanceof HTMLButtonElement)) throw new Error('missing import button');
    mutations.setTrelloImportBtn(importBtn);
    mutations.setTrelloImportData(raw);

    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValueOnce({
      boardName: 'Raw Trello',
      openLists: 1,
      closedLists: 0,
      cards: 1,
      archivedCards: 0,
      labels: 0,
      membersReferenced: 0,
      checklists: 0,
      checklistItems: 0,
      commentCardActions: 0,
      attachments: 0,
      customFieldItems: 0,
      detectedDoneColumn: 'Done',
      detectedDoneReason: 'Synthesized a Done column because the Trello board has only one open list.',
      hardErrors: [],
      warnings: [],
    });
    await mod.handleTrelloPreview();
    expect(apiFetchMock).toHaveBeenCalledWith('/api/import/trello/preview', {
      method: 'POST',
      body: raw,
    });

    apiFetchMock.mockReset();
    mutations.setTrelloImportPreview({
      boardName: 'Raw Trello',
      openLists: 1,
      closedLists: 0,
      cards: 1,
      archivedCards: 0,
      labels: 0,
      membersReferenced: 0,
      checklists: 0,
      checklistItems: 0,
      commentCardActions: 0,
      attachments: 0,
      customFieldItems: 0,
      detectedDoneColumn: 'Done',
      detectedDoneReason: 'Synthesized a Done column because the Trello board has only one open list.',
      hardErrors: [],
      warnings: [],
    });
    apiFetchMock.mockResolvedValueOnce({
      project: { id: 1, name: 'Raw Trello', slug: 'raw-trello' },
      summary: {
        projects: 1,
        todos: 1,
        labels: 0,
        openLists: 1,
        closedLists: 0,
        archivedCards: 0,
        checklists: 0,
        checklistItems: 0,
        commentCardActions: 0,
        attachments: 0,
        customFieldItems: 0,
      },
      warnings: [],
    });
    await mod.handleTrelloImport();
    expect(apiFetchMock).toHaveBeenCalledWith('/api/import/trello', {
      method: 'POST',
      body: raw,
    });
  });

  it('shows a localized backend validation reason when Trello preview fails', async () => {
    const mod = await loadSettingsModule();
    const mutations = await loadStateMutations();
    const i18n = await import('../i18n/index.js');
    await i18n.setLocale('de');

    document.body.innerHTML += mod.renderBackupTabHTML();
    mutations.setTrelloImportData('not json');

    const err = new Error('invalid Trello JSON') as Error & { data?: unknown };
    err.data = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'invalid Trello JSON',
        details: { reason: 'invalid_trello_json', detail: 'bad json' },
      },
    };
    apiFetchMock.mockRejectedValueOnce(err);

    await mod.handleTrelloPreview();

    expect(showToastMock).toHaveBeenCalledWith(deCatalog['errors.VALIDATION_ERROR.invalid_trello_json']);
  });
});
