package oidc

import (
	"testing"
	"time"
)

func TestSanitizeReturnTo(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"empty", "", "/"},
		{"root", "/", "/"},
		{"simple path", "/dashboard", "/dashboard"},
		{"path with query", "/board?slug=abc", "/board?slug=abc"},
		{"double slash", "//evil.com", "/"},
		{"scheme", "https://evil.com", "/"},
		{"backslash", "/foo\\bar", "/"},
		{"encoded double slash", "%2f%2f", "/"},
		{"dot traversal", "/../../etc/passwd", "/"},
		{"single dot segment", "/foo/./bar", "/"},
		{"double dot segment", "/foo/../bar", "/"},
		{"newline", "/foo\nbar", "/"},
		{"carriage return", "/foo\rbar", "/"},
		{"null byte", "/foo\x00bar", "/"},
		{"fragment", "/foo#bar", "/"},
		{"no leading slash", "dashboard", "/"},
		{"protocol relative", "//evil.com/path", "/"},
		{"contains scheme mid-path", "/foo://bar", "/"},
		{"encoded dot dot", "%2e%2e", "/"},
		{"nested path", "/projects/123/board", "/projects/123/board"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SanitizeReturnTo(tt.in)
			if got != tt.want {
				t.Errorf("SanitizeReturnTo(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestNormalizeIssuer(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"https://auth.example.com", "https://auth.example.com"},
		{"https://auth.example.com/", "https://auth.example.com"},
		{"https://auth.example.com///", "https://auth.example.com"},
		{"  https://auth.example.com/  ", "https://auth.example.com"},
		{"", ""},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			got := NormalizeIssuer(tt.in)
			if got != tt.want {
				t.Errorf("NormalizeIssuer(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestIsEmailVerified(t *testing.T) {
	tests := []struct {
		name string
		in   any
		want bool
	}{
		{"bool true", true, true},
		{"bool false", false, false},
		{"string true", "true", true},
		{"string false", "false", false},
		{"string True", "True", false},
		{"nil", nil, false},
		{"number", 1.0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isEmailVerified(tt.in)
			if got != tt.want {
				t.Errorf("isEmailVerified(%v) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

func TestStateStoreSingleUse(t *testing.T) {
	s := newStateStore(10 * time.Minute)
	ls := &loginState{Nonce: "n1", PKCEVerifier: "v1", ReturnTo: "/", CreatedAt: time.Now()}
	s.Put("abc", ls)

	got := s.Take("abc")
	if got == nil {
		t.Fatal("expected login state, got nil")
	}
	if got.Nonce != "n1" {
		t.Errorf("nonce = %q, want %q", got.Nonce, "n1")
	}

	// Second take should return nil (single-use)
	got = s.Take("abc")
	if got != nil {
		t.Fatal("expected nil on second take, got non-nil")
	}
}

func TestStateStoreExpiry(t *testing.T) {
	s := newStateStore(0) // 0 TTL = immediately expired
	ls := &loginState{Nonce: "n1", PKCEVerifier: "v1", ReturnTo: "/", CreatedAt: time.Now().Add(-time.Second)}
	s.Put("abc", ls)

	got := s.Take("abc")
	if got != nil {
		t.Fatal("expected nil for expired state, got non-nil")
	}
}

func TestStateStoreUnknownKey(t *testing.T) {
	s := newStateStore(10 * time.Minute)
	got := s.Take("nonexistent")
	if got != nil {
		t.Fatal("expected nil for unknown key, got non-nil")
	}
}
