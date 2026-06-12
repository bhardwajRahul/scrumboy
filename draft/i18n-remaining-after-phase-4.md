# i18n effort — remaining work after Phase 4 (historical snapshot)

**Date:** 2026-06-11  
**Scope:** Frontend web app (`internal/httpapi/web`)  
**Catalog:** ~450 keys in `modules/i18n/locales/en.json` (parity across en, de, fr, pt, pseudo via `npm run verify:i18n`)

> Historical note: this backlog snapshot predates the shipped `3.18.0`+ sweep. Many items listed here as remaining are now complete, including public `fr` / `pt` locales, auth, wall, profile/users/backup settings, and broader Settings localization. The remaining sections are preserved as implementation history and intentionally describe work that has since moved. Use current code/tests and `CHANGELOG.md` `3.18.0`+ as the source of truth.

---

## Executive summary

Phases 1–4 established a solid i18n foundation and localized the highest-traffic product surfaces: shell/board/projects/dashboard/todo, auth, and most Settings tabs. **The core app is usable in de/fr/pt for day-to-day board work**, but several modals and secondary surfaces remain English-only.

The largest remaining buckets are:

1. **Settings admin surfaces** — Profile, Users, Backup/Trello (tab labels are localized; bodies and toasts are not)
2. **Wall (Scrumbaby)** — entire collaborative canvas UI
3. **VoiceFlow** — spoken prompts, confirm UI, and settings toggle copy
4. **Global chrome** — notifications panel, PWA update banner, 404 page
5. **Phase 4 residuals** — runtime toasts/confirms on Workflow, Tag Colors, and a few load-error strings

Backend Go strings, service-worker push payloads, and marketing/OG meta in `index.html` are still English-only and were explicitly out of scope for Phases 2–4.

---

## Completed (Phases 1–4)

### Infrastructure (pre-phase / ongoing)

| Capability | Location | Notes |
|------------|----------|-------|
| Locale loader + `t()` / `hydrateI18n()` | `modules/i18n/index.ts` | Strict missing-key mode in tests |
| `formatDate` / `formatNumber` | `modules/i18n/index.ts` | Used by dashboard, sprints, charts |
| `apiErrorMessage()` | `modules/i18n/index.ts` | HTTP + known error codes; raw detail preserved |
| Bootstrap EN catalog | `BOOTSTRAP_EN_CATALOG` in `index.ts` | Must stay in sync with critical keys |
| Catalog parity CI | `scripts/verify-i18n-locales.mjs` | 5 locales |
| QA pseudo locale | `modules/i18n/qa.ts` | localhost / test only |
| Language picker | Settings → Language tab | `settings.language.*` |

### Phase 1 — Core product shell (inferred from coverage + tests)

Localized with `data-i18n-*` and/or `t()`:

- **Board** — toolbar, filters, search, members dialog, bulk selection, load-more, project rename/delete, voice entry errors (`board-i18n.test.ts`)
- **Projects** — list/grid, create flow, workflow wizard, rename/delete confirms (`projects-i18n.test.ts`)
- **Dashboard** — tabs, stats, sort, load-more, project links (`dashboard-i18n.test.ts`)
- **Todo dialog** — fields, status/sprint labels, links, notes tabs, confirms (`todo.*` keys)
- **Shell** — bulk-edit dialog in `index.html`, context menu labels (`shell.*`)
- **Nav labels** — Dashboard / Projects / Temporary (`nav-labels.ts`)
- **Field tooltips** — `tooltips.*` via `fieldLabelHTML` / `titleAttr`
- **Drag-drop** — move toast (`board.todo.movedTo`)
- **Realtime assignment toast** — `realtime.assigned`

### Phase 2 — Auth

- Sign-in, bootstrap, reset password, 2FA challenge (`auth.*`)
- OIDC error mapping + URL/`return_to` cleanup (audited)
- Locale listener on auth views; form state preserved across locale change

### Phase 3 — Settings Customization (+ listener pattern)

- Theme, wallpaper, desktop notifications, keybindings (`settings.customization.*`)
- `ensureSettingsLocaleListener` + `applySettingsLocaleToOpenDialog()` pipeline
- Language tab chrome (`settings.language.*`)
- Settings shell title + tab labels (`settings.shell.*`, `settings.tabs.*`)

### Phase 4 — Settings Charts, Workflow, Sprints, Tag Colors (+ cleanup)

| Tab | Static chrome | Locale-change behavior | Tests |
|-----|---------------|------------------------|-------|
| Charts | `settings.charts.*` via `t()` in `burndown.ts` | Re-render from cache, no `/sprints` or `/burndown` fetch | `settings-tabs-i18n.test.ts`, `burndown.test.ts` |
| Workflow | `data-i18n-*` on chrome + delete titles | `hydrateI18n` only; counts/state preserved | `settings-tabs-i18n.test.ts` |
| Sprints | `data-i18n-*` + `formatDate` on dates | `hydrateI18n` + `refreshSprintDateLabels`; inputs preserved | `settings-tabs-i18n.test.ts`, `settings-sprints.test.ts` |
| Tag Colors | `data-i18n-*` on chrome/controls | `hydrateI18n` only; picker values preserved | `settings-tabs-i18n.test.ts` |

**Phase 4 Sprints cleanup (post-phase):** activation/delete confirms, validation/success/failure toasts, load errors, duration label layout (`settings.sprints.activateConfirm.*`, `deleteConfirm.*`, `validation.*`, `toast.*`, `error.*`).

---

## Phase 4 residuals (small, same-tab follow-ups)

These were intentionally deferred or only partially covered:

### Workflow (`settings-workflow.ts`)

- **Runtime toasts (9):** e.g. `No project available`, `Lane name is required`, `Lane added`, `Workflow updated`, `Done lane cannot be deleted`
- **Load/error HTML:** `No project in context.`, `Workflow lanes are unavailable.`
- **Dynamic aria-labels:** `Lane label for {key}`, `Lane color for {key}` (not `data-i18n-*`)

### Tag Colors (`settings-tags.ts`)

- **Delete confirm:** message + title still English; tag name correctly stays raw
- **Runtime toasts (5):** e.g. `Tag color updated`, `Cannot update color: tag ID missing`
- **Load error in `settings.ts`:** `Error loading tags: {message}` (parallel to sprints fix)

### Charts

- Chart copy is localized; no known functional gaps. uPlot axis tick formatting may still follow browser/Intl defaults (acceptable).

### Sprints

- **Complete** for confirms, toasts, and load errors after cleanup pass.

---

## Remaining work by area

### Priority A — Settings tabs not yet i18n’d

All have **localized tab labels** only (`settings.tabs.profile|users|backup`). Bodies re-render on tab switch; need the same patterns as Phase 4 (chrome via `data-i18n-*` or `t()`, locale branches in `applySettingsLocaleToOpenDialog` where dialogs stay open).

#### Profile (`settings.ts` ~1278–1320, handlers ~1650–1730)

- Section titles/descriptions: Profile, Two-factor authentication
- Buttons: Enable/Disable 2FA, Regenerate recovery codes, Remove avatar, Log out
- KV labels: Name, Email, User ID, System Role, Authentication
- 2FA setup/disable/regenerate dialogs (large inline HTML blocks)
- Toasts: Avatar updated/removed, 2FA enabled/disabled, recovery codes regenerated, setup failed
- Avatar error area (raw backend message — keep raw detail)

#### Users (`settings.ts` `renderUsersTabContent`, password/2FA admin dialogs)

- Table chrome: User Management, column headers, Create User
- Row actions: Promote, Demote, Delete, Password
- Empty/error: No users found, Error loading users
- Password reset dialog + copy-link toasts
- Create-user dialog + validation
- Promote/demote/delete confirms + toasts (admin-only)

#### Backup & Trello (`settings.ts` `renderBackupTabHTML`, handlers ~533–1000)

- Export/Import section copy, import mode radio labels
- Preview/warning/confirmation UI (`Type REPLACE to confirm`)
- Trello import preview/import flow copy
- ~15+ hardcoded `showToast(...)` strings (export success, invalid file, import guards, Trello errors)
- Dynamic preview HTML built from API responses (may stay partially raw; wrap static labels only)

#### VoiceFlow toggle (inside Customization tab)

- `renderVoiceFlowCustomizationHTML()` — title + checkbox label still English
- Not wired to `applySettingsLocaleToOpenDialog` customization branch (easy add)

#### Push toasts (Customization handlers)

- Web Push enable/disable/failure toasts in `settings.ts` (~1998–2004) still English; desktop-notification **chrome** is already localized.

### Priority B — Wall (`modules/dialogs/wall*.ts`)

No `wall.*` catalog keys. English remains in:

| Module | Examples |
|--------|----------|
| `wall.ts` | Toasts: not available, could not add/update/delete note, draw/delete connection |
| `wall-rendering.ts` | Empty state, resize/edit aria-labels |
| `wall-realtime.ts` | `This board does not have a wall.` |
| `wall-note-context-menu.ts` | Context menu actions (likely) |
| `wall-viewport*.ts` | Nav/gesture hints (verify) |

**Risk:** Wall re-renders frequently; locale listener must not refetch wall doc or reset edit/drag state (same constraints as Phase 4 Charts).

### Priority C — VoiceFlow (`modules/voice/`)

- `flow.ts` — confirm dialog title `Confirm command`; speech strings: `{summary}. Confirm?`, `Which one? …`
- Command summaries/confirm labels from parser (user content vs system copy — only localize system fragments)
- `board.voice.*` keys exist for board-entry errors; voice UI itself is not covered
- Settings toggle (Priority A) is the configuration surface

### Priority D — Global chrome

| Surface | File | Strings |
|---------|------|---------|
| Notifications panel | `core/notifications.ts` | Panel title, Mark all as read, badge hover `N todo(s) assigned…` |
| PWA update | `pwaUpdate.ts` | New version available, Update now, Later |
| Not found | `views/notfound.ts` | Not found, Home button |
| Keybinding capture toasts | `core/keybindings.ts` | Invalid key, already used, could not save, no projects |

### Priority E — Marketing / static HTML

- `index.html` — `<title>`, Open Graph / Twitter description (English-only; may stay en for SEO or need per-locale server templates)
- `manifest.json` — app name (if present)

### Priority F — Backend & push (explicitly out of prior phases)

- Go HTTP error messages returned to clients (frontend `apiErrorMessage` maps codes; free-text stays raw)
- Service worker / Web Push notification title+body (`push_notify.go`, `sw.js`)
- Email templates (if any)

---

## Deliberate non-goals (carried forward)

From Phase 2–4 constraints — still apply unless product asks otherwise:

- **Do not localize persisted/user data** — sprint names, tag names, lane keys, todo titles, user names/emails, wall note text, role enum values displayed raw (`PLANNED`, `admin`, etc.)
- **Do not broaden API error redesign** — keep `err.message` / backend validation detail visible when unmapped
- **Locale change must not refetch** where Phase 4 proved cache/DOM-metadata patterns (charts, sprints dates, workflow counts)
- **Never call full modal re-render** on `I18N_LOCALE_CHANGED` for Settings (use `applySettingsLocaleToOpenDialog` branches)

---

## Recommended phase plan (proposed)

| Phase | Focus | Est. risk | Depends on |
|-------|--------|-----------|------------|
| **5** | Settings Profile + Users + Backup/Trello + VoiceFlow toggle + remaining Settings toasts | Medium | Phase 3–4 listener pattern |
| **5b** | Phase 4 residuals: Workflow/Tags toasts, confirms, load errors | Low | — |
| **6** | Wall UI + locale listener (no doc refetch on locale change) | High | Wall state/edit guards |
| **7** | VoiceFlow UI + spoken system phrases | Medium | Speech locale vs UI locale |
| **8** | Notifications panel, PWA banner, NotFound, keybinding toasts | Low | — |
| **9** | Bootstrap catalog sync + optional `index.html` / manifest localization | Low | Build/deploy strategy |
| **10** | Backend/push notification copy (optional product decision) | High | Server + SW coordination |

---

## Test coverage gaps

| Area | Existing tests | Missing |
|------|----------------|---------|
| Auth | `auth.test.ts` | — |
| Board/Projects/Dashboard | `*-i18n.test.ts` | — |
| Settings Customization | `settings-customization-i18n.test.ts` | — |
| Settings Charts/Sprints/Workflow/Tags | `settings-tabs-i18n.test.ts` | — |
| Sprints confirms/toasts | `settings-sprints.test.ts` | — |
| Profile/Users/Backup | — | Locale change + no refetch; admin dialog copy |
| Wall | — | Locale change without wall doc refetch |
| VoiceFlow | `flow.test.ts` (mocked) | Localized confirm/speech in de |
| Notifications/PWA/404 | — | Smoke tests optional |

---

## Tooling & maintenance

1. **`BOOTSTRAP_EN_CATALOG`** in `i18n/index.ts` duplicates a large subset of `en.json` — new keys used at module load (e.g. `burndown.ts` `t()` before full catalog fetch) must be added to both or tests/production boot will throw.
2. **`verify:i18n`** — run on every catalog change; keep pseudo strings wrapped in `[!! … !!]`.
3. **Translation quality** — `settings.sprints.words.story/stories` left as English loanwords in de/fr/pt; review with native speakers before release.
4. **Date/number** — sprint/chart dates use shared helpers; wall timestamps and relative ages (dashboard “Xd”) should reuse same helpers when localized.

---

## Quick reference: modules without i18n import

These files still contain user-visible English and do **not** import `modules/i18n`:

- `dialogs/wall.ts`, `wall-rendering.ts`, `wall-realtime.ts`, `wall-*.ts` (most)
- `voice/flow.ts`, `voice/speech-output.ts` (speaks dynamic text)
- `core/notifications.ts`, `core/keybindings.ts`
- `pwaUpdate.ts`
- `views/notfound.ts`
- `dialogs/settings-workflow.ts` (chrome i18n via attributes only; toasts not)
- `dialogs/settings-tags.ts` (same)

Modules that **do** import i18n: `auth`, `board*`, `projects`, `dashboard`, `todo*`, `bulk-edit`, `burndown`, `settings` (partial), `settings-sprints`, `nav-labels`, `field-tooltips`, `drag-drop`, `realtime`, `utils` (`apiErrorMessage`).

---

## Summary checklist

- [x] Core navigation + board + projects + dashboard + todo
- [x] Auth + error fallbacks
- [x] Settings: Language, Customization, Charts, Workflow chrome, Sprints, Tag Colors chrome
- [x] Sprints runtime confirms/toasts
- [ ] Settings: Profile, Users, Backup/Trello, VoiceFlow toggle, Push toasts
- [ ] Workflow/Tags runtime toasts + tag delete confirm
- [ ] Wall
- [ ] VoiceFlow runtime UI + speech
- [ ] Notifications, PWA, 404, keybinding toasts
- [ ] Landing/meta, backend push (optional)
