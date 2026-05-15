# Phase 1: Markdown Notes

## Feature flag

- Name: `SCRUMBOY_MARKDOWN_NOTES_ENABLED`
- Default: `false`
- Truthy values: `1`, `true`, `on`, `yes` (trimmed, case-insensitive)

## Supported Markdown subset

Phase 1 applies to todo `body` / Notes only. Todo Title stays plain text everywhere.

Supported in the modal preview:

- headings such as `#`, `##`, `###`
- bold and italic
- unordered and ordered lists
- blockquotes
- inline code
- fenced code blocks
- horizontal rules
- safe `http` / `https` links
- normal line breaks with the configured parser behavior

## Intentionally unsupported

- Markdown rendering in todo Title
- raw HTML
- iframe / object / embed / script HTML
- inline event handlers
- images rendered from Markdown
- image upload
- attachments
- base64 / data URL support
- protocol-relative URLs such as `//example.com/path`
- non-web schemes such as `mailto:` and `tel:`

## Notes on link handling

- Allowed links are limited to `http`, `https`, root-relative paths such as `/board/alpha`, relative paths, query-only links, and hash links.
- External `http` / `https` links get `rel="noopener noreferrer"` and `target="_blank"`.
- `mailto:` and `tel:` are intentionally not allowed in Phase 1. They are not required for the todo-notes preview goal, and removing them keeps the initial allow-list narrower.

## Vendor loading

Phase 1 keeps `/vendor/markdown-it.min.js` and `/vendor/purify.min.js` eagerly loaded.

Reason:

- the current path is already versioned and precached by the service worker
- the preview renderer is synchronous today
- switching to on-demand script loading would add async modal state and another cache/update path for limited benefit

That makes eager loading the lower-risk choice for Phase 1 hardening.

## Rollback

Rollback is feature-flag based:

- unset `SCRUMBOY_MARKDOWN_NOTES_ENABLED` or set it to `0`
- restart the server

Existing todos do not need migration because Phase 1 keeps storing the same raw `todos.body` string and does not change DB, API, MCP, backup, import, or export schemas.

## Manual test checklist

- Flag off:
  - open create/edit todo
  - confirm Notes is still textarea-only
  - confirm save behavior is unchanged
- Flag on:
  - enter headings, bold, italic, lists, blockquotes, inline code, fenced code blocks, horizontal rules, and safe links
  - switch between Write and Preview
  - save and reopen the todo
  - confirm the textarea still contains the raw Markdown
- Scope checks:
  - confirm todo Title is still plain text
  - confirm board cards still render plain escaped titles only
  - confirm link picker, voice flows, dashboard titles, sprint names, tags, and wall notes are unchanged
- Security checks:
  - paste `<script>alert(1)</script>`
  - paste `<img src=x onerror=alert(1)>`
  - paste `[x](javascript:alert(1))`
  - paste `[x](data:text/html,<script>alert(1)</script>)`
  - paste `[x](//example.com/path)`
  - confirm preview executes nothing and blocked links are neutralized
- Service worker / upgrade checks:
  - open an older cached build
  - deploy the new build and let the updated service worker install
  - reload once the update is activated
  - confirm flag off still shows textarea-only Notes
  - confirm flag on opens Preview without stale-cache asset errors
