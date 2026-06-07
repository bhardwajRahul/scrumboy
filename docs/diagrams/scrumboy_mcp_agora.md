# MCP and Agora integration

Optional automation surface: API-token or session-authenticated clients can call the same store-backed tools as the REST API, via MCP HTTP or Agoragentic envelopes.

```mermaid
flowchart TB
  Client[Automation client MCP or Agora]
  AuthC[Session cookie or API token]

  Client --> AuthC
  AuthC --> Entry{entry point}

  Entry --> McpRoot["GET POST mcp"]
  Entry --> McpRpc["POST mcp rpc JSON-RPC"]
  Entry --> AgoraD["POST agora v1 discover"]
  Entry --> AgoraI["POST agora v1 invoke"]

  McpRoot --> Adapter[mcp.Adapter tool registry]
  McpRpc --> Adapter
  AgoraD --> AgoraH[agora.Handler]
  AgoraI --> AgoraH
  AgoraH --> Adapter

  Adapter --> Tools[projects todos sprints tags members]
  Tools --> Store[store with same authz as REST]
```

Tools are registered in `internal/mcp`; mode (`full` vs `anonymous`) gates which operations are exposed. Agora wraps MCP tool discovery and invocation for Agoragentic-compatible clients.
