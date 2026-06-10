import { t } from './i18n/index.js';

const MOBILE_BREAKPOINT = 767;

export function temporaryBoardsNavLabel(): string {
  return window.innerWidth <= MOBILE_BREAKPOINT
    ? t('nav.temporaryBoards.short')
    : t('nav.temporaryBoards.long');
}
