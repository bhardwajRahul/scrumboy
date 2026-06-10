import { t } from './i18n/index.js';

const MOBILE_BREAKPOINT = 767;

export function temporaryBoardsNavLabelKey(
  width = window.innerWidth,
): 'nav.temporaryBoards.short' | 'nav.temporaryBoards.long' {
  return width <= MOBILE_BREAKPOINT
    ? 'nav.temporaryBoards.short'
    : 'nav.temporaryBoards.long';
}

export function temporaryBoardsNavLabel(): string {
  return t(temporaryBoardsNavLabelKey());
}
