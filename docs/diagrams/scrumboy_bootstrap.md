# Application bootstrap

Startup sequence in `cmd/scrumboy/main.go`.

```mermaid
flowchart LR
  Env[config.FromEnv]
  DB[db.Open SQLite]
  Mig[migrate.Apply]
  Store[store.New]
  Color[BackfillDominantColors]
  OIDC[oidc.New optional]
  MCP[mcp.New]
  Agora[agora.New]
  Srv[httpapi.NewServer]
  Listen[http.Server Listen TLS optional]

  Env --> DB --> Mig --> Store --> Color
  Color --> OIDC
  OIDC --> MCP --> Agora --> Srv --> Listen
```

## Background work

```mermaid
flowchart TB
  Hourly[Hourly ticker main.go]
  Hourly --> Expire[DeleteExpiredProjects temp boards]
  Hourly --> Wal[PRAGMA wal_checkpoint TRUNCATE]

  Fanout[eventbus fanout consumers]
  Fanout --> SSE[sse bridge to Hub]
  Fanout --> WH[webhook dispatcher queue]
  Fanout --> PushN[push notifier todo assigned]

  WH --> Worker[webhook worker goroutine]
```

`NewServer` wires the SSE bridge, webhook queue plus worker, and push notifier into `eventbus.NewFanout` before serving traffic.
