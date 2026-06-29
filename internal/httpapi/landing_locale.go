package httpapi

import (
	"net/http"
	"sort"
	"strconv"
	"strings"
)

const landingLocaleCookieName = "scrumboy.locale"

func negotiateLandingLocale(r *http.Request, available map[string][]byte) string {
	if r == nil {
		return ""
	}
	if c, err := r.Cookie(landingLocaleCookieName); err == nil && c != nil {
		if locale, ok := landingLocaleFromPreference(c.Value, available); ok {
			return locale
		}
	}
	return negotiateLandingLocaleFromAcceptLanguage(r.Header.Get("Accept-Language"), available)
}

func negotiateLandingLocaleFromAcceptLanguage(acceptLanguage string, available map[string][]byte) string {
	for _, tag := range parseAcceptLanguage(acceptLanguage) {
		locale, ok := landingLocaleFromPreference(tag, available)
		if !ok {
			continue
		}
		return locale
	}
	return ""
}

func landingLocaleFromPreference(value string, available map[string][]byte) (string, bool) {
	locale := normalizeLandingLocale(value)
	if locale == "" || locale == "pseudo" {
		return "", false
	}
	if locale == "en" {
		return "", true
	}
	if _, ok := available[locale]; !ok {
		return "", false
	}
	return locale, true
}

type acceptLanguagePreference struct {
	tag   string
	q     float64
	order int
}

func parseAcceptLanguage(header string) []string {
	parts := strings.Split(header, ",")
	preferences := make([]acceptLanguagePreference, 0, len(parts))
	for i, part := range parts {
		tag, q, ok := parseAcceptLanguagePart(part)
		if !ok {
			continue
		}
		preferences = append(preferences, acceptLanguagePreference{tag: tag, q: q, order: i})
	}
	sort.SliceStable(preferences, func(i, j int) bool {
		if preferences[i].q == preferences[j].q {
			return preferences[i].order < preferences[j].order
		}
		return preferences[i].q > preferences[j].q
	})

	tags := make([]string, 0, len(preferences))
	for _, preference := range preferences {
		tags = append(tags, preference.tag)
	}
	return tags
}

func parseAcceptLanguagePart(part string) (string, float64, bool) {
	part = strings.TrimSpace(part)
	if part == "" {
		return "", 0, false
	}
	segments := strings.Split(part, ";")
	tag := strings.TrimSpace(segments[0])
	if tag == "" || tag == "*" {
		return "", 0, false
	}

	q := 1.0
	for _, segment := range segments[1:] {
		key, value, found := strings.Cut(strings.TrimSpace(segment), "=")
		if !found || strings.TrimSpace(strings.ToLower(key)) != "q" {
			continue
		}
		parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
		if err != nil || parsed <= 0 || parsed > 1 {
			return "", 0, false
		}
		q = parsed
	}
	return tag, q, true
}

func normalizeLandingLocale(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	normalized = strings.ReplaceAll(normalized, "_", "-")
	if normalized == "" {
		return ""
	}

	switch {
	case normalized == "pseudo":
		return "pseudo"
	case normalized == "en" || strings.HasPrefix(normalized, "en-"):
		return "en"
	case normalized == "zh" || strings.HasPrefix(normalized, "zh-"):
		return "zh"
	case normalized == "hi" || strings.HasPrefix(normalized, "hi-"):
		return "hi"
	case normalized == "es" || strings.HasPrefix(normalized, "es-"):
		return "es"
	case normalized == "ar" || strings.HasPrefix(normalized, "ar-"):
		return "ar"
	case normalized == "fr" || strings.HasPrefix(normalized, "fr-"):
		return "fr"
	case normalized == "bn" || strings.HasPrefix(normalized, "bn-"):
		return "bn"
	case normalized == "pt" || strings.HasPrefix(normalized, "pt-"):
		return "pt"
	case normalized == "id" || strings.HasPrefix(normalized, "id-"):
		return "id"
	case normalized == "ur" || strings.HasPrefix(normalized, "ur-"):
		return "ur"
	case normalized == "ru" || strings.HasPrefix(normalized, "ru-"):
		return "ru"
	case normalized == "de" || strings.HasPrefix(normalized, "de-"):
		return "de"
	case normalized == "ja" || strings.HasPrefix(normalized, "ja-"):
		return "ja"
	case normalized == "sw" || strings.HasPrefix(normalized, "sw-"):
		return "sw"
	case normalized == "vi" || strings.HasPrefix(normalized, "vi-"):
		return "vi"
	case normalized == "tr" || strings.HasPrefix(normalized, "tr-"):
		return "tr"
	case normalized == "ko" || strings.HasPrefix(normalized, "ko-"):
		return "ko"
	case normalized == "fa" || strings.HasPrefix(normalized, "fa-"):
		return "fa"
	case normalized == "th" || strings.HasPrefix(normalized, "th-"):
		return "th"
	case normalized == "it" || strings.HasPrefix(normalized, "it-"):
		return "it"
	case normalized == "ms" || strings.HasPrefix(normalized, "ms-"):
		return "ms"
	case normalized == "pl" || strings.HasPrefix(normalized, "pl-"):
		return "pl"
	case normalized == "uk" || strings.HasPrefix(normalized, "uk-"):
		return "uk"
	default:
		return ""
	}
}

func setApexLandingNegotiationHeaders(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "private")
	addVaryHeader(w, "Cookie")
	addVaryHeader(w, "Accept-Language")
}

func addVaryHeader(w http.ResponseWriter, value string) {
	existing := w.Header().Get("Vary")
	if existing == "" {
		w.Header().Set("Vary", value)
		return
	}
	for _, part := range strings.Split(existing, ",") {
		if strings.EqualFold(strings.TrimSpace(part), value) {
			return
		}
	}
	w.Header().Set("Vary", existing+", "+value)
}
