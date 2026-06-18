// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import deCatalog from './i18n/locales/de.json';
import enCatalog from './i18n/locales/en.json';

async function flushPromises(count = 6): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve();
  }
}

async function initI18n(locale: 'en' | 'de') {
  const i18n = await import('./i18n/index.js');
  await i18n.initI18n({
    locale,
    loadLocale: vi.fn(async (next: 'en' | 'de') => (next === 'de' ? deCatalog : enCatalog)),
  });
  return i18n;
}

describe('pwa update banner i18n', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('enableServiceWorkerDev', 'true');
  });

  afterEach(async () => {
    const i18n = await import('./i18n/index.js');
    i18n.resetI18nForTests();
    document.body.innerHTML = '';
    localStorage.clear();
    sessionStorage.clear();
    delete (window as any).reloadForUpdate;
    delete (window as any).dismissUpdateNotification;
    delete (navigator as any).serviceWorker;
    vi.restoreAllMocks();
  });

  it('renders localized banner copy, relocalizes while visible, and cleans up its locale listener on dismiss', async () => {
    const i18n = await initI18n('en');
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const registration = {
      waiting: { postMessage: vi.fn() },
      update: vi.fn(),
      addEventListener: vi.fn(),
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: vi.fn(async () => registration),
        controller: {},
      },
    });

    const { registerPwaGlobals } = await import('./pwaUpdate.js');
    registerPwaGlobals();
    window.dispatchEvent(new Event('load'));
    await flushPromises();

    const notification = document.getElementById('updateNotification');
    expect(notification?.textContent).toContain(enCatalog['pwaUpdate.message']);
    expect(notification?.textContent).toContain(enCatalog['pwaUpdate.actions.updateNow']);
    expect(notification?.textContent).toContain(enCatalog['pwaUpdate.actions.later']);

    await i18n.setLocale('de');
    await flushPromises();

    expect(document.getElementById('updateNotification')?.textContent).toContain(deCatalog['pwaUpdate.message']);
    expect(document.getElementById('updateNotification')?.textContent).toContain(deCatalog['pwaUpdate.actions.updateNow']);
    expect(document.getElementById('updateNotification')?.textContent).toContain(deCatalog['pwaUpdate.actions.later']);

    const localeAdds = addSpy.mock.calls.filter(([type]) => type === i18n.I18N_LOCALE_CHANGED);
    expect(localeAdds).toHaveLength(1);

    (window as any).dismissUpdateNotification();

    expect(document.getElementById('updateNotification')).toBeNull();
    const localeRemoves = removeSpy.mock.calls.filter(([type]) => type === i18n.I18N_LOCALE_CHANGED);
    expect(localeRemoves).toHaveLength(1);
  });
});
