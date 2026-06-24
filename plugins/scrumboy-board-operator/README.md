# Scrumboy Board Operator Agent Plugin

This plugin packages Scrumboy board-operating guidance for Codex, Claude, and
other compatible plugin-capable agent workspaces.

The plugin is a package intended for local or manual loading. A Skill is one
capability inside the plugin, usually a focused `SKILL.md` workflow guide. This
package includes a Skill for safely inspecting projects, todos, sprints, tags,
and board state through Scrumboy's MCP and Agoragentic HTTP APIs.
The package only provides plugin metadata and Skill guidance; your agent
harness still needs Scrumboy endpoint access and appropriate credentials.

## What It Helps Agents Do

- Review board state before creating or moving todos.
- Triage sprint progress, assignment gaps, and blockers or stale work where
  they are represented by board content, tags, sprint dates, workflow columns,
  or visible metadata.
- Draft safe mutations for project maintainers to approve.
- Use `/mcp/rpc`, `/mcp`, or `/agora/v1/*` without mixing response formats.
- Keep board contents, credentials, and user data out of telemetry.

## Local Loading

Load this package through your agent harness's local or manual plugin workflow,
then configure that harness to call the Scrumboy MCP JSON-RPC endpoint:

```bash
curl -X POST http://localhost:8080/mcp/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sb_your_token_here" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Then use the Skill in
`skills/scrumboy-board-operator/SKILL.md` to guide read-first board operations
and approval-gated changes.

## Privacy and Telemetry Boundary

Do not emit prompts, source files, todo descriptions, board contents, API
tokens, session cookies, user identifiers, tool arguments, or model outputs as
telemetry. Safe metadata can include the plugin component name, sanitized
outcome, harness name, duration bucket, and sanitized error class.
