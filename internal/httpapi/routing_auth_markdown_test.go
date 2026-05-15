package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"scrumboy/internal/db"
	"scrumboy/internal/migrate"
	"scrumboy/internal/store"
)

func newAuthStatusTestServer(t *testing.T, opts Options) (*httptest.Server, *http.Client) {
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
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := migrate.Apply(context.Background(), sqlDB); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	if opts.MaxRequestBody == 0 {
		opts.MaxRequestBody = 1 << 20
	}
	if opts.ScrumboyMode == "" {
		opts.ScrumboyMode = "full"
	}

	st := store.New(sqlDB, nil)
	ts := httptest.NewServer(NewServer(st, opts))
	t.Cleanup(ts.Close)
	return ts, ts.Client()
}

func TestAuthStatusMarkdownNotesEnabled(t *testing.T) {
	cases := []struct {
		name    string
		mode    string
		enabled bool
	}{
		{name: "full disabled", mode: "full", enabled: false},
		{name: "full enabled", mode: "full", enabled: true},
		{name: "anonymous disabled", mode: "anonymous", enabled: false},
		{name: "anonymous enabled", mode: "anonymous", enabled: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ts, client := newAuthStatusTestServer(t, Options{
				ScrumboyMode:         tc.mode,
				MarkdownNotesEnabled: tc.enabled,
			})

			resp, err := client.Get(ts.URL + "/api/auth/status")
			if err != nil {
				t.Fatalf("GET /api/auth/status: %v", err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				t.Fatalf("expected 200, got %d", resp.StatusCode)
			}

			var statusResp map[string]any
			if err := json.NewDecoder(resp.Body).Decode(&statusResp); err != nil {
				t.Fatalf("decode status response: %v", err)
			}
			if got, ok := statusResp["markdownNotesEnabled"].(bool); !ok || got != tc.enabled {
				t.Fatalf("expected markdownNotesEnabled=%v, got %#v", tc.enabled, statusResp["markdownNotesEnabled"])
			}
		})
	}
}
