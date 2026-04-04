const MOBILE_BREAKPOINT = 767;

export function temporaryBoardsNavLabel(): string {
  return window.innerWidth <= MOBILE_BREAKPOINT ? "Temporary" : "Temporary Boards";
}
