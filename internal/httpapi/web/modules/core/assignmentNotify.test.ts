// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

function installNotification(value: {
  permission: NotificationPermission;
  requestPermission?: () => Promise<NotificationPermission>;
}): void {
  vi.stubGlobal('Notification', {
    permission: value.permission,
    requestPermission: value.requestPermission ?? vi.fn().mockResolvedValue(value.permission),
  });
}

describe('assignment notification metadata', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('keeps the unsupported English status description unchanged', async () => {
    vi.unstubAllGlobals();
    const notify = await import('./assignmentNotify.js');
    expect(notify.getDesktopNotificationStatusKind()).toBe('unsupported');
    expect(notify.getDesktopNotificationStatusDescription()).toBe('Not supported in this browser.');
  });

  it('keeps the granted English status description unchanged', async () => {
    installNotification({ permission: 'granted' });
    const notify = await import('./assignmentNotify.js');
    expect(notify.getDesktopNotificationStatusKind()).toBe('granted');
    expect(notify.getDesktopNotificationStatusDescription()).toBe(
      'Enabled - you will receive OS notifications for new assignments.',
    );
  });

  it('keeps the denied English status description unchanged', async () => {
    installNotification({ permission: 'denied' });
    const notify = await import('./assignmentNotify.js');
    expect(notify.getDesktopNotificationStatusKind()).toBe('denied');
    expect(notify.getDesktopNotificationStatusDescription()).toBe(
      'Blocked — allow notifications for this site in your browser settings.',
    );
  });

  it('keeps the default English status description unchanged', async () => {
    installNotification({ permission: 'default' });
    const notify = await import('./assignmentNotify.js');
    expect(notify.getDesktopNotificationStatusKind()).toBe('default');
    expect(notify.getDesktopNotificationStatusDescription()).toBe(
      'Not enabled yet — click the button below (your browser will ask for permission).',
    );
  });
});
