// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import deCatalog from '../i18n/locales/de.json';
import enCatalog from '../i18n/locales/en.json';

const showToastMock = vi.hoisted(() => vi.fn());
const routeState = vi.hoisted(() => ({ route: 'board' as 'board' | 'dashboard' | 'projects' }));

vi.mock('../api.js', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('../router.js', () => ({
  navigate: vi.fn(),
}));

vi.mock('../utils.js', () => ({
  showToast: showToastMock,
}));

vi.mock('../state/mutations.js', () => ({
  setProjectsTab: vi.fn(),
}));

vi.mock('../state/selectors.js', () => ({
  getAuthStatusAvailable: () => true,
  getBoard: () => null,
  getProjectsTab: () => 'projects',
  getRoute: () => routeState.route,
  getUser: () => ({ id: 1 }),
}));

function installBaseDOM(): void {
  document.body.innerHTML = `
    <dialog id="settingsDialog"></dialog>
    <dialog id="todoDialog"></dialog>
  `;
}

async function initI18n(locale: 'en' | 'de') {
  const i18n = await import('../i18n/index.js');
  await i18n.initI18n({
    locale,
    loadLocale: vi.fn(async (next: 'en' | 'de') => (next === 'de' ? deCatalog : enCatalog)),
  });
  return i18n;
}

describe('keybindings i18n', () => {
  beforeEach(() => {
    vi.resetModules();
    installBaseDOM();
    localStorage.clear();
    showToastMock.mockClear();
    routeState.route = 'board';
  });

  afterEach(async () => {
    const i18n = await import('../i18n/index.js');
    i18n.resetI18nForTests();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps existing English toast fallback before the full catalog is initialized', async () => {
    const keybindings = await import('./keybindings.js');

    expect(keybindings.saveKeybindingOverride('openSettings', '')).toBe(false);

    expect(showToastMock).toHaveBeenCalledWith('Invalid key');
  });

  it('localizes validation and save-failure toasts', async () => {
    await initI18n('de');
    const keybindings = await import('./keybindings.js');

    expect(keybindings.saveKeybindingOverride('openSettings', '')).toBe(false);
    expect(showToastMock).toHaveBeenLastCalledWith(deCatalog['settings.customization.keybindings.toast.invalidKey']);

    expect(keybindings.saveKeybindingOverride('newTodo', 's')).toBe(false);
    expect(showToastMock).toHaveBeenLastCalledWith(deCatalog['settings.customization.keybindings.toast.duplicateKey']);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage full');
    });

    expect(keybindings.saveKeybindingOverride('openSettings', 'o')).toBe(false);
    expect(showToastMock).toHaveBeenLastCalledWith(deCatalog['settings.customization.keybindings.toast.saveFailed']);
  });

  it('localizes jump-action empty-state toasts', async () => {
    await initI18n('de');
    const keybindings = await import('./keybindings.js');
    routeState.route = 'dashboard';

    keybindings.executeAction('dashboardProject1');

    expect(showToastMock).toHaveBeenCalledWith(deCatalog['settings.customization.keybindings.toast.noProjectsAvailable']);
  });
});
