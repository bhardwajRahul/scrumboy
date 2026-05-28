# VAPID keys and Web Push in Scrumboy

**VAPID** (Voluntary Application Server Identification) is the standard way a web application identifies itself to browser push services (Mozilla, Google, Apple, and others). In Scrumboy, VAPID keys are **optional server credentials** that enable **Web Push** — background alerts when someone **assigns you a todo** while the app tab is in the background or the PWA is not focused.

For operator setup (Docker wiring, verification commands, PWA install, and auto-subscribe behavior), see [`docs/pwa.md`](pwa.md). This document explains what VAPID is, why it matters here, and whether you need it.

---

## Do I need VAPID keys?

**Usually no.** Boards, live SSE updates, in-tab notifications, and normal use work without VAPID. Set keys only when you want **background assignment push** on installed or backgrounded clients.

Scrumboy does **not** ship default VAPID keys. Each self-hosted instance generates or supplies its own pair.

---

## What VAPID does in this project

When **both** keys are configured **and the server runs in full mode**, Scrumboy:

1. Exposes **`pushConfigured: true`** on **`GET /api/auth/status`** so the SPA knows push is available without probing other endpoints.
2. Serves the public key at **`GET /api/push/vapid-public-key`** for browser subscription.
3. Accepts **subscribe / unsubscribe** requests from signed-in users and stores push endpoints per device.
4. Sends **assignment notifications** through the browser’s push network when a todo is assigned to a subscribed user.

If only one key is set, keys are blank, or the server runs in **anonymous mode**, Web Push stays **disabled** — partial config is ignored. At startup the server logs one of:

- `web push: enabled`
- `web push: disabled (anonymous mode)`
- `web push: disabled (set SCRUMBOY_VAPID_PUBLIC_KEY and SCRUMBOY_VAPID_PRIVATE_KEY)`
- `web push: partial config ignored`

---

## Two different notification paths

Do not confuse these — they solve different problems:

| Setting / feature | What it does |
|-------------------|--------------|
| **Enable notifications** (Settings) | In-tab / desktop alerts while the browser still has Scrumboy open (Notification API). |
| **Web Push** (needs VAPID on the server) | Can reach you when the tab is in the background or the PWA is not focused; uses the browser’s push service. |

Turning on desktop notifications does **not** replace VAPID. Setting VAPID does **not** bypass the browser permission prompt — each user must still **allow notifications** on each device.

After sign-in, the SPA may attempt auto-subscribe when **`pushConfigured`** is true. Users can opt out or back in under **Settings → Customization → Web Push**.

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `SCRUMBOY_VAPID_PUBLIC_KEY` | Yes (with private) | Public key (URL-safe base64). Shared with browsers for subscription. |
| `SCRUMBOY_VAPID_PRIVATE_KEY` | Yes (with public) | Private key (URL-safe base64). Used server-side to sign outbound push requests. **Keep secret.** |
| `SCRUMBOY_VAPID_SUBSCRIBER` | No | Contact hint for the VAPID JWT **`sub`** claim (plain email or `mailto:` / `https:` URL). Not login identity — see below. |
| `SCRUMBOY_DEBUG_PUSH` | No | Set to `1` to log push send/prune behavior on the server. |

Scrumboy does **not** auto-load `.env` files inside the process. Your process manager, Compose, or Kubernetes must inject these into the running server. See [`docs/pwa.md`](pwa.md#docker-setup-and-verification) for Docker examples.

Example entries in `scrumboy.env.example` at the repo root.

---

## Generating a key pair

Use any VAPID-capable tool, for example:

- [`web-push` npm](https://www.npmjs.com/package/web-push) — `npx web-push generate-vapid-keys`
- [VapidKeys.com](https://vapidkeys.com/) or similar generators

Paste the **public** and **private** values into your environment as URL-safe base64 (as the tool outputs them). Restart or recreate the server after changing keys.

**Important:** Treat the private key like a secret. Do not commit it to git or expose it in client-side code. Only the public key is returned by the API.

---

## `SCRUMBOY_VAPID_SUBSCRIBER`

Push providers expect a stable **contact** on outbound requests. This value becomes the JWT **`sub`** (subject) claim.

- Use a plain operations email (e.g. `ops@example.com`) — the server normalizes it to `mailto:ops@example.com`.
- Or set a full `mailto:...` or `https://...` URL explicitly.
- It does **not** need to match OIDC, user emails, or who can sign in.
- If unset, the server uses a built-in default (see `internal/httpapi/push_notify.go`).

---

## What gets sent (and what does not)

Web Push in Scrumboy is **not product telemetry**. VAPID identifies **your** Scrumboy server to the push network so assignment events can be delivered to devices that opted in. Board data is not sent to Scrumboy’s project maintainers.

Push payloads are limited to assignment alerts (who assigned what). Full todo content stays on your instance; delivery goes through the user’s browser push service under their permission.

---

## Quick verification

1. Confirm env vars are visible to the running process (e.g. `docker exec scrumboy env | grep SCRUMBOY_VAPID`).
2. Check startup log for `web push: enabled`.
3. Call **`GET /api/auth/status`** while signed in — expect **`pushConfigured: true`**.
4. Call **`GET /api/push/vapid-public-key`** — expect **`200`** with `{ "publicKey": "..." }` (or **`503`** / `PUSH_UNAVAILABLE` if misconfigured).

See [`docs/pwa.md`](pwa.md) for full Docker and curl examples.

---

## Related documentation

- [`docs/pwa.md`](pwa.md) — PWA install, Docker setup, auto-subscribe, Settings opt-out, trade-offs.
- [`FAQ.md`](../FAQ.md#what-are-vapid-keys-and-do-i-need-them) — short operator FAQ entry.
- [`API.md`](../API.md) — `pushConfigured` on auth status and push API routes.
- [`README.md`](../README.md#config) — env variable table.
