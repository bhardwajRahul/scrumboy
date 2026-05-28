package config

import "testing"

func TestMarkdownNotesEnabledFromEnv(t *testing.T) {
	cases := []struct {
		name string
		env  string
		want bool
	}{
		{"empty", "", false},
		{"whitespace", "   ", false},
		{"one", "1", true},
		{"one spaced", " 1 ", true},
		{"true", "true", true},
		{"TRUE", "TRUE", true},
		{"on", "on", true},
		{"yes", "yes", true},
		{"false", "false", false},
		{"off", "off", false},
		{"garbage", "maybe", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("SCRUMBOY_MARKDOWN_NOTES_ENABLED", tc.env)
			if got := markdownNotesEnabledFromEnv(); got != tc.want {
				t.Fatalf("markdownNotesEnabledFromEnv() = %v, want %v (SCRUMBOY_MARKDOWN_NOTES_ENABLED=%q)", got, tc.want, tc.env)
			}
		})
	}
}

func TestMermaidNotesEnabledFromEnv(t *testing.T) {
	cases := []struct {
		name                 string
		markdownNotesEnabled bool
		env                  string
		want                 bool
	}{
		{"markdown disabled blocks mermaid", false, "1", false},
		{"empty", true, "", false},
		{"whitespace", true, "   ", false},
		{"one", true, "1", true},
		{"one spaced", true, " 1 ", true},
		{"true", true, "true", true},
		{"TRUE", true, "TRUE", true},
		{"on", true, "on", true},
		{"yes", true, "yes", true},
		{"false", true, "false", false},
		{"off", true, "off", false},
		{"garbage", true, "maybe", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("SCRUMBOY_MERMAID_NOTES_ENABLED", tc.env)
			if got := mermaidNotesEnabledFromEnv(tc.markdownNotesEnabled); got != tc.want {
				t.Fatalf("mermaidNotesEnabledFromEnv(%v) = %v, want %v (SCRUMBOY_MERMAID_NOTES_ENABLED=%q)", tc.markdownNotesEnabled, got, tc.want, tc.env)
			}
		})
	}
}
