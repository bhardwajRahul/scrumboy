# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability, please report it immediately:

- **Do not** open a public GitHub issue for security-sensitive bugs.

- Email the maintainers (or open a private security advisory on GitHub) with a description of the issue and steps to reproduce.

- Allow a reasonable time for a fix before any public disclosure.

We appreciate your help in keeping Scrumboy safe for users.

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

### Deployment and configuration

- Use HTTPS in production. Session cookies should be set with appropriate flags (e.g. `Secure`, `SameSite`) when the app is served over HTTPS.
- Keep dependencies up to date and review release notes for security fixes.

---

*Last updated: April 2026*
