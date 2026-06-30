# HTTP request routing

Top-level dispatch in `internal/httpapi/server.go` `ServeHTTP`.

```mermaid
flowchart TD
  Req[Incoming request]
  Req --> Health{path healthz?}
  Health -->|yes| HZ[handleHealthz]
  Health -->|no| Agora{agora v1 prefix?}
  Agora -->|yes| AgH[Agora handler]
  Agora -->|no| MCP{mcp prefix?}
  MCP -->|yes| McpH[MCP handler]
  MCP -->|no| API{api prefix?}
  API -->|yes| ApiH[handleAPI namespaces]
  API -->|no| SpaH[handleSPA static and slug routes]

  ApiH --> RProj[routing_projects]
  ApiH --> RBoard[routing_board incl wall]
  ApiH --> RTodos[routing_todos]
  ApiH --> RAuth[routing_auth]
  ApiH --> RAdmin[routing_admin]
  ApiH --> RImport[routing_import backup]
```

Wall REST lives under **`/api/board/{slug}/wall`** via `routing_board_wall.go` (nested under board, not a top-level API namespace).

## API namespaces (`routing.go`)

Top-level `/api/*` segments: `projects`, `board`, `todos`, `auth`, `me`, `backup`, `import`, `user`, `admin`, `version`, `tags`, `dashboard`, `webhooks`, `push`.

API lives under `/api/*` only; everything else falls through to embedded `web/dist` assets or slug canonicalization.

## SPA paths (`spa.go`)

- `/` marketing landing (anonymous mode) or SPA `index.html` → client projects list (full mode)
- `/dashboard` personal dashboard
- `/{slug}` canonical project board URL
- `/{slug}/t/{localId}` deep link to todo segment
- `/anon` creates anonymous temporary board and redirects to `/{slug}` (**all modes**)
- `/temp` redirects to `/anon`
- `/{locale}/` localized marketing landings (**anonymous mode only**)
- `/p/{id}` legacy redirect to `/{slug}`
- `mermaid-semantic-edges.json` served dynamically (not a static embed)
- `sw.js` version-injected service worker

## Localized validation errors (SPA)

Handlers use `writeValidationError(w, message, reason, details)` with stable snake_case `details.reason` when the failure class is known. The SPA maps recognized reasons through `apiErrorMessage()` / catalog keys; unknown or dynamic store messages keep the English `error.message` (or raw text via `apiErrorMessageOrRaw()` on import/backup paths). HTTP status codes and payload shape are unchanged.
