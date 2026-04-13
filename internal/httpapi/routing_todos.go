package httpapi

import (
	"encoding/json"
	"net/http"

	"scrumboy/internal/store"
)

func (s *Server) handleTodos(w http.ResponseWriter, r *http.Request, rest []string) {
	if len(rest) == 0 {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "not found", nil)
		return
	}

	todoID, ok := parseInt64(rest[0])
	if !ok {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid todo id", map[string]any{"field": "todoId"})
		return
	}

	// /api/todos/{id}
	if len(rest) == 1 {
		switch r.Method {
		case http.MethodPatch:
			var raw map[string]json.RawMessage
			if err := readJSON(w, r, s.maxBody, &raw); err != nil {
				return
			}
			if _, ok := raw["assigneeUserId"]; !ok {
				writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "missing assigneeUserId", map[string]any{"field": "assigneeUserId"})
				return
			}

			var in struct {
				Title            string   `json:"title"`
				Body             string   `json:"body"`
				Tags             []string `json:"tags"`
				EstimationPoints *int64   `json:"estimationPoints"`
				AssigneeUserId   *int64   `json:"assigneeUserId"`
			}
			payload, err := json.Marshal(raw)
			if err != nil {
				writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid json payload", nil)
				return
			}
			if err := json.Unmarshal(payload, &in); err != nil {
				writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid json payload", nil)
				return
			}
			todo, err := s.store.UpdateTodo(s.requestContext(r), todoID, store.UpdateTodoInput{
				Title:            in.Title,
				Body:             in.Body,
				Tags:             in.Tags,
				EstimationPoints: in.EstimationPoints,
				AssigneeUserID:   in.AssigneeUserId,
			}, s.storeMode())
			if err != nil {
				writeStoreErr(w, err, true)
				return
			}
			if !todo.AssignmentChanged {
				s.emitRefreshNeeded(r.Context(), todo.ProjectID, "todo_updated")
			}
			writeJSON(w, http.StatusOK, todoToJSON(todo))
			return

		case http.MethodDelete:
			projectID, err := s.store.GetProjectIDForTodo(s.requestContext(r), todoID)
			if err != nil {
				writeStoreErr(w, err, true)
				return
			}
			if err := s.store.DeleteTodo(s.requestContext(r), todoID, s.storeMode()); err != nil {
				writeStoreErr(w, err, true)
				return
			}
			s.emitRefreshNeeded(r.Context(), projectID, "todo_deleted")
			w.WriteHeader(http.StatusNoContent)
			return

		default:
			writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed", nil)
			return
		}
	}

	// /api/todos/{id}/move
	if len(rest) == 2 && rest[1] == "move" && r.Method == http.MethodPost {
		var in struct {
			ToColumnKey string `json:"toColumnKey"`
			ToStatus    string `json:"toStatus"`
			AfterID     *int64 `json:"afterId"`
			BeforeID    *int64 `json:"beforeId"`
		}
		if err := readJSON(w, r, s.maxBody, &in); err != nil {
			return
		}
		toColumnKey := in.ToColumnKey
		if toColumnKey == "" && in.ToStatus != "" {
			toColumnKey = normalizeLaneKey(in.ToStatus)
		}
		if toColumnKey == "" {
			writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "missing toColumnKey", map[string]any{"field": "toColumnKey"})
			return
		}
		todo, err := s.store.MoveTodo(s.requestContext(r), todoID, toColumnKey, in.AfterID, in.BeforeID, s.storeMode())
		if err != nil {
			writeStoreErr(w, err, true)
			return
		}
		s.emitRefreshNeeded(r.Context(), todo.ProjectID, "todo_moved")
		writeJSON(w, http.StatusOK, todoToJSON(todo))
		return
	}

	writeError(w, http.StatusNotFound, "NOT_FOUND", "not found", nil)
}
