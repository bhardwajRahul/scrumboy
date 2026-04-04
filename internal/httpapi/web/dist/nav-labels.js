const MOBILE_BREAKPOINT = 767;
export function temporaryBoardsNavLabel() {
    return window.innerWidth <= MOBILE_BREAKPOINT ? "Temporary" : "Temporary Boards";
}
