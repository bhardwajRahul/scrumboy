# FAQ

## Contents

- [How do I enable Markdown in my notes?](#how-do-i-enable-markdown-in-my-notes)
- [How do I edit several todos at once?](#how-do-i-edit-several-todos-at-once)
- [Are tag colors personal, or shared with the team?](#are-tag-colors-personal-or-shared-with-the-team)
- [Does Scrumboy use telemetry, tracking, or “phone home”?](#does-scrumboy-use-telemetry-tracking-or-phone-home)

# Notes
## How do I enable Markdown in my notes?

Set `SCRUMBOY_MARKDOWN_NOTES_ENABLED=1` on the server (also accepts `true`, `on`, or `yes`; case-insensitive). The feature defaults to off.

After a restart, the todo dialog **Notes** field shows **markdown** and **preview** tabs. **markdown** is the source editor; **preview** is a sanitized rendered view. Supported syntax includes headings, emphasis, lists, blockquotes, inline and fenced code, horizontal rules (`---` on its own line with blank lines around it), and safe `http`/`https` links.

Notes are still stored as raw markdown in `todos.body`. Todo titles and board card titles stay plain text. The server exposes `markdownNotesEnabled` on `/api/auth/status` so the UI only shows the tabs when the feature is enabled.

Preview hardening: HTML in notes is not rendered; images stay as escaped text; dangerous link schemes and embedded content are stripped or neutralized.

For architecture, security, and source references, see [`docs/markdown.md`](docs/markdown.md).

# Board

## How do I edit several todos at once?

On the board, hold **Ctrl** (Windows/Linux) or **⌘ Command** (Mac) and click todo cards to select them. Selected cards are highlighted. When at least two are selected, a bar appears with **Edit N selected** - click it to open the bulk edit dialog.

In that dialog, turn on only the changes you want (each field has its own checkbox), then click **Apply**. Updates apply to the selected todos only - not the whole board. Tags you add are merged onto each card; they do not remove existing tags.

A normal click on a card (without Ctrl/⌘) opens the usual single-todo editor and clears the selection. Viewers cannot use multi-select; Ctrl/⌘+click still opens one todo for them.

# Tags

## Are tag colors personal, or shared with the team?

It depends on the kind of tag.

**Your personal tags** (tags you create and reuse across projects) keep a **color per user**. If you and a teammate both use a tag named `bug`, each of you can pick a different color in **Settings → Tag Colors**, and you will each see your own choice on cards and filter chips. The app remembers your colors when you sign in.

**Tags that belong to a specific board** (common on shared or anonymous boards) have **one color for everyone** on that board. When a maintainer sets the color, everyone sees the same tint on filter chips and todo cards.

When you open a board, Scrumboy refreshes colors from that board so what you see matches the rules above. Changing a color in **Settings → Tag Colors** saves it for next time and updates the board you have open. If something still looks wrong after a change, refresh the page or reopen the board so the latest colors load.

# Privacy

## Does Scrumboy use telemetry, tracking, or “phone home”?

**No.** Scrumboy does not ship product analytics, ad trackers, or background reporting to the Scrumboy project or any other vendor. Your boards, todos, tags, and account data stay on **the server you run** (typically a local SQLite database under your data directory).

Normal use only talks to **your own Scrumboy instance** - the web app loading pages and calling its API on the same host. There is no built-in usage statistics collection.

A few **optional** features can reach **other systems you control or enable**:

- **Sign-in (OIDC/SSO)** - only if you configure it; the browser talks to *your* identity provider, not Scrumboy’s servers.
- **Webhooks** - only if you add them; Scrumboy sends events to URLs *you* choose.
- **Desktop / PWA notifications** - only if you turn them on and the server has push keys configured; the browser’s push service (e.g. Apple or Google) delivers alerts, which is standard for web apps and not Scrumboy “spying.”
- **Integrations (API, MCP, automation)** - only when you or your tools call your instance.

Words like “analytics” or “activity” inside Scrumboy (for example dashboard stats or audit history) refer to **features that read your own database**, not third-party tracking.

If you self-host, you are responsible for your deployment’s network exposure, backups, and any optional integrations above. The application source is available to inspect under the project license.
