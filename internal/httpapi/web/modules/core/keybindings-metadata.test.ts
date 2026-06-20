// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api.js', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('../router.js', () => ({
  navigate: vi.fn(),
}));

vi.mock('../utils.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../state/mutations.js', () => ({
  setProjectsTab: vi.fn(),
}));

vi.mock('../state/selectors.js', () => ({
  getAuthStatusAvailable: () => false,
  getBoard: () => null,
  getProjectsTab: () => 'projects',
  getRoute: () => 'projects',
  getUser: () => null,
}));

function installBaseDOM(): void {
  document.body.innerHTML = `
    <dialog id="settingsDialog"></dialog>
    <dialog id="todoDialog"></dialog>
  `;
}

describe('keybinding metadata compatibility', () => {
  beforeEach(() => {
    vi.resetModules();
    installBaseDOM();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('keeps existing English labels while exposing i18n metadata', async () => {
    const keybindings = await import('./keybindings.js');

    const openSettings = keybindings.KEY_ACTION_LIST.find((meta) => meta.id === 'openSettings');
    const dashboardProject1 = keybindings.KEY_ACTION_LIST.find((meta) => meta.id === 'dashboardProject1');
    const projectsList1 = keybindings.KEY_ACTION_LIST.find((meta) => meta.id === 'projectsList1');

    expect(openSettings).toMatchObject({
      id: 'openSettings',
      label: 'Open Settings',
      labelKey: 'settings.customization.keybindings.actions.openSettings',
    });
    expect(dashboardProject1).toMatchObject({
      id: 'dashboardProject1',
      label: 'Jump to project 1 (dashboard)',
      labelKey: 'settings.customization.keybindings.actions.dashboardProject',
      labelValues: { index: 1 },
    });
    expect(projectsList1).toMatchObject({
      id: 'projectsList1',
      label: 'Open project 1 (projects list)',
      labelKey: 'settings.customization.keybindings.actions.projectsList',
      labelValues: { index: 1 },
    });
    const openWall = keybindings.KEY_ACTION_LIST.find((meta) => meta.id === 'openWall');
    expect(openWall).toMatchObject({
      id: 'openWall',
      label: 'Open wall',
      labelKey: 'settings.customization.keybindings.actions.openWall',
      contexts: ['board'],
    });
  });
});
