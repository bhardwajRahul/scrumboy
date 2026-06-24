# Scrumboy Board Operator Agent Plugin

This plugin packages Scrumboy board-operating guidance for agent workspaces
such as Codex, Claude, Copilot, and other MCP-compatible harnesses.

The plugin is the installable package. A Skill is one capability inside the
plugin, usually a focused `SKILL.md` workflow guide. This first package includes
a Skill for safely inspecting projects, todos, sprints, tags, and board state
through Scrumboy's MCP and Agoragentic HTTP APIs.

## What It Helps Agents Do

- Review board state before creating or moving todos.
- Triage sprint progress, blocked work, and assignment gaps.
- Draft safe mutations for project maintainers to approve.
- Use `/mcp/rpc`, `/mcp`, or `/agora/v1/*` without mixing response formats.
- Keep board contents, credentials, and user data out of telemetry.

## Install Anywhere

Configure your agent harness to call the Scrumboy MCP JSON-RPC endpoint:

```bash
curl -X POST http://localhost:8080/mcp/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sb_your_token_here" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Then use the Skill in
`skills/scrumboy-board-operator/SKILL.md` to guide read-first board operations
and approval-gated changes.

## Telvine Packaging

If this plugin is published through Telvine:

```bash
npm i -g telvine
telvine login
telvine publish ./plugins/scrumboy-board-operator
```

## Privacy Boundary

Do not emit prompts, source files, todo descriptions, board contents, API
tokens, session cookies, user identifiers, tool arguments, or model outputs as
telemetry. Safe metadata can include the plugin component name, sanitized
outcome, harness name, duration bucket, and sanitized error class.
