package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNegotiateLandingLocaleCookiePrecedence(t *testing.T) {
	available := map[string][]byte{
		"de": []byte("de"),
		"fr": []byte("fr"),
		"hi": []byte("hi"),
	}

	tests := []struct {
		name           string
		cookieValue    string
		acceptLanguage string
		want           string
	}{
		{
			name:           "English cookie keeps apex English despite French browser",
			cookieValue:    "en",
			acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.8",
			want:           "",
		},
		{
			name:           "German cookie beats French browser",
			cookieValue:    "de",
			acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.8",
			want:           "de",
		},
		{
			name:           "Unavailable cookie falls back to browser language",
			cookieValue:    "it",
			acceptLanguage: "fr-FR,fr;q=0.9",
			want:           "fr",
		},
		{
			name:           "Invalid cookie falls back to browser language",
			cookieValue:    "not-a-locale",
			acceptLanguage: "hi-IN,hi;q=0.9",
			want:           "hi",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.AddCookie(&http.Cookie{Name: landingLocaleCookieName, Value: tc.cookieValue})
			req.Header.Set("Accept-Language", tc.acceptLanguage)

			if got := negotiateLandingLocale(req, available); got != tc.want {
				t.Fatalf("negotiateLandingLocale() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestNegotiateLandingLocaleAcceptLanguage(t *testing.T) {
	available := map[string][]byte{
		"de": []byte("de"),
		"fr": []byte("fr"),
		"hi": []byte("hi"),
		"zh": []byte("zh"),
	}

	tests := []struct {
		name           string
		acceptLanguage string
		want           string
	}{
		{
			name:           "French regional preference redirects to French",
			acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.8",
			want:           "fr",
		},
		{
			name:           "English only stays on apex",
			acceptLanguage: "en-US,en;q=0.9",
			want:           "",
		},
		{
			name:           "English first supported language stays on apex",
			acceptLanguage: "nl-NL,nl;q=0.9,en-US;q=0.8,fr;q=0.7",
			want:           "",
		},
		{
			name:           "Empty header stays on apex",
			acceptLanguage: "",
			want:           "",
		},
		{
			name:           "Unsupported language stays on apex",
			acceptLanguage: "nl-NL,nl;q=0.9",
			want:           "",
		},
		{
			name:           "Wildcard is ignored",
			acceptLanguage: "*,fr;q=0.9",
			want:           "fr",
		},
		{
			name:           "q zero is ignored",
			acceptLanguage: "de-DE;q=0,fr-FR;q=0.9",
			want:           "fr",
		},
		{
			name:           "Invalid q value is ignored",
			acceptLanguage: "de-DE;q=bogus,fr-FR;q=0.9",
			want:           "fr",
		},
		{
			name:           "Higher q value wins",
			acceptLanguage: "fr-FR;q=0.4,de-DE;q=0.9",
			want:           "de",
		},
		{
			name:           "Equal q values keep header order",
			acceptLanguage: "de-DE;q=0.7,fr-FR;q=0.7",
			want:           "de",
		},
		{
			name:           "Unavailable normalized locale stays on apex",
			acceptLanguage: "it-IT,it;q=0.9",
			want:           "",
		},
		{
			name:           "Traditional Chinese regional tag maps to zh for landing",
			acceptLanguage: "zh-TW,zh;q=0.9",
			want:           "zh",
		},
		{
			name:           "Traditional Chinese script tag maps to zh for landing",
			acceptLanguage: "zh-Hant,zh;q=0.9",
			want:           "zh",
		},
		{
			name:           "Simplified Chinese regional tag maps to zh for landing",
			acceptLanguage: "zh-CN,zh;q=0.9",
			want:           "zh",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := negotiateLandingLocaleFromAcceptLanguage(tc.acceptLanguage, available); got != tc.want {
				t.Fatalf("negotiateLandingLocaleFromAcceptLanguage() = %q, want %q", got, tc.want)
			}
		})
	}
}
