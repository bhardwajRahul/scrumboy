# Wall pan/zoom — manual browser verification

Run each scenario in a real browser (Chromium/Firefox) at **zoom ≠ 1** and with at least one note at **negative canvas coordinates** (e.g. x: -200, y: -150).

| # | Scenario | Pass criteria |
|---|----------|---------------|
| 1 | Create note (right-click canvas) | Note appears under cursor |
| 2 | Drag single note | Resting position matches pointer; PATCH persists |
| 3 | Multi-select drag | All selected notes move together |
| 4 | Resize (corner handle) | Size changes correctly at non-1 zoom |
| 5 | Marquee select | Box selects geometrically correct notes |
| 6 | Edge create (Shift+drag) | Connects intended notes |
| 7 | Edge preview | Preview line follows cursor |
| 8 | Trash delete | Drag-to-trash hit-test works when panned/zoomed |
| 9 | Fit view (⊡ or **F**) | All notes visible; recovers from off-screen pan |
| 10 | Reload | Pan/zoom restored from localStorage |
| 11 | Corrupt storage | Clear key or set invalid JSON → wall opens at origin without error |
| 12 | Negative coords | Note at negative x/y reachable and editable |
| 13 | Edit suppression | Wheel / Space+drag do nothing while editing note text |
| 14 | Input suppression | Wheel does nothing when focus in textarea/button |
| 15 | Teardown | Close wall → Space pan not stuck; page scroll normal |

Navigation reference: wheel = pan, Ctrl/Cmd+wheel = zoom, middle-drag / Space+drag = pan.
