Table of contents

- [Reporting a vulnerability](#reporting-a-vulnerability)
- [Verified security scan status](#verified-security-scan-status)
- [Security practices (transparency)](#security-practices-transparency)
  - [Passwords](#passwords)
  - [Sessions and authentication](#sessions-and-authentication)
  - [Data at rest](#data-at-rest)
  - [OIDC (OpenID Connect)](#oidc-openid-connect)
  - [Human authentication methods](#human-authentication-methods)
  - [Deployment and configuration](#deployment-and-configuration)

## Reporting a vulnerability

If you believe you have found a security vulnerability, please report it privately:

- Prefer GitHub’s **Report a vulnerability** flow on https://github.com/markrai/scrumboy/security

- **Do not** open a public GitHub issue for security-sensitive bugs.

- Allow a reasonable time for a fix before any public disclosure.

We appreciate your help in keeping Scrumboy safe for users.

---

## Verified security scan status

Point-in-time record for **Scrumboy 3.22.1**, verified **2026-07-19** (UTC).

The README Snyk badge indicates that the GitHub project is **monitored** by Snyk. It is **not** a live guarantee of zero findings, and this section is not a claim that Scrumboy is completely secure - only that the scopes below reported no known vulnerable paths / no reachable vulnerabilities at verification time.

| Scope | Tool / target | Result |
|-------|----------------|--------|
| Go dependencies | `snyk test` on `go.mod` | 0 known vulnerabilities (no vulnerable paths) |
| Frontend dependencies | `snyk test` on `internal/httpapi/web/package.json` (via lockfile) | 0 known vulnerabilities (no vulnerable paths) |
| Container image | `snyk container test` on a locally built image from `Dockerfile` (`scrumboy:snyk-local`) | 0 known vulnerabilities (no vulnerable paths; OS + app deps in image) |
| Reachability-aware Go analysis | `govulncheck ./...` | 0 vulnerabilities affecting code (symbol/reachability results) |

Commands used for this record:

- `snyk test --all-projects`
- `govulncheck ./...`
- `docker build -t scrumboy:snyk-local .` then `snyk container test scrumboy:snyk-local --file=Dockerfile`

There is no public GitHub Actions workflow publishing these scanner results; this record is from local verification against the repository tree for the version above.

---


## Security practices (transparency)

This section summarizes how the application handles sensitive data. It is intended for users and contributors who want to understand our security posture.

### Passwords

User passwords are hashed with **bcrypt** before being written to the database.
- Only the hash is stored in the `users.password_hash` column. On login, the provided password is verified with `bcrypt.CompareHashAndPassword`; the plaintext password is never persisted or logged.

### Sessions and authentication

- Session tokens are generated with `crypto/rand` and sent to the client in a cookie. The **raw token is never stored in the database.**
- Only a **SHA-256 hash** of the token is stored in `sessions.token_hash`. Lookups and revocation use this hash, so a database leak does not expose valid session tokens.

### Data at rest

- No plaintext passwords or session tokens are stored. Sensitive credentials are stored only in hashed form as described above.
- Backup/export features may include project and user data; they do not include password hashes or session token hashes in a form that would allow authentication. Handle exported data according to your own data policies.

### OIDC (OpenID Connect)

- When configured, Scrumboy acts as an OIDC confidential client using the Authorization Code flow with PKCE (S256).
- Token exchange and ID token validation happen server-side; the browser never sees access tokens or ID tokens.
- After successful OIDC login, the user receives a standard `scrumboy_session` cookie (same session infrastructure as password login).
- Identity is linked via the stable `(issuer, subject)` pair from the ID token, not email alone.
- OIDC state and PKCE verifiers are stored in-memory with a short TTL; they are not persisted to the database.
- Verified email is required; login is denied if the `email_verified` claim is not `true`.

### Human authentication methods

- Scrumboy derives human account methods from authoritative records: a valid bcrypt password hash and an identity for the currently configured normalized OIDC issuer. It does not maintain duplicate booleans in the database.
- High-risk method changes use short-lived, hashed, single-use server-side state, exact user/session binding, OIDC state/nonce/PKCE validation, fresh `auth_time`, Scrumboy 2FA when configured, independent user and trusted-IP rate limits, and transactional compare-and-set updates. Normal OIDC ownership is always `(issuer, subject)`; matching email never silently links an identity.
- Scrumboy 2FA protects local-password login and sensitive method changes. MFA for ordinary SSO login is controlled by the identity provider. Host-side owner recovery is a deliberate break-glass exception: host/database control replaces user proof, existing sessions are revoked, and 2FA configuration remains intact.
- See [`docs/oidc.md`](docs/oidc.md) and [`docs/recovery.md`](docs/recovery.md).

### Deployment and configuration

- Use HTTPS in production. Session cookies should be set with appropriate flags (e.g. `Secure`, `SameSite`) when the app is served over HTTPS.
- Keep dependencies up to date and review release notes for security fixes.

---

*Last updated: July 2026*
