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
  Hub --> SSE["GET api projects id events SSE"]
  SSE --> Client[sse-client.ts board-realtime.ts]
  Client --> Refresh[board-refresh.ts reload board]

  WHDisp --> Queue[webhook queue]
  Queue --> Worker[webhook worker HTTP POST]

  PushN --> VAPID[Web Push VAPID]
```

## Common event types

| Event | Typical consumer |
|-------|------------------|
| `board.refresh_needed` | SSE to browsers on that project |
| `board.members_updated` | SSE plus membership UI refresh |
| `todo.assigned` | Push notification to assignee |

Merged user stream: `GET /api/me/realtime` for cross-project notifications.
