# Todo notes Markdown (Phase 1)

Phase 1 adds an **optional, client-side preview** of Markdown in the todo dialog **Notes** field. The server stores and serves notes as **plain text**; it does not parse or sanitize Markdown. Enabling the feature only exposes UI and loads browser libraries—the preview pipeline runs entirely in the SPA.

For operator setup, see [`FAQ.md`](../FAQ.md). This document describes architecture, configuration, and the preview security model.

---

## Scope

| In scope | Out of scope |
|----------|----------------|
| **markdown** / **preview** tabs in the Edit/New Todo dialog (`#todoBody`, `#todoBodyPreview`) | Rendering Markdown on the board, dashboard, or notifications |
| Preview of `todos.body` when the user opens the **preview** tab | Server-side Markdown → HTML conversion |
| Sanitized HTML in the preview pane only | WYSIWYG editing (Notes stay a `<textarea>`) |
| Raw Markdown persisted on create/patch | Images, raw HTML, or non-http(s) links in preview |

Todo **titles** and card titles on the board are always escaped plain text (see `board-rendering` tests).

---

## Configuration

| Variable | Default | Enabled when |
|----------|---------|--------------|
| `SCRUMBOY_MARKDOWN_NOTES_ENABLED` | off (unset) | `1`, `true`, `on`, or `yes` (trimmed, case-insensitive) |

Parsed in `internal/config/config.go` (`markdownNotesEnabledFromEnv`), passed through `cmd/scrumboy/main.go` into the HTTP server (`ServerOpts.MarkdownNotesEnabled`), and exposed to the SPA as **`markdownNotesEnabled`** on:

- `GET /api/auth/status` (authenticated and anonymous status payloads in `internal/httpapi/routing_auth.go`)

The UI reads that flag once during auth bootstrap (`modules/router.ts` → `setMarkdownNotesEnabled`) and gates tab visibility in `modules/dialogs/todo.ts` (`markdownNotesPreviewEnabled()`).

There is **no per-project** or per-user toggle; it is instance-wide.

---

## Data flow

```
User edits textarea (#todoBody)
        │
        ▼
Create/Patch API ──► todos.body (raw Markdown string, unchanged)
        │
        ▼ (preview tab only, client-side)
renderMarkdownPreviewInto()
        │
        ├─► markdown-it.render()  (html: false)
        └─► DOMPurify + link policy + DOM cleanup
                │
                ▼
        #todoBodyPreview innerHTML (ephemeral, not saved)
```

`modules/dialogs/todo-submit.ts` passes `body` through unchanged in create and patch payloads. Tests in `todo-submit.test.ts` assert Markdown is not converted to HTML before send.

---

## Frontend

### DOM (`internal/httpapi/web/index.html`)

- **Label row:** `Notes` label and `#todoBodyToggle` (tab list: `#todoBodyWriteTab`, `#todoBodyPreviewTab`).
- **Editor:** `#todoBody` (textarea) and `#todoBodyPreview` (preview `div`) inside `.todo-notes-editor`.
- Tabs are hidden when `markdownNotesEnabled` is false (`hidden` on `#todoBodyToggle`).

### Todo dialog (`modules/dialogs/todo.ts`)

- **`todoNotesMode`:** `"markdown"` | `"preview"`.
- **`syncTodoNotesModeUI()`:** toggles `hidden` on textarea vs preview, `is-active` / `aria-pressed` on tabs.
- **`renderTodoNotesPreview()`:** calls `renderMarkdownPreviewInto`; on vendor/render failure, shows a toast and falls back to markdown mode.
- **`input` listener:** re-renders preview live while the preview tab is active.

### Preview module (`modules/markdown-preview.ts`)

Exported API:

- `renderMarkdownToSafeHtml(markdown: string): string`
- `renderMarkdownPreviewInto(container: HTMLElement, markdown: string): void`

Empty or whitespace-only notes set `todo-markdown-preview--empty` and clear the container (placeholder via CSS `::before`).

### Styles (`styles.css`)

Preview typography and colors are scoped under `#todoDialog .todo-markdown-preview` (headings, lists, blockquote, code, `pre`, links, `hr`).

### State

- `current._markdownNotesEnabled` in `modules/state/state.ts`, set from auth status only (not from board payloads).

---

## Rendering pipeline

### 1. markdown-it

Loaded from `/vendor/markdown-it.min.js` (global `window.markdownit`). Pinned dependency: `markdown-it@14.1.1` in `internal/httpapi/web/package.json`, copied by `scripts/sync-vendor.mjs`.

Instance options (`getMarkdownRenderer()`):

| Option | Value | Rationale |
|--------|-------|-----------|
| `html` | `false` | Disables raw HTML blocks in source Markdown |
| `breaks` | `true` | Single newlines become `<br>` |
| `linkify` | `false` | Bare URLs are not auto-linked (explicit `[text](url)` only) |

**Custom rule:** `renderer.rules.image` rewrites image tokens to **escaped plain text** (`![alt](url)`) so no `<img>` is emitted.

### 2. DOMPurify

Second pass via `/vendor/purify.min.js` (`dompurify@3.4.3`):

- **`ALLOWED_TAGS`:** `a`, `blockquote`, `br`, `code`, `em`, `h1`–`h6`, `hr`, `li`, `ol`, `p`, `pre`, `strong`, `ul`
- **`ALLOWED_ATTR`:** `href`, `rel`, `target` only
- ARIA and `data-*` attributes disallowed

### 3. Post-sanitize DOM pass

On a detached `<template>`:

1. Remove any `img`, `iframe`, `object`, `embed`, `script`, `svg` that survived parsing.
2. For each `<a>`:
   - **`isSafeLinkHref`:** allow empty-scheme-relative paths (`/`, `./`, `../`, `#`, `?`); allow `http`/`https` only for explicit schemes; reject `//`, `javascript:`, `data:`, `mailto:`, `tel:`, etc.
   - **External** (`http://` / `https://`): set `target="_blank"` and `rel="noopener noreferrer"`.
   - **Unsafe href:** replace anchor with text node (link text only).

---

## Supported Markdown (preview)

Verified in `modules/markdown-preview.test.ts`:

- ATX headings `#` … `######`
- `**bold**`, `*italic*`
- Bullet and ordered lists
- Blockquotes (`>`)
- Inline `` `code` `` and fenced code blocks
- Thematic breaks (`---`, `***`, `___`) on their own line (CommonMark rules; blank lines often required)
- `[label](https://…)` and safe same-origin relative links

**Not rendered as HTML in preview:**

- `![alt](url)` → escaped literal
- Raw HTML in source → escaped in output
- Dangerous or non-web link schemes → plain text
- Protocol-relative URLs (`//host/...`)

---

## Security notes

- **XSS surface** is limited to the preview `div` in the todo dialog; content is never written back to the server as HTML.
- **CSP / trust:** preview depends on vendored `markdown-it` and DOMPurify; `npm test` in `internal/httpapi/web` runs `verify-vendor.mjs` before Vitest.
- **Link exfiltration:** only `http`/`https` external navigation; `noopener noreferrer` on external tabs.
- **No Markdown on titles** avoids XSS or layout surprises on shared boards and SSE-driven card updates.

---

## Build, vendor, and PWA

| Asset | Role |
|-------|------|
| `/vendor/markdown-it.min.js` | Parser (eager script in `index.html`) |
| `/vendor/purify.min.js` | Sanitizer (eager script in `index.html`) |
| `/dist/markdown-preview.js` | Compiled module (TypeScript → `dist/`) |

Service worker (`sw.js`) precaches vendor scripts and `dist/markdown-preview.js` for offline-capable loads after first visit.

Regenerate vendor files after dependency bumps:

```bash
cd internal/httpapi/web
npm run sync:vendor
npm run verify:vendor
```

---

## Tests

| Location | Covers |
|----------|--------|
| `internal/config/config_markdown_enabled_test.go` | Env parsing |
| `internal/httpapi/routing_auth_markdown_test.go` | `markdownNotesEnabled` on auth status |
| `modules/markdown-preview.test.ts` | Supported subset, links, HTML/images neutralization |
| `modules/dialogs/todo-markdown-preview.test.ts` | Dialog gating, preview vs textarea, raw body on save |
| `modules/dialogs/todo-submit.test.ts` | API payloads keep raw Markdown |
| `modules/views/board-rendering.test.ts` | Card titles do not render note Markdown |

---

## Key source files

| Area | Path |
|------|------|
| Env / config | `internal/config/config.go` |
| Server flag | `internal/httpapi/server.go`, `cmd/scrumboy/main.go` |
| Auth JSON | `internal/httpapi/routing_auth.go` |
| Preview core | `internal/httpapi/web/modules/markdown-preview.ts` |
| Todo UI | `internal/httpapi/web/modules/dialogs/todo.ts` |
| Markup | `internal/httpapi/web/index.html` |
| Vendor sync | `internal/httpapi/web/scripts/sync-vendor.mjs` |
