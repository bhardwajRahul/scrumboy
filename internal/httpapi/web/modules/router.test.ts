// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  apiFetchMock,
  renderAuthMock,
  renderResetPasswordMock,
  renderProjectsMock,
  renderDashboardMock,
  renderBoardMock,
  renderNotFoundMock,
  stopBoardEventsMock,
  startGlobalRealtimeMock,
  stopGlobalRealtimeMock,
  initForegroundLifecycleMock,
  hydrateNotificationsForUserMock,
  initNotificationBadgeMock,
  unsubscribeFromPushMock,
  maybeAutoSubscribePushAfterLoginMock,
  loadUserThemeMock,
  applyWallpaperForAuthContextMock,
  loadUserWallpaperMock,
  hydrateVoiceFlowEnabledFromServerMock,
  hydrateVoiceFlowHandsFreeConfirmationFromServerMock,
  hydrateVoiceFlowModeFromServerMock,
} = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  renderAuthMock: vi.fn(),
  renderResetPasswordMock: vi.fn(),
  renderProjectsMock: vi.fn(),
  renderDashboardMock: vi.fn(),
  renderBoardMock: vi.fn(),
  renderNotFoundMock: vi.fn(),
  stopBoardEventsMock: vi.fn(),
  startGlobalRealtimeMock: vi.fn(),
  stopGlobalRealtimeMock: vi.fn(),
  initForegroundLifecycleMock: vi.fn(),
  hydrateNotificationsForUserMock: vi.fn(),
  initNotificationBadgeMock: vi.fn(),
  unsubscribeFromPushMock: vi.fn().mockResolvedValue(undefined),
  maybeAutoSubscribePushAfterLoginMock: vi.fn(),
  loadUserThemeMock: vi.fn().mockResolvedValue(undefined),
  applyWallpaperForAuthContextMock: vi.fn(),
  loadUserWallpaperMock: vi.fn().mockResolvedValue(undefined),
  hydrateVoiceFlowEnabledFromServerMock: vi.fn(),
  hydrateVoiceFlowHandsFreeConfirmationFromServerMock: vi.fn(),
  hydrateVoiceFlowModeFromServerMock: vi.fn(),
}));

vi.mock('./api.js', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('./views/index.js', () => ({
  renderAuth: renderAuthMock,
  renderResetPassword: renderResetPasswordMock,
  renderProjects: renderProjectsMock,
  renderDashboard: renderDashboardMock,
  renderBoard: renderBoardMock,
  renderNotFound: renderNotFoundMock,
  stopBoardEvents: stopBoardEventsMock,
}));

vi.mock('./core/realtime.js', () => ({
  startGlobalRealtime: startGlobalRealtimeMock,
  stopGlobalRealtime: stopGlobalRealtimeMock,
  initForegroundLifecycle: initForegroundLifecycleMock,
}));

vi.mock('./core/notifications.js', () => ({
  hydrateNotificationsForUser: hydrateNotificationsForUserMock,
  initNotificationBadge: initNotificationBadgeMock,
}));

vi.mock('./core/push.js', () => ({
  unsubscribeFromPush: unsubscribeFromPushMock,
  maybeAutoSubscribePushAfterLogin: maybeAutoSubscribePushAfterLoginMock,
}));

vi.mock('./theme.js', () => ({
  loadUserTheme: loadUserThemeMock,
}));

vi.mock('./wallpaper.js', () => ({
  applyWallpaperForAuthContext: applyWallpaperForAuthContextMock,
  loadUserWallpaper: loadUserWallpaperMock,
}));

vi.mock('./core/voiceflow-preferences.js', () => ({
  hydrateVoiceFlowEnabledFromServer: hydrateVoiceFlowEnabledFromServerMock,
  hydrateVoiceFlowHandsFreeConfirmationFromServer: hydrateVoiceFlowHandsFreeConfirmationFromServerMock,
  hydrateVoiceFlowModeFromServer: hydrateVoiceFlowModeFromServerMock,
  VOICE_FLOW_ENABLED_PREFERENCE_KEY: 'voiceflowEnabled',
  VOICE_FLOW_HANDS_FREE_CONFIRMATION_PREFERENCE_KEY: 'voiceflowHandsFreeConfirmation',
  VOICE_FLOW_MODE_PREFERENCE_KEY: 'voiceflowMode',
}));

function userStatus() {
  return {
    id: 7,
    email: 'ada@example.com',
    name: 'Ada',
    isBootstrap: false,
    systemRole: 'user',
    twoFactorEnabled: false,
  };
}

async function loadRouterModule() {
  return import('./router.js');
}

describe('router push autosubscribe gate', () => {
  beforeEach(() => {
    vi.resetModules();
    window.history.replaceState({}, '', '/');
    localStorage.clear();
    apiFetchMock.mockReset();
    renderAuthMock.mockReset();
    renderResetPasswordMock.mockReset();
    renderProjectsMock.mockReset();
    renderDashboardMock.mockReset();
    renderBoardMock.mockReset();
    renderNotFoundMock.mockReset();
    stopBoardEventsMock.mockReset();
    startGlobalRealtimeMock.mockReset();
    stopGlobalRealtimeMock.mockReset();
    initForegroundLifecycleMock.mockReset();
    hydrateNotificationsForUserMock.mockReset();
    initNotificationBadgeMock.mockReset();
    unsubscribeFromPushMock.mockClear();
    maybeAutoSubscribePushAfterLoginMock.mockClear();
    loadUserThemeMock.mockClear();
    applyWallpaperForAuthContextMock.mockClear();
    loadUserWallpaperMock.mockClear();
    hydrateVoiceFlowEnabledFromServerMock.mockClear();
    hydrateVoiceFlowHandsFreeConfirmationFromServerMock.mockClear();
    hydrateVoiceFlowModeFromServerMock.mockClear();
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function installAuthStatus(pushConfigured: boolean): void {
    apiFetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/auth/status') {
        return {
          user: userStatus(),
          bootstrapAvailable: false,
          mode: 'full',
          pushConfigured,
          oidcEnabled: false,
          localAuthEnabled: true,
          wallEnabled: false,
          markdownNotesEnabled: false,
          mermaidNotesEnabled: false,
        };
      }
      if (url === '/api/me') {
        return userStatus();
      }
      if (url.startsWith('/api/user/preferences?key=')) {
        return {};
      }
      throw new Error(`unexpected apiFetch url: ${url}`);
    });
  }

  it('skips auto-subscribe when auth status says push is not configured', async () => {
    installAuthStatus(false);
    const mod = await loadRouterModule();

    await mod.router();

    expect(maybeAutoSubscribePushAfterLoginMock).not.toHaveBeenCalled();
    expect(renderProjectsMock).toHaveBeenCalledTimes(1);
  });

  it('auto-subscribes after login when auth status says push is configured', async () => {
    installAuthStatus(true);
    const mod = await loadRouterModule();

    await mod.router();

    expect(maybeAutoSubscribePushAfterLoginMock).toHaveBeenCalledTimes(1);
    expect(maybeAutoSubscribePushAfterLoginMock).toHaveBeenCalledWith(7);
    expect(renderProjectsMock).toHaveBeenCalledTimes(1);
  });
});
