package mcp_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"testing"
	"time"

	"scrumboy/internal/db"
	"scrumboy/internal/httpapi"
	"scrumboy/internal/mcp"
	"scrumboy/internal/migrate"
	"scrumboy/internal/store"
)

func newTestServer(t *testing.T, mode string) (*httptest.Server, *sql.DB, func()) {
	t.Helper()

	dir := t.TempDir()
	sqlDB, err := db.Open(filepath.Join(dir, "app.db"), db.Options{
		BusyTimeout: 5000,
		JournalMode: "WAL",
		Synchronous: "FULL",
	})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := migrate.Apply(context.Background(), sqlDB); err != nil {
		_ = sqlDB.Close()
		t.Fatalf("migrate: %v", err)
	}

	st := store.New(sqlDB, nil)
	srv := httpapi.NewServer(st, httpapi.Options{
		MaxRequestBody: 1 << 20,
		ScrumboyMode:   mode,
		MCPHandler:     mcp.New(st, mcp.Options{Mode: mode}),
	})
	ts := httptest.NewServer(srv)
	return ts, sqlDB, func() {
		ts.Close()
		_ = sqlDB.Close()
	}
}

func doMCP(t *testing.T, client *http.Client, url string, body any) (*http.Response, map[string]any) {
	t.Helper()

	var reqBody io.Reader
	if body != nil {
		var buf bytes.Buffer
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode mcp body: %v", err)
		}
		reqBody = &buf
	}

	req, err := http.NewRequest(http.MethodPost, url, reqBody)
	if err != nil {
		t.Fatalf("new mcp request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("do mcp request: %v", err)
	}
	defer resp.Body.Close()

	var out map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode mcp response: %v", err)
	}
	return resp, out
}

func doJSON(t *testing.T, client *http.Client, method, url string, body any, out any) *http.Response {
	t.Helper()

	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode json: %v", err)
		}
	}

	req, err := http.NewRequest(method, url, &buf)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Scrumboy", "1")

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	defer resp.Body.Close()

	if out != nil {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			t.Fatalf("decode json: %v", err)
		}
	}
	return resp
}

func newCookieClient(t *testing.T, ts *httptest.Server) *http.Client {
	t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("cookie jar: %v", err)
	}
	client := ts.Client()
	client.Jar = jar
	return client
}

func newStatelessClient(ts *httptest.Server) *http.Client {
	base := ts.Client()
	return &http.Client{Transport: base.Transport}
}

func projectSlugByName(t *testing.T, sqlDB *sql.DB, name string) string {
	t.Helper()
	var slug string
	if err := sqlDB.QueryRow(`SELECT slug FROM projects WHERE name = ?`, name).Scan(&slug); err != nil {
		t.Fatalf("query project slug: %v", err)
	}
	return slug
}

func projectIDBySlug(t *testing.T, sqlDB *sql.DB, slug string) int64 {
	t.Helper()
	var projectID int64
	if err := sqlDB.QueryRow(`SELECT id FROM projects WHERE slug = ?`, slug).Scan(&projectID); err != nil {
		t.Fatalf("query project id by slug: %v", err)
	}
	return projectID
}

func firstUserID(t *testing.T, sqlDB *sql.DB) int64 {
	t.Helper()
	var userID int64
	if err := sqlDB.QueryRow(`SELECT id FROM users ORDER BY id ASC LIMIT 1`).Scan(&userID); err != nil {
		t.Fatalf("query first user id: %v", err)
	}
	return userID
}

func todoLocalIDsByColumn(t *testing.T, sqlDB *sql.DB, slug, columnKey string) []int64 {
	t.Helper()
	rows, err := sqlDB.Query(`
SELECT t.local_id
FROM todos t
JOIN projects p ON p.id = t.project_id
WHERE p.slug = ? AND t.column_key = ?
ORDER BY t.rank ASC, t.id ASC
`, slug, columnKey)
	if err != nil {
		t.Fatalf("query todo order: %v", err)
	}
	defer rows.Close()

	var out []int64
	for rows.Next() {
		var localID int64
		if err := rows.Scan(&localID); err != nil {
			t.Fatalf("scan todo order: %v", err)
		}
		out = append(out, localID)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate todo order: %v", err)
	}
	return out
}

func bootstrapUser(t *testing.T, client *http.Client, baseURL string) {
	t.Helper()
	resp := doJSON(t, client, http.MethodPost, baseURL+"/api/auth/bootstrap", map[string]any{
		"email":    "owner@example.com",
		"password": "password123",
		"name":     "Owner",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("bootstrap status=%d", resp.StatusCode)
	}
}

func insertProjectScopedTag(t *testing.T, sqlDB *sql.DB, projectID int64, name string, color *string) int64 {
	t.Helper()
	nowMs := time.Now().UTC().UnixMilli()
	var colorArg any
	if color != nil {
		colorArg = *color
	}
	res, err := sqlDB.Exec(`INSERT INTO tags(user_id, project_id, name, created_at, color) VALUES (NULL, ?, ?, ?, ?)`, projectID, name, nowMs, colorArg)
	if err != nil {
		t.Fatalf("insert project-scoped tag: %v", err)
	}
	tagID, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("project tag last insert id: %v", err)
	}
	return tagID
}

func newSessionClientForUser(t *testing.T, ts *httptest.Server, st *store.Store, userID int64) *http.Client {
	t.Helper()
	client := newCookieClient(t, ts)
	token, expiresAt, err := st.CreateSession(context.Background(), userID, 24*time.Hour)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	u, err := url.Parse(ts.URL)
	if err != nil {
		t.Fatalf("parse server url: %v", err)
	}
	client.Jar.SetCookies(u, []*http.Cookie{{
		Name:    "scrumboy_session",
		Value:   token,
		Path:    "/",
		Expires: expiresAt,
	}})
	return client
}

func TestMCPMountDoesNotBreakSPARoutes(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "full")
	defer cleanup()

	resp, err := http.Get(ts.URL + "/")
	if err != nil {
		t.Fatalf("get root: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected root 200, got %d", resp.StatusCode)
	}
	if got := resp.Header.Get("Content-Type"); got != "text/html; charset=utf-8" {
		t.Fatalf("expected html content type, got %q", got)
	}

	resp, err = http.Get(ts.URL + "/mcp")
	if err != nil {
		t.Fatalf("get /mcp: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected /mcp 200, got %d", resp.StatusCode)
	}
}

func TestMCPSystemGetCapabilities_FullPreBootstrap(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "full")
	defer cleanup()

	resp, err := http.Get(ts.URL + "/mcp")
	if err != nil {
		t.Fatalf("get /mcp: %v", err)
	}
	defer resp.Body.Close()

	var out map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if got := resp.Header.Get("Cache-Control"); got != "no-store" {
		t.Fatalf("expected Cache-Control no-store, got %q", got)
	}
	if out["ok"] != true {
		t.Fatalf("expected ok=true, got %#v", out["ok"])
	}
	data := out["data"].(map[string]any)
	if data["serverMode"] != "full" {
		t.Fatalf("expected serverMode full, got %#v", data["serverMode"])
	}
	if data["bootstrapAvailable"] != true {
		t.Fatalf("expected bootstrapAvailable true, got %#v", data["bootstrapAvailable"])
	}
	auth := data["auth"].(map[string]any)
	if auth["mode"] != "sessionCookie" {
		t.Fatalf("expected sessionCookie auth mode, got %#v", auth["mode"])
	}
	if auth["authenticatedToolsUsable"] != false {
		t.Fatalf("expected authenticatedToolsUsable false, got %#v", auth["authenticatedToolsUsable"])
	}
	tools := data["implementedTools"].([]any)
	if len(tools) != 22 || tools[0] != "system.getCapabilities" || tools[1] != "projects.list" || tools[2] != "todos.create" || tools[3] != "todos.get" || tools[4] != "todos.search" || tools[5] != "todos.update" || tools[6] != "todos.delete" || tools[7] != "todos.move" || tools[8] != "sprints.list" || tools[9] != "sprints.get" || tools[10] != "sprints.getActive" || tools[11] != "sprints.create" || tools[12] != "sprints.activate" || tools[13] != "sprints.close" || tools[14] != "sprints.update" || tools[15] != "sprints.delete" || tools[16] != "tags.listProject" || tools[17] != "tags.listMine" || tools[18] != "tags.updateMineColor" || tools[19] != "tags.updateProjectColor" || tools[20] != "members.list" || tools[21] != "members.listAvailable" {
		t.Fatalf("unexpected implementedTools: %#v", tools)
	}
	planned := data["plannedTools"].([]any)
	if len(planned) != 1 || planned[0] != "board.get" {
		t.Fatalf("unexpected plannedTools: %#v", planned)
	}
}

func TestMCPSystemGetCapabilities_AnonymousMode(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "anonymous")
	defer cleanup()

	resp, err := http.Get(ts.URL + "/mcp")
	if err != nil {
		t.Fatalf("get /mcp: %v", err)
	}
	defer resp.Body.Close()

	var out map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	data := out["data"].(map[string]any)
	if data["serverMode"] != "anonymous" {
		t.Fatalf("expected anonymous mode, got %#v", data["serverMode"])
	}
	auth := data["auth"].(map[string]any)
	if auth["mode"] != "disabled" {
		t.Fatalf("expected disabled auth mode, got %#v", auth["mode"])
	}
	if auth["authenticatedToolsUsable"] != false {
		t.Fatalf("expected authenticatedToolsUsable false, got %#v", auth["authenticatedToolsUsable"])
	}
}

func TestMCPProjectsListRequiresAuthAfterBootstrap(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "full")
	defer cleanup()

	authClient := newCookieClient(t, ts)
	bootstrapUser(t, authClient, ts.URL)

	resp, out := doMCP(t, newStatelessClient(ts), ts.URL+"/mcp", map[string]any{
		"tool":  "projects.list",
		"input": map[string]any{},
	})

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
	if out["ok"] != false {
		t.Fatalf("expected ok=false, got %#v", out["ok"])
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "AUTH_REQUIRED" {
		t.Fatalf("expected AUTH_REQUIRED, got %#v", errObj["code"])
	}
}

func TestMCPProjectsListSuccessWithAuthenticatedSession(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)

	var created map[string]any
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "MCP Project",
	}, &created)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool":  "projects.list",
		"input": map[string]any{},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	if out["ok"] != true {
		t.Fatalf("expected ok=true, got %#v", out["ok"])
	}

	data := out["data"].(map[string]any)
	items := data["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("expected 1 project, got %#v", items)
	}
	item := items[0].(map[string]any)
	if item["projectSlug"] == "" {
		t.Fatalf("expected projectSlug, got %#v", item["projectSlug"])
	}
	if item["name"] != "MCP Project" {
		t.Fatalf("expected project name, got %#v", item["name"])
	}
	if _, ok := out["meta"].(map[string]any); !ok {
		t.Fatalf("expected meta object, got %#v", out["meta"])
	}
}

func TestMCPProjectsListCapabilityUnavailableInAnonymousMode(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "anonymous")
	defer cleanup()

	resp, out := doMCP(t, ts.Client(), ts.URL+"/mcp", map[string]any{
		"tool":  "projects.list",
		"input": map[string]any{},
	})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "CAPABILITY_UNAVAILABLE" {
		t.Fatalf("expected CAPABILITY_UNAVAILABLE, got %#v", errObj["code"])
	}
}

func TestMCPTodosCreateSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)

	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Create Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Create Project")

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Add MCP adapter",
			"body":        "Thin layer only",
			"tags":        []string{"mcp"},
			"columnKey":   "backlog",
			"position": map[string]any{
				"afterLocalId":  nil,
				"beforeLocalId": nil,
			},
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	if out["ok"] != true {
		t.Fatalf("expected ok=true, got %#v", out["ok"])
	}
	data := out["data"].(map[string]any)
	todo := data["todo"].(map[string]any)
	if todo["projectSlug"] != slug {
		t.Fatalf("expected projectSlug %q, got %#v", slug, todo["projectSlug"])
	}
	if todo["localId"] == nil {
		t.Fatalf("expected localId, got %#v", todo["localId"])
	}
	if todo["columnKey"] != "backlog" {
		t.Fatalf("expected columnKey backlog, got %#v", todo["columnKey"])
	}
	if _, ok := todo["id"]; ok {
		t.Fatalf("did not expect global todo id in MCP todo object: %#v", todo)
	}
	if _, ok := out["meta"].(map[string]any); !ok {
		t.Fatalf("expected meta object, got %#v", out["meta"])
	}
}

func TestMCPTodosCreateRequiresAuthAfterBootstrap(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Auth Required Todo Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Auth Required Todo Project")

	resp2, out := doMCP(t, newStatelessClient(ts), ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Unauthed",
		},
	})
	if resp2.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "AUTH_REQUIRED" {
		t.Fatalf("expected AUTH_REQUIRED, got %#v", errObj["code"])
	}
}

func TestMCPTodosCreateCapabilityUnavailableInAnonymousMode(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "anonymous")
	defer cleanup()

	resp, out := doMCP(t, ts.Client(), ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": "demo",
			"title":       "Nope",
		},
	})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "CAPABILITY_UNAVAILABLE" {
		t.Fatalf("expected CAPABILITY_UNAVAILABLE, got %#v", errObj["code"])
	}
}

func TestMCPTodosCreateValidationErrorForMalformedInput(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)

	resp, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug":  "demo",
			"title":        "Bad",
			"unknownField": true,
		},
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPTodosGetSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Get Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Get Project")

	resp = doJSON(t, client, http.MethodPost, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Fetch me",
		},
	}, &map[string]any{})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("todos.create status=%d", resp.StatusCode)
	}

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.get",
		"input": map[string]any{
			"projectSlug": slug,
			"localId":     1,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	data := out["data"].(map[string]any)
	todo := data["todo"].(map[string]any)
	if todo["projectSlug"] != slug || todo["localId"] != float64(1) {
		t.Fatalf("unexpected canonical identity: %#v", todo)
	}
	if todo["title"] != "Fetch me" {
		t.Fatalf("expected title, got %#v", todo["title"])
	}
	if _, ok := todo["id"]; ok {
		t.Fatalf("did not expect global todo id in MCP todo object: %#v", todo)
	}
	if _, ok := out["meta"].(map[string]any); !ok {
		t.Fatalf("expected meta object, got %#v", out["meta"])
	}
}

func TestMCPTodosGetNotFound(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Missing Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Missing Project")

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.get",
		"input": map[string]any{
			"projectSlug": slug,
			"localId":     999,
		},
	})
	if resp2.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "NOT_FOUND" {
		t.Fatalf("expected NOT_FOUND, got %#v", errObj["code"])
	}
}

func TestMCPTodosGetRequiresAuth(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Get Auth Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Get Auth Project")

	resp2, out := doMCP(t, newStatelessClient(ts), ts.URL+"/mcp", map[string]any{
		"tool": "todos.get",
		"input": map[string]any{
			"projectSlug": slug,
			"localId":     1,
		},
	})
	if resp2.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "AUTH_REQUIRED" {
		t.Fatalf("expected AUTH_REQUIRED, got %#v", errObj["code"])
	}
}

func TestMCPTodosSearchSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Search Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Search Project")

	doJSON(t, client, http.MethodPost, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Add MCP adapter",
		},
	}, &map[string]any{})
	doJSON(t, client, http.MethodPost, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Other task",
		},
	}, &map[string]any{})

	limit := 20
	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.search",
		"input": map[string]any{
			"projectSlug":     slug,
			"query":           "adapter",
			"limit":           limit,
			"excludeLocalIds": []int64{},
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	data := out["data"].(map[string]any)
	items := data["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("expected 1 result, got %#v", items)
	}
	item := items[0].(map[string]any)
	if item["projectSlug"] != slug || item["localId"] == nil {
		t.Fatalf("unexpected canonical search item: %#v", item)
	}
	if item["title"] != "Add MCP adapter" {
		t.Fatalf("unexpected title: %#v", item["title"])
	}
	if _, ok := item["id"]; ok {
		t.Fatalf("did not expect global todo id in search result: %#v", item)
	}
	if _, ok := out["meta"].(map[string]any); !ok {
		t.Fatalf("expected meta object, got %#v", out["meta"])
	}
	if len(out["meta"].(map[string]any)) != 0 {
		t.Fatalf("expected empty meta for honest non-cursor search, got %#v", out["meta"])
	}
}

func TestMCPTodosSearchValidationErrorForMalformedInput(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)

	resp, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.search",
		"input": map[string]any{
			"projectSlug": "demo",
			"limit":       0,
		},
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPTodosUpdateSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	userID := firstUserID(t, sqlDB)

	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Update Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Update Project")

	createResp, createOut := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug":      slug,
			"title":            "Original",
			"body":             "Original body",
			"tags":             []string{"mcp"},
			"estimationPoints": 3,
			"assigneeUserId":   userID,
		},
	})
	if createResp.StatusCode != http.StatusOK {
		t.Fatalf("todos.create status=%d", createResp.StatusCode)
	}
	localID := int(createOut["data"].(map[string]any)["todo"].(map[string]any)["localId"].(float64))

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.update",
		"input": map[string]any{
			"projectSlug": slug,
			"localId":     localID,
			"patch": map[string]any{
				"title": "Updated",
				"body":  "Updated body",
			},
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	data := out["data"].(map[string]any)
	todo := data["todo"].(map[string]any)
	if todo["projectSlug"] != slug || todo["localId"] != float64(localID) {
		t.Fatalf("unexpected canonical identity: %#v", todo)
	}
	if todo["title"] != "Updated" || todo["body"] != "Updated body" {
		t.Fatalf("unexpected updated fields: %#v", todo)
	}
	if _, ok := todo["id"]; ok {
		t.Fatalf("did not expect global todo id in MCP todo object: %#v", todo)
	}
}

func TestMCPTodosUpdateOmittedFieldsRemainUnchanged(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)

	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Omit Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Omit Project")

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug":      slug,
			"title":            "Keep title",
			"body":             "Keep body",
			"tags":             []string{"mcp", "backend"},
			"estimationPoints": 5,
		},
	})

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.update",
		"input": map[string]any{
			"projectSlug": slug,
			"localId":     1,
			"patch": map[string]any{
				"body": "Changed only body",
			},
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	todo := out["data"].(map[string]any)["todo"].(map[string]any)
	if todo["title"] != "Keep title" {
		t.Fatalf("expected title unchanged, got %#v", todo["title"])
	}
	if todo["body"] != "Changed only body" {
		t.Fatalf("expected body changed, got %#v", todo["body"])
	}
	tags := todo["tags"].([]any)
	if len(tags) != 2 || tags[0] != "backend" || tags[1] != "mcp" {
		t.Fatalf("expected tags unchanged, got %#v", todo["tags"])
	}
	if todo["estimationPoints"] != float64(5) {
		t.Fatalf("expected estimation unchanged, got %#v", todo["estimationPoints"])
	}
}

func TestMCPTodosUpdateNullClearsSupportedFields(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	userID := firstUserID(t, sqlDB)

	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Clear Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Clear Project")

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug":      slug,
			"title":            "Clear me",
			"estimationPoints": 8,
			"assigneeUserId":   userID,
		},
	})

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.update",
		"input": map[string]any{
			"projectSlug": slug,
			"localId":     1,
			"patch": map[string]any{
				"estimationPoints": nil,
				"assigneeUserId":   nil,
			},
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	todo := out["data"].(map[string]any)["todo"].(map[string]any)
	if todo["estimationPoints"] != nil {
		t.Fatalf("expected estimationPoints cleared, got %#v", todo["estimationPoints"])
	}
	if todo["assigneeUserId"] != nil {
		t.Fatalf("expected assigneeUserId cleared, got %#v", todo["assigneeUserId"])
	}
}

func TestMCPTodosUpdateValidationErrorForMalformedPatch(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Bad Patch Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Bad Patch Project")

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Patch target",
		},
	})

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.update",
		"input": map[string]any{
			"projectSlug": slug,
			"localId":     1,
			"patch": map[string]any{
				"columnKey": "doing",
			},
		},
	})
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPTodosUpdateRejectsInvalidNullField(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Invalid Null Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Invalid Null Project")

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Patch target",
		},
	})

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.update",
		"input": map[string]any{
			"projectSlug": slug,
			"localId":     1,
			"patch": map[string]any{
				"title": nil,
			},
		},
	})
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPTodosUpdateRequiresAuth(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Update Auth Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Update Auth Project")

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Patch me",
		},
	})

	resp2, out := doMCP(t, newStatelessClient(ts), ts.URL+"/mcp", map[string]any{
		"tool": "todos.update",
		"input": map[string]any{
			"projectSlug": slug,
			"localId":     1,
			"patch": map[string]any{
				"title": "No auth",
			},
		},
	})
	if resp2.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "AUTH_REQUIRED" {
		t.Fatalf("expected AUTH_REQUIRED, got %#v", errObj["code"])
	}
}

func TestMCPTodosUpdateCapabilityUnavailableInAnonymousMode(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "anonymous")
	defer cleanup()

	resp, out := doMCP(t, ts.Client(), ts.URL+"/mcp", map[string]any{
		"tool": "todos.update",
		"input": map[string]any{
			"projectSlug": "demo",
			"localId":     1,
			"patch": map[string]any{
				"title": "Nope",
			},
		},
	})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "CAPABILITY_UNAVAILABLE" {
		t.Fatalf("expected CAPABILITY_UNAVAILABLE, got %#v", errObj["code"])
	}
}

func TestMCPTodosDeleteSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Delete Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Delete Project")

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Delete me",
		},
	})

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.delete",
		"input": map[string]any{
			"projectSlug": slug,
			"localId":     1,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	if out["ok"] != true {
		t.Fatalf("expected ok=true, got %#v", out["ok"])
	}
	data := out["data"].(map[string]any)
	if data["status"] != "deleted" {
		t.Fatalf("expected deleted status, got %#v", data["status"])
	}
	if data["projectSlug"] != slug || data["localId"] != float64(1) {
		t.Fatalf("unexpected delete identity echo: %#v", data)
	}
	if _, ok := data["id"]; ok {
		t.Fatalf("did not expect global todo id in delete response: %#v", data)
	}
	if _, ok := out["meta"].(map[string]any); !ok {
		t.Fatalf("expected meta object, got %#v", out["meta"])
	}
}

func TestMCPTodosDeleteNotFound(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Delete Missing Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Delete Missing Project")

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.delete",
		"input": map[string]any{
			"projectSlug": slug,
			"localId":     999,
		},
	})
	if resp2.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "NOT_FOUND" {
		t.Fatalf("expected NOT_FOUND, got %#v", errObj["code"])
	}
}

func TestMCPTodosDeleteRequiresAuth(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Delete Auth Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Delete Auth Project")

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Delete me",
		},
	})

	resp2, out := doMCP(t, newStatelessClient(ts), ts.URL+"/mcp", map[string]any{
		"tool": "todos.delete",
		"input": map[string]any{
			"projectSlug": slug,
			"localId":     1,
		},
	})
	if resp2.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "AUTH_REQUIRED" {
		t.Fatalf("expected AUTH_REQUIRED, got %#v", errObj["code"])
	}
}

func TestMCPTodosDeleteCapabilityUnavailableInAnonymousMode(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "anonymous")
	defer cleanup()

	resp, out := doMCP(t, ts.Client(), ts.URL+"/mcp", map[string]any{
		"tool": "todos.delete",
		"input": map[string]any{
			"projectSlug": "demo",
			"localId":     1,
		},
	})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "CAPABILITY_UNAVAILABLE" {
		t.Fatalf("expected CAPABILITY_UNAVAILABLE, got %#v", errObj["code"])
	}
}

func TestMCPTodosMoveSuccessToAnotherColumn(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Move Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Move Project")

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Move me",
		},
	})

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.move",
		"input": map[string]any{
			"projectSlug": slug,
			"localId":     1,
			"toColumnKey": "in-progress",
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	todo := out["data"].(map[string]any)["todo"].(map[string]any)
	if todo["projectSlug"] != slug || todo["localId"] != float64(1) {
		t.Fatalf("unexpected canonical identity: %#v", todo)
	}
	if todo["columnKey"] != "doing" {
		t.Fatalf("expected normalized columnKey doing, got %#v", todo["columnKey"])
	}
	if _, ok := todo["id"]; ok {
		t.Fatalf("did not expect global todo id in move response: %#v", todo)
	}
	if _, ok := out["meta"].(map[string]any); !ok {
		t.Fatalf("expected meta object, got %#v", out["meta"])
	}
}

func TestMCPTodosMoveSuccessWithAfterLocalId(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Move After Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Move After Project")

	for i := 1; i <= 2; i++ {
		doMCP(t, client, ts.URL+"/mcp", map[string]any{
			"tool": "todos.create",
			"input": map[string]any{
				"projectSlug": slug,
				"title":       "Task",
			},
		})
	}

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool":  "todos.move",
		"input": map[string]any{"projectSlug": slug, "localId": 1, "toColumnKey": "doing"},
	})
	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.move",
		"input": map[string]any{
			"projectSlug":  slug,
			"localId":      2,
			"toColumnKey":  "doing",
			"afterLocalId": 1,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	todo := out["data"].(map[string]any)["todo"].(map[string]any)
	if todo["columnKey"] != "doing" {
		t.Fatalf("expected doing, got %#v", todo["columnKey"])
	}
	got := todoLocalIDsByColumn(t, sqlDB, slug, "doing")
	want := []int64{1, 2}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("unexpected doing order: got=%v want=%v", got, want)
	}
}

func TestMCPTodosMoveSuccessWithBeforeLocalId(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Move Before Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Move Before Project")

	for i := 1; i <= 2; i++ {
		doMCP(t, client, ts.URL+"/mcp", map[string]any{
			"tool": "todos.create",
			"input": map[string]any{
				"projectSlug": slug,
				"title":       "Task",
			},
		})
	}

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool":  "todos.move",
		"input": map[string]any{"projectSlug": slug, "localId": 2, "toColumnKey": "doing"},
	})

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.move",
		"input": map[string]any{
			"projectSlug":   slug,
			"localId":       1,
			"toColumnKey":   "doing",
			"beforeLocalId": 2,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	todo := out["data"].(map[string]any)["todo"].(map[string]any)
	if todo["columnKey"] != "doing" {
		t.Fatalf("expected doing, got %#v", todo["columnKey"])
	}
	got := todoLocalIDsByColumn(t, sqlDB, slug, "doing")
	want := []int64{1, 2}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("unexpected doing order: got=%v want=%v", got, want)
	}
}

func TestMCPTodosMoveValidationErrorWhenBothNeighborsSet(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)

	resp, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.move",
		"input": map[string]any{
			"projectSlug":   "demo",
			"localId":       1,
			"toColumnKey":   "doing",
			"afterLocalId":  2,
			"beforeLocalId": 3,
		},
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPTodosMoveValidationErrorForNonexistentNeighbor(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Move Missing Neighbor Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Move Missing Neighbor Project")

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Task",
		},
	})

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.move",
		"input": map[string]any{
			"projectSlug":  slug,
			"localId":      1,
			"toColumnKey":  "doing",
			"afterLocalId": 999,
		},
	})
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPTodosMoveValidationErrorForWrongColumnNeighbor(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Move Wrong Column Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Move Wrong Column Project")

	for i := 1; i <= 2; i++ {
		doMCP(t, client, ts.URL+"/mcp", map[string]any{
			"tool": "todos.create",
			"input": map[string]any{
				"projectSlug": slug,
				"title":       "Task",
			},
		})
	}
	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool":  "todos.move",
		"input": map[string]any{"projectSlug": slug, "localId": 1, "toColumnKey": "doing"},
	})

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.move",
		"input": map[string]any{
			"projectSlug":  slug,
			"localId":      2,
			"toColumnKey":  "testing",
			"afterLocalId": 1,
		},
	})
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPTodosMoveValidationErrorForAmbiguousAfterPlacement(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Move Ambiguous Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Move Ambiguous Project")

	for i := 1; i <= 3; i++ {
		doMCP(t, client, ts.URL+"/mcp", map[string]any{
			"tool": "todos.create",
			"input": map[string]any{
				"projectSlug": slug,
				"title":       "Task",
			},
		})
	}

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool":  "todos.move",
		"input": map[string]any{"projectSlug": slug, "localId": 1, "toColumnKey": "doing"},
	})
	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool":  "todos.move",
		"input": map[string]any{"projectSlug": slug, "localId": 2, "toColumnKey": "doing"},
	})

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.move",
		"input": map[string]any{
			"projectSlug":  slug,
			"localId":      3,
			"toColumnKey":  "doing",
			"afterLocalId": 1,
		},
	})
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPTodosMoveRequiresAuth(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Todo Move Auth Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Todo Move Auth Project")

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Move me",
		},
	})

	resp2, out := doMCP(t, newStatelessClient(ts), ts.URL+"/mcp", map[string]any{
		"tool": "todos.move",
		"input": map[string]any{
			"projectSlug": slug,
			"localId":     1,
			"toColumnKey": "doing",
		},
	})
	if resp2.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "AUTH_REQUIRED" {
		t.Fatalf("expected AUTH_REQUIRED, got %#v", errObj["code"])
	}
}

func TestMCPTodosMoveCapabilityUnavailableInAnonymousMode(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "anonymous")
	defer cleanup()

	resp, out := doMCP(t, ts.Client(), ts.URL+"/mcp", map[string]any{
		"tool": "todos.move",
		"input": map[string]any{
			"projectSlug": "demo",
			"localId":     1,
			"toColumnKey": "doing",
		},
	})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "CAPABILITY_UNAVAILABLE" {
		t.Fatalf("expected CAPABILITY_UNAVAILABLE, got %#v", errObj["code"])
	}
}

func TestMCPSprintsListSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint List Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint List Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	sp1, err := st.CreateSprint(context.Background(), projectID, "Sprint 1", time.UnixMilli(1000), time.UnixMilli(2000))
	if err != nil {
		t.Fatalf("create sprint 1: %v", err)
	}
	if _, err := st.CreateSprint(context.Background(), projectID, "Sprint 2", time.UnixMilli(3000), time.UnixMilli(4000)); err != nil {
		t.Fatalf("create sprint 2: %v", err)
	}

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Backlog todo",
		},
	})
	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Sprint todo",
			"sprintId":    sp1.ID,
		},
	})

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.list",
		"input": map[string]any{
			"projectSlug": slug,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	data := out["data"].(map[string]any)
	items := data["items"].([]any)
	if len(items) != 2 {
		t.Fatalf("expected 2 sprints, got %#v", items)
	}
	first := items[0].(map[string]any)
	if first["projectSlug"] != slug || first["sprintId"] == nil {
		t.Fatalf("unexpected canonical sprint identity: %#v", first)
	}
	meta := out["meta"].(map[string]any)
	if meta["unscheduledCount"] != float64(1) {
		t.Fatalf("expected unscheduledCount=1, got %#v", meta["unscheduledCount"])
	}
}

func TestMCPSprintsGetSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Get Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Get Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	sp, err := st.CreateSprint(context.Background(), projectID, "Sprint 1", time.UnixMilli(1000), time.UnixMilli(2000))
	if err != nil {
		t.Fatalf("create sprint: %v", err)
	}

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.get",
		"input": map[string]any{
			"projectSlug": slug,
			"sprintId":    sp.ID,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	sprint := out["data"].(map[string]any)["sprint"].(map[string]any)
	if sprint["projectSlug"] != slug || sprint["sprintId"] != float64(sp.ID) {
		t.Fatalf("unexpected canonical sprint identity: %#v", sprint)
	}
}

func TestMCPSprintsGetActiveSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Active Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Active Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	sp, err := st.CreateSprint(context.Background(), projectID, "Active Sprint", time.Now().Add(24*time.Hour), time.Now().Add(48*time.Hour))
	if err != nil {
		t.Fatalf("create sprint: %v", err)
	}
	if err := st.ActivateSprint(context.Background(), projectID, sp.ID); err != nil {
		t.Fatalf("activate sprint: %v", err)
	}

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.getActive",
		"input": map[string]any{
			"projectSlug": slug,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	sprint := out["data"].(map[string]any)["sprint"].(map[string]any)
	if sprint["projectSlug"] != slug || sprint["sprintId"] != float64(sp.ID) {
		t.Fatalf("unexpected active sprint identity: %#v", sprint)
	}
}

func TestMCPSprintsGetActiveNoActiveSprintReturnsNull(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint No Active Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint No Active Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	if _, err := st.CreateSprint(context.Background(), projectID, "Planned Sprint", time.UnixMilli(1000), time.UnixMilli(2000)); err != nil {
		t.Fatalf("create sprint: %v", err)
	}

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.getActive",
		"input": map[string]any{
			"projectSlug": slug,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	if out["data"].(map[string]any)["sprint"] != nil {
		t.Fatalf("expected sprint null, got %#v", out["data"])
	}
}

func TestMCPSprintsAuthFailure(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Auth Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Auth Project")

	resp2, out := doMCP(t, newStatelessClient(ts), ts.URL+"/mcp", map[string]any{
		"tool": "sprints.list",
		"input": map[string]any{
			"projectSlug": slug,
		},
	})
	if resp2.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "AUTH_REQUIRED" {
		t.Fatalf("expected AUTH_REQUIRED, got %#v", errObj["code"])
	}
}

func TestMCPSprintsCapabilityUnavailableInAnonymousMode(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "anonymous")
	defer cleanup()

	resp, out := doMCP(t, ts.Client(), ts.URL+"/mcp", map[string]any{
		"tool": "sprints.list",
		"input": map[string]any{
			"projectSlug": "demo",
		},
	})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "CAPABILITY_UNAVAILABLE" {
		t.Fatalf("expected CAPABILITY_UNAVAILABLE, got %#v", errObj["code"])
	}
}

func TestMCPSprintsCreateSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Create Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Create Project")

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.create",
		"input": map[string]any{
			"projectSlug":    slug,
			"name":           "Sprint 1",
			"plannedStartAt": "2026-04-01T00:00:00Z",
			"plannedEndAt":   "2026-04-14T23:59:59Z",
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	sprint := out["data"].(map[string]any)["sprint"].(map[string]any)
	if sprint["projectSlug"] != slug || sprint["sprintId"] == nil {
		t.Fatalf("unexpected sprint identity: %#v", sprint)
	}
	if sprint["name"] != "Sprint 1" {
		t.Fatalf("expected sprint name, got %#v", sprint["name"])
	}
	if _, ok := out["meta"].(map[string]any); !ok {
		t.Fatalf("expected meta object, got %#v", out["meta"])
	}
}

func TestMCPSprintsCreateValidationErrorForMalformedInput(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Bad Input Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Bad Input Project")

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.create",
		"input": map[string]any{
			"projectSlug":    slug,
			"name":           "Sprint 1",
			"plannedStartAt": "not-a-time",
			"plannedEndAt":   "2026-04-14T23:59:59Z",
		},
	})
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPSprintsCreateValidationErrorForInvalidDateRange(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Bad Range Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Bad Range Project")

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.create",
		"input": map[string]any{
			"projectSlug":    slug,
			"name":           "Sprint 1",
			"plannedStartAt": "2026-04-14T23:59:59Z",
			"plannedEndAt":   "2026-04-01T00:00:00Z",
		},
	})
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPSprintsCreateAuthFailure(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Create Auth Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Create Auth Project")

	resp2, out := doMCP(t, newStatelessClient(ts), ts.URL+"/mcp", map[string]any{
		"tool": "sprints.create",
		"input": map[string]any{
			"projectSlug":    slug,
			"name":           "Sprint 1",
			"plannedStartAt": "2026-04-01T00:00:00Z",
			"plannedEndAt":   "2026-04-14T23:59:59Z",
		},
	})
	if resp2.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "AUTH_REQUIRED" {
		t.Fatalf("expected AUTH_REQUIRED, got %#v", errObj["code"])
	}
}

func TestMCPSprintsCreateCapabilityUnavailableInAnonymousMode(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "anonymous")
	defer cleanup()

	resp, out := doMCP(t, ts.Client(), ts.URL+"/mcp", map[string]any{
		"tool": "sprints.create",
		"input": map[string]any{
			"projectSlug":    "demo",
			"name":           "Sprint 1",
			"plannedStartAt": "2026-04-01T00:00:00Z",
			"plannedEndAt":   "2026-04-14T23:59:59Z",
		},
	})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "CAPABILITY_UNAVAILABLE" {
		t.Fatalf("expected CAPABILITY_UNAVAILABLE, got %#v", errObj["code"])
	}
}

func TestMCPSprintsActivateSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Activate Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Activate Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	sp, err := st.CreateSprint(context.Background(), projectID, "Planned Sprint", time.Now().Add(24*time.Hour), time.Now().Add(48*time.Hour))
	if err != nil {
		t.Fatalf("create sprint: %v", err)
	}

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.activate",
		"input": map[string]any{
			"projectSlug": slug,
			"sprintId":    sp.ID,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	sprint := out["data"].(map[string]any)["sprint"].(map[string]any)
	if sprint["projectSlug"] != slug || sprint["sprintId"] != float64(sp.ID) {
		t.Fatalf("unexpected sprint identity: %#v", sprint)
	}
	if sprint["state"] != "ACTIVE" {
		t.Fatalf("expected ACTIVE, got %#v", sprint["state"])
	}
}

func TestMCPSprintsCloseSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Close Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Close Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	sp, err := st.CreateSprint(context.Background(), projectID, "Sprint", time.Now().Add(24*time.Hour), time.Now().Add(48*time.Hour))
	if err != nil {
		t.Fatalf("create sprint: %v", err)
	}
	if err := st.ActivateSprint(context.Background(), projectID, sp.ID); err != nil {
		t.Fatalf("activate sprint: %v", err)
	}

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.close",
		"input": map[string]any{
			"projectSlug": slug,
			"sprintId":    sp.ID,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	sprint := out["data"].(map[string]any)["sprint"].(map[string]any)
	if sprint["state"] != "CLOSED" {
		t.Fatalf("expected CLOSED, got %#v", sprint["state"])
	}
}

func TestMCPSprintsActivateValidationErrorFromWrongState(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Activate Wrong State Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Activate Wrong State Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	sp, err := st.CreateSprint(context.Background(), projectID, "Sprint", time.Now().Add(24*time.Hour), time.Now().Add(48*time.Hour))
	if err != nil {
		t.Fatalf("create sprint: %v", err)
	}
	if err := st.ActivateSprint(context.Background(), projectID, sp.ID); err != nil {
		t.Fatalf("activate sprint: %v", err)
	}

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.activate",
		"input": map[string]any{
			"projectSlug": slug,
			"sprintId":    sp.ID,
		},
	})
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPSprintsCloseValidationErrorFromWrongState(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Close Wrong State Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Close Wrong State Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	sp, err := st.CreateSprint(context.Background(), projectID, "Sprint", time.Now().Add(24*time.Hour), time.Now().Add(48*time.Hour))
	if err != nil {
		t.Fatalf("create sprint: %v", err)
	}

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.close",
		"input": map[string]any{
			"projectSlug": slug,
			"sprintId":    sp.ID,
		},
	})
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPSprintActionsAuthFailure(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Action Auth Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Action Auth Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	sp, err := st.CreateSprint(context.Background(), projectID, "Sprint", time.Now().Add(24*time.Hour), time.Now().Add(48*time.Hour))
	if err != nil {
		t.Fatalf("create sprint: %v", err)
	}

	resp2, out := doMCP(t, newStatelessClient(ts), ts.URL+"/mcp", map[string]any{
		"tool": "sprints.activate",
		"input": map[string]any{
			"projectSlug": slug,
			"sprintId":    sp.ID,
		},
	})
	if resp2.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "AUTH_REQUIRED" {
		t.Fatalf("expected AUTH_REQUIRED, got %#v", errObj["code"])
	}
}

func TestMCPSprintActionsCapabilityUnavailableInAnonymousMode(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "anonymous")
	defer cleanup()

	resp, out := doMCP(t, ts.Client(), ts.URL+"/mcp", map[string]any{
		"tool": "sprints.activate",
		"input": map[string]any{
			"projectSlug": "demo",
			"sprintId":    1,
		},
	})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "CAPABILITY_UNAVAILABLE" {
		t.Fatalf("expected CAPABILITY_UNAVAILABLE, got %#v", errObj["code"])
	}
}

func TestMCPSprintsUpdateSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Update Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Update Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	sp, err := st.CreateSprint(context.Background(), projectID, "Sprint 1", time.UnixMilli(1000), time.UnixMilli(2000))
	if err != nil {
		t.Fatalf("create sprint: %v", err)
	}

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.update",
		"input": map[string]any{
			"projectSlug": slug,
			"sprintId":    sp.ID,
			"patch": map[string]any{
				"name":           "Sprint 1 revised",
				"plannedStartAt": 3000,
				"plannedEndAt":   4000,
			},
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	sprint := out["data"].(map[string]any)["sprint"].(map[string]any)
	if sprint["projectSlug"] != slug || sprint["sprintId"] != float64(sp.ID) {
		t.Fatalf("unexpected sprint identity: %#v", sprint)
	}
	if sprint["name"] != "Sprint 1 revised" {
		t.Fatalf("expected updated name, got %#v", sprint["name"])
	}
	if sprint["plannedStartAt"] != float64(3000) || sprint["plannedEndAt"] != float64(4000) {
		t.Fatalf("expected updated dates, got %#v", sprint)
	}
}

func TestMCPSprintsUpdateOmissionLeavesFieldsUnchanged(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Omit Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Omit Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	sp, err := st.CreateSprint(context.Background(), projectID, "Sprint 1", time.UnixMilli(1000), time.UnixMilli(2000))
	if err != nil {
		t.Fatalf("create sprint: %v", err)
	}

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.update",
		"input": map[string]any{
			"projectSlug": slug,
			"sprintId":    sp.ID,
			"patch": map[string]any{
				"name": "Sprint renamed",
			},
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	sprint := out["data"].(map[string]any)["sprint"].(map[string]any)
	if sprint["name"] != "Sprint renamed" {
		t.Fatalf("expected updated name, got %#v", sprint["name"])
	}
	if sprint["plannedStartAt"] != float64(1000) || sprint["plannedEndAt"] != float64(2000) {
		t.Fatalf("expected dates unchanged, got %#v", sprint)
	}
}

func TestMCPSprintsUpdateValidationErrorForStateFieldCombo(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint State Update Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint State Update Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	sp, err := st.CreateSprint(context.Background(), projectID, "Sprint 1", time.Now().Add(24*time.Hour), time.Now().Add(48*time.Hour))
	if err != nil {
		t.Fatalf("create sprint: %v", err)
	}
	if err := st.ActivateSprint(context.Background(), projectID, sp.ID); err != nil {
		t.Fatalf("activate sprint: %v", err)
	}

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.update",
		"input": map[string]any{
			"projectSlug": slug,
			"sprintId":    sp.ID,
			"patch": map[string]any{
				"name": "Nope",
			},
		},
	})
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPSprintsUpdateMalformedTimestampValidation(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Bad Timestamp Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Bad Timestamp Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	sp, err := st.CreateSprint(context.Background(), projectID, "Sprint 1", time.UnixMilli(1000), time.UnixMilli(2000))
	if err != nil {
		t.Fatalf("create sprint: %v", err)
	}

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.update",
		"input": map[string]any{
			"projectSlug": slug,
			"sprintId":    sp.ID,
			"patch": map[string]any{
				"plannedStartAt": "not-a-number",
			},
		},
	})
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPSprintsUpdateInvalidDateRangeValidation(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Bad Update Range Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Bad Update Range Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	sp, err := st.CreateSprint(context.Background(), projectID, "Sprint 1", time.UnixMilli(1000), time.UnixMilli(2000))
	if err != nil {
		t.Fatalf("create sprint: %v", err)
	}

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.update",
		"input": map[string]any{
			"projectSlug": slug,
			"sprintId":    sp.ID,
			"patch": map[string]any{
				"plannedStartAt": 3000,
				"plannedEndAt":   2000,
			},
		},
	})
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPSprintsUpdateAuthFailure(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Update Auth Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Update Auth Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	sp, err := st.CreateSprint(context.Background(), projectID, "Sprint 1", time.UnixMilli(1000), time.UnixMilli(2000))
	if err != nil {
		t.Fatalf("create sprint: %v", err)
	}

	resp2, out := doMCP(t, newStatelessClient(ts), ts.URL+"/mcp", map[string]any{
		"tool": "sprints.update",
		"input": map[string]any{
			"projectSlug": slug,
			"sprintId":    sp.ID,
			"patch": map[string]any{
				"name": "No auth",
			},
		},
	})
	if resp2.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "AUTH_REQUIRED" {
		t.Fatalf("expected AUTH_REQUIRED, got %#v", errObj["code"])
	}
}

func TestMCPSprintsUpdateCapabilityUnavailableInAnonymousMode(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "anonymous")
	defer cleanup()

	resp, out := doMCP(t, ts.Client(), ts.URL+"/mcp", map[string]any{
		"tool": "sprints.update",
		"input": map[string]any{
			"projectSlug": "demo",
			"sprintId":    1,
			"patch": map[string]any{
				"name": "Nope",
			},
		},
	})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "CAPABILITY_UNAVAILABLE" {
		t.Fatalf("expected CAPABILITY_UNAVAILABLE, got %#v", errObj["code"])
	}
}

func TestMCPSprintsDeleteSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Delete Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Delete Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	sp, err := st.CreateSprint(context.Background(), projectID, "Sprint 1", time.UnixMilli(1000), time.UnixMilli(2000))
	if err != nil {
		t.Fatalf("create sprint: %v", err)
	}

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.delete",
		"input": map[string]any{
			"projectSlug": slug,
			"sprintId":    sp.ID,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	if out["ok"] != true {
		t.Fatalf("expected ok=true, got %#v", out["ok"])
	}
	data := out["data"].(map[string]any)
	if data["status"] != "deleted" {
		t.Fatalf("expected deleted status, got %#v", data["status"])
	}
	if data["projectSlug"] != slug || data["sprintId"] != float64(sp.ID) {
		t.Fatalf("unexpected delete identity echo: %#v", data)
	}
	if _, ok := out["meta"].(map[string]any); !ok {
		t.Fatalf("expected meta object, got %#v", out["meta"])
	}
}

func TestMCPSprintsDeleteNotFound(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Delete Missing Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Delete Missing Project")

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "sprints.delete",
		"input": map[string]any{
			"projectSlug": slug,
			"sprintId":    999,
		},
	})
	if resp2.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "NOT_FOUND" {
		t.Fatalf("expected NOT_FOUND, got %#v", errObj["code"])
	}
}

func TestMCPSprintsDeleteAuthFailure(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Sprint Delete Auth Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Sprint Delete Auth Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	sp, err := st.CreateSprint(context.Background(), projectID, "Sprint 1", time.UnixMilli(1000), time.UnixMilli(2000))
	if err != nil {
		t.Fatalf("create sprint: %v", err)
	}

	resp2, out := doMCP(t, newStatelessClient(ts), ts.URL+"/mcp", map[string]any{
		"tool": "sprints.delete",
		"input": map[string]any{
			"projectSlug": slug,
			"sprintId":    sp.ID,
		},
	})
	if resp2.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "AUTH_REQUIRED" {
		t.Fatalf("expected AUTH_REQUIRED, got %#v", errObj["code"])
	}
}

func TestMCPSprintsDeleteCapabilityUnavailableInAnonymousMode(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "anonymous")
	defer cleanup()

	resp, out := doMCP(t, ts.Client(), ts.URL+"/mcp", map[string]any{
		"tool": "sprints.delete",
		"input": map[string]any{
			"projectSlug": "demo",
			"sprintId":    1,
		},
	})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "CAPABILITY_UNAVAILABLE" {
		t.Fatalf("expected CAPABILITY_UNAVAILABLE, got %#v", errObj["code"])
	}
}

func TestMCPTagsListProjectSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Tag Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Tag Project")

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Tagged todo",
			"tags":        []string{"mcp"},
		},
	})

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "tags.listProject",
		"input": map[string]any{
			"projectSlug": slug,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	items := out["data"].(map[string]any)["items"].([]any)
	if len(items) == 0 {
		t.Fatalf("expected project tags, got %#v", items)
	}
	tag := items[0].(map[string]any)
	if tag["tagId"] == nil || tag["name"] != "mcp" {
		t.Fatalf("unexpected project tag shape: %#v", tag)
	}
	if tag["count"] != float64(1) {
		t.Fatalf("expected count 1, got %#v", tag["count"])
	}
	if _, ok := out["meta"].(map[string]any); !ok {
		t.Fatalf("expected meta object, got %#v", out["meta"])
	}
}

func TestMCPTagsListMineSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Tag Mine Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Tag Mine Project")

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Tagged todo",
			"tags":        []string{"backend", "mcp"},
		},
	})

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool":  "tags.listMine",
		"input": map[string]any{},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	items := out["data"].(map[string]any)["items"].([]any)
	if len(items) < 2 {
		t.Fatalf("expected mine tags, got %#v", items)
	}
	tag := items[0].(map[string]any)
	if tag["tagId"] == nil || tag["name"] == nil {
		t.Fatalf("unexpected mine tag shape: %#v", tag)
	}
	if _, hasCount := tag["count"]; hasCount {
		t.Fatalf("did not expect count in tags.listMine shape: %#v", tag)
	}
}

func TestMCPTagsAuthFailure(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Tag Auth Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Tag Auth Project")

	resp2, out := doMCP(t, newStatelessClient(ts), ts.URL+"/mcp", map[string]any{
		"tool": "tags.listProject",
		"input": map[string]any{
			"projectSlug": slug,
		},
	})
	if resp2.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "AUTH_REQUIRED" {
		t.Fatalf("expected AUTH_REQUIRED, got %#v", errObj["code"])
	}
}

func TestMCPTagsCapabilityUnavailableInAnonymousMode(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "anonymous")
	defer cleanup()

	resp, out := doMCP(t, ts.Client(), ts.URL+"/mcp", map[string]any{
		"tool":  "tags.listMine",
		"input": map[string]any{},
	})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "CAPABILITY_UNAVAILABLE" {
		t.Fatalf("expected CAPABILITY_UNAVAILABLE, got %#v", errObj["code"])
	}
}

func TestMCPTagsUpdateMineColorSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Tag Color Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Tag Color Project")

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Tagged todo",
			"tags":        []string{"backend"},
		},
	})

	_, mine := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool":  "tags.listMine",
		"input": map[string]any{},
	})
	tagID := mine["data"].(map[string]any)["items"].([]any)[0].(map[string]any)["tagId"]

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "tags.updateMineColor",
		"input": map[string]any{
			"tagId": tagID,
			"color": "#7c3aed",
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	tag := out["data"].(map[string]any)["tag"].(map[string]any)
	if tag["tagId"] != tagID || tag["name"] != "backend" {
		t.Fatalf("unexpected tag response: %#v", tag)
	}
	if tag["color"] != "#7c3aed" {
		t.Fatalf("expected updated color, got %#v", tag["color"])
	}
}

func TestMCPTagsUpdateMineColorClearSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Tag Clear Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Tag Clear Project")

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Tagged todo",
			"tags":        []string{"backend"},
		},
	})

	_, mine := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool":  "tags.listMine",
		"input": map[string]any{},
	})
	tagID := mine["data"].(map[string]any)["items"].([]any)[0].(map[string]any)["tagId"]

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "tags.updateMineColor",
		"input": map[string]any{
			"tagId": tagID,
			"color": "#7c3aed",
		},
	})

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "tags.updateMineColor",
		"input": map[string]any{
			"tagId": tagID,
			"color": nil,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	tag := out["data"].(map[string]any)["tag"].(map[string]any)
	if tag["color"] != nil {
		t.Fatalf("expected cleared color, got %#v", tag["color"])
	}
}

func TestMCPTagsUpdateMineColorMalformedColorValidation(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Tag Bad Color Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Tag Bad Color Project")

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Tagged todo",
			"tags":        []string{"backend"},
		},
	})

	_, mine := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool":  "tags.listMine",
		"input": map[string]any{},
	})
	tagID := mine["data"].(map[string]any)["items"].([]any)[0].(map[string]any)["tagId"]

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "tags.updateMineColor",
		"input": map[string]any{
			"tagId": tagID,
			"color": "purple",
		},
	})
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPTagsUpdateMineColorRejectsEmptyStringClear(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Tag Empty Clear Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Tag Empty Clear Project")

	doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "todos.create",
		"input": map[string]any{
			"projectSlug": slug,
			"title":       "Tagged todo",
			"tags":        []string{"backend"},
		},
	})

	_, mine := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool":  "tags.listMine",
		"input": map[string]any{},
	})
	tagID := mine["data"].(map[string]any)["items"].([]any)[0].(map[string]any)["tagId"]

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "tags.updateMineColor",
		"input": map[string]any{
			"tagId": tagID,
			"color": "",
		},
	})
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPTagsUpdateMineColorMalformedInputValidation(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)

	resp, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "tags.updateMineColor",
		"input": map[string]any{
			"tagId":        1,
			"color":        "#7c3aed",
			"unknownField": true,
		},
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPTagsUpdateMineColorAuthFailure(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)

	resp, out := doMCP(t, newStatelessClient(ts), ts.URL+"/mcp", map[string]any{
		"tool": "tags.updateMineColor",
		"input": map[string]any{
			"tagId": 1,
			"color": "#7c3aed",
		},
	})
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "AUTH_REQUIRED" {
		t.Fatalf("expected AUTH_REQUIRED, got %#v", errObj["code"])
	}
}

func TestMCPTagsUpdateMineColorCapabilityUnavailableInAnonymousMode(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "anonymous")
	defer cleanup()

	resp, out := doMCP(t, ts.Client(), ts.URL+"/mcp", map[string]any{
		"tool": "tags.updateMineColor",
		"input": map[string]any{
			"tagId": 1,
			"color": "#7c3aed",
		},
	})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "CAPABILITY_UNAVAILABLE" {
		t.Fatalf("expected CAPABILITY_UNAVAILABLE, got %#v", errObj["code"])
	}
}

func TestMCPTagsUpdateProjectColorSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Project Tag Color Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Project Tag Color Project")
	projectID := projectIDBySlug(t, sqlDB, slug)
	tagID := insertProjectScopedTag(t, sqlDB, projectID, "backend", nil)

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "tags.updateProjectColor",
		"input": map[string]any{
			"projectSlug": slug,
			"tagId":       tagID,
			"color":       "#7c3aed",
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	tag := out["data"].(map[string]any)["tag"].(map[string]any)
	if tag["tagId"] != float64(tagID) || tag["name"] != "backend" {
		t.Fatalf("unexpected tag response: %#v", tag)
	}
	if tag["color"] != "#7c3aed" {
		t.Fatalf("expected updated color, got %#v", tag["color"])
	}
	if _, ok := out["meta"].(map[string]any); !ok {
		t.Fatalf("expected meta object, got %#v", out["meta"])
	}
}

// TestMCPTagsUpdateProjectColorVisibleToOtherMemberViaListProject checks that a project-scoped
// color change is stored on the shared tag row (tags.color), not as a per-viewer preference:
// a different project member sees the same color via tags.listProject / ListTagCounts.
// The maintainer updates color before adding the viewer so the write path is unambiguously the owner session.
func TestMCPTagsUpdateProjectColorVisibleToOtherMemberViaListProject(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	ownerClient := newCookieClient(t, ts)
	bootstrapUser(t, ownerClient, ts.URL)
	ownerID := firstUserID(t, sqlDB)
	resp := doJSON(t, ownerClient, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Project Tag Shared Color",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Project Tag Shared Color")
	projectID := projectIDBySlug(t, sqlDB, slug)
	tagID := insertProjectScopedTag(t, sqlDB, projectID, "backend", nil)

	wantColor := "#aabbcc"
	resp2, _ := doMCP(t, ownerClient, ts.URL+"/mcp", map[string]any{
		"tool": "tags.updateProjectColor",
		"input": map[string]any{
			"projectSlug": slug,
			"tagId":       tagID,
			"color":       wantColor,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("update project color status=%d", resp2.StatusCode)
	}

	st := store.New(sqlDB, nil)
	viewer, err := st.CreateUser(context.Background(), "viewer2@example.com", "password123", "Viewer2")
	if err != nil {
		t.Fatalf("create viewer: %v", err)
	}
	if err := st.AddProjectMember(context.Background(), ownerID, projectID, viewer.ID, store.RoleViewer); err != nil {
		t.Fatalf("add viewer membership: %v", err)
	}
	viewerClient := newSessionClientForUser(t, ts, st, viewer.ID)

	resp3, listOut := doMCP(t, viewerClient, ts.URL+"/mcp", map[string]any{
		"tool": "tags.listProject",
		"input": map[string]any{
			"projectSlug": slug,
		},
	})
	if resp3.StatusCode != http.StatusOK {
		t.Fatalf("tags.listProject status=%d", resp3.StatusCode)
	}
	items := listOut["data"].(map[string]any)["items"].([]any)
	var found bool
	for _, it := range items {
		m := it.(map[string]any)
		if int64(m["tagId"].(float64)) != tagID {
			continue
		}
		found = true
		if m["color"] != wantColor {
			t.Fatalf("viewer expected shared project color %q, got %#v", wantColor, m["color"])
		}
	}
	if !found {
		t.Fatalf("tag %d not in listProject items: %#v", tagID, items)
	}
}

func TestMCPTagsUpdateProjectColorPermissionFailure(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	ownerClient := newCookieClient(t, ts)
	bootstrapUser(t, ownerClient, ts.URL)
	ownerID := firstUserID(t, sqlDB)
	resp := doJSON(t, ownerClient, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Project Tag Permission Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Project Tag Permission Project")
	projectID := projectIDBySlug(t, sqlDB, slug)
	tagID := insertProjectScopedTag(t, sqlDB, projectID, "backend", nil)

	st := store.New(sqlDB, nil)
	viewer, err := st.CreateUser(context.Background(), "viewer@example.com", "password123", "Viewer")
	if err != nil {
		t.Fatalf("create viewer: %v", err)
	}
	if err := st.AddProjectMember(context.Background(), ownerID, projectID, viewer.ID, store.RoleViewer); err != nil {
		t.Fatalf("add viewer membership: %v", err)
	}
	viewerClient := newSessionClientForUser(t, ts, st, viewer.ID)

	resp2, out := doMCP(t, viewerClient, ts.URL+"/mcp", map[string]any{
		"tool": "tags.updateProjectColor",
		"input": map[string]any{
			"projectSlug": slug,
			"tagId":       tagID,
			"color":       "#7c3aed",
		},
	})
	if resp2.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "FORBIDDEN" {
		t.Fatalf("expected FORBIDDEN, got %#v", errObj["code"])
	}
}

func TestMCPTagsUpdateProjectColorWrongProjectNotFound(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Project Tag First",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	resp = doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Project Tag Second",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create second project status=%d", resp.StatusCode)
	}
	firstSlug := projectSlugByName(t, sqlDB, "Project Tag First")
	secondSlug := projectSlugByName(t, sqlDB, "Project Tag Second")
	secondProjectID := projectIDBySlug(t, sqlDB, secondSlug)
	tagID := insertProjectScopedTag(t, sqlDB, secondProjectID, "backend", nil)

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "tags.updateProjectColor",
		"input": map[string]any{
			"projectSlug": firstSlug,
			"tagId":       tagID,
			"color":       "#7c3aed",
		},
	})
	if resp2.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "NOT_FOUND" {
		t.Fatalf("expected NOT_FOUND, got %#v", errObj["code"])
	}
}

func TestMCPTagsUpdateProjectColorMalformedColorValidation(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Project Tag Bad Color",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Project Tag Bad Color")
	projectID := projectIDBySlug(t, sqlDB, slug)
	tagID := insertProjectScopedTag(t, sqlDB, projectID, "backend", nil)

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "tags.updateProjectColor",
		"input": map[string]any{
			"projectSlug": slug,
			"tagId":       tagID,
			"color":       "purple",
		},
	})
	if resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}

func TestMCPTagsUpdateProjectColorClearSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	initialColor := "#7c3aed"
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Project Tag Clear",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Project Tag Clear")
	projectID := projectIDBySlug(t, sqlDB, slug)
	tagID := insertProjectScopedTag(t, sqlDB, projectID, "backend", &initialColor)

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "tags.updateProjectColor",
		"input": map[string]any{
			"projectSlug": slug,
			"tagId":       tagID,
			"color":       nil,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	tag := out["data"].(map[string]any)["tag"].(map[string]any)
	if tag["color"] != nil {
		t.Fatalf("expected cleared project color, got %#v", tag["color"])
	}
}

func TestMCPTagsUpdateProjectColorAuthFailure(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Project Tag Auth Failure",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Project Tag Auth Failure")
	projectID := projectIDBySlug(t, sqlDB, slug)
	tagID := insertProjectScopedTag(t, sqlDB, projectID, "backend", nil)

	resp, out := doMCP(t, newStatelessClient(ts), ts.URL+"/mcp", map[string]any{
		"tool": "tags.updateProjectColor",
		"input": map[string]any{
			"projectSlug": slug,
			"tagId":       tagID,
			"color":       "#7c3aed",
		},
	})
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "AUTH_REQUIRED" {
		t.Fatalf("expected AUTH_REQUIRED, got %#v", errObj["code"])
	}
}

func TestMCPTagsUpdateProjectColorCapabilityUnavailableInAnonymousMode(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "anonymous")
	defer cleanup()

	resp, out := doMCP(t, ts.Client(), ts.URL+"/mcp", map[string]any{
		"tool": "tags.updateProjectColor",
		"input": map[string]any{
			"projectSlug": "demo",
			"tagId":       1,
			"color":       "#7c3aed",
		},
	})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "CAPABILITY_UNAVAILABLE" {
		t.Fatalf("expected CAPABILITY_UNAVAILABLE, got %#v", errObj["code"])
	}
}

func TestMCPMembersListSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Members List Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Members List Project")
	ownerID := firstUserID(t, sqlDB)

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "members.list",
		"input": map[string]any{
			"projectSlug": slug,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	data := out["data"].(map[string]any)
	items := data["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("expected one member, got %d", len(items))
	}
	m := items[0].(map[string]any)
	if m["projectSlug"] != slug {
		t.Fatalf("projectSlug: %#v", m["projectSlug"])
	}
	if int64(m["userId"].(float64)) != ownerID {
		t.Fatalf("userId: %#v", m["userId"])
	}
	if m["email"] != "owner@example.com" {
		t.Fatalf("email: %#v", m["email"])
	}
	if m["role"] != "maintainer" {
		t.Fatalf("role: %#v", m["role"])
	}
	if _, ok := out["meta"].(map[string]any); !ok {
		t.Fatalf("expected meta object, got %#v", out["meta"])
	}
}

func TestMCPMembersListAvailableSuccess(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Members Avail Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Members Avail Project")

	st := store.New(sqlDB, nil)
	other, err := st.CreateUser(context.Background(), "other@example.com", "password123", "Other")
	if err != nil {
		t.Fatalf("create user: %v", err)
	}

	resp2, out := doMCP(t, client, ts.URL+"/mcp", map[string]any{
		"tool": "members.listAvailable",
		"input": map[string]any{
			"projectSlug": slug,
		},
	})
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	items := out["data"].(map[string]any)["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("expected one available user, got %d", len(items))
	}
	u := items[0].(map[string]any)
	if int64(u["userId"].(float64)) != other.ID {
		t.Fatalf("userId: %#v", u["userId"])
	}
	if u["email"] != "other@example.com" {
		t.Fatalf("email: %#v", u["email"])
	}
}

func TestMCPMembersListAuthFailure(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	client := newCookieClient(t, ts)
	bootstrapUser(t, client, ts.URL)
	resp := doJSON(t, client, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Members Auth Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Members Auth Project")

	resp2, out := doMCP(t, newStatelessClient(ts), ts.URL+"/mcp", map[string]any{
		"tool": "members.list",
		"input": map[string]any{
			"projectSlug": slug,
		},
	})
	if resp2.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "AUTH_REQUIRED" {
		t.Fatalf("expected AUTH_REQUIRED, got %#v", errObj["code"])
	}
}

func TestMCPMembersListCapabilityUnavailableInAnonymousMode(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "anonymous")
	defer cleanup()

	resp, out := doMCP(t, ts.Client(), ts.URL+"/mcp", map[string]any{
		"tool": "members.list",
		"input": map[string]any{
			"projectSlug": "demo",
		},
	})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "CAPABILITY_UNAVAILABLE" {
		t.Fatalf("expected CAPABILITY_UNAVAILABLE, got %#v", errObj["code"])
	}
}

func TestMCPMembersListAvailableCapabilityUnavailableInAnonymousMode(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "anonymous")
	defer cleanup()

	resp, out := doMCP(t, ts.Client(), ts.URL+"/mcp", map[string]any{
		"tool": "members.listAvailable",
		"input": map[string]any{
			"projectSlug": "demo",
		},
	})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "CAPABILITY_UNAVAILABLE" {
		t.Fatalf("expected CAPABILITY_UNAVAILABLE, got %#v", errObj["code"])
	}
}

func TestMCPMembersListAvailablePermissionFailure(t *testing.T) {
	ts, sqlDB, cleanup := newTestServer(t, "full")
	defer cleanup()

	ownerClient := newCookieClient(t, ts)
	bootstrapUser(t, ownerClient, ts.URL)
	ownerID := firstUserID(t, sqlDB)
	resp := doJSON(t, ownerClient, http.MethodPost, ts.URL+"/api/projects", map[string]any{
		"name": "Members Perm Project",
	}, &map[string]any{})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create project status=%d", resp.StatusCode)
	}
	slug := projectSlugByName(t, sqlDB, "Members Perm Project")
	projectID := projectIDBySlug(t, sqlDB, slug)

	st := store.New(sqlDB, nil)
	viewer, err := st.CreateUser(context.Background(), "vmem@example.com", "password123", "V")
	if err != nil {
		t.Fatalf("create viewer: %v", err)
	}
	if err := st.AddProjectMember(context.Background(), ownerID, projectID, viewer.ID, store.RoleViewer); err != nil {
		t.Fatalf("add viewer: %v", err)
	}
	viewerClient := newSessionClientForUser(t, ts, st, viewer.ID)

	resp2, out := doMCP(t, viewerClient, ts.URL+"/mcp", map[string]any{
		"tool": "members.listAvailable",
		"input": map[string]any{
			"projectSlug": slug,
		},
	})
	if resp2.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp2.StatusCode)
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "FORBIDDEN" {
		t.Fatalf("expected FORBIDDEN, got %#v", errObj["code"])
	}
}

func TestMCPUnknownToolReturnsNotFoundEnvelope(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "full")
	defer cleanup()

	resp, out := doMCP(t, ts.Client(), ts.URL+"/mcp", map[string]any{
		"tool":  "missing.tool",
		"input": map[string]any{},
	})
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
	if out["ok"] != false {
		t.Fatalf("expected ok=false, got %#v", out["ok"])
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "NOT_FOUND" {
		t.Fatalf("expected NOT_FOUND, got %#v", errObj["code"])
	}
	if _, ok := errObj["details"].(map[string]any); !ok {
		t.Fatalf("expected details object, got %#v", errObj["details"])
	}
}

func TestMCPInvalidJSONReturnsValidationError(t *testing.T) {
	ts, _, cleanup := newTestServer(t, "full")
	defer cleanup()

	req, err := http.NewRequest(http.MethodPost, ts.URL+"/mcp", bytes.NewBufferString(`{"tool":"projects.list"} {"extra":true}`))
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	defer resp.Body.Close()

	var out map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
	if out["ok"] != false {
		t.Fatalf("expected ok=false, got %#v", out["ok"])
	}
	errObj := out["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %#v", errObj["code"])
	}
}
