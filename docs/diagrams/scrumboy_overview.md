# Scrumboy system overview

Self-hosted Kanban / project management: one Go binary serves REST, MCP, Agora, SSE realtime, webhooks, and an embedded SPA backed by SQLite.

```mermaid
flowchart TB
  Browser[Browser SPA PWA]
  Agents[AI agents MCP Agora clients]

  subgraph monolith [Go monolith cmd/scrumboy]
    HTTP[httpapi.Server]
    MCP[mcp.Adapter]
    Agora[agora.Handler]
    Store[store layer]
    Bus[eventbus.Fanout]
  end

  DB[(SQLite data/scrumboy.db)]
  IdP[Optional OIDC IdP]
  Hooks[Outbound webhooks]
  Push[Web Push endpoints]

  Browser --> HTTP
  Agents --> MCP
  Agents --> Agora
  HTTP --> Store
  MCP --> Store
  Agora --> MCP
  Store --> DB
  HTTP --> IdP
  Store --> Bus
  Bus --> Browser
  Bus --> Hooks
  Bus --> Push
```

## Package map

| Path | Role |
|------|------|
| `cmd/scrumboy` | Process entry, TLS, hourly maintenance |
| `internal/httpapi` | HTTP routing, SSE hub, SPA embed, webhooks, push |
| `internal/store` | Domain logic and authorization |
| `internal/mcp` | MCP HTTP and JSON-RPC tool surface |
| `internal/agora` | Agoragentic discover and invoke over MCP |
| `internal/httpapi/web` | TypeScript SPA compiled to `dist/` |
| `internal/migrate` | Versioned SQL migrations |
