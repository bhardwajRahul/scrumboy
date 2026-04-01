package mcp

import "testing"

func TestNormalizeProjectMemberRoleForMCP(t *testing.T) {
	t.Parallel()
	tests := []struct {
		in, want string
	}{
		{"owner", "maintainer"},
		{"OWNER", "maintainer"},
		{"editor", "contributor"},
		{"maintainer", "maintainer"},
		{"contributor", "contributor"},
		{"viewer", "viewer"},
	}
	for _, tc := range tests {
		if got := normalizeProjectMemberRoleForMCP(tc.in); got != tc.want {
			t.Fatalf("normalizeProjectMemberRoleForMCP(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
