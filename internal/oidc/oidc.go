package oidc

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	gooidc "github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

// Config holds the validated, canonical OIDC settings.
type Config struct {
	IssuerCanonical  string // normalized once at config load
	ClientID         string
	ClientSecret     string
	RedirectURL      string // absolute callback URL
	LocalAuthDisabled bool
}

// Service manages OIDC discovery, state, and token validation.
type Service struct {
	cfg Config

	mu       sync.Mutex
	provider *gooidc.Provider  // lazy; nil until first successful discovery
	verifier *gooidc.IDTokenVerifier

	states *stateStore
}

func New(cfg Config) *Service {
	return &Service{
		cfg:    cfg,
		states: newStateStore(10 * time.Minute),
	}
}

func (s *Service) Config() Config { return s.cfg }

// ensureProvider performs lazy discovery and caches the result.
// Returns an error if discovery fails or issuer mismatches.
func (s *Service) ensureProvider(ctx context.Context) (*gooidc.Provider, *gooidc.IDTokenVerifier, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.provider != nil {
		return s.provider, s.verifier, nil
	}

	p, err := gooidc.NewProvider(ctx, s.cfg.IssuerCanonical)
	if err != nil {
		return nil, nil, fmt.Errorf("oidc discovery failed for %q: %w", s.cfg.IssuerCanonical, err)
	}

	s.provider = p
	s.verifier = p.Verifier(&gooidc.Config{
		ClientID: s.cfg.ClientID,
	})
	return s.provider, s.verifier, nil
}

func (s *Service) oauth2Config(provider *gooidc.Provider) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     s.cfg.ClientID,
		ClientSecret: s.cfg.ClientSecret,
		Endpoint:     provider.Endpoint(),
		RedirectURL:  s.cfg.RedirectURL,
		Scopes:       []string{gooidc.ScopeOpenID, "email", "profile"},
	}
}

// LoginRedirectURL builds the authorization URL and stores PKCE/nonce/state in memory.
func (s *Service) LoginRedirectURL(ctx context.Context, returnTo string) (string, error) {
	provider, _, err := s.ensureProvider(ctx)
	if err != nil {
		return "", err
	}

	stateRaw, err := randomString(32)
	if err != nil {
		return "", fmt.Errorf("generate state: %w", err)
	}

	nonce, err := randomString(32)
	if err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}

	verifier := oauth2.GenerateVerifier()

	s.states.Put(stateRaw, &loginState{
		Nonce:        nonce,
		PKCEVerifier: verifier,
		ReturnTo:     returnTo,
		CreatedAt:    time.Now(),
	})

	cfg := s.oauth2Config(provider)
	authURL := cfg.AuthCodeURL(
		stateRaw,
		oauth2.SetAuthURLParam("nonce", nonce),
		oauth2.S256ChallengeOption(verifier),
	)

	return authURL, nil
}

// CallbackResult holds the validated identity after a successful callback.
type CallbackResult struct {
	Issuer   string
	Subject  string
	Email    string
	Name     string
	ReturnTo string
}

// HandleCallback validates the callback, exchanges the code, and verifies the ID token.
func (s *Service) HandleCallback(ctx context.Context, r *http.Request) (*CallbackResult, string) {
	if errParam := r.URL.Query().Get("error"); errParam != "" {
		return nil, "provider"
	}

	stateParam := r.URL.Query().Get("state")
	code := r.URL.Query().Get("code")
	if stateParam == "" || code == "" {
		return nil, "state_invalid"
	}

	ls := s.states.Take(stateParam)
	if ls == nil {
		return nil, "state_invalid"
	}

	provider, verifier, err := s.ensureProvider(ctx)
	if err != nil {
		return nil, "token"
	}

	cfg := s.oauth2Config(provider)
	tok, err := cfg.Exchange(ctx, code, oauth2.VerifierOption(ls.PKCEVerifier))
	if err != nil {
		return nil, "token"
	}

	rawIDToken, ok := tok.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		return nil, "token"
	}

	idToken, err := verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, "token"
	}

	if idToken.Nonce != ls.Nonce {
		return nil, "token"
	}

	var claims struct {
		Email         string `json:"email"`
		EmailVerified any    `json:"email_verified"`
		Name          string `json:"name"`
		PreferredUser string `json:"preferred_username"`
	}
	if err := idToken.Claims(&claims); err != nil {
		return nil, "token"
	}

	email := strings.TrimSpace(claims.Email)
	if email == "" {
		return nil, "email"
	}

	if !isEmailVerified(claims.EmailVerified) {
		return nil, "email"
	}

	name := strings.TrimSpace(claims.Name)
	if name == "" {
		name = strings.TrimSpace(claims.PreferredUser)
	}
	if name == "" {
		parts := strings.SplitN(idToken.Subject, "|", 2)
		name = parts[len(parts)-1]
	}

	return &CallbackResult{
		Issuer:   s.cfg.IssuerCanonical,
		Subject:  idToken.Subject,
		Email:    strings.ToLower(email),
		Name:     name,
		ReturnTo: ls.ReturnTo,
	}, ""
}

// isEmailVerified handles both boolean true and string "true" from providers.
func isEmailVerified(v any) bool {
	switch val := v.(type) {
	case bool:
		return val
	case string:
		return val == "true"
	}
	return false
}

// SanitizeReturnTo validates a return_to value against open-redirect attacks.
func SanitizeReturnTo(raw string) string {
	if raw == "" {
		return "/"
	}
	decoded, err := url.PathUnescape(raw)
	if err != nil {
		return "/"
	}
	decoded = strings.TrimSpace(decoded)
	if decoded == "" {
		return "/"
	}

	for _, c := range decoded {
		if c == '\\' || c == '\r' || c == '\n' || c == 0 {
			return "/"
		}
	}

	if !strings.HasPrefix(decoded, "/") {
		return "/"
	}
	if strings.HasPrefix(decoded, "//") {
		return "/"
	}
	if strings.Contains(decoded, "://") {
		return "/"
	}
	if strings.Contains(decoded, "#") {
		return "/"
	}

	pathPart := decoded
	if idx := strings.Index(decoded, "?"); idx >= 0 {
		pathPart = decoded[:idx]
	}
	for _, seg := range strings.Split(pathPart, "/") {
		if seg == "." || seg == ".." {
			return "/"
		}
	}

	return decoded
}

// NormalizeIssuer produces IssuerCanonical from a raw env value.
func NormalizeIssuer(raw string) string {
	s := strings.TrimSpace(raw)
	s = strings.TrimRight(s, "/")
	return s
}

func randomString(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
