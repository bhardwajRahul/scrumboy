# Wall canvas (Scrumbaby)

Optional sticky-note canvas per project, gated by `SCRUMBOY_WALL_ENABLED`.

```mermaid
flowchart TB
  UI[wall.ts dialogs]
  API[wall-api.ts]
  Routes[routing_board_wall.go]
  StoreW[store wall.go]
  RT[wall-realtime.ts SSE]

  UI --> API --> Routes --> StoreW
  RT --> UI
```

## Frontend submodules

```mermaid
flowchart LR
  Wall[wall.ts shell]
  VP[wall-viewport.ts]
  Render[wall-rendering.ts]
  Drag[wall-drag-controller.ts]
  Sel[wall-selection.ts]
  Edit[wall-edit-controller.ts]

  Wall --> VP --> Render
  Wall --> Drag
  Wall --> Sel
  Wall --> Edit
```

Notes support viewport pan and zoom, multi-select, edges between notes, and Kalam handwriting font. When wall is disabled server returns 404 and the topbar button is hidden via bootstrap flags.
