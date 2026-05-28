# Todo notes Markdown + Mermaid preview (Phase 1 / 1B)

Scrumboy supports an **optional, client-side preview** of Markdown in the todo dialog **Notes** field. Mermaid is an optional **sub-feature** of that preview. The server stores and serves notes as **plain text**; it does not parse or sanitize Markdown or Mermaid. Enabling these features only exposes UI and loads browser libraries—the preview pipeline runs entirely in the SPA.

For operator setup, see [`FAQ.md`](../FAQ.md). This document describes architecture, configuration, and the preview security model.

---

## Scope

| In scope | Out of scope |
|----------|----------------|
| **markdown** / **preview** tabs in the Edit/New Todo dialog (`#todoBody`, `#todoBodyPreview`) | Rendering Markdown on the board, dashboard, or notifications |
| Preview of `todos.body` when the user opens the **preview** tab | Server-side Markdown → HTML conversion |
| Sanitized HTML in the preview pane only | WYSIWYG editing (Notes stay a `<textarea>`) |
| Optional Mermaid rendering for fenced ` ```mermaid ` blocks in the preview pane only | Rendering Mermaid on cards, notifications, exports, or any server path |
| Raw Markdown persisted on create/patch | Images, raw HTML, or non-http(s) links in preview |

Todo **titles** and card titles on the board are always escaped plain text (see `board-rendering` tests).

---

## Configuration

| Variable | Default | Enabled when |
|----------|---------|--------------|
| `SCRUMBOY_MARKDOWN_NOTES_ENABLED` | off (unset) | `1`, `true`, `on`, or `yes` (trimmed, case-insensitive) |
| `SCRUMBOY_MERMAID_NOTES_ENABLED` | off (unset) | `1`, `true`, `on`, or `yes` **and** Markdown notes are already enabled |

Parsed in `internal/config/config.go` (`markdownNotesEnabledFromEnv`, `mermaidNotesEnabledFromEnv`), passed through `cmd/scrumboy/main.go` into the HTTP server (`ServerOpts.MarkdownNotesEnabled`, `ServerOpts.MermaidNotesEnabled`), and exposed to the SPA as **`markdownNotesEnabled`** and **`mermaidNotesEnabled`** on:

- `GET /api/auth/status` (authenticated and anonymous status payloads in `internal/httpapi/routing_auth.go`)

The UI reads those flags once during auth bootstrap (`modules/router.ts` → `setMarkdownNotesEnabled` / `setMermaidNotesEnabled`). Markdown gates tab visibility in `modules/dialogs/todo.ts` (`markdownNotesPreviewEnabled()`); Mermaid only affects whether fenced Mermaid blocks are upgraded inside the preview pane.

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
                ├─► (optional) detect Mermaid placeholders
                ├─► lazy-load /vendor/mermaid.min.js on first Mermaid preview use
                └─► mermaid.run() in preview-only hosts (sandbox mode)
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
- **`input` listener:** re-renders preview live while the preview tab is active; stale async Mermaid renders are cancelled by container-scoped render epochs.

### Preview module (`modules/markdown-preview.ts`)

Exported API:

- `renderMarkdownToSafeHtml(markdown: string): string`
- `renderMarkdownPreviewInto(container: HTMLElement, markdown: string, options?: { mermaidEnabled?: boolean }): Promise<void>`

Empty or whitespace-only notes set `todo-markdown-preview--empty` and clear the container (placeholder via CSS `::before`).

### Styles (`styles.css`)

Preview typography and colors are scoped under `#todoDialog .todo-markdown-preview` (headings, lists, blockquote, code, `pre`, links, `hr`).

### State

- `current._markdownNotesEnabled` in `modules/state/state.ts`, set from auth status only (not from board payloads).
- `current._mermaidNotesEnabled` in `modules/state/state.ts`, also set from auth status only.

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

### 4. Mermaid (optional, preview-only)

When `mermaidEnabled` is true and the Markdown contains fenced Mermaid blocks:

1. `renderer.rules.fence` emits opaque placeholders for ` ```mermaid ` blocks while keeping non-Mermaid fences as normal code blocks.
2. After sanitized HTML is placed into the preview container, placeholders are replaced with local Mermaid hosts.
3. `/vendor/mermaid.min.js` is lazy-loaded on demand.
4. Mermaid initializes once with:
   - `startOnLoad: false`
   - `securityLevel: "sandbox"`
   - `maxTextSize: 50000`
   - `maxEdges: 500`
   - `suppressErrorRendering: true`
5. User `%%{init: ...}%%` / `%%{initialize: ...}%%` directives are stripped before render so site security settings remain authoritative.
6. Diagram syntax failures do **not** tear down preview mode; the preview shows a local fallback block with the original source.

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
- Mermaid directives (`%%{init: ...}%%`) are ignored for rendering; site-level Mermaid config wins

---

## Security notes

- **XSS surface** is limited to the preview `div` in the todo dialog; content is never written back to the server as HTML.
- **CSP / trust:** preview depends on vendored `markdown-it` and DOMPurify; `npm test` in `internal/httpapi/web` runs `verify-vendor.mjs` before Vitest.
- **Link exfiltration:** only `http`/`https` external navigation; `noopener noreferrer` on external tabs.
- **No Markdown on titles** avoids XSS or layout surprises on shared boards and SSE-driven card updates.
- **Mermaid isolation:** diagrams render with Mermaid `securityLevel: "sandbox"` and are never passed through the general Markdown allow-list as arbitrary SVG/HTML.
- **Mermaid scope:** diagrams only render in the todo dialog preview, never on the board or server.

---

## Build, vendor, and PWA

| Asset | Role |
|-------|------|
| `/vendor/markdown-it.min.js` | Parser (eager script in `index.html`) |
| `/vendor/purify.min.js` | Sanitizer (eager script in `index.html`) |
| `/vendor/mermaid.min.js` | Mermaid runtime (lazy-loaded only when Mermaid preview is needed) |
| `/dist/markdown-preview.js` | Compiled module (TypeScript → `dist/`) |

Service worker (`sw.js`) precaches the eager Markdown assets and `dist/markdown-preview.js`. Mermaid is **not** install-time precached; it is fetched lazily and then becomes eligible for the service worker's normal runtime caching after first successful load.

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
| `internal/config/config_markdown_enabled_test.go` | Markdown + Mermaid env parsing |
| `internal/httpapi/routing_auth_markdown_test.go` | `markdownNotesEnabled` and `mermaidNotesEnabled` on auth status |
| `modules/markdown-preview.test.ts` | Supported subset, links, HTML/images neutralization, Mermaid fences, directive stripping, async rerender cancellation |
| `modules/dialogs/todo-markdown-preview.test.ts` | Dialog gating, preview vs textarea, raw body on save |
| `modules/dialogs/todo-submit.test.ts` | API payloads keep raw Markdown / raw note bodies |
| `modules/views/board-rendering.test.ts` | Card titles do not render note Markdown or Mermaid |

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
