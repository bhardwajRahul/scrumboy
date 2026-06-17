package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"testing"
)

func TestUserWallpaperUploadDecodeErrorPreservesRawMessageWithoutReason(t *testing.T) {
	ts, _, cleanup := newTestHTTPServerWithOptions(t, Options{
		MaxRequestBody: 1 << 20,
		ScrumboyMode:   "full",
		DataDir:        t.TempDir(),
	})
	defer cleanup()

	client := newCookieClient(t)
	bootstrapUserClient(t, client, ts.URL, "Owner", "wallpaper-decode@example.com", "password123")

	payload := []byte("not a png")
	_, expectedErr := decodeWallpaperUpload(payload, "image/png")
	if expectedErr == nil {
		t.Fatal("expected invalid PNG fixture to fail decoding")
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreatePart(textproto.MIMEHeader{
		"Content-Disposition": {`form-data; name="file"; filename="wallpaper.png"`},
		"Content-Type":        {"image/png"},
	})
	if err != nil {
		t.Fatalf("create multipart part: %v", err)
	}
	if _, err := part.Write(payload); err != nil {
		t.Fatalf("write multipart payload: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req, err := http.NewRequest(http.MethodPost, ts.URL+"/api/user/wallpaper/image", &body)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("X-Scrumboy", "1")

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("upload wallpaper: %v", err)
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read response body: %v", err)
	}

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", resp.StatusCode, string(respBody))
	}

	var got apiErrorEnvelope
	if err := json.Unmarshal(respBody, &got); err != nil {
		t.Fatalf("decode response: %v body=%s", err, string(respBody))
	}
	if got.Error.Code != "VALIDATION_ERROR" {
		t.Fatalf("code=%q body=%s", got.Error.Code, string(respBody))
	}
	if got.Error.Message != expectedErr.Error() {
		t.Fatalf("message=%q want %q", got.Error.Message, expectedErr.Error())
	}
	if got.Error.Details == nil {
		t.Fatal("details=nil, want field detail")
	}
	if gotField, _ := got.Error.Details["field"].(string); gotField != "file" {
		t.Fatalf("details.field=%v, want file", got.Error.Details["field"])
	}
	if _, ok := got.Error.Details["reason"]; ok {
		t.Fatalf("details.reason=%v, want absent", got.Error.Details["reason"])
	}
}
