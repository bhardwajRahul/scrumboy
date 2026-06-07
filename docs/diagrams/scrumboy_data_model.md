# Data model and persistence

SQLite is the single source of truth. `internal/store` owns domain rules; `internal/migrate` applies numbered SQL files.

```mermaid
flowchart TB
  SQL[(SQLite)]
  Store[internal/store]

  subgraph domains [Store domains]
    Proj[projects memberships]
    Todo[todos links tags]
    Board[board lanes workflows]
    Sprint[sprints burndown]
    AuthDom[users sessions api tokens]
    WallDom[wall notes edges]
    Audit[audit trail]
    WHook[webhook subscriptions]
    PushDom[push subscriptions]
  end

  Store --> SQL
  Store --> domains
```

## Migration pipeline

```mermaid
sequenceDiagram
  participant Main as main.go
  participant Mig as migrate.Apply
  participant DB as SQLite

  Main->>Mig: open db path from DATA_DIR
  Mig->>DB: ensure schema_migrations table
  loop each 001..054 sql file
    Mig->>DB: apply if version missing
  end
  Main->>Main: store.New with optional 2FA encryption key
```

Authorization checks live in store methods (`CheckProjectRole`, system roles), not only in HTTP handlers.
