// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initI18n, resetI18nForTests, setLocale } from './i18n/index.js';
import { temporaryBoardsNavLabel, temporaryBoardsNavLabelKey } from './nav-labels.js';

const enCatalog = {
  'nav.temporaryBoards.long': 'Temporary Boards',
  'nav.temporaryBoards.short': 'Temporary',
};

const pseudoCatalog = {
  'nav.temporaryBoards.long': '[!! Temporary Boards !!]',
  'nav.temporaryBoards.short': '[!! Temporary !!]',
};

function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
}

describe('nav-labels', () => {
  beforeEach(async () => {
    await initI18n({
      locale: 'en',
      loadLocale: async (locale: 'en' | 'de' | 'pseudo') => (locale === 'pseudo' ? pseudoCatalog : enCatalog),
    });
  });

  afterEach(() => {
    resetI18nForTests();
    localStorage.clear();
  });

  it('returns the shared temporary board label keys at the current breakpoint', () => {
    expect(temporaryBoardsNavLabelKey(767)).toBe('nav.temporaryBoards.short');
    expect(temporaryBoardsNavLabelKey(768)).toBe('nav.temporaryBoards.long');
  });

  it('returns localized desktop and mobile temporary board labels', async () => {
    setViewportWidth(1024);
    expect(temporaryBoardsNavLabel()).toBe('Temporary Boards');

    setViewportWidth(375);
    expect(temporaryBoardsNavLabel()).toBe('Temporary');

    await setLocale('pseudo');

    setViewportWidth(1024);
    expect(temporaryBoardsNavLabel()).toBe('[!! Temporary Boards !!]');

    setViewportWidth(375);
    expect(temporaryBoardsNavLabel()).toBe('[!! Temporary !!]');
  });
});
