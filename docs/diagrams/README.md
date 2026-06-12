# Scrumboy architecture diagrams

Mermaid diagrams for the Scrumboy monolith (Go server + embedded TypeScript SPA + SQLite).

**Interactive viewer:** open [`index.html`](index.html) via a local HTTP server (browser cannot load markdown from `file://`).

**Easiest (Windows):** double-click [`serve-diagrams.bat`](serve-diagrams.bat) in **this** folder. It runs [`serve.py`](serve.py), which always serves from `scrumboy\docs\diagrams` (not whatever folder your terminal was in).

Or manually:

```powershell
cd C:\dev\project\scrumboy\docs\diagrams
python serve.py
```

Then open **http://127.0.0.1:8775/** (the script may open it for you).

### Sanity check before serving

```powershell
cd C:\dev\project\scrumboy\docs\diagrams
dir
```

You should see **`index.html`**, **`serve.py`**, and about **13** `scrumboy_*.md` files.

| If `dir` shows… | You are… |
|-----------------|----------|
| Only `README.md` | **Wrong folder** - open `docs/diagrams` inside the Scrumboy repo |
| `index.html` + many `scrumboy_*.md` | Correct - run `python serve.py` here |

### Yes/no branch label colors

The viewer ports Scrumboy's semantic edge coloring (`mermaid-semantic-edges.js` + `mermaid-semantic-edges.json`): paired branch labels (`yes`/`no`, `true`/`false`, `pass`/`fail`) get green/red **label backgrounds only** after render. Keep in sync with `internal/httpapi/web/modules/mermaid-semantic-edges.ts` when changing behavior.

| File | Topic |
|------|--------|
| [scrumboy_overview.md](scrumboy_overview.md) | System context and major packages |
| [scrumboy_deployment_ops.md](scrumboy_deployment_ops.md) | Docker, SQLite, backup, upgrade |
| [scrumboy_http_routing.md](scrumboy_http_routing.md) | `ServeHTTP` request dispatch |
| [scrumboy_bootstrap.md](scrumboy_bootstrap.md) | `main.go` startup and background jobs |
| [scrumboy_data_model.md](scrumboy_data_model.md) | SQLite, migrations, `store` domains |
| [scrumboy_auth_permissions.md](scrumboy_auth_permissions.md) | Sessions, OIDC, 2FA, roles |
| [scrumboy_board_kanban.md](scrumboy_board_kanban.md) | Board REST, drag-drop, workflows |
| [scrumboy_realtime_events.md](scrumboy_realtime_events.md) | Eventbus, SSE, webhooks, push |
| [scrumboy_mcp_agora.md](scrumboy_mcp_agora.md) | Optional MCP and Agora automation |
| [scrumboy_voiceflow.md](scrumboy_voiceflow.md) | Speech commands; UI localized, grammar English-centric |
| [scrumboy_wall_canvas.md](scrumboy_wall_canvas.md) | Scrumbaby wall canvas |
| [scrumboy_backup_import.md](scrumboy_backup_import.md) | Backup JSON and Trello import |
| [scrumboy_frontend_spa.md](scrumboy_frontend_spa.md) | SPA router, state, locale runtime |
