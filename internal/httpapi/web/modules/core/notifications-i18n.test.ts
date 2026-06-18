// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import deCatalog from '../i18n/locales/de.json';
import enCatalog from '../i18n/locales/en.json';

const selectorState = vi.hoisted(() => ({
  projectId: 0 as number | null,
  projects: [] as Array<{ id: number; slug: string }>,
}));
const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('../state/selectors.js', () => ({
  getProjectId: () => selectorState.projectId,
  getProjects: () => selectorState.projects,
}));

vi.mock('../api.js', () => ({
  apiFetch: apiFetchMock,
}));

const en = enCatalog as Record<string, string>;
const de = deCatalog as Record<string, string>;
const USER_ID = 1;
const LIST_KEY = `scrumboy_notifications_v1_${USER_ID}`;
const NOW = new Date('2026-06-16T12:00:00Z');

type I18nModule = typeof import('../i18n/index.js');
type NotificationsModule = typeof import('./notifications.js');

type Subject = {
  i18n: I18nModule;
  notifications: NotificationsModule;
};

function item(title: string, secondsAgo: number, read = false): Record<string, unknown> {
  return {
    id: `n-${title}`,
    type: 'todo.assigned',
    title,
    projectId: 1,
    projectSlug: 'alpha',
    todoId: secondsAgo + 1,
    timestamp: NOW.getTime() - secondsAgo * 1000,
    read,
  };
}

function seedItems(items: Record<string, unknown>[]): void {
  localStorage.setItem(LIST_KEY, JSON.stringify(items));
}

async function loadSubject(locale: 'en' | 'de' = 'en'): Promise<Subject> {
  vi.resetModules();
  document.body.innerHTML = '';
  localStorage.clear();
  selectorState.projectId = 0;
  selectorState.projects = [];
  apiFetchMock.mockReset().mockResolvedValue([]);
  const i18n = await import('../i18n/index.js');
  i18n.resetI18nForTests();
  await i18n.initI18n({
    locale,
    loadLocale: vi.fn(async (nextLocale: 'en' | 'de') => (nextLocale === 'de' ? de : en)),
  });
  const notifications = await import('./notifications.js');
  return { i18n, notifications };
}

function initAndHydrate(notifications: NotificationsModule): void {
  notifications.initNotificationBadge();
  notifications.hydrateNotificationsForUser(USER_ID);
}

function badge(): HTMLButtonElement {
  const el = document.getElementById('global-notification-badge');
  if (!(el instanceof HTMLButtonElement)) throw new Error('missing notification badge');
  return el;
}

function panel(): HTMLDivElement {
  const el = document.getElementById('global-notification-panel');
  if (!(el instanceof HTMLDivElement)) throw new Error('missing notification panel');
  return el;
}

function openPanel(): void {
  badge().click();
}

function rows(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.notification-panel__row'));
}

describe('notification panel i18n', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(async () => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    const i18n = await import('../i18n/index.js');
    i18n.resetI18nForTests();
    vi.resetModules();
  });

  it('renders German panel chrome and empty state', async () => {
    const { notifications } = await loadSubject('de');
    initAndHydrate(notifications);

    openPanel();

    expect(panel().getAttribute('aria-label')).toBe(de['notifications.panel.title']);
    expect(document.querySelector('.notification-panel__header h2')?.textContent).toBe(de['notifications.panel.title']);
    expect(document.getElementById('notification-panel-mark-all')?.textContent).toBe(de['notifications.panel.markAllRead']);
    expect(document.getElementById('global-notification-panel-list')?.textContent).toContain(de['notifications.panel.empty']);
  });

  it('renders German row copy and fallback title without storing localized fallback text', async () => {
    const { notifications } = await loadSubject('de');
    seedItems([{ ...item('', 5 * 60), id: 'missing-title' }]);

    initAndHydrate(notifications);
    openPanel();

    const rowText = rows()[0].textContent ?? '';
    expect(rowText).toContain(de['realtime.todoFallback']);
    expect(rowText).toContain(de['notifications.row.assignedToYou']);
    expect(rowText).toContain(de['notifications.relative.minutesAgo'].replace('{count}', '5'));
    expect(localStorage.getItem(LIST_KEY)).toContain('"title":""');
  });

  it('preserves compact relative timestamp thresholds exactly', async () => {
    const { notifications } = await loadSubject('en');
    seedItems([
      item('a', 44),
      item('b', 45),
      item('c', 60),
      item('d', 3599),
      item('e', 3600),
      item('f', 86399),
      item('g', 86400),
    ]);

    initAndHydrate(notifications);
    openPanel();

    const rowText = rows().map((row) => row.textContent ?? '');
    expect(rowText[0]).toContain(en['notifications.relative.justNow']);
    expect(rowText[1]).toContain(en['notifications.relative.minutesAgo'].replace('{count}', '0'));
    expect(rowText[2]).toContain(en['notifications.relative.minutesAgo'].replace('{count}', '1'));
    expect(rowText[3]).toContain(en['notifications.relative.minutesAgo'].replace('{count}', '59'));
    expect(rowText[4]).toContain(en['notifications.relative.hoursAgo'].replace('{count}', '1'));
    expect(rowText[5]).toContain(en['notifications.relative.hoursAgo'].replace('{count}', '23'));
    expect(rowText[6]).toContain(en['notifications.relative.daysAgo'].replace('{count}', '1'));
  });

  it('uses current unread count for badge singular and plural tooltip text', async () => {
    const { notifications } = await loadSubject('de');
    seedItems([item('one', 60)]);
    initAndHydrate(notifications);

    expect(badge().textContent).toBe('1');
    expect(badge().getAttribute('title')).toBe(de['notifications.badge.oneTodo']);
    expect(badge().getAttribute('aria-label')).toBe(de['notifications.badge.oneTodo']);

    const plural = await loadSubject('de');
    seedItems([item('one', 60), item('two', 60), item('three', 60), item('four', 60), item('five', 60)]);
    initAndHydrate(plural.notifications);

    const expected = de['notifications.badge.multipleTodos'].replace('{count}', '5');
    expect(badge().textContent).toBe('5');
    expect(badge().getAttribute('title')).toBe(expected);
    expect(badge().getAttribute('aria-label')).toBe(expected);
  });

  it('clears stale badge tooltip and aria text when unread count reaches zero', async () => {
    const { notifications } = await loadSubject('de');
    seedItems([item('one', 60)]);
    initAndHydrate(notifications);

    expect(badge().getAttribute('title')).toBe(de['notifications.badge.oneTodo']);
    openPanel();
    document.getElementById('notification-panel-mark-all')?.click();

    expect(notifications.getListUnreadCount()).toBe(0);
    expect(badge().style.display).toBe('none');
    expect(badge().hasAttribute('title')).toBe(false);
    expect(badge().hasAttribute('aria-label')).toBe(false);
  });

  it('updates badge and open panel copy on locale change without changing unread state or items', async () => {
    const { i18n, notifications } = await loadSubject('en');
    seedItems([item('Fix login', 60)]);
    initAndHydrate(notifications);
    openPanel();

    const storedBefore = localStorage.getItem(LIST_KEY);
    expect(notifications.getListUnreadCount()).toBe(1);
    expect(badge().getAttribute('title')).toBe(en['notifications.badge.oneTodo']);
    expect(rows()[0].textContent).toContain(en['notifications.row.assignedToYou']);

    await i18n.setLocale('de');

    expect(notifications.getListUnreadCount()).toBe(1);
    expect(localStorage.getItem(LIST_KEY)).toBe(storedBefore);
    expect(badge().textContent).toBe('1');
    expect(badge().getAttribute('title')).toBe(de['notifications.badge.oneTodo']);
    expect(badge().getAttribute('aria-label')).toBe(de['notifications.badge.oneTodo']);
    expect(panel().getAttribute('aria-label')).toBe(de['notifications.panel.title']);
    expect(rows()[0].textContent).toContain('Fix login');
    expect(rows()[0].textContent).toContain(de['notifications.row.assignedToYou']);
  });

  it('does not stack locale listeners across repeated badge initialization', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const { i18n, notifications } = await loadSubject('en');

    notifications.initNotificationBadge();
    notifications.initNotificationBadge();

    const localeAdds = addSpy.mock.calls.filter(([type]) => type === i18n.I18N_LOCALE_CHANGED);
    expect(localeAdds).toHaveLength(1);
  });
});
