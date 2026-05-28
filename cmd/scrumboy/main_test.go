package main

import (
	"bytes"
	"log"
	"strings"
	"testing"
)

func TestLogWebPushConfiguration(t *testing.T) {
	cases := []struct {
		name string
		mode string
		pub  string
		priv string
		want string
	}{
		{name: "enabled", mode: "full", pub: "pub", priv: "priv", want: "web push: enabled"},
		{name: "disabled", mode: "full", pub: "", priv: "", want: "web push: disabled (set SCRUMBOY_VAPID_PUBLIC_KEY and SCRUMBOY_VAPID_PRIVATE_KEY)"},
		{name: "partial public only", mode: "full", pub: "pub", priv: "", want: "web push: partial config ignored"},
		{name: "partial private only", mode: "full", pub: "", priv: "priv", want: "web push: partial config ignored"},
		{name: "trimmed disabled", mode: "full", pub: "   ", priv: "\t", want: "web push: disabled (set SCRUMBOY_VAPID_PUBLIC_KEY and SCRUMBOY_VAPID_PRIVATE_KEY)"},
		{name: "anonymous with keys", mode: "anonymous", pub: "pub", priv: "priv", want: "web push: disabled (anonymous mode)"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var buf bytes.Buffer
			logger := log.New(&buf, "", 0)
			logWebPushConfiguration(logger, tc.mode, tc.pub, tc.priv)
			if got := strings.TrimSpace(buf.String()); got != tc.want {
				t.Fatalf("log output = %q, want %q", got, tc.want)
			}
		})
	}
}
