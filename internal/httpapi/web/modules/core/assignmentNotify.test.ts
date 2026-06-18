// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import deCatalog from '../i18n/locales/de.json';
import enCatalog from '../i18n/locales/en.json';

function installNotification(value: {
  permission: NotificationPermission;
  requestPermission?: () => Promise<NotificationPermission>;
}): ReturnType<typeof vi.fn> {
  const NotificationMock = vi.fn();
  Object.defineProperty(NotificationMock, 'permission', {
    configurable: true,
    value: value.permission,
  });
  Object.defineProperty(NotificationMock, 'requestPermission', {
    configurable: true,
    value: value.requestPermission ?? vi.fn().mockResolvedValue(value.permission),
  });
  vi.stubGlobal('Notification', NotificationMock);
  return NotificationMock;
}

const en = enCatalog as Record<string, string>;
const de = deCatalog as Record<string, string>;

async function loadSubject(locale: 'en' | 'de' = 'en') {
  vi.resetModules();
  const i18n = await import('../i18n/index.js');
  i18n.resetI18nForTests();
  await i18n.initI18n({
    locale,
    loadLocale: vi.fn(async (nextLocale: 'en' | 'de') => (nextLocale === 'de' ? de : en)),
  });
  return import('./assignmentNotify.js');
}

describe('assignment notification metadata', () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    const i18n = await import('../i18n/index.js');
    i18n.resetI18nForTests();
    vi.resetModules();
  });

  it('returns localized unsupported status descriptions', async () => {
    vi.unstubAllGlobals();
    const notify = await loadSubject('de');
    expect(notify.getDesktopNotificationStatusKind()).toBe('unsupported');
    expect(notify.getDesktopNotificationStatusDescription()).toBe(de['settings.customization.notifications.status.unsupported']);
  });

  it('returns localized granted status descriptions', async () => {
    installNotification({ permission: 'granted' });
    const notify = await loadSubject('de');
    expect(notify.getDesktopNotificationStatusKind()).toBe('granted');
    expect(notify.getDesktopNotificationStatusDescription()).toBe(de['settings.customization.notifications.status.granted']);
  });

  it('returns localized denied status descriptions', async () => {
    installNotification({ permission: 'denied' });
    const notify = await loadSubject('de');
    expect(notify.getDesktopNotificationStatusKind()).toBe('denied');
    expect(notify.getDesktopNotificationStatusDescription()).toBe(de['settings.customization.notifications.status.denied']);
  });

  it('returns localized default status descriptions', async () => {
    installNotification({ permission: 'default' });
    const notify = await loadSubject('de');
    expect(notify.getDesktopNotificationStatusKind()).toBe('default');
    expect(notify.getDesktopNotificationStatusDescription()).toBe(de['settings.customization.notifications.status.default']);
  });

  it('uses English catalog status descriptions by default', async () => {
    installNotification({ permission: 'default' });
    const notify = await loadSubject('en');
    expect(notify.getDesktopNotificationStatusDescription()).toBe(en['settings.customization.notifications.status.default']);
  });

  it('localizes desktop notification title and fallback body only', async () => {
    const NotificationMock = installNotification({ permission: 'granted' });
    const notify = await loadSubject('de');

    notify.showAssignmentDesktopNotification('');
    expect(NotificationMock).toHaveBeenLastCalledWith(de['notifications.desktop.title'], { body: de['realtime.todoFallback'] });

    notify.showAssignmentDesktopNotification('Fix login');
    expect(NotificationMock).toHaveBeenLastCalledWith(de['notifications.desktop.title'], { body: 'Fix login' });
  });
});
