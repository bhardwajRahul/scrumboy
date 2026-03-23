package auth

import (
	"fmt"
	"strings"

	"scrumboy/internal/errs"
)

const minPasswordLength = 8

// ValidatePassword validates a password for signup or reset.
// Rules: min length 8, trim whitespace, reject empty.
// Returns errs.ErrValidation on failure.
func ValidatePassword(password string) error {
	p := strings.TrimSpace(password)
	if p == "" {
		return fmt.Errorf("%w: password required", errs.ErrValidation)
	}
	if len(p) < minPasswordLength {
		return fmt.Errorf("%w: password too short", errs.ErrValidation)
	}
	return nil
}
