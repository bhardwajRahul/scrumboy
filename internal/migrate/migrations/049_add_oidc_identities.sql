-- Rebuild users table: make password_hash nullable for OIDC-only users.
-- The migrate runner already sets PRAGMA foreign_keys=OFF on the connection
-- before starting the transaction, so DROP TABLE users succeeds despite
-- child tables (sessions, project_members, etc.) referencing users(id).

CREATE TABLE users_new (
  id                    INTEGER PRIMARY KEY,
  email                 TEXT NOT NULL UNIQUE,
  password_hash         TEXT,
  created_at            INTEGER NOT NULL,
  name                  TEXT NOT NULL DEFAULT '',
  is_bootstrap          BOOLEAN NOT NULL DEFAULT FALSE,
  system_role           TEXT NOT NULL DEFAULT 'user',
  two_factor_enabled    INTEGER NOT NULL DEFAULT 0,
  two_factor_secret_enc TEXT NULL,
  image                 TEXT
);

INSERT INTO users_new (
  id, email, password_hash, created_at, name, is_bootstrap,
  system_role, two_factor_enabled, two_factor_secret_enc, image
)
SELECT
  id, email, password_hash, created_at, name, is_bootstrap,
  system_role, two_factor_enabled, two_factor_secret_enc, image
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- External OIDC identity linkage: stable key is (issuer, subject).
CREATE TABLE IF NOT EXISTS user_oidc_identities (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issuer     TEXT NOT NULL,
  subject    TEXT NOT NULL,
  email_at_login TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(issuer, subject)
);

CREATE INDEX IF NOT EXISTS idx_user_oidc_identities_user_id
  ON user_oidc_identities(user_id);
