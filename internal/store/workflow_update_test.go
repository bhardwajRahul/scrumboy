package store

import (
	"context"
	"errors"
	"testing"
)

func TestUpdateWorkflowColumn_ValidNameAndColor(t *testing.T) {
	st, cleanup := newTestStore(t)
	defer cleanup()

	ctx := context.Background()
	project, err := st.CreateProject(ctx, "workflow-update")
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	if err := st.UpdateWorkflowColumn(ctx, project.ID, DefaultColumnDoing, "Working", "#112233"); err != nil {
		t.Fatalf("UpdateWorkflowColumn: %v", err)
	}
	workflow, err := st.GetProjectWorkflow(ctx, project.ID)
	if err != nil {
		t.Fatalf("GetProjectWorkflow: %v", err)
	}
	var col *WorkflowColumn
	for i := range workflow {
		if workflow[i].Key == DefaultColumnDoing {
			col = &workflow[i]
			break
		}
	}
	if col == nil {
		t.Fatalf("expected column %q", DefaultColumnDoing)
	}
	if col.Name != "Working" || col.Color != "#112233" {
		t.Fatalf("got name=%q color=%q", col.Name, col.Color)
	}
}

func TestUpdateWorkflowColumn_InvalidColorRejected(t *testing.T) {
	st, cleanup := newTestStore(t)
	defer cleanup()

	ctx := context.Background()
	project, err := st.CreateProject(ctx, "workflow-bad-color")
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	err = st.UpdateWorkflowColumn(ctx, project.ID, DefaultColumnDoing, "Working", "#gggggg")
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation, got %v", err)
	}
	err = st.UpdateWorkflowColumn(ctx, project.ID, DefaultColumnDoing, "Working", "red")
	if err == nil {
		t.Fatal("expected error for non-hex color")
	}
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation, got %v", err)
	}
}

func TestUpdateWorkflowColumn_NonexistentKey(t *testing.T) {
	st, cleanup := newTestStore(t)
	defer cleanup()

	ctx := context.Background()
	project, err := st.CreateProject(ctx, "workflow-missing-key")
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	err = st.UpdateWorkflowColumn(ctx, project.ID, "no_such_lane", "X", "#112233")
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestUpdateWorkflowColumn_OtherFieldsUnchanged(t *testing.T) {
	st, cleanup := newTestStore(t)
	defer cleanup()

	ctx := context.Background()
	project, err := st.CreateProject(ctx, "workflow-fields")
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	before, err := st.GetProjectWorkflow(ctx, project.ID)
	if err != nil {
		t.Fatalf("GetProjectWorkflow: %v", err)
	}
	var doing WorkflowColumn
	for i := range before {
		if before[i].Key == DefaultColumnDoing {
			doing = before[i]
			break
		}
	}
	if err := st.UpdateWorkflowColumn(ctx, project.ID, DefaultColumnDoing, "Renamed", "#aabbcc"); err != nil {
		t.Fatalf("UpdateWorkflowColumn: %v", err)
	}
	after, err := st.GetProjectWorkflow(ctx, project.ID)
	if err != nil {
		t.Fatalf("GetProjectWorkflow: %v", err)
	}
	var got WorkflowColumn
	for i := range after {
		if after[i].Key == DefaultColumnDoing {
			got = after[i]
			break
		}
	}
	if got.Key != doing.Key || got.Position != doing.Position || got.IsDone != doing.IsDone || got.System != doing.System {
		t.Fatalf("immutable fields changed: before=%+v after=%+v", doing, got)
	}
	if got.Name != "Renamed" || got.Color != "#aabbcc" {
		t.Fatalf("expected name+color updated, got %+v", got)
	}
}
