# Agoragentic v1: Scrumboy Agora HTTP adapter

Updated: 2026-04-23

Scrumboy exposes a thin **HTTP edge adapter** for agents that use the **Agoragentic v1** listing contract. The integration maps:

| Public listing (Agoragentic) | HTTP endpoint | Internal mapping |
|-----------------------------|---------------|------------------|
| `scrumboy.discover_tools` | `POST /agora/v1/discover` | `POST /mcp/rpc` with JSON-RPC `tools/list` |
| `scrumboy.invoke_tool` | `POST /agora/v1/invoke` | `POST /mcp/rpc` with JSON-RPC `tools/call` |

**Canonical Scrumboy MCP** remains **`/mcp`** and **`/mcp/rpc`**. The adapter does not replace those surfaces; for Agoragentic, `POST /mcp/rpc` is used **only inside** the process via the same handler instance as a normal request (same auth, same tools). The MCP **core** under `internal/mcp` is unchanged by this layer.

**Authentication:** the same as MCP JSON-RPC: optional **`Cookie: scrumboy_session=…`** and/or **`Authorization: Bearer <api token>`** (full mode). The adapter does not parse or add credentials; it forwards the incoming request to the in-process `POST /mcp/rpc` path (see `internal/agora/roundtrip.go`).

**Response envelope** (all adapter responses use these top-level fields):

Success:

```json
{ "ok": true, "result": {}, "error": null }
```

Failure:

```json
{ "ok": false, "result": null, "error": { "message": "…" } }
```

JSON-RPC **protocol** errors (after delegation) may also include **`code`** (number, JSON-RPC) and optional **`data`** (any JSON). Tool-level failures from `tools/call` with `isError: true` are surfaced with **`ok: false`** and **`message`** from the tool text, without a JSON-RPC `code` unless the adapter is propagating a protocol error.

---

## `scrumboy.discover_tools` — `POST /agora/v1/discover`

**Request body (MUST be a JSON object; empty object is enough):**

```json
{}
```

`additionalProperties: false` is consistent with a strict object with no members.

**Success `result` shape** (MCP catalog; field names are MCP-native):

```json
{
  "ok": true,
  "result": {
    "tools": [
      {
        "name": "string",
        "description": "string",
        "inputSchema": {}
      }
    ]
  },
  "error": null
}
```

Each tool in `tools` includes **`name`** (required) and, when the catalog provides them, **`description`** and **`inputSchema`**. The schema key is **`inputSchema`** (camelCase), not `input_schema`, matching MCP `tools/list`.

**Failure:** `ok: false`, `result: null`, `error` with at least `message` (and optionally `code` / `data` for JSON-RPC error propagation).

---

## `scrumboy.invoke_tool` — `POST /agora/v1/invoke`

**Request body (required keys):**

```json
{
  "tool": "tool.name",
  "arguments": {}
}
```

- **`tool`** (string) — same registered name as MCP `params.name` for `tools/call`.
- **`arguments`** (object) — same shape as `params.arguments` for `tools/call`. Use **`{}`** when a tool needs no input fields. Omitted `arguments` or JSON `null` is rejected; send **`"arguments": {}`** (or a non-null object).

**`additionalProperties: false`:** unknown top-level keys are rejected (strict JSON decode).

**Success `result`:** any JSON value (object, array, string, number, boolean, or null) — this follows whatever the adapter’s normalization produces from the MCP `tools/call` result (`structuredContent` and/or `content` text), same rules as the existing adapter (see `internal/agora/adapter.go` `invokeSuccessNormalized`).

**Failure:** `ok: false`, `result: null`, `error` with at least `message`.

---

## v1 JSON Schema summary (Agoragentic listing)

**discover success** — `result` is an object with required `tools` (array of tool objects; each tool at minimum has `name` string, optional `description`, `inputSchema` object; `inputSchema` stays camelCase).

**invoke request** — object with `required: ["tool", "arguments"]`, `arguments` a JSON object.

**invoke success** — `result` unconstrained (any JSON).

**`error` object (when present):** `message` (string) required for adapter validation failures; for JSON-RPC errors, `code` (number) and `data` (any) may appear.

A minimal machine-readable example for the two listing IDs is in [`examples/agoragentic-manifest.json`](examples/agoragentic-manifest.json).
