package httpapi

import (
	"errors"
	"net/http"
	"time"

	"scrumboy/internal/oidc"
	"scrumboy/internal/store"
)

func (s *Server) handleOIDCLogin(w http.ResponseWriter, r *http.Request) {
	if s.mode == "anonymous" || s.oidcService == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "not found", nil)
		return
	}
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed", nil)
		return
	}

	returnTo := oidc.SanitizeReturnTo(r.URL.Query().Get("return_to"))

	authURL, err := s.oidcService.LoginRedirectURL(r.Context(), returnTo)
	if err != nil {
		s.logger.Printf("oidc: discovery/login error: %v", err)
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "OIDC is currently unavailable", nil)
		return
	}

	http.Redirect(w, r, authURL, http.StatusFound)
}

func (s *Server) handleOIDCCallback(w http.ResponseWriter, r *http.Request) {
	if s.mode == "anonymous" || s.oidcService == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "not found", nil)
		return
	}
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed", nil)
		return
	}

	result, errCode := s.oidcService.HandleCallback(r.Context(), r)
	if errCode != "" {
		if errCode != "provider" {
			s.logger.Printf("oidc: callback error: %s", errCode)
		}
		http.Redirect(w, r, "/?oidc_error="+errCode, http.StatusFound)
		return
	}

	ctx := r.Context()

	u, err := s.store.GetUserByOIDCIdentity(ctx, result.Issuer, result.Subject)
	if err != nil {
		if !errors.Is(err, store.ErrNotFound) {
			s.logger.Printf("oidc: get user by identity: %v", err)
			http.Redirect(w, r, "/?oidc_error=token", http.StatusFound)
			return
		}

		// New identity: create user. Pass configured issuer so the store
		// only grants owner when issuer matches (plan section I).
		configuredIssuer := s.oidcService.Config().IssuerCanonical
		u, err = s.store.CreateUserOIDC(ctx, configuredIssuer, result.Issuer, result.Subject, result.Email, result.Name)
		if err != nil {
			if errors.Is(err, store.ErrConflict) {
				s.logger.Printf("oidc: login aborted: email already in use by existing user (OIDC identity not linked), sub=%s", result.Subject)
			} else {
				s.logger.Printf("oidc: create user: %v", err)
			}
			http.Redirect(w, r, "/?oidc_error=token", http.StatusFound)
			return
		}
	}

	if err := s.store.AssignUnownedDurableProjectsToUser(ctx, u.ID); err != nil {
		s.logger.Printf("oidc: assign unowned projects: %v", err)
	}

	token, expiresAt, err := s.store.CreateSession(ctx, u.ID, 30*24*time.Hour)
	if err != nil {
		s.logger.Printf("oidc: create session: %v", err)
		http.Redirect(w, r, "/?oidc_error=token", http.StatusFound)
		return
	}
	setSessionCookie(w, r, token, expiresAt)
	http.Redirect(w, r, result.ReturnTo, http.StatusFound)
}
