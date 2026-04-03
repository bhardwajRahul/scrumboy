package httpapi

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"scrumboy/internal/db"
	"scrumboy/internal/migrate"
	"scrumboy/internal/oidc"
	"scrumboy/internal/store"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
)

// fakeIdP simulates an OIDC provider for integration tests.
type fakeIdP struct {
	server     *httptest.Server
	key        *rsa.PrivateKey
	keyID      string
	issuer     string
	clientID   string
	subject    string
	email      string
	emailVer   bool
	name       string
}

func newFakeIdP(t *testing.T) *fakeIdP {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	idp := &fakeIdP{
		key:      key,
		keyID:    "test-kid-1",
		clientID: "test-client",
		subject:  "user-sub-123",
		email:    "alice@example.com",
		emailVer: true,
		name:     "Alice",
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/.well-known/openid-configuration", idp.handleDiscovery)
	mux.HandleFunc("/jwks", idp.handleJWKS)
	mux.HandleFunc("/authorize", idp.handleAuthorize)
	mux.HandleFunc("/token", idp.handleToken)
	idp.server = httptest.NewServer(mux)
	idp.issuer = idp.server.URL
	return idp
}

func (f *fakeIdP) close() { f.server.Close() }

func (f *fakeIdP) handleDiscovery(w http.ResponseWriter, r *http.Request) {
	disc := map[string]any{
		"issuer":                 f.issuer,
		"authorization_endpoint": f.issuer + "/authorize",
		"token_endpoint":         f.issuer + "/token",
		"jwks_uri":               f.issuer + "/jwks",
		"response_types_supported": []string{"code"},
		"subject_types_supported":  []string{"public"},
		"id_token_signing_alg_values_supported": []string{"RS256"},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(disc)
}

func (f *fakeIdP) handleJWKS(w http.ResponseWriter, r *http.Request) {
	jwk := jose.JSONWebKey{
		Key:       &f.key.PublicKey,
		KeyID:     f.keyID,
		Algorithm: string(jose.RS256),
		Use:       "sig",
	}
	set := jose.JSONWebKeySet{Keys: []jose.JSONWebKey{jwk}}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(set)
}

func (f *fakeIdP) handleAuthorize(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	redir := r.URL.Query().Get("redirect_uri")
	u, _ := url.Parse(redir)
	q := u.Query()
	q.Set("code", "test-auth-code")
	q.Set("state", state)
	u.RawQuery = q.Encode()
	http.Redirect(w, r, u.String(), http.StatusFound)
}

func (f *fakeIdP) handleToken(w http.ResponseWriter, r *http.Request) {
	signer, err := jose.NewSigner(
		jose.SigningKey{Algorithm: jose.RS256, Key: f.key},
		(&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", f.keyID),
	)
	if err != nil {
		http.Error(w, "signer error", 500)
		return
	}

	nonce := r.FormValue("nonce")
	if nonce == "" {
		nonce = "fallback"
	}

	now := time.Now()
	claims := map[string]any{
		"iss":            f.issuer,
		"sub":            f.subject,
		"aud":            f.clientID,
		"exp":            now.Add(10 * time.Minute).Unix(),
		"iat":            now.Unix(),
		"nonce":          nonce,
		"email":          f.email,
		"email_verified": f.emailVer,
		"name":           f.name,
	}

	raw, err := jwt.Signed(signer).Claims(claims).Serialize()
	if err != nil {
		http.Error(w, "jwt error", 500)
		return
	}

	resp := map[string]any{
		"access_token": "fake-access-token",
		"token_type":   "Bearer",
		"id_token":     raw,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (f *fakeIdP) signIDToken(t *testing.T, claims map[string]any) string {
	t.Helper()
	signer, err := jose.NewSigner(
		jose.SigningKey{Algorithm: jose.RS256, Key: f.key},
		(&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", f.keyID),
	)
	if err != nil {
		t.Fatalf("new signer: %v", err)
	}
	raw, err := jwt.Signed(signer).Claims(claims).Serialize()
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return raw
}

func newTestOIDCServer(t *testing.T, idp *fakeIdP) (*httptest.Server, func()) {
	t.Helper()

	dir := t.TempDir()
	sqlDB, err := db.Open(filepath.Join(dir, "app.db"), db.Options{
		BusyTimeout: 5000,
		JournalMode: "WAL",
		Synchronous: "FULL",
	})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := migrate.Apply(context.Background(), sqlDB); err != nil {
		_ = sqlDB.Close()
		t.Fatalf("migrate: %v", err)
	}

	st := store.New(sqlDB, nil)

	// Create OIDC service with the fake IdP as issuer.
	// RedirectURL is set to a placeholder; we override per test as needed.
	oidcSvc := oidc.New(oidc.Config{
		IssuerCanonical: idp.issuer,
		ClientID:        idp.clientID,
		ClientSecret:    "test-secret",
		RedirectURL:     "http://placeholder/api/auth/oidc/callback",
	})

	srv := NewServer(st, Options{
		MaxRequestBody: 1 << 20,
		ScrumboyMode:   "full",
		OIDCService:    oidcSvc,
	})
	ts := httptest.NewServer(srv)

	// Update redirect URL to point to the actual test server.
	oidcSvc2 := oidc.New(oidc.Config{
		IssuerCanonical: idp.issuer,
		ClientID:        idp.clientID,
		ClientSecret:    "test-secret",
		RedirectURL:     ts.URL + "/api/auth/oidc/callback",
	})
	srv.oidcService = oidcSvc2

	return ts, func() {
		ts.Close()
		_ = sqlDB.Close()
	}
}

func TestOIDCStatusFlags(t *testing.T) {
	idp := newFakeIdP(t)
	defer idp.close()

	ts, cleanup := newTestOIDCServer(t, idp)
	defer cleanup()

	jar, _ := cookiejar.New(nil)
	client := &http.Client{Jar: jar}

	var status map[string]any
	doJSON(t, client, "GET", ts.URL+"/api/auth/status", nil, &status)

	if status["oidcEnabled"] != true {
		t.Errorf("expected oidcEnabled=true, got %v", status["oidcEnabled"])
	}
	if status["localAuthEnabled"] != true {
		t.Errorf("expected localAuthEnabled=true, got %v", status["localAuthEnabled"])
	}
}

func TestOIDCLoginRedirect(t *testing.T) {
	idp := newFakeIdP(t)
	defer idp.close()

	ts, cleanup := newTestOIDCServer(t, idp)
	defer cleanup()

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	resp, err := client.Get(ts.URL + "/api/auth/oidc/login?return_to=/dashboard")
	if err != nil {
		t.Fatalf("login request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusFound {
		t.Fatalf("expected 302, got %d", resp.StatusCode)
	}

	loc := resp.Header.Get("Location")
	if !strings.HasPrefix(loc, idp.issuer+"/authorize") {
		t.Errorf("expected redirect to IdP, got %q", loc)
	}
	if !strings.Contains(loc, "code_challenge_method=S256") {
		t.Errorf("expected PKCE S256 in authorize URL, got %q", loc)
	}
}

func TestOIDCAnonymousMode404(t *testing.T) {
	dir := t.TempDir()
	sqlDB, err := db.Open(filepath.Join(dir, "app.db"), db.Options{
		BusyTimeout: 5000,
		JournalMode: "WAL",
		Synchronous: "FULL",
	})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer sqlDB.Close()
	if err := migrate.Apply(context.Background(), sqlDB); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	st := store.New(sqlDB, nil)
	oidcSvc := oidc.New(oidc.Config{
		IssuerCanonical: "https://example.com",
		ClientID:        "c",
		ClientSecret:    "s",
		RedirectURL:     "http://example.com/cb",
	})
	srv := NewServer(st, Options{
		MaxRequestBody: 1 << 20,
		ScrumboyMode:   "anonymous",
		OIDCService:    oidcSvc,
	})
	ts := httptest.NewServer(srv)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/api/auth/oidc/login")
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404 in anonymous mode, got %d", resp.StatusCode)
	}
}

func TestOIDCCallbackInvalidState(t *testing.T) {
	idp := newFakeIdP(t)
	defer idp.close()

	ts, cleanup := newTestOIDCServer(t, idp)
	defer cleanup()

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	resp, err := client.Get(ts.URL + "/api/auth/oidc/callback?code=abc&state=bogus")
	if err != nil {
		t.Fatalf("callback: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusFound {
		t.Fatalf("expected 302, got %d", resp.StatusCode)
	}
	loc := resp.Header.Get("Location")
	if !strings.Contains(loc, "oidc_error=state_invalid") {
		t.Errorf("expected oidc_error=state_invalid, got Location=%q", loc)
	}
}

