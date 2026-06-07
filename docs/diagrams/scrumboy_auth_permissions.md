# Authentication and permissions

Two-layer model: HTTP establishes actor identity; `store` enforces system and project roles.

```mermaid
flowchart TB
  Cred[Credential]
  Cred --> Cookie[scrumboy_session cookie]
  Cred --> Token[API token sb_* header]
  Cred --> OIDC[OIDC callback flow]

  Cookie --> Ctx[requestContext user id in ctx]
  Token --> Ctx
  OIDC --> Ctx

  Ctx --> Handler[HTTP handler]
  Handler --> StoreCheck[store CheckProjectRole etc]
  StoreCheck --> Allow[allow or 403]
```

## Login paths

```mermaid
flowchart LR
  Local[Email password]
  TOTP[2FA TOTP step]
  OIDCFlow[OIDC redirect]
  Bootstrap[Bootstrap first user]

  Local --> TOTP
  OIDCFlow --> Link[Link or create user]
  Bootstrap --> Session[CreateSession cookie]
  TOTP --> Session
  Link --> Session
```

- **Full mode:** sessions, users, API tokens, admin routes
- **Anonymous mode:** `requestContext` ignores cookies; temp boards have no owner until claimed
- **2FA:** requires `SCRUMBOY_ENCRYPTION_KEY` when any user has TOTP enabled

See `docs/roles_and_permissions.md` for role matrix detail.
