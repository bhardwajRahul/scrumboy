# Board and Kanban UX

Board data flows from slug URL through REST into rendered lanes and drag-drop mutations.

```mermaid
flowchart TB
  URL["URL /{slug}"]
  Router[router.ts]
  Load[loadBoardBySlug]
  API["GET api board slug"]
  Render[board-rendering.ts]
  DnD[drag-drop Sortable]
  Patch["PATCH move update todos"]

  URL --> Router --> Load --> API --> Render
  Render --> DnD
  DnD --> Patch --> API
```

## Workflow columns

```mermaid
flowchart LR
  Backlog[backlog]
  NotStarted[not_started]
  InProgress[in_progress]
  Testing[testing]
  Done[done]

  Backlog --> NotStarted --> InProgress --> Testing --> Done
```

Lane colors and sprint chips are defined in `styles.css` CSS variables. Sprints filter board scope via `sprintId` query param; tags and search filters apply client-side in `board-filters.ts`.
