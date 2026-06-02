# Wall pan/zoom — manual browser verification

Run each scenario in a real browser (Chromium/Firefox) at **zoom ≠ 1** and with at least one note at **negative canvas coordinates** (e.g. x: -200, y: -150).

| # | Scenario | Pass criteria |
|---|----------|---------------|
| 1 | Create note (right-click canvas) | Note appears under cursor |
| 2 | Drag single note | Resting position matches pointer; PATCH persists |
| 3 | Multi-select drag | All selected notes move together |
| 4 | Resize (corner handle) | Size changes correctly at non-1 zoom |
| 5 | Wall opens in Select mode | Mode button shows dashed-square icon; `aria-pressed="false"`; empty-canvas drag still draws marquee |
| 6 | Select-mode touch marquee | Empty-canvas touch drag still draws the marquee box on touch hardware |
| 7 | Toggle to Pan mode | Button switches to hand icon, Pan label/title, and the surface enters Pan mode |
| 8 | Pan-mode mouse drag | Empty-canvas primary drag pans instead of selecting |
| 9 | Pan-mode touch swipe | Empty-canvas touch swipe pans on touch hardware |
| 10 | Pan-mode pinch zoom | Two-finger touch pinch zooms around the pinch midpoint |
| 11 | Toggle back to Select | Marquee selection returns immediately |
| 12 | Edge create (Shift+drag) | Connects intended notes in both Select and Pan mode |
| 13 | Edge preview | Preview line follows cursor |
| 14 | Trash delete | Drag-to-trash hit-test works when panned/zoomed |
| 15 | Right-click create note | Empty-canvas context-menu create still works in both Select and Pan mode |
| 16 | Fit view (⊡ or **F**) | All notes visible; recovers from off-screen pan |
| 17 | Reload | Pan/zoom restored from localStorage; canvas mode resets to Select on reopen |
| 18 | Corrupt storage | Clear key or set invalid JSON → wall opens at origin without error |
| 19 | Negative coords | Note at negative x/y reachable and editable |
| 20 | Edit suppression | Wheel / Space+drag do nothing while editing note text; Pan mode does not pan from text editing controls |
| 21 | Input suppression | Wheel does nothing when focus in textarea/button; fit/close/mode buttons do not trigger canvas gestures |
| 22 | Teardown | Close wall → Space pan not stuck; no stuck grabbing cursor; page scroll normal |
| 23 | Arrow-key pan | Arrow keys pan the canvas; Shift = larger steps; page behind modal does not scroll |
| 24 | Arrow suppression | Arrow keys move the caret (no pan) while editing note text or with focus in an input/button |

Navigation reference: wheel = pan, Ctrl/Cmd+wheel = zoom, middle-drag / Space+drag / arrow keys = pan, Pan mode = empty-canvas drag/swipe/pinch.
