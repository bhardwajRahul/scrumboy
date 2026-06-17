// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import deCatalog from '../i18n/locales/de.json';
import enCatalog from '../i18n/locales/en.json';

async function initI18n(locale: 'en' | 'de') {
  const i18n = await import('../i18n/index.js');
  await i18n.initI18n({
    locale,
    loadLocale: vi.fn(async (next: 'en' | 'de') => (next === 'de' ? deCatalog : enCatalog)),
  });
  return i18n;
}

describe('not found view i18n', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="app"></div>';
  });

  afterEach(async () => {
    const i18n = await import('../i18n/index.js');
    i18n.resetI18nForTests();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders localized copy and exposes hydration attributes for locale changes', async () => {
    const i18n = await initI18n('en');
    const { renderNotFound } = await import('./notfound.js');

    renderNotFound();

    expect(document.getElementById('homeBtn')?.textContent).toBe(enCatalog['notFound.home']);
    expect(document.querySelector('.empty__title')?.textContent).toBe(enCatalog['notFound.title']);
    expect(document.getElementById('homeBtn')?.getAttribute('data-i18n-text')).toBe('notFound.home');

    await i18n.setLocale('de');
    i18n.hydrateI18n(document.body);

    expect(document.getElementById('homeBtn')?.textContent).toBe(deCatalog['notFound.home']);
    expect(document.querySelector('.empty__title')?.textContent).toBe(deCatalog['notFound.title']);
  });
});
