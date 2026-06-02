# Wall coordinate audit (pan/zoom implementation)

Each occurrence is classified **Convert** (via `wall-viewport`) or **Screen-space OK**.

| File | Line / symbol | Classification | Notes |
|------|---------------|----------------|-------|
| wall.ts | contextmenu create `clientX/Y - rect.left` | Convert | `screenToCanvas` |
| wall.ts | `openWallNoteContextMenu(ev.clientX, ev.clientY)` | Screen-space OK | Menu positions in viewport pixels |
| wall.ts | beginMarquee `surfaceRect`, start/cur/end | Convert | Marquee rect in canvas space |
| wall.ts | beginMarquee `downClientX/Y`, dx/dy threshold | Screen-space OK | `DRAG_THRESHOLD_PX` is screen feel |
| wall.ts | beginEdgeDrag preview update | Convert | `screenToCanvas` |
| wall.ts | beginEdgeDrag `elementFromPoint` | Screen-space OK | DOM hit-test API is screen-based |
| wall.ts | armNoteInteraction dx/dy threshold | Screen-space OK | Screen-pixel promotion threshold |
| wall-drag-controller.ts | `isOverTrash` getBoundingClientRect ×2 | Screen-space OK | Trash is viewport-fixed; both rects screen space |
| wall-drag-controller.ts | beginDrag surfaceRect, noteRect, shiftX/Y | Convert | Canvas position from screen pointer + pan/zoom |
| wall-drag-controller.ts | moveAt clientX/Y | Convert | Via canvas position formula |
| wall-drag-controller.ts | startResize dw/dh | Convert | `canvasDelta` divides by zoom |
| wall-rendering.ts | noteCenter offsetLeft/Top | Screen-space OK | Canvas coords when parent is `.wall-content` |
| wall-rendering.ts | getNoteCenterFromElement fallback getBoundingClientRect | Convert | Uses `screenToCanvas` on note center |
| wall-note-context-menu.ts | clientX/Y, menu getBoundingClientRect | Screen-space OK | Viewport menu placement |
| wall-realtime.ts | applyTransient x/y on style | Screen-space OK | Stored/server coords are canvas space |
