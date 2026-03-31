## Scrumboy MCP Adapter Implementation Plan

Builds on the prior audit: [mcp_readiness_audit_e58d38a8.plan.md](C:/Users/okayt/.cursor/plans/mcp_readiness_audit_e58d38a8.plan.md).

This plan assumes:

- The current frontend-facing REST surface must remain unchanged.
- MCP support should be added as a new adapter layer, not by normalizing existing REST handlers first.
- The adapter should be thin, incremental, and deterministic for machine clients.
- Canonical MCP todo identity is `projectSlug + localId` unless later code evidence proves that impossible.

## 1. Where The MCP Layer Should Live

### Recommended structure

Use a new top-level package at [`internal/mcp/`](internal/mcp/) for the adapter core, and mount it from the existing HTTP server in [`internal/httpapi/server.go`](internal/httpapi/server.go).

Recommended initial file layout:

- [`internal/mcp/adapter.go`](internal/mcp/adapter.go)
  - adapter struct, shared dependencies, mode/auth helpers
- [`internal/mcp/http_handler.go`](internal/mcp/http_handler.go)
  - HTTP-facing MCP transport entrypoint mounted at `/mcp`
- [`internal/mcp/registry.go`](internal/mcp/registry.go)
  - tool registry and dispatch
- [`internal/mcp/types.go`](internal/mcp/types.go)
  - canonical MCP result/error/capabilities structs
- [`internal/mcp/errors.go`](internal/mcp/errors.go)
  - adapter error codes and backend-to-MCP mapping
- [`internal/mcp/normalize.go`](internal/mcp/normalize.go)
  - input camelCase normalization, optional/null handling, pagination translation
- [`internal/mcp/system_tools.go`](internal/mcp/system_tools.go)
- [`internal/mcp/projects_tools.go`](internal/mcp/projects_tools.go)
- [`internal/mcp/board_tools.go`](internal/mcp/board_tools.go)
- [`internal/mcp/todos_tools.go`](internal/mcp/todos_tools.go)
- [`internal/mcp/testutil_test.go`](internal/mcp/testutil_test.go)
  - helper setup using the same store/test patterns already used in [`internal/httpapi/server_test.go`](internal/httpapi/server_test.go)

Likely touched existing files:

- [`cmd/scrumboy/main.go`](cmd/scrumboy/main.go)
  - wire MCP adapter into the current process
- [`internal/config/config.go`](internal/config/config.go)
  - possible touch point if mount/exposure is controlled via config
- [`internal/httpapi/server.go`](internal/httpapi/server.go)
  - mount `/mcp` before SPA fallback

### Why this structure fits this repo

- [`cmd/scrumboy/main.go`](cmd/scrumboy/main.go) already builds one process around one `*store.Store` and one `http.Server`. Reusing that process is the lowest-risk path.
- [`internal/httpapi/`](internal/httpapi/) is heavily tied to browser concerns: cookies, SPA routing, SSE, HTML assets, CSRF header rules, and frontend JSON contracts. That makes it the wrong home for MCP tool logic.
- [`internal/store/`](internal/store/) already contains the real business and permission logic. The MCP layer should sit just above it, not below it and not inside the browser API package.
- Mounting `/mcp` from the existing server keeps deployment simple and avoids inventing a second daemon, second database wiring path, or separate lifecycle.

### Chosen transport

Initial transport should be HTTP-mounted MCP on the existing server, at `/mcp`.

Why:

- The repo already has only one server entrypoint and no CLI/stdio transport infrastructure.
- [`internal/httpapi/server.go`](internal/httpapi/server.go) already owns request dispatch, so adding one more top-level route is a very small change.
- Keeping MCP off `/api/*` avoids the existing `X-Scrumboy` mutation header rule and avoids accidental coupling to frontend REST conventions.

### Decision point: MCP mount and exposure control

This plan keeps the transport recommendation of `/mcp` on the existing server, but does not assume upfront how exposure is controlled.

#### Option A: add an `MCPEnabled` config flag, default `false`

Pros:

- lowest operational surprise
- explicit rollout switch for dev/staging/local testing
- easy to keep dormant while package skeleton lands

Cons:

- adds new config surface and startup branching
- may be unnecessary if `/mcp` can always exist safely behind tool-level checks
- slightly increases config/test matrix

Likely code touch points:

- [`internal/config/config.go`](internal/config/config.go)
- [`cmd/scrumboy/main.go`](cmd/scrumboy/main.go)
- [`internal/httpapi/server.go`](internal/httpapi/server.go)

Rollout implications:

- safest for staged rollout
- requires deployment/config coordination before MCP is visible anywhere

#### Option B: always mount `/mcp` and rely on tool-level auth/capability checks

Pros:

- simplest routing model
- fewer startup branches
- capability discovery can always explain current availability

Cons:

- exposes the surface everywhere immediately
- may be undesirable if the team wants MCP hidden until later phases
- needs especially clear capability and auth responses from day one

Likely code touch points:

- [`cmd/scrumboy/main.go`](cmd/scrumboy/main.go)
- [`internal/httpapi/server.go`](internal/httpapi/server.go)

Rollout implications:

- easiest implementation path
- requires confidence that an always-mounted but mostly inert `/mcp` route is acceptable operationally

#### Option C: mount `/mcp` only in selected environments/builds if a natural pattern already exists

Pros:

- could align with existing repo/build behavior if such a pattern already exists
- avoids adding brand-new config if there is already a stronger precedent

Cons:

- current codebase does not yet show an obvious environment-specific server composition pattern
- risks adding build/runtime branching that is harder to reason about than a small config flag

Likely code touch points:

- [`cmd/scrumboy/main.go`](cmd/scrumboy/main.go)
- possible build or startup wiring around the main server path

Rollout implications:

- only attractive if a natural existing repo pattern is confirmed during implementation
- should not be invented from scratch just for MCP

Current plan status:

- Settled: MCP should live at `/mcp` on the existing server when enabled/mounted.
- Not yet settled: whether `/mcp` is always mounted or conditionally exposed.
- Earliest implementation work should preserve this decision point until a brief code inspection confirms whether there is already a natural exposure pattern.

### Decision point: MCP auth strategy

Auth is a first-order design decision for this adapter. It should be resolved early because it affects transport behavior, capability reporting, and which tools are safe to ship in the first cut.

#### Option A: reuse existing session cookie behavior

What it means technically:

- MCP requests are authenticated the same way REST requests currently are, by resolving the existing session cookie into request context.
- The adapter reuses or lightly extracts the auth-context logic currently centered in [`internal/httpapi/server.go`](internal/httpapi/server.go).

Likely file/package touch points:

- [`internal/httpapi/server.go`](internal/httpapi/server.go)
- [`internal/mcp/adapter.go`](internal/mcp/adapter.go)
- [`internal/mcp/http_handler.go`](internal/mcp/http_handler.go)

Main risks:

- MCP clients may not reliably send browser-style cookies
- could accidentally pull browser assumptions into the adapter if not isolated cleanly
- may work well only for locally co-hosted clients and not for other MCP runtimes

Effect on near-term rollout:

- safest if the initial MCP client is local and can share the existing authenticated session
- makes `system.getCapabilities` and `projects.list` straightforward
- still leaves auth portability unresolved for later phases

#### Option B: add a separate MCP-specific token or bearer mechanism

What it means technically:

- `/mcp` accepts a dedicated token/header flow instead of or in addition to the session cookie
- adapter auth context is derived separately from current browser session handling

Likely file/package touch points:

- [`internal/mcp/http_handler.go`](internal/mcp/http_handler.go)
- [`internal/mcp/adapter.go`](internal/mcp/adapter.go)
- likely config and token-management touch points not yet present in current code

Main risks:

- larger scope than the current thin-adapter goal
- introduces new secret lifecycle and probably new persistence/config needs
- can easily drag Phase 0 into auth-product work

Effect on near-term rollout:

- may be the right long-term answer
- is not the lowest-risk path for the first slice unless a target MCP runtime makes cookie reuse impossible

#### Option C: keep early MCP phases limited until auth is resolved

What it means technically:

- land the adapter skeleton and capability surface first
- optionally ship only tools whose auth story is clear
- defer broader authenticated tool rollout until one auth path is chosen

Likely file/package touch points:

- [`internal/mcp/adapter.go`](internal/mcp/adapter.go)
- [`internal/mcp/system_tools.go`](internal/mcp/system_tools.go)
- [`internal/mcp/projects_tools.go`](internal/mcp/projects_tools.go)

Main risks:

- slows down functional breadth
- may create temporary capability/tool gating that later needs tightening

Effect on near-term rollout:

- best match if auth cannot be settled quickly
- supports the safer first cut of skeleton plus `system.getCapabilities` and, if viable, `projects.list`

Current plan status:

- Settled: auth must be surfaced explicitly in capabilities and error contracts.
- Not yet settled: whether the initial implementation uses session cookies, a new token flow, or a deliberately limited early rollout.
- The first coding cut should avoid committing the rest of the adapter to one auth mechanism beyond what is necessary for `system.getCapabilities` and possibly `projects.list`.

## 2. What The MCP Layer Should Call

### Recommended approach

Use a hybrid approach with a strong bias toward direct store calls:

- MCP transport/auth context setup should reuse existing server request context behavior where possible.
- MCP tool implementations should call store-layer functions directly.
- MCP should not call existing REST handlers indirectly.
- Shared logic should be extracted only when duplication is non-trivial and clearly safer than copying a few lines.

### Why direct store calls are safest here

- Existing REST handlers in [`internal/httpapi/routing.go`](internal/httpapi/routing.go), [`internal/httpapi/dashboard.go`](internal/httpapi/dashboard.go), and [`internal/httpapi/auth_2fa.go`](internal/httpapi/auth_2fa.go) are tightly coupled to HTTP parsing, status codes, HTML responses, and current frontend response shapes.
- The store already enforces most of the important business rules and access checks:
  - project read/write access in [`internal/store/projects.go`](internal/store/projects.go)
  - todo mutation and edit-scope logic in [`internal/store/todos.go`](internal/store/todos.go)
  - link behavior in [`internal/store/links.go`](internal/store/links.go)
  - system role checks in [`internal/store/system_roles.go`](internal/store/system_roles.go)
- Calling handlers would force the MCP layer to translate already-inconsistent REST responses back into normalized tool results. That adds complexity without gaining safety.

### What can be reused safely

- Request user resolution from [`internal/httpapi/server.go`](internal/httpapi/server.go) should be reused conceptually and, if practical, via a small extracted helper so MCP and REST derive auth context the same way.
- Store methods should be reused directly for all first-slice tools.
- Existing JSON shaping in [`internal/httpapi/json.go`](internal/httpapi/json.go) should not be reused by default. Those structs were built to preserve UI contracts, not MCP contracts.

### When extraction is worth it

Worth extracting:

- a small auth-context helper if MCP and REST both need identical cookie-to-context behavior
- a small mode/capabilities helper if both REST and MCP need to expose `full` vs `anonymous` and bootstrap status

Not worth extracting in Phase 0 or 1:

- generic projection/model layers
- a shared “application service” package spanning every domain
- current REST JSON DTOs into a shared contract package

## 3. Canonical MCP Contract

### Canonical conventions

#### Resource identity

- Project identity: `projectSlug`
- Todo identity: `projectSlug + localId`
- Sprint identity: `projectSlug + sprintId`
- Tag identity:
  - project-scoped mutations prefer `tagId` when known
  - name-based fallback stays adapter-internal only where backend behavior requires it

The MCP layer must never expose global todo ID routes as canonical.

#### Input naming

- All MCP inputs use camelCase.
- Adapter accepts only canonical camelCase at the MCP surface.
- Adapter internally translates to legacy backend fields only when store calls or transitional handler reuse require it.

#### Output envelope

Every successful tool returns:

```json
{
  "ok": true,
  "data": {},
  "meta": {}
}
```

Rules:

- `data` is always present on success.
- Collections are wrapped as `data.items`, never returned as raw arrays.
- Entity fetches return a named object inside `data`, not a raw object at the top level.
- `meta` is optional in meaning, but present as an object for consistency.

#### Output field stability

- MCP output field names are part of the adapter contract and should be treated as compatibility promises once exposed.
- Field names should be semantic and stable, even when backend/store/REST naming is inconsistent today.
- Backend quirks should be translated behind the adapter rather than leaked into MCP because they already exist internally.
- Avoid exposing transitional or shaky field names that are likely to be renamed in the next phase.

#### Pagination model

Default canonical pagination for standard list/search tools:

```json
{
  "limit": 20,
  "cursor": "opaque-string"
}
```

Default canonical paged output:

```json
{
  "ok": true,
  "data": {
    "items": []
  },
  "meta": {
    "nextCursor": "opaque-string-or-null",
    "hasMore": true
  }
}
```

#### Board pagination special case

`board.get` is not a standard single-list pagination problem. The current backend board surface already carries per-column metadata, and forcing that into the same `limit/cursor` output shape as normal list/search tools would hide useful structure or create awkward abstraction.

Board-specific rule:

- `limit` may still be used as an input concept for per-column window size
- board outputs may use specialized metadata such as `nextCursorByColumn` and `hasMoreByColumn`
- this is an explicit adapter special case, not a failure of the broader pagination model

Why this is acceptable:

- normal list/search tools still benefit from one simple default contract
- board views are structurally multi-column and deserve a specialized response shape
- keeping the exception explicit is less risky than pretending a universal pagination envelope fits both cases cleanly

#### Error shape

The adapter should normalize internal/backend failures to one MCP-side error payload shape:

```json
{
  "ok": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Sign-in required for this tool",
    "details": {
      "backendCode": "UNAUTHORIZED"
    }
  }
}
```

Canonical adapter codes should include:

- `AUTH_REQUIRED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `CONFLICT`
- `RATE_LIMITED`
- `MODE_UNAVAILABLE`
- `CAPABILITY_UNAVAILABLE`
- `INTERNAL`

#### Auth and capability discovery

The adapter should expose one explicit introspection tool before domain tools:

- `system.getCapabilities`

This tool should report:

- current server mode: `full` or `anonymous`
- which auth mechanism is configured or unresolved for MCP
- whether authenticated tools are usable under the current configuration
- whether bootstrap is available
- canonical identity rules
- implemented tools
- planned tools only if the adapter intentionally wants to expose roadmap-like visibility, and only when clearly labeled as non-implemented
- major adapter constraints such as legacy route suppression and current pagination contract

Truthfulness rule:

- `system.getCapabilities` must describe what the adapter can actually do in the current implementation.
- The tool list must not advertise future tools as if they already exist.
- If roadmap visibility is useful, expose it separately as something like `plannedTools`, not mixed into `implementedTools`.

### Example MCP tool shapes

#### `system.getCapabilities`

Input:

```json
{}
```

Output:

```json
{
  "ok": true,
  "data": {
    "serverMode": "full",
    "auth": {
      "mode": "sessionCookie|bearerToken|limitedEarlyPhase",
      "authenticated": true,
      "bootstrapAvailable": false
    },
    "identity": {
      "project": "projectSlug",
      "todo": ["projectSlug", "localId"],
      "sprint": ["projectSlug", "sprintId"]
    },
    "pagination": {
      "defaultInput": ["limit", "cursor"],
      "defaultOutput": ["nextCursor", "hasMore"],
      "specialCases": ["board.get"]
    },
    "implementedTools": [
      "system.getCapabilities",
      "projects.list"
    ],
    "plannedTools": [
      "board.get",
      "todos.create"
    ]
  },
  "meta": {
    "adapterVersion": 1
  }
}
```

#### `projects.list`

Input:

```json
{}
```

Output:

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "projectSlug": "demo-board",
        "projectId": 12,
        "name": "Demo Board",
        "image": null,
        "dominantColor": "#64748b",
        "defaultSprintWeeks": 2,
        "expiresAt": null,
        "createdAt": "2026-03-31T12:00:00Z",
        "updatedAt": "2026-03-31T12:00:00Z",
        "role": "maintainer"
      }
    ]
  },
  "meta": {}
}
```

#### `board.get`

Input:

```json
{
  "projectSlug": "demo-board",
  "tag": "bug",
  "search": "login",
  "sprintId": "active",
  "limit": 50
}
```

Output:

```json
{
  "ok": true,
  "data": {
    "project": {
      "projectSlug": "demo-board",
      "projectId": 12,
      "name": "Demo Board",
      "role": "maintainer"
    },
    "columns": [
      {
        "key": "backlog",
        "name": "Backlog",
        "isDone": false,
        "items": []
      }
    ],
    "tags": [
      {
        "tagId": 3,
        "name": "bug",
        "count": 4,
        "color": "#ef4444",
        "canDelete": true
      }
    ]
  },
  "meta": {
    "nextCursorByColumn": {
      "backlog": null
    },
    "hasMoreByColumn": {
      "backlog": false
    }
  }
}
```

#### `todos.create`

Input:

```json
{
  "projectSlug": "demo-board",
  "title": "Add MCP adapter",
  "body": "Thin layer only",
  "tags": ["mcp"],
  "columnKey": "backlog",
  "estimationPoints": 3,
  "sprintId": null,
  "assigneeUserId": null,
  "position": {
    "afterLocalId": null,
    "beforeLocalId": null
  }
}
```

Output:

```json
{
  "ok": true,
  "data": {
    "todo": {
      "projectSlug": "demo-board",
      "id": 101,
      "localId": 27,
      "title": "Add MCP adapter",
      "body": "Thin layer only",
      "columnKey": "backlog",
      "status": "BACKLOG",
      "tags": ["mcp"],
      "estimationPoints": 3,
      "assigneeUserId": null,
      "sprintId": null,
      "createdAt": "2026-03-31T12:00:00Z",
      "updatedAt": "2026-03-31T12:00:00Z"
    }
  },
  "meta": {}
}
```

#### `todos.update`

Input:

```json
{
  "projectSlug": "demo-board",
  "localId": 27,
  "patch": {
    "title": "Add initial MCP adapter",
    "body": "Phase 0 and 1 only",
    "tags": ["mcp", "backend"],
    "estimationPoints": 5,
    "assigneeUserId": null,
    "sprintId": null
  }
}
```

Output:

```json
{
  "ok": true,
  "data": {
    "todo": {
      "projectSlug": "demo-board",
      "localId": 27,
      "title": "Add initial MCP adapter"
    }
  },
  "meta": {}
}
```

#### `todos.move`

Input:

```json
{
  "projectSlug": "demo-board",
  "localId": 27,
  "toColumnKey": "in-progress",
  "afterLocalId": 22,
  "beforeLocalId": null
}
```

Output:

```json
{
  "ok": true,
  "data": {
    "todo": {
      "projectSlug": "demo-board",
      "localId": 27,
      "columnKey": "in-progress",
      "status": "IN-PROGRESS"
    }
  },
  "meta": {}
}
```

#### `todos.search`

Input:

```json
{
  "projectSlug": "demo-board",
  "query": "adapter",
  "limit": 20,
  "excludeLocalIds": [27]
}
```

Output:

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "projectSlug": "demo-board",
        "localId": 31,
        "title": "Document adapter behavior"
      }
    ]
  },
  "meta": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

## 4. First Implementation Slice

### Recommended first slice

Implement the safest smallest vertical slice that proves the adapter shape and capability contract without forcing early commitment on board projection or auth breadth:

- `system.getCapabilities`
- `projects.list`

Why this slice:

- It exercises mode/auth discovery before any mutation.
- It establishes the adapter skeleton, canonical envelope, and capability contract first.
- It gives one simple authenticated read tool that is much less entangled with frontend DTO shaping than `board.get`.
- It preserves room to resolve auth and board-projection decisions before mutation tools arrive.

### Immediate next-step decision point: `board.get`

`board.get` is still likely one of the earliest useful MCP tools, but it is a higher-risk read tool than `projects.list`.

Why it is higher risk in this codebase:

- the current board response shape in [`internal/httpapi/json.go`](internal/httpapi/json.go) is closely aligned to frontend board rendering
- it already carries board-specific multi-column pagination metadata
- it is the easiest place for frontend-shaped DTO complexity to leak into MCP too early

Decision point:

- Option A: keep `board.get` in Phase 1 if code inspection shows the projection can stay clean, small, and clearly MCP-specific
- Option B: move `board.get` to the immediate follow-on phase after Phase 1 if projection is too entangled with frontend concerns

Current plan status:

- Settled: `projects.list` is the safest first read tool.
- Not yet settled: whether `board.get` belongs in Phase 1 or immediately after it.
- First implementation prompt should not require `board.get`.

### Files likely to be added

- [`internal/mcp/adapter.go`](internal/mcp/adapter.go)
- [`internal/mcp/http_handler.go`](internal/mcp/http_handler.go)
- [`internal/mcp/registry.go`](internal/mcp/registry.go)
- [`internal/mcp/types.go`](internal/mcp/types.go)
- [`internal/mcp/errors.go`](internal/mcp/errors.go)
- [`internal/mcp/normalize.go`](internal/mcp/normalize.go)
- [`internal/mcp/system_tools.go`](internal/mcp/system_tools.go)
- [`internal/mcp/projects_tools.go`](internal/mcp/projects_tools.go)
- [`internal/mcp/adapter_test.go`](internal/mcp/adapter_test.go)
- [`internal/mcp/normalize_test.go`](internal/mcp/normalize_test.go)
- [`internal/mcp/http_handler_test.go`](internal/mcp/http_handler_test.go)

### Files likely to be modified

- [`cmd/scrumboy/main.go`](cmd/scrumboy/main.go)
- [`internal/config/config.go`](internal/config/config.go) if the mount decision selects config-gated exposure
- [`internal/httpapi/server.go`](internal/httpapi/server.go)

### Existing code dependencies

- mode/auth context from [`internal/httpapi/server.go`](internal/httpapi/server.go)
- project visibility and role checks from [`internal/store/projects.go`](internal/store/projects.go)

### Risk level

Low for the first cut if limited to skeleton plus `system.getCapabilities` and `projects.list`.

Main risks:

- auth context reuse may be awkward if `requestContext` stays private to `httpapi.Server`
- MCP client auth expectations may not match cookie-based auth
- mount/exposure decision may add minor startup wiring churn depending on which option is chosen

### What should be tested

- capability reporting in `full` vs `anonymous` mode
- `projects.list` auth behavior in full mode and anonymous mode
- normalization of empty arrays/nulls/meta fields
- explicit non-exposure of legacy global todo IDs as MCP input identifiers in capabilities and registry contracts

## 5. Staged Rollout Plan

### Phase 0: Groundwork

#### Scope

- package skeleton
- `/mcp` mount
- adapter registry
- canonical result/error helpers
- resolve the mount/exposure decision
- resolve or deliberately constrain the early auth decision

#### Tools included

- none or only a no-op health dispatch until `system.getCapabilities` is wired

#### Technical tasks

- decide among the mount/exposure options in Section 1 before wiring startup behavior
- construct adapter in [`cmd/scrumboy/main.go`](cmd/scrumboy/main.go) from the same store and mode already used by `httpapi`
- mount `/mcp` in [`internal/httpapi/server.go`](internal/httpapi/server.go) before SPA routing
- add `internal/mcp` package skeleton and registry
- add canonical success/error helpers
- add enough auth/capability plumbing for `system.getCapabilities` to report the configured or unresolved auth mode

#### Risks

- route mount order accidentally interfering with SPA or `/api/*`
- overcommitting to an SDK or transport abstraction too early

#### Exit criteria

- chosen mount behavior is documented in code and tests
- `/mcp` exposure behavior matches the selected option
- no existing frontend/API tests regress

### Phase 1: Capability + Safe Read Tools

#### Scope

- capability discovery
- authenticated, read-only project tools
- optional `board.get` only if projection stays clean after a focused code check

#### Exact tools

- `system.getCapabilities`
- `projects.list`
- `board.get` only if the Phase 1 decision check stays low-risk; otherwise defer to the immediate next phase

#### Technical tasks

- implement mode/bootstrap/auth reporting using current store + mode state
- add canonical project projection
- if `board.get` remains in Phase 1, add a board projection that is explicitly MCP-specific rather than a thin copy of the frontend DTO
- ensure auth failures become deterministic adapter errors

#### Risks

- board projection shape growing too close to current frontend DTOs
- unclear semantics for anonymous temporary boards unless capability output is explicit

#### Exit criteria

- MCP client can discover mode and list projects through canonical `projectSlug`
- output shapes are stable and wrapped
- unauthorized access is deterministic from MCP perspective

### Phase 1B: `board.get` if deferred

#### Scope

- add `board.get` only after a focused projection check

#### Exact tools

- `board.get`

#### Technical tasks

- inspect board/store shaping paths closely enough to decide whether a clean MCP projection is small and durable
- define the board-specific pagination metadata separately from standard list/search pagination
- ensure the adapter does not simply mirror [`internal/httpapi/json.go`](internal/httpapi/json.go) board DTO structure unless that shape is truly stable and semantically appropriate for MCP

#### Risks

- early leakage of frontend board DTO assumptions
- bloating the first rollout with multi-column pagination and filtering semantics

#### Exit criteria

- `board.get` contract is demonstrably MCP-specific, stable, and not just a REST/UI DTO copy
- board pagination special-case metadata is documented and tested

### Phase 2: Core Todo Mutation Tools

#### Scope

- create, update, move, get, delete, search

#### Exact tools

- `todos.create`
- `todos.get`
- `todos.update`
- `todos.move`
- `todos.delete`
- `todos.search`

#### Technical tasks

- translate canonical `projectSlug + localId` to current store calls
- implement patch normalization so missing fields are not confused with explicit nulls
- hide backend quirks such as required `assigneeUserId` presence on update
- normalize search input to `query`, `limit`, `excludeLocalIds`

#### Risks

- update semantics: current REST layer enforces presence of `assigneeUserId`; MCP patch behavior must be explicit
- move positioning needs consistent handling of `afterLocalId` vs `beforeLocalId`

#### Exit criteria

- all core todo operations work without exposing global todo ID routes
- canonical patch semantics are tested
- machine clients can create and modify todos using only slug/localId

### Phase 3: Sprints, Tags, Members

#### Scope

- secondary project workflows and project administration

#### Exact tools

- `sprints.list`, `sprints.create`, `sprints.get`, `sprints.update`, `sprints.delete`, `sprints.activate`, `sprints.close`
- `tags.listProject`, `tags.listMine`, `tags.updateColor`, `tags.delete`
- `members.list`, `members.add`, `members.updateRole`, `members.remove`, `members.listAvailable`

#### Technical tasks

- normalize mixed 204/object behaviors from current semantics into structured results
- hide durable-vs-anonymous tag routing differences behind one adapter contract
- make maintainer-only operations explicit in capability and auth failure metadata

#### Risks

- tag behavior differs across durable projects vs anonymous boards
- sprint list currently has mixed empty behavior (`204` vs object); adapter must pick one stable shape

#### Exit criteria

- all project collaboration tools use one canonical contract
- no MCP tool requires the caller to know durable vs temp routing quirks

### Phase 4: Optional Advanced Surface

#### Scope

- dashboard/admin/backup/auth mutations/streaming if still valuable

#### Exact tools

- `dashboard.getSummary`
- `dashboard.listTodos`
- `admin.users.*`
- `backup.*`
- optional event/stream subscriptions
- optional auth tools beyond capability discovery

#### Technical tasks

- add explicit auth-required metadata for dashboard tools
- decide whether admin/backup should be exposed at all in initial MCP scope
- evaluate streaming only after the read/write tool surface is stable

#### Risks

- backup/admin tools carry higher blast radius
- streaming increases transport complexity disproportionately
- auth mutation tools may force a more explicit MCP auth story

#### Exit criteria

- only tools with clear MCP value and safe semantics are exposed
- advanced tools do not weaken the simple deterministic core

## 6. Normalization Rules

These are implementation rules for the adapter, not general principles.

### `204` responses or no-body operations

- MCP never returns an empty success.
- For delete/activate/close/disable-style operations, synthesize:

```json
{
  "ok": true,
  "data": {
    "status": "deleted"
  },
  "meta": {}
}
```

- If the operation has a more specific semantic, use that instead of `"deleted"`:
  - `"updated"`
  - `"moved"`
  - `"activated"`
  - `"closed"`
  - `"loggedOut"`

### HTML or non-JSON success responses

- MCP must never forward raw HTML.
- For endpoints whose current REST success is HTML or text, the adapter must map them to semantic JSON success.
- Example: logout should become `{ ok:true, data:{ status:"loggedOut" }, meta:{} }`.

### Array responses

- MCP must never return a raw array at top level.
- Wrap all arrays as `data.items`.
- Preserve item order exactly as returned by store/backend logic.

### Mixed snake_case vs camelCase inputs

- MCP accepts camelCase only.
- Adapter translates legacy request names internally:
  - `userId` -> backend `user_id` when needed
  - `newPassword` -> backend `new_password` when needed
- Adapter should reject snake_case at the MCP boundary with `VALIDATION_ERROR` rather than silently accepting multiple spellings.

### Legacy route suppression

- MCP must never expose:
  - `/api/todos/{id}`
  - `/api/projects/{id}/board` as a canonical board fetch
  - any global todo ID mutation path as MCP tool input
- Legacy backend routes remain untouched for frontend compatibility only.
- If adapter implementation internally falls back to a legacy path during transition, that must remain invisible to callers and marked with a code comment as transitional.

### Mode-dependent behavior

- `system.getCapabilities` must always be callable.
- In `anonymous` mode:
  - capability output must say auth tools are unavailable
  - project-scoped read/write tools must clearly indicate anonymous-board limitations
- In pre-bootstrap `full` mode:
  - capability output must say `bootstrapAvailable: true`
  - tools that are blocked only because no session exists should return `AUTH_REQUIRED`, not generic internal errors
- If auth is unresolved or intentionally limited in the first cut, `projects.list` must fail deterministically with `AUTH_REQUIRED` or `CAPABILITY_UNAVAILABLE`; it must not silently disappear from routing/dispatch or degrade into an ambiguous not-found behavior.

### Auth failure vs not-found masking

- The REST layer intentionally sometimes maps unauthorized access to `NOT_FOUND`.
- MCP should preserve privacy but reduce ambiguity where the caller already has a canonical target shape.
- Rule:
  - entrypoint-level missing auth becomes `AUTH_REQUIRED`
  - project resource fetch after auth is present but membership is missing stays `NOT_FOUND`
  - capability output should warn that some unauthorized project accesses are intentionally masked as not found

### Pagination translation

- Standard list/search tools use canonical MCP input `limit` and `cursor`.
- Translation rules:
  - board lane paging: MCP `cursor` maps to backend `afterCursor`
  - dashboard paging: MCP `cursor` maps to backend `cursor`
  - board summary fetch with lane windows, if exposed via `board.get`, may map MCP `limit` to backend `limitPerLane`
- Standard paged outputs normalize to `meta.nextCursor` and `meta.hasMore`.
- `board.get` is an explicit special case and may expose `meta.nextCursorByColumn` and `meta.hasMoreByColumn`.

### Optional and null field normalization

- If a field is meaningful but unset, return `null`, not omission, unless omission has actual semantic value.
- Collections should default to `[]`, not `null`.
- `meta` should always be an object.
- Omit fields only when omission itself is part of the contract and documented, such as capability sections not available in current mode.

## 7. Test Strategy

### Recommended test locations

- [`internal/mcp/normalize_test.go`](internal/mcp/normalize_test.go)
- [`internal/mcp/errors_test.go`](internal/mcp/errors_test.go)
- [`internal/mcp/registry_test.go`](internal/mcp/registry_test.go)
- [`internal/mcp/http_handler_test.go`](internal/mcp/http_handler_test.go)
- [`internal/mcp/projects_tools_test.go`](internal/mcp/projects_tools_test.go)
- [`internal/mcp/board_tools_test.go`](internal/mcp/board_tools_test.go)
- [`internal/mcp/todos_tools_test.go`](internal/mcp/todos_tools_test.go)

Optional light-touch route smoke test:

- extend [`internal/httpapi/server_test.go`](internal/httpapi/server_test.go) only to verify `/mcp` mount behavior does not break current routing

### What to test

#### Unit tests for normalization helpers

- array wrapping
- null/default handling
- canonical error mapping
- pagination translation
- camelCase input validation and translation

#### Tool tests

- `system.getCapabilities` in `full`, `anonymous`, and pre-bootstrap cases
- `projects.list` with auth and without auth
- `board.get` by slug with filters only when that tool is included in the selected phase

#### Auth and mode behavior tests

- anonymous mode still exposes capabilities but not auth-only tools
- full mode without session returns deterministic `AUTH_REQUIRED`
- membership denial remains `NOT_FOUND` where masking is intended

#### Canonical identity regression tests

- todo tools require `projectSlug + localId`
- no MCP tool accepts or emits global todo ID as the primary identifier
- board and todo outputs include enough canonical identity fields for follow-up calls

#### Fixture-based tests

- Add a very small set of fixture-style JSON request/response examples only for normalization-heavy tools.
- Do not build a large golden-fixture suite in Phase 0 or 1.

### What not to over-test initially

- full transport protocol edge cases beyond the supported `/mcp` path
- every domain before the tool exists
- duplicated coverage already exercised by store tests
- browser-specific behavior, since MCP should stay transport- and client-neutral

## 8. Sharp Edges / Do Not Do Yet

## Do Not Do Yet

- Do not rewrite existing REST routes in [`internal/httpapi/routing.go`](internal/httpapi/routing.go).
- Do not rename backend fields everywhere just to make REST cleaner.
- Do not replace the frontend’s current use of legacy or duplicate REST routes.
- Do not refactor store authorization into a new generic auth platform layer.
- Do not move current frontend JSON DTOs out of [`internal/httpapi/json.go`](internal/httpapi/json.go) unless a specific duplication proves painful.
- Do not introduce a second binary or stdio-only process before the HTTP-mounted adapter proves useful.
- Do not expose admin or backup tools in the first slice.
- Do not over-abstract a plugin/service architecture before at least Phase 2 exists.
- Do not promise generic bidirectional MCP streaming in the first implementation.

## 9. Implementation Order Recommendation

Recommended phase order:

1. Phase 0: Groundwork
2. Phase 1: Capability + Safe Read Tools
3. Phase 2: Core Todo Mutation Tools
4. Phase 3: Sprints, Tags, Members
5. Phase 4: Optional Advanced Surface

### Exact first coding task

Add the MCP skeleton:

- resolve the minimal mount/exposure approach from the options in Section 1
- wire an `internal/mcp` adapter from [`cmd/scrumboy/main.go`](cmd/scrumboy/main.go)
- mount `/mcp` in [`internal/httpapi/server.go`](internal/httpapi/server.go)
- add an empty registry and canonical result/error types

### Exact second coding task

Implement `system.getCapabilities` end to end:

- mode reporting
- auth/bootstrap reporting
- tool list
- canonical identity and pagination declarations

### Exact third coding task

Implement the safest Phase 1 read tool:

1. `projects.list`

Then perform a focused projection check for `board.get` before deciding whether it belongs in Phase 1 or Phase 1B.

## Recommended next implementation prompt

Implement only the safest first cut from `mcp_adapter_implementation_plan.md`.

Constraints:

- Do not modify existing REST route behavior used by the frontend.
- Add MCP as a thin new layer mounted at `/mcp`.
- Use `internal/mcp/` as the main package for adapter logic.
- Reuse current store/business logic; do not route MCP calls through existing REST handlers.
- Before choosing how `/mcp` is exposed, do a brief code inspection against the mount/exposure decision point in the plan and pick the smallest repo-consistent option.
- Before committing to an auth mechanism beyond what is needed for this cut, do a brief code inspection against the auth decision point in the plan and keep the implementation as non-committal as practical.
- Implement only these MCP tools:
  - `system.getCapabilities`
  - `projects.list`
- Use canonical MCP conventions from the plan:
  - project identity is `projectSlug`
  - todo identity strategy should be declared in capabilities but no todo tools yet
  - success shape is `{ ok, data, meta }`
  - deterministic normalized error shape
  - arrays wrapped in `data.items`
- Add focused tests under `internal/mcp/` plus only minimal route-mount coverage in existing server tests if needed.
- Leave `board.get` for the next prompt unless code inspection shows it is genuinely low-risk and can be projected cleanly without importing frontend DTO complexity.
- Do not add admin, backup, auth mutation, tag, sprint, or todo mutation tools yet.

Before editing, quickly verify the best way to reuse current request auth context from `internal/httpapi/server.go`. If extracting a tiny shared helper is safer than duplicating cookie parsing, do that; otherwise keep the change minimal and local.
