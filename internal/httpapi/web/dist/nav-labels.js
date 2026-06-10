import { t } from './i18n/index.js';
const MOBILE_BREAKPOINT = 767;
export function temporaryBoardsNavLabelKey(width = window.innerWidth) {
    return width <= MOBILE_BREAKPOINT
        ? 'nav.temporaryBoards.short'
        : 'nav.temporaryBoards.long';
}
export function temporaryBoardsNavLabel() {
    return t(temporaryBoardsNavLabelKey());
}
