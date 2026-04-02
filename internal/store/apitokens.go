package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"fmt"
	"strings"
	"time"
)

// APITokenPrefix is the mandatory v1 wire prefix for minted access tokens (before random material).
const APITokenPrefix = "sb_"

// CreateUserAPIToken generates a new opaque token, stores SHA-256(token) only, and returns the plaintext once.
func (s *Store) CreateUserAPIToken(ctx context.Context, userID int64, name *string) (plaintext string, err error) {
	if userID <= 0 {
		return "", fmt.Errorf("%w: invalid user id", ErrValidation)
	}

	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("rand token: %w", err)
	}
	secret := base64.RawURLEncoding.EncodeToString(b)
	plaintext = APITokenPrefix + secret
	tokenHash := hashToken(plaintext)

	nowMs := time.Now().UTC().UnixMilli()

	var nameArg any
	if name != nil {
		n := strings.TrimSpace(*name)
		if n != "" {
			nameArg = n
		}
	}

	if _, err := s.db.ExecContext(ctx, `
INSERT INTO api_tokens(user_id, token_hash, name, created_at, last_used_at, revoked_at)
VALUES (?, ?, ?, ?, NULL, NULL)
`, userID, tokenHash, nameArg, nowMs); err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: api_tokens.token_hash") {
			return "", ErrConflict
		}
		return "", fmt.Errorf("insert api token: %w", err)
	}
	return plaintext, nil
}

// GetUserByAPIToken returns the user for an active (non-revoked) API token. The full presented secret
// (including sb_ prefix) is hashed and matched. last_used_at is updated best-effort and must not affect success.
func (s *Store) GetUserByAPIToken(ctx context.Context, rawToken string) (User, error) {
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return User{}, ErrNotFound
	}
	if !strings.HasPrefix(rawToken, APITokenPrefix) {
		return User{}, ErrNotFound
	}

	tokenHash := hashToken(rawToken)
	nowMs := time.Now().UTC().UnixMilli()

	var (
		u                User
		isBootstrap      bool
		systemRoleStr    string
		createdAt        int64
		twoFactorEnabled bool
	)
	err := s.db.QueryRowContext(ctx, `
SELECT u.id, u.email, u.name, u.is_bootstrap, u.system_role, u.created_at, u.two_factor_enabled
FROM api_tokens t
JOIN users u ON u.id = t.user_id
WHERE t.token_hash = ?
  AND t.revoked_at IS NULL
`, tokenHash).Scan(&u.ID, &u.Email, &u.Name, &isBootstrap, &systemRoleStr, &createdAt, &twoFactorEnabled)
	if err != nil {
		if err == sql.ErrNoRows {
			return User{}, ErrNotFound
		}
		return User{}, fmt.Errorf("get api token user: %w", err)
	}
	u.IsBootstrap = isBootstrap
	if role, ok := ParseSystemRole(systemRoleStr); ok {
		u.SystemRole = role
	} else {
		u.SystemRole = SystemRoleUser
	}
	u.CreatedAt = time.UnixMilli(createdAt).UTC()
	u.TwoFactorEnabled = twoFactorEnabled

	go func() {
		_, _ = s.db.ExecContext(context.Background(),
			`UPDATE api_tokens SET last_used_at = ? WHERE token_hash = ? AND revoked_at IS NULL`,
			nowMs, tokenHash)
	}()

	return u, nil
}
