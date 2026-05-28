package httpapi

import "strings"

func PushConfigured(mode, publicKey, privateKey string) bool {
	normalizedMode := strings.TrimSpace(mode)
	if normalizedMode != "full" && normalizedMode != "anonymous" {
		normalizedMode = "full"
	}
	return normalizedMode == "full" && hasCompleteVAPIDKeys(publicKey, privateKey)
}

func hasCompleteVAPIDKeys(publicKey, privateKey string) bool {
	return strings.TrimSpace(publicKey) != "" && strings.TrimSpace(privateKey) != ""
}
