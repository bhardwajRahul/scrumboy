# Realtime events pipeline

Store mutations publish domain events; `eventbus.Fanout` fans out to SSE, webhooks, and push.

```mermaid
flowchart TB
  Mut[store mutation]
  Pub[PublishEvent]
  Fan[eventbus.Fanout]

  Mut --> Pub --> Fan
  Fan --> Bridge[SSE bridge]
  Fan --> WHDisp[webhook dispatcher]
  Fan --> PushN[push notifier]

  Bridge --> Hub[Hub per project and user channels]
  Hub --> BoardSSE["GET /api/board/slug/events SSE"]
  Hub --> UserSSE["GET /api/me/realtime SSE"]
  BoardSSE --> AnonClient[board-realtime.ts anonymous boards]
  UserSSE --> LoggedClient[core/realtime.ts logged-in users]
  AnonClient --> Refresh[orchestration/board-refresh.ts reload board]
  LoggedClient --> Refresh

  WHDisp --> Queue[webhook queue]
  Queue --> Worker[webhook worker HTTP POST]

  PushN --> VAPID[Web Push VAPID]
```

## SSE transport

| Client context | Endpoint | Module |
|----------------|----------|--------|
| Logged-in user | `GET /api/me/realtime` | `core/realtime.ts` (merged cross-project stream) |
| Anonymous board | `GET /api/board/{slug}/events` | `board-realtime.ts` (per-board stream) |

Both paths share `sse-client.ts` for the EventSource connection.

## Common event types

| Event | Typical consumer |
|-------|------------------|
| `board.refresh_needed` | SSE to browsers on that project |
| `board.members_updated` | SSE plus membership UI refresh |
| `todo.assigned` | Push notification to assignee; also on merged user stream |
| `wall.refresh_needed` | Wall canvas full refetch |
| `wall.transient` | Wall canvas incremental DOM update without refetch |
