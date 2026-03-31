# Editable Workflow Lanes — Codebase Analysis & Rollout Plan

**Date:** 2026-03-31
**Branch:** Prefer a **dedicated feature branch** for this work (not necessarily `feature/mcp-adapter`). Practical merge flow: after **Phase 1** lands, merge it to `main`, then merge/rebase `main` into `feature/mcp-adapter` to reduce conflict surface. Normal conflicts may still occur in shared files (`routing.go`, store, board/settings frontend); that is merge management, not a reason to avoid the feature.
**Scope:** Post-creation editing of project workflow lanes. **Near-term rollout:** rename display label only, then dashboard hardening, then add lane, then delete empty non-done lane. **Deferred:** changing which lane is `is_done` (see §3).

---

## Table of Contents

1. [Findings](#1-findings)
   - 1.1 [Current Workflow Model](#11-current-workflow-model)
   - 1.2 [Todo-to-Lane Relationship](#12-todo-to-lane-relationship)
   - 1.3 [Done Semantics](#13-done-semantics)
   - 1.4 [Stats and Charts Impact](#14-stats-and-charts-impact)
   - 1.5 [Frontend / UX Impact](#15-frontend--ux-impact)
   - 1.6 [Import/Export and API Impact](#16-importexport-and-api-impact)
   - 1.7 [Permissions and Validation](#17-permissions-and-validation)
   - 1.8 [Testing Impact](#18-testing-impact)
2. [Risk Matrix](#2-risk-matrix)
3. [Recommended Rollout Phases](#3-recommended-rollout-phases)
4. [Dashboard Hardening and Optional Refactors](#4-dashboard-hardening-and-optional-refactors)
5. [Concrete Implementation Checklist](#5-concrete-implementation-checklist)

---

## 1. Findings

### 1.1 Current Workflow Model

#### Storage

Workflows are stored as rows in the `project_workflow_columns` table (migration `036_add_project_workflow_columns.sql`):

```sql
CREATE TABLE project_workflow_columns (
  id          INTEGER PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES projects(id),
  key         TEXT NOT NULL,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  is_done     INTEGER NOT NULL,
  UNIQUE(project_id, key)
);
```

Additional columns added by later migrations:
- `system INTEGER NOT NULL DEFAULT 0` — migration `039_add_workflow_system_flag.sql`
- `color TEXT NOT NULL DEFAULT '#64748b'` — migration `040_add_workflow_column_color.sql`

#### Go struct

`internal/store/types.go` lines 90–99:

```go
type WorkflowColumn struct {
    ID        int64
    ProjectID int64
    Key       string
    Name      string
    Color     string
    Position  int
    IsDone    bool
    System    bool
}
```

#### Lane identity model

| Mechanism | Role |
|-----------|------|
| `id` (integer PK) | Stable DB primary key; not used in any cross-table joins |
| **`key`** (string, per-project unique) | **Logical identity**. Used by `todos.column_key`, all API paths, drag-drop, MCP, import/export. Constrained by `UNIQUE(project_id, key)` |
| `name` (string) | **Display label only**. Rendered in board headers, API JSON, export. Not referenced by todo association |
| `position` (integer) | **Ordering** for board display. Set from array index on insert; `ORDER BY position ASC, id ASC` |

**Key validation** — `internal/store/workflows.go` lines 22–28: regex `^[a-z0-9](?:[a-z0-9_]*[a-z0-9])?$`, max length 32 chars (`maxSlugLen` from `internal/store/slug.go`).

**Verdict: Lane identity is key-based, not name-based.** Renaming the display `name` does not affect todo association or any functional cross-reference. This is the single most important architectural fact for safe editability.

#### Default lanes

`internal/store/workflows.go` `defaultWorkflowColumns()` lines 42–50:

| Key | Name | Color | IsDone | System |
|-----|------|-------|--------|--------|
| `backlog` | Backlog | `#9CA3AF` | false | true |
| `not_started` | Not Started | `#F59E0B` | false | true |
| `doing` | In Progress | `#10B981` | false | true |
| `testing` | Testing | `#3B82F6` | false | true |
| `done` | Done | `#EF4444` | true | true |

#### Creation invariants

`insertWorkflowColumnsExec` — `internal/store/workflows.go` lines 100–145:
- Minimum 2 columns
- Non-empty trimmed `name`
- Valid `key` (regex + ≤ 32 chars)
- Valid hex `color` (`#RRGGBB`), defaults to `#64748b`
- No duplicate keys
- **Exactly one** `IsDone == true` column
- `System` forced to `false` for user-supplied workflows
- `Position` forced to slice index (user-supplied position ignored)

`validateExactlyOneDoneColumn` — lines 226–236: post-insert sanity check.

#### No post-creation edit API exists today

There is **no HTTP handler** for updating workflow columns on an existing project. The only paths that modify workflow post-creation are:
- Backup import/merge (`internal/store/backup.go`): deletes + re-inserts workflow columns
- Store-level `InsertWorkflowColumns` used in tests

---

### 1.2 Todo-to-Lane Relationship

#### How todos reference lanes

`todos.column_key` (TEXT NOT NULL) stores the lane **key** string. Established in migration `038_drop_todos_status.sql`.

`Todo` struct — `internal/store/types.go` lines 209–226:
```go
type Todo struct {
    // ...
    ColumnKey string
    // ...
    DoneAt    *time.Time
}
```

**Validation on write**: `validateProjectColumnKeyQueryer` (`internal/store/workflows.go` lines 204–219) confirms the key exists in `project_workflow_columns` for the project. Used by:
- `CreateTodo` — `internal/store/todos.go` lines 181–185
- `MoveTodo` — `internal/store/todos.go` lines 836–843

#### Legacy status

The integer `todos.status` column was **removed** in migration `038_drop_todos_status.sql`. The Go `Status` type (lines 26–88 of `types.go`) is **deprecated** and only kept for import/export compatibility mapping.

API layer still accepts `status` / `toStatus` as aliases, normalized to `column_key` via `normalizeLaneKey` (`internal/httpapi/routing.go` lines 2444–2458), which maps legacy uppercase enums (e.g., `"IN_PROGRESS"` → `"doing"`) and lowercases unknown values.

Frontend also has compatibility: `todo.columnKey || todo.status` in `internal/httpapi/web/modules/dialogs/todo.ts` line 1031.

#### Will renaming a lane label preserve todo association?

**Yes — proven by code inspection.** Todos store `column_key` which matches `WorkflowColumn.Key`, not `Name`. All validation and querying joins on `key`. Changing only `name` in `project_workflow_columns` leaves all todo associations intact.

#### Back-compat risks

1. **Backup merge refuses workflow replacement when orphaned todos exist** — `internal/store/backup.go` ~lines 750–806: if new workflow lacks a key that existing todos reference, import is rejected ("stranded").
2. **`normalizeLaneKey` maps only the five default uppercase keys** — custom lane keys pass through as lowercase. This is already correct for custom workflows.
3. **`resolveImportColumnKey`** (`internal/store/backup_bulk.go` lines 53–68) handles legacy enum OR direct column_key.

---

### 1.3 Done Semantics

#### Explicit `is_done` flag — the primary mechanism

The `project_workflow_columns.is_done` column is the **source of truth**. It is enforced to be exactly one per project.

Key functions:
- `GetWorkflowDoneColumnKey` — `internal/store/workflows.go` lines 182–194: `SELECT key WHERE is_done = 1`
- `resolveDoneAtForColumnTransition` — `internal/store/todos.go` lines 310–316: sets `done_at` timestamp when a todo enters the `is_done` column from a non-done column; **never clears `done_at` on reopen**
- `validateExactlyOneDoneColumn` — `internal/store/workflows.go` lines 226–236

#### All locations where "done" is determined

| Location | File | Mechanism | Notes |
|----------|------|-----------|-------|
| Burndown `isIncompleteAtDayEnd` | `internal/store/burndown.go:51–61` | Compares `t.columnKey != doneColumnKey` (from `GetWorkflowDoneColumnKey`) | **Correct**: uses `is_done` flag dynamically |
| `GetBacklogSize` | `internal/store/burndown.go:169–281` | Calls `GetWorkflowDoneColumnKey` | **Correct** |
| `GetRealBurndown` | `internal/store/burndown.go:289–388` | Calls `GetWorkflowDoneColumnKey` | **Correct** |
| `GetRealBurndownForSprint` | `internal/store/burndown.go:394–477` | Calls `GetWorkflowDoneColumnKey` | **Correct** |
| Todo creation `done_at` | `internal/store/todos.go:216` | Via `resolveDoneAtForColumnTransition` using `WorkflowColumn.IsDone` | **Correct** |
| Todo move `done_at` | `internal/store/todos.go:849–858` | `targetCol.IsDone` / `currentCol.IsDone` | **Correct** |
| **Dashboard: sprint completion** | `internal/store/dashboard.go:323` | **`t.column_key = 'done'`** (string literal) | **HARDCODED — BUG for custom done key** |
| **Dashboard: weekly throughput** | `internal/store/dashboard.go:388` | **`column_key = 'done'`** (string literal) | **HARDCODED** |
| **Dashboard: avg lead time (with sprint)** | `internal/store/dashboard.go:428` | **`t.column_key = 'done'`** (string literal) | **HARDCODED** |
| **Dashboard: avg lead time (fallback)** | `internal/store/dashboard.go:443` | **`column_key = 'done'`** (string literal) | **HARDCODED** |
| **Dashboard: oldest WIP** | `internal/store/dashboard.go:462` | **`column_key IN ('doing', 'testing')`** (string literals) | **HARDCODED to default keys** |
| **Dashboard: assigned filter** | `internal/store/dashboard.go:124,191,205,250,299` | `column_key != ?` with `DefaultColumnDone` constant | Uses constant, but still assumes key is `"done"` |
| Board JSON `isDone` | `internal/httpapi/json.go:504,521` | `wc.IsDone` from struct | **Correct** |
| Frontend `getBoardColumns` | `web/modules/views/board.ts:94–99` | Uses `columnOrder[].isDone` from API | **Correct** when `columnOrder` present |
| Frontend `resolveColumnKey` | `web/modules/dialogs/todo.ts:51–62` | Maps legacy uppercase to lowercase | **Correct** |

#### Critical hidden assumption — DASHBOARD IS BROKEN FOR CUSTOM WORKFLOWS

The dashboard (`internal/store/dashboard.go`) has **10+ SQL queries that hardcode `'done'` as the done column key** rather than using `GetWorkflowDoneColumnKey`. This means:
- Projects with custom workflows where the done column key is not `"done"` will have **zero throughput, zero completion, incorrect lead time, and missing WIP** on the personal dashboard.
- This is a **pre-existing correctness bug** independent of rename-label-only (which does not change keys, `is_done`, todo association, or stats query semantics). It matters most for custom done/WIP keys and would matter acutely for any future done-lane reassignment without a deliberate historical-data strategy.

The burndown system (`internal/store/burndown.go`) is **correctly implemented** — it dynamically resolves the done column via `GetWorkflowDoneColumnKey`.

---

### 1.4 Stats and Charts Impact

#### Code that powers stats/charts

| Component | Files | Historical? |
|-----------|-------|-------------|
| Burndown chart | `internal/store/burndown.go` | Yes — reconstructs day-by-day from `created_at`, `column_key`, `done_at` |
| Backlog size chart | `internal/store/burndown.go` | Yes — same replay |
| Dashboard throughput | `internal/store/dashboard.go:382–392` | Yes — buckets by `done_at` |
| Dashboard lead time | `internal/store/dashboard.go:414–449` | Yes — `done_at - created_at` |
| Dashboard sprint completion | `internal/store/dashboard.go:310–351` | Mixed — `done_at` within sprint window |
| Dashboard WIP | `internal/store/dashboard.go:354–363` | Current state |
| Board lane counts | `internal/store/board.go` | Current state |
| Tag counts | `internal/store/tags.go` | Current state |

#### Impact by operation

| Operation | Burndown/Backlog | Dashboard Throughput/Lead/Completion | Dashboard WIP | Board Counts | Safe? |
|-----------|-----------------|-------------------------------------|---------------|-------------|-------|
| **Rename lane** (change `name` only, keep `key`) | No impact | No impact | No impact | No impact (keys unchanged) | **YES — safe** |
| **Add non-done lane** | No impact (new key is not the done key) | No impact (queries filter on done key) | No impact (queries filter on specific keys) | New lane appears automatically | **YES — safe** |
| **Delete non-done lane** (no todos in it) | No impact | No impact | WIP count may drop if deleting `doing`/`testing` (dashboard hardcode) | Lane disappears | **YES — safe if empty** |
| **Delete non-done lane** (has todos) | **UNSAFE**: todos in that lane are orphaned; burndown replay may miscategorize | **UNSAFE**: same | **UNSAFE**: same | **UNSAFE**: same | **NO — must relocate todos first** |
| **Change done lane** (move `is_done` to different column) | **MIXED**: burndown uses `GetWorkflowDoneColumnKey` (reads new done key) but `done_at` timestamps are historical — previously completed todos retain old `done_at` and old `column_key`, so burndown replay sees them as "completed in old done lane" which now has a different key | **BROKEN**: dashboard hardcodes `'done'` — if new done key differs from `"done"`, dashboard stops working for the project | Same | Counts shift | **HIGH RISK** |

#### Historical data problem with "change done lane"

Burndown reconstructs history by checking `t.columnKey != doneColumnKey` for each day. If the done column key changes from `"done"` to `"shipped"`:
- Todos completed under the old regime have `column_key = "done"` and `done_at` set
- The new `doneColumnKey` is `"shipped"`
- `isIncompleteAtDayEnd` will see those old todos as **incomplete** (wrong key), despite `done_at` being set
- This **rewrites historical chart meaning**: old completed work appears as still open

**No event-sourcing or lane transition history exists** — burndown relies only on current `column_key` + timestamps, not on historical transition log. The `audit_events` table logs `todo_moved` events but burndown does not read it.

---

### 1.5 Frontend / UX Impact

#### Board rendering

`internal/httpapi/web/modules/views/board.ts`:
- `getBoardColumns(board)` (lines 94–99): uses `board.columnOrder` from API when present; falls back to hardcoded five columns from `columnsSpec()`
- `renderBoardFromData` (lines 1308–1502) and `updateBoardContent` (lines 1159–1306): render one `<section class="col">` per column from `getBoardColumns()`
- Column headers use `c.key` for CSS class, `c.color` for border, `c.name` for title
- Card lists use `data-status="${c.key}"` which is the drop target identifier for drag-drop

**Verdict**: Board rendering is **fully dynamic** when `columnOrder` is populated. No hardcoded column count or fixed column assumptions in the render path.

#### Drag and drop

`internal/httpapi/web/modules/features/drag-drop.ts`:
- **SortableJS** library
- `setDnDColumns(columns)` (line 29): receives columns from board; falls back to `columnsSpec()` (hardcoded five lanes, line 19–26) when empty
- `initDnD()` (lines 111–224): creates Sortable instance per lane via `document.getElementById(\`list_${c.key}\`)`
- Drop target: `list.getAttribute("data-status")` → sent as `toStatus` in API call (line 136)
- `LANE_CARD_CLASSES` (line 33): hardcoded list `['card--backlog', 'card--not_started', 'card--in_progress', 'card--testing', 'card--done']` — stripped before applying new color; custom keys use `card--${targetKey.toLowerCase()}`

**Risk**: The `columnsSpec()` fallback and `LANE_CARD_CLASSES` array assume exactly five default lanes. If `columnOrder` is empty/missing for a board with custom columns, DnD breaks.

#### Hardcoded fallbacks in state management

`internal/httpapi/web/modules/state/state.ts` line 72:
```typescript
boardLaneMeta: {
  BACKLOG: { hasMore: false, nextCursor: null, loading: false },
  NOT_STARTED: { ... }, IN_PROGRESS: { ... }, TESTING: { ... }, DONE: { ... }
}
```

`internal/httpapi/web/modules/state/selectors.ts` lines 131–138:
```typescript
getBoardLaneMeta() fallback uses same five hardcoded keys
```

These fallbacks are **only used before board data loads** or when `boardLaneMeta` is null. Once `buildLaneMetaFromBoard` (board.ts lines 113–140) runs, it dynamically builds meta from the board's actual columns. **Low risk** — the fallback is effectively dead code once the board loads.

#### SSE refresh

`internal/httpapi/web/modules/views/board.ts`:
- `connectBoardEvents(slug)` (lines 335–397): `EventSource` on `/api/board/${slug}/events`
- On message: calls `refetchBoardFromRealtime` → `invalidateBoard` → `loadBoardBySlug` → full board re-fetch including `columnOrder`
- **No separate workflow refresh needed** — workflow metadata comes embedded in the board GET response

#### Caching

- Board prefetch cache in `internal/httpapi/web/modules/views/projects.ts` (lines 25–27, 529–552): `resolvedBoardBySlug` Map. After a workflow edit, this would serve stale data until next navigation or invalidation.
- `lastUpdateBoardContent*` skip-optimization in `board.ts` (lines 195–198): based on same board object reference — a fresh fetch bypasses this correctly.

**Required**: After a workflow edit from settings, drive the same invalidation/refetch paths the board already uses (e.g. clear `resolvedBoardBySlug`, call `invalidateBoard` / `loadBoardBySlug`) so headers and `columnOrder` update; add a new SSE event type only if existing realtime events cannot accomplish that.

---

### 1.6 Import/Export and API Impact

#### Export gap (pre-existing)

The HTTP export (`GET /api/backup/export`) uses `exportDataToJSON` (`internal/httpapi/json.go` lines 647+) which maps to `projectExportJSON` — this struct **omits `workflowColumns`, `sprints`, and `doneAt`** from the export. So the public export is a subset of what `ExportAllProjects` builds in memory.

**Impact**: Editing workflows does not break export because workflow data is already absent from the public export JSON. However, the store-level `ExportData.ProjectExport` **does** include `WorkflowColumns` (populated when workflow differs from defaults — `backup.go` line 351–363).

#### Import

Import paths (`internal/store/backup.go`):
- `validateImportPreflight` (lines 608+): validates workflow keys, names, colors, exactly-one-done, todo-status-resolves-in-workflow
- **Merge import**: refuses workflow replacement when existing todos reference keys not in the new workflow ("stranded" guard, ~lines 750–806)
- `insertWorkflowColumnsExec` is called after `deleteProjectWorkflowColumnsExec` during replacement

**Impact**: Import already handles custom workflows correctly. Editable lanes introduce no new import risk.

#### API endpoints needing changes

Currently **no workflow update endpoint exists**. Required new endpoints:

| Operation | Proposed endpoint | Notes |
|-----------|------------------|-------|
| Rename lane (label only) | `PATCH /api/board/{slug}/workflow/{key}` | Body: `{ "name": "..." }`; **lane `key` immutable**. |
| Add lane | `POST /api/board/{slug}/workflow` | Body: `{ "key": "...", "name": "...", "color": "...", "position": N }` |
| Delete lane | `DELETE /api/board/{slug}/workflow/{key}` | Precondition: no todos in lane |
| Reorder lanes | *(optional / future)* | e.g. `PUT .../workflow/order` — **not part of the core incremental rollout** unless existing UI requires it. |
| Change done lane | *(deferred)* | Not in near-term scope; see §3. |

#### MCP exposure

**MCP is out of scope for this workflow-editing rollout** — do not design the HTTP/store API around future MCP tools. No `workflows.*` tools exist today (`internal/mcp/registry.go`); `board.get` is planned only (`internal/mcp/adapter.go`). Todo tools still use `columnKey` / `toColumnKey`. A future `workflow.*` surface can be a separate product decision.

---

### 1.7 Permissions and Validation

#### Current permission model

Project roles (`internal/store/types.go` lines 280–361):
- **Maintainer**: full project control (create/delete/move todos, settings, export)
- **Contributor**: body edits on assigned todos only
- **Viewer**: read-only

Todo permissions (`internal/store/permissions.go` lines 12–41):
- Create/Delete/Move: Maintainer only
- Edit: Maintainer = full; Contributor = body only if assigned

**Recommendation**: Workflow editing should require **Maintainer** role, consistent with other structural project changes (board settings, sprints, members). No new permission type needed.

#### Required server-side validations for each operation

**Rename (label only — first increment)**:
- Caller must be project Maintainer
- New `name` must be non-empty, trimmed, ≤ 200 chars
- Key remains unchanged (reject key/`isDone`/`color` in body for this narrow endpoint, or ignore non-name fields)
- **Lane color**: optional / deferred to a later increment if not trivially isolated on the same PATCH.

**Add**:
- Caller must be project Maintainer
- New `key` must be valid (regex, ≤ 32 chars, unique in project)
- New `name` must be non-empty
- New lane must NOT be `is_done` (done-lane reassignment is deferred; see §3)
- `position` must be valid (0..len); reassign positions for all lanes
- Project must not exceed a reasonable lane limit (recommend max 12)

**Delete**:
- Caller must be project Maintainer
- Lane must NOT be `is_done`
- Lane must NOT contain any todos (`SELECT COUNT(*) FROM todos WHERE project_id = ? AND column_key = ?`)
- Project must retain ≥ 2 lanes after deletion
- Reassign positions for remaining lanes

**Change done** *(deferred — not shipping in this incremental rollout)*: If revisited, requires Maintainer, atomic `is_done` swap, `validateExactlyOneDoneColumn`, and a **deliberate historical-data strategy** for burndown/dashboard (`done_at`, `column_key`, replay semantics). Do not ship on “warn only” without that design.

#### Guardrails for first rollout

1. Block delete when any todos exist in the lane (no bulk-move yet)
2. Do **not** expose done-lane reassignment in the near-term phases below
3. Enforce `Maintainer` role on all workflow edit endpoints
4. Require minimum 2 lanes invariant on delete
5. Prefer **existing** board refresh paths: after workflow mutations, trigger the same invalidation/refetch the app already uses for board updates (e.g. `invalidateBoard` / `loadBoardBySlug`, clear `resolvedBoardBySlug` where needed). Add a **dedicated** SSE event type only if existing events cannot drive a metadata refresh reliably.

---

### 1.8 Testing Impact

#### Existing tests relevant to workflows/todos/stats

| Area | File | Key tests |
|------|------|-----------|
| Workflow creation/import | `internal/store/backup_integrity_test.go` | `TestExportImportRoundTrip_WorkflowColumns`, `TestImportMerge_ExistingCustomWorkflow`, `TestImportMerge_WorkflowReplacementRejectedWhenStrandedTodos` |
| Todo move + done_at | `internal/store/done_at_test.go` | `TestDoneAt_MoveTodo_IntoDONE`, `TestDoneAt_MoveTodo_ReopenPreserves` |
| Todo ordering across lanes | `internal/store/ordering_test.go` | `TestMoveTodo_MoveAcrossColumns`, `TestMoveTodo_ReorderWithinColumn` |
| Board paging + lanes | `internal/store/board_test.go` | `TestGetBoardPaged_ReturnsColumnsMeta`, `TestListTodosForBoardLane_Pagination` |
| Board API shape | `internal/httpapi/server_test.go` | `TestAPI_BoardPagedAndLaneEndpoint`, `TestAPI_CreateMoveAndFetchBoard` |
| Burndown | `internal/store/status_test.go` | `TestBurndown_TestingIsIncomplete`, `TestBurndown_TestingCompletedAfterDay` |
| Permissions | `internal/store/todos_assignee_test.go` | Full permission matrix for create/update/move/delete |
| MCP | `internal/mcp/adapter_test.go` | `TestMCPTodosCreate*`, `TestMCPTodosMoveSuccess*` |
| Import auth | `internal/store/backup_auth_test.go` | `TestBackupAuth_MaintainerCanExport` |

**No frontend tests exist** (no `.test.ts`, `.spec.ts`, or Playwright/Cypress files).

#### Minimum new test coverage needed

| Phase | Tests needed |
|-------|-------------|
| **Phase 1 (rename label)** | `TestRenameLane_UpdatesNameOnly`, `TestRenameLane_PreservesTodosColumnKey`, `TestRenameLane_RequiresMaintainer`, `TestRenameLane_EmptyNameRejected`, `TestRenameLane_BoardRefreshShowsNewName`, `TestRenameLane_BurndownUnaffected` |
| **Phase 2 (dashboard hardening)** | `TestDashboardSummary_CustomDoneKey`, `TestDashboardSummary_CustomWIPKeys` (and fix queries until they pass) |
| **Phase 3 (add lane)** | `TestAddLane_ValidKey`, `TestAddLane_DuplicateKeyRejected`, `TestAddLane_InsertsBeforeDone`, `TestAddLane_BoardRendersNewLane`, `TestAddLane_StatsUnaffected`, `TestAddLane_MaxLanesEnforced` |
| **Phase 4 (delete)** | `TestDeleteLane_EmptyLaneRemoved`, `TestDeleteLane_NonEmptyLaneRejected`, `TestDeleteLane_DoneLaneRejected`, `TestDeleteLane_MinLanesEnforced`, `TestDeleteLane_BoardRefreshRemovesLane`, `TestDeleteLane_StatsUnaffected` |
| **Deferred (done-lane reassignment)** | When a historical-data strategy exists: `TestChangeDone_*` and burndown/dashboard regression tests (see §3 deferred) |

---

## 2. Risk Matrix

| Risk | Severity | Likelihood | Affected phases | Mitigation |
|------|----------|------------|-----------------|------------|
| **Dashboard hardcodes `'done'` key** — pre-existing bug; custom-workflow projects can have wrong dashboard metrics | HIGH | CERTAIN (for any project not using default `done` key) | Phase 2 (fix); *not* a release-blocker for Phase 1 rename-label | Fix early in **Phase 2** (ideally right after Phase 1 or in parallel): replace hardcoded `'done'` with per-project done key; parameterize dashboard SQL |
| **Dashboard hardcodes `'doing'`/`'testing'` for WIP** — oldest WIP and WIP count assume these keys | MEDIUM | CERTAIN (for any project without those keys) | Phase 2 | Same Phase 2 hardening: parameterize WIP / aging-WIP |
| **Burndown rewrites history on done-lane change** — completed todos under old done key appear as "incomplete" | HIGH | If done-lane reassignment ships without design | Deferred | Options (a)–(c) in §3 remain documented; **do not adopt any without a deliberate historical-data strategy** |
| **Frontend fallback columns are hardcoded** — `columnsSpec()`, `LANE_CARD_CLASSES`, initial `boardLaneMeta` | LOW | Low (only triggered when `columnOrder` is empty) | All phases | Clean up fallbacks or ensure `columnOrder` is always populated |
| **Board prefetch cache serves stale workflow** — `resolvedBoardBySlug` not invalidated on edit | MEDIUM | Moderate | Phase 1+ | Clear prefetch cache on workflow edit or navigation to settings |
| **Export JSON omits workflow columns** — public export (`projectExportJSON`) has no `workflowColumns` | LOW | Low (store-level export includes them) | Phase 1+ | Consider adding to public export; not blocking |
| **`done_at` never clears on reopen** — moving a todo out of done does not reset `done_at` | LOW | By design (documented) | Deferred / future done-lane work | Revisit only if done-lane edits are designed |
| **MCP has no workflow tools** | LOW | N/A for this rollout | *Out of scope* | MCP exposure does not gate this feature |
| **No frontend tests** — cannot automatically verify board rendering after changes | MEDIUM | Moderate | All phases | Manual QA + consider adding Playwright smoke tests |

---

## 3. Recommended Rollout Phases

**Order:** Phase 1 → Phase 2 → Phase 3 → Phase 4. Rename-label-only is first and narrow. Dashboard hardening is **not** a release-blocker for Phase 1 (see §1.3–1.4): it fixes a **pre-existing** bug; shipping rename does not change keys, `is_done`, todo association, or stats query semantics. Land Phase 2 **immediately after** Phase 1 or **in parallel**; do not hold Phase 1 on it.

### Phase 1: Rename display label only

**Goal**: Rename a lane's **display `name` only**. **Lane `key` stays immutable.** **Lane color is optional / deferred** (follow-up) unless trivially isolated on the same endpoint.

**Scope**:
- `PATCH /api/board/{slug}/workflow/{key}` with body `{ "name": "string" }`
- **Strict contract**: reject unknown or mutating fields (`key`, `isDone`, `color`, `position`, etc.) with `400`
- Server updates `project_workflow_columns.name` only WHERE `project_id = ? AND key = ?`
- Refresh: prefer **existing** `invalidateBoard` / `loadBoardBySlug` and clearing `resolvedBoardBySlug`; use existing SSE/realtime that already triggers board refetch. Add a **new** event type only if that is insufficient.

**Explicit invariant**: key remains immutable in both API and UI; no hidden slug/key regeneration from name changes.

**Required code changes**:

| Layer | File | Change |
|-------|------|--------|
| Store | `internal/store/workflows.go` | e.g. `UpdateWorkflowColumnName(ctx, projectID int64, key, newName string) error` |
| HTTP | `internal/httpapi/routing.go` | `PATCH .../workflow/{key}` + maintainer check |
| Frontend | `web/modules/dialogs/settings.ts` | Workflow UI: label rename |
| Frontend | `web/modules/views/board.ts`, `projects.ts` | Wire success to existing board refresh / prefetch invalidation |

**Risks**: Minimal. Label-only; keys and `is_done` unchanged.

**Test plan**:
- `TestRenameLane_UpdatesNamePreservesKey` (store test)
- `TestRenameLane_RequiresMaintainer` (HTTP integration test)
- `TestRenameLane_NonexistentKeyReturns404` (HTTP integration test)
- `TestRenameLane_BoardAPIReflectsNewName` (HTTP integration test)
- `TestRenameLane_BurndownUnaffected` (store test)
- Manual QA: label, header, DnD, todo dialog

**Stats/charts impacted**: No.

---

### Phase 2: Dashboard hardening (custom done / WIP)

**Goal**: Fix **pre-existing** dashboard hardcoding (`'done'`, `'doing'`, `'testing'`). Same technical work as the old "Phase 0"; **not** blocking Phase 1.

**Scope**: Refactor `GetDashboardSummary` (`internal/store/dashboard.go`): per-project done key, parameterized WIP; batch helpers in `internal/store/workflows.go` (JOIN or `map[projectID]doneKey`). Details: ~12 SQL sites (lines 124, 191, 205, 250, 255, 274, 283, 298, 323, 361, 388, 428, 443, 462).

**Risks**: Low — internal SQL only.

**Test plan**: `TestDashboardSummary_CustomDoneKey`, `TestDashboardSummary_CustomWIPKeys`; existing `TestBurndown_*`.

**Stats/charts impacted**: Yes — dashboard correctness.

---

### Phase 3: Add lane

**Goal**: Allow adding a new non-done lane with **insert-before-done** behavior for v1. **Dedicated lane reorder** (e.g. `PUT .../workflow/order`) remains *optional / future*.

**Scope**:
- `POST /api/board/{slug}/workflow`
- Body: `{ "key": "string", "name": "string", "color": "#hexhex" }`
- Server inserts new row immediately before the current done lane, then normalizes positions
- After mutation: prefer **existing** board invalidation / refetch (same as Phase 1)
- Frontend: "Add lane"; key from `keyFromLaneName` / `makeUniqueLaneKey` (`projects.ts` lines 56–82)

**Required code changes**:

| Layer | File | Change |
|-------|------|--------|
| Store | `internal/store/workflows.go` | New `AddWorkflowColumn(ctx, projectID int64, col WorkflowColumn) error` with key validation, uniqueness, max-lane-count, and insert-before-done placement |
| HTTP | `internal/httpapi/routing.go` | New handler: `POST .../workflow` with maintainer check |
| Frontend | `web/modules/dialogs/settings.ts` | "Add lane" button → key derived from name; no position selector in v1 |

**Constraints**:
- New lane `is_done` must be `false`
- Max lane count: 12 (prevent abuse)
- Key auto-generation: reuse `keyFromLaneName` / `makeUniqueLaneKey` pattern from `projects.ts` on server side
- Placement in v1: always insert immediately before the done lane; no arbitrary `position` input

**Risks**: Low. New lane has no todos, so stats/board/DnD pick it up automatically.

**Test plan**:
- `TestAddLane_InsertsBeforeDone` (store test)
- `TestAddLane_DuplicateKeyRejected` (store test)
- `TestAddLane_InvalidKeyRejected` (store test)
- `TestAddLane_MaxLanesEnforced` (store test)
- `TestAddLane_IsDoneFalseEnforced` (store test: reject `isDone: true`)
- `TestAddLane_BoardShowsNewLane` (HTTP integration test)
- `TestAddLane_DnDWorksWithNewLane` (manual QA: add lane, drag todo into it)
- `TestAddLane_BurndownUnchanged` (store test)

**Stats/charts impacted**: No (empty lane, not done-flagged).

---

### Phase 4: Delete empty non-done lane

**Goal**: Delete a lane with **no todos** that is **not** the done lane; retain ≥ 2 lanes.

**Scope**:
- `DELETE /api/board/{slug}/workflow/{key}` with validations above
- Reassign positions; prefer **existing** board refresh plumbing after success
- Frontend: "Delete" per lane (disabled for done lane / non-empty lanes)

**Required code changes**:

| Layer | File | Change |
|-------|------|--------|
| Store | `internal/store/workflows.go` | New `DeleteWorkflowColumn(ctx, projectID int64, key string) error` with todo-count check, is-done check, min-lanes check |
| HTTP | `internal/httpapi/routing.go` | New handler: `DELETE .../workflow/{key}` with maintainer check |
| Frontend | `web/modules/dialogs/settings.ts` | Delete button per lane; disabled when lane has todos or is done; confirmation dialog |

**Risks**:
- **Dashboard WIP**: if Phase 2 is not shipped, deleting `"doing"`/`"testing"` can still yield wrong WIP — prefer **Phase 2 before or with** Phase 4, or accept edge cases until then.
- **Board CSS**: `card--doing` / `card--testing` unused — harmless.

**Test plan**:
- `TestDeleteLane_EmptyNonDoneLaneRemoved` (store test)
- `TestDeleteLane_NonEmptyLaneRejected` (store test)
- `TestDeleteLane_DoneLaneRejected` (store test)
- `TestDeleteLane_LastTwoLanesCannotDelete` (store test: must retain ≥ 2)
- `TestDeleteLane_PositionsReindexed` (store test)
- `TestDeleteLane_BoardNoLongerShowsLane` (HTTP integration test)
- `TestDeleteLane_ImportWithDeletedKeyStillWorks` (import test: export from old state, delete lane, import should not choke if no todos reference deleted key)
- Manual QA: delete a lane, verify board layout, verify DnD, verify stats unchanged

**Stats/charts impacted**: No for lane data itself (lane is empty), but custom-workflow dashboard correctness still depends on **Phase 2**. Do not interpret Phase 4 as independently safe to ship before Phase 2 in custom-workflow environments.

---

### Deferred: Change done designation (not near-term)

**Do not ship** reassignment of which lane has `is_done` in this incremental rollout. Risks: §1.3–1.4, burndown historical replay vs `column_key`/`done_at`.

If revisited (not scheduled): atomic `is_done` swap, `validateExactlyOneDoneColumn`, todo `done_at`/`column_key` rules, board refresh via **existing** plumbing unless a new event is truly required.

**Historical data — documented options (none without strategy)**:

1. **Option A:** Warn + accept semantic break — **insufficient alone** to justify shipping.
2. **Option B:** Migrate affected todos' `column_key` (and possibly timing) — needs spec + consent.
3. **Option C:** Store done-key-at-time / transition history — schema + burndown depth.

**No near-term ship:** defer until a historical-data strategy exists; Options A–C are not adoption candidates without that design.

**Tests:** deferred — `TestChangeDone_*` when/if strategy exists (§1.8).

**Stats/charts:** high blast radius if shipped naively; **Phase 2** helps *current* dashboard reads, not burndown historical replay correctness.

---

## 4. Dashboard Hardening and Optional Refactors

Detail for **rollout Phase 2** (not blocking Phase 1 rename-label).

### 4.1 Dashboard done-key / WIP parameterization (**not** blocking Phase 1)

**Why fix early:** custom-workflow projects already see wrong dashboard metrics — **pre-existing** bug. Phase 1 rename does not change keys or SQL filters.

**Scope**: Refactor `GetDashboardSummary` to resolve per-project done column keys and parameterize all SQL.

**Approach**:

```go
// In GetDashboardSummary, after loading projectIDs:
doneKeys, err := s.GetDoneColumnKeysForProjects(ctx, projectIDs)
// Returns map[int64]string  (projectID → done column key)
```

For cross-project queries (throughput, completion): GROUP BY or JOIN with `project_workflow_columns`.

For WIP: replace hardcoded `'doing'`/`'testing'` with a NOT IN (done_key, backlog_key) approach, or better: query all non-done, non-first-position lanes.

**Files**: `internal/store/dashboard.go`, `internal/store/workflows.go` (new batch helper).

### 4.2 Frontend fallback cleanup (optional)

**Scope**: Remove or guard `columnsSpec()` hardcoded fallback in `drag-drop.ts`. Since `columnOrder` is always populated when the board API succeeds, the fallback is dead code. Either:
- Remove it and fail explicitly if `columnOrder` is missing
- Log a warning if the fallback is ever hit

**Files**: `internal/httpapi/web/modules/features/drag-drop.ts`, `internal/httpapi/web/modules/state/state.ts`, `internal/httpapi/web/modules/state/selectors.ts`.

---

## 5. Concrete Implementation Checklist

### Phase 1: Rename label only

- [ ] `internal/store/workflows.go`: `UpdateWorkflowColumnName(ctx, projectID int64, key, newName string) error` (name-only; **optional later:** extend for color if isolated)
- [ ] Strict PATCH validation in handler: reject unknown/mutating fields with `400`
- [ ] Preserve key immutability in API + UI; no key regeneration from name edits
- [ ] `internal/httpapi/routing.go`: `PATCH /api/board/{slug}/workflow/{key}` + maintainer check
- [ ] Reuse existing board refresh: `invalidateBoard` / `loadBoardBySlug`, clear `resolvedBoardBySlug`; **only if needed:** new SSE event in `sse.go`
- [ ] `internal/httpapi/web/modules/dialogs/settings.ts`: workflow label rename UI
- [ ] Test: `TestRenameLane_*` (no color-invalid tests in this increment)
- [ ] Manual QA: label, DnD, todo dialog, stats unchanged

### Phase 2: Dashboard hardening

- [ ] `internal/store/workflows.go`: `GetDoneColumnKeysForProjects` (or equivalent batch)
- [ ] `internal/store/dashboard.go`: parameterize `'done'`, `'doing'`, `'testing'` usage per §4.1
- [ ] Tests: `TestDashboardSummary_CustomDoneKey`, `TestDashboardSummary_CustomWIPKeys`

### Phase 3: Add lane

- [ ] `internal/store/workflows.go`: `AddWorkflowColumn(...)` + insert-before-done placement (no arbitrary position input in v1)
- [ ] `internal/httpapi/routing.go`: `POST /api/board/{slug}/workflow`
- [ ] `internal/httpapi/web/modules/dialogs/settings.ts`: add-lane UI
- [ ] Test: `TestAddLane_*`
- [ ] *(Optional / future: dedicated reorder endpoint if product requires it)*

### Phase 4: Delete empty non-done lane

- [ ] `internal/store/workflows.go`: `DeleteWorkflowColumn(...)` with guards
- [ ] `internal/httpapi/routing.go`: `DELETE /api/board/{slug}/workflow/{key}`
- [ ] `internal/httpapi/web/modules/dialogs/settings.ts`: delete controls
- [ ] Test: `TestDeleteLane_*`

### Deferred: Change done designation

- [ ] **Do not schedule** until historical-data strategy (§3 deferred) is defined; then design + `TestChangeDone_*`

### Cross-cutting (all phases)

- [ ] `internal/httpapi/web/modules/features/drag-drop.ts`: optional `columnsSpec()` / `LANE_CARD_CLASSES` cleanup
- [ ] `internal/httpapi/web/modules/state/state.ts`: optional `boardLaneMeta` fallback cleanup
- [ ] **MCP:** out of scope for this rollout — no checklist items
- [ ] `README.md` / docs for workflow editing (as shipped)
- [ ] Optional: `workflowColumns` on public export (`projectExportJSON`)
