package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"scrumboy/internal/crypto"
)

var (
	ErrStartupEncryptionKeyRequired = errors.New("startup encryption key required")
	ErrStartupEncryptionKeyInvalid  = errors.New("startup encryption key invalid")
)

type StartupEncryptionKeyResolution struct {
	Key                       []byte
	InvalidIgnored            bool
	EncryptedAuthSecurityData bool
}

func ResolveStartupEncryptionKey(ctx context.Context, db *sql.DB, rawKey string) (StartupEncryptionKeyResolution, error) {
	res := StartupEncryptionKeyResolution{}

	hasEncryptedState, err := EncryptedAuthSecurityStateExists(ctx, db)
	if err != nil {
		return res, err
	}
	res.EncryptedAuthSecurityData = hasEncryptedState

	rawKey = strings.TrimSpace(rawKey)
	if rawKey == "" {
		if hasEncryptedState {
			return res, ErrStartupEncryptionKeyRequired
		}
		return res, nil
	}

	key, err := crypto.DecodeKey(rawKey)
	if err != nil {
		if hasEncryptedState {
			return res, fmt.Errorf("%w: %v", ErrStartupEncryptionKeyInvalid, err)
		}
		res.InvalidIgnored = true
		return res, nil
	}

	res.Key = key
	return res, nil
}

func EncryptedAuthSecurityStateExists(ctx context.Context, db *sql.DB) (bool, error) {
	var exists int
	err := db.QueryRowContext(ctx, `
SELECT CASE WHEN
  EXISTS(SELECT 1 FROM users WHERE two_factor_enabled = 1)
  OR EXISTS(
    SELECT 1
    FROM users
    WHERE two_factor_secret_enc IS NOT NULL
      AND TRIM(two_factor_secret_enc) <> ''
  )
  OR EXISTS(
    SELECT 1
    FROM two_factor_enrollments
    WHERE secret_enc IS NOT NULL
      AND TRIM(secret_enc) <> ''
  )
THEN 1 ELSE 0 END`).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check encrypted auth/security state: %w", err)
	}
	return exists != 0, nil
}
