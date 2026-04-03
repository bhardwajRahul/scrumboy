package oidc

import (
	"sync"
	"time"
)

type loginState struct {
	Nonce        string
	PKCEVerifier string
	ReturnTo     string
	CreatedAt    time.Time
}

// stateStore is an in-memory, TTL-evicting map for OIDC login state.
// Not persisted to DB; restart drops in-flight logins (acceptable for MVP).
type stateStore struct {
	mu  sync.Mutex
	ttl time.Duration
	m   map[string]*loginState
}

func newStateStore(ttl time.Duration) *stateStore {
	return &stateStore{
		ttl: ttl,
		m:   make(map[string]*loginState),
	}
}

// Put stores a login state keyed by the opaque state string.
func (s *stateStore) Put(state string, ls *loginState) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.evictLocked()
	s.m[state] = ls
}

// Take retrieves and deletes the login state (single-use).
// Returns nil if not found or expired.
func (s *stateStore) Take(state string) *loginState {
	s.mu.Lock()
	defer s.mu.Unlock()
	ls, ok := s.m[state]
	if !ok {
		return nil
	}
	delete(s.m, state)
	if time.Since(ls.CreatedAt) > s.ttl {
		return nil
	}
	return ls
}

func (s *stateStore) evictLocked() {
	now := time.Now()
	for k, v := range s.m {
		if now.Sub(v.CreatedAt) > s.ttl {
			delete(s.m, k)
		}
	}
}
