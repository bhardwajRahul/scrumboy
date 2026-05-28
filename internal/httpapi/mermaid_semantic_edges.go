package httpapi

import (
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
)

func (s *Server) serveMermaidSemanticEdges(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")

	if s.dataDir != "" {
		overridePath := filepath.Join(s.dataDir, "mermaid-semantic-edges.json")
		if body, err := os.ReadFile(overridePath); err == nil {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(body)
			return
		}
	}

	body, err := fs.ReadFile(s.webFS, "mermaid-semantic-edges.json")
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "mermaid semantic edges config not found", nil)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}
