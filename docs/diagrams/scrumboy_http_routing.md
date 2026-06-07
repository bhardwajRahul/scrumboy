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
  ApiH --> RBoard[routing_board]
  ApiH --> RTodos[routing_todos]
  ApiH --> RAuth[routing_auth]
  ApiH --> RAdmin[routing_admin]
  ApiH --> RWall[routing_board_wall]
  ApiH --> RImport[routing_import backup]
```

## SPA paths (`spa.go`)

- `/` landing or projects list
- `/dashboard` personal dashboard
- `/{slug}` canonical project board URL
- `/{slug}/t/{localId}` deep link to todo segment
- `/anon` anonymous temporary board creation (anonymous mode)

API lives under `/api/*` only; everything else falls through to embedded `web/dist` assets or slug canonicalization.
