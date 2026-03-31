package store

import (
	"context"
	"errors"
	"fmt"
	"testing"
)

func TestAddLane_InsertsBeforeDone(t *testing.T) {
	st, cleanup := newTestStore(t)
	defer cleanup()

	ctx := context.Background()
	project, err := st.CreateProject(ctx, "workflow-add")
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}

	added, err := st.AddWorkflowColumn(ctx, project.ID, "Review")
	if err != nil {
		t.Fatalf("AddWorkflowColumn: %v", err)
	}

	workflow, err := st.GetProjectWorkflow(ctx, project.ID)
	if err != nil {
		t.Fatalf("GetProjectWorkflow: %v", err)
	}
	want := []string{
		DefaultColumnBacklog,
		DefaultColumnNotStarted,
		DefaultColumnDoing,
		DefaultColumnTesting,
		"review",
		DefaultColumnDone,
	}
	if len(workflow) != len(want) {
		t.Fatalf("expected %d workflow columns, got %d", len(want), len(workflow))
	}
	for i, col := range workflow {
		if col.Key != want[i] {
			t.Fatalf("expected lane %d key %q, got %q", i, want[i], col.Key)
		}
		if col.Position != i {
			t.Fatalf("expected lane %q position %d, got %d", col.Key, i, col.Position)
		}
	}
	if added.Key != "review" {
		t.Fatalf("expected generated key %q, got %q", "review", added.Key)
	}
	if added.Position != len(workflow)-2 {
		t.Fatalf("expected inserted position %d, got %d", len(workflow)-2, added.Position)
	}
}

func TestAddLane_StoredNameIsTrimmed(t *testing.T) {
	st, cleanup := newTestStore(t)
	defer cleanup()

	ctx := context.Background()
	project, err := st.CreateProject(ctx, "workflow-add-trim")
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}

	raw := "\t  Ship Ready  \n"
	added, err := st.AddWorkflowColumn(ctx, project.ID, raw)
	if err != nil {
		t.Fatalf("AddWorkflowColumn: %v", err)
	}
	wantName := "Ship Ready"
	if added.Name != wantName {
		t.Fatalf("returned name: want %q, got %q", wantName, added.Name)
	}

	workflow, err := st.GetProjectWorkflow(ctx, project.ID)
	if err != nil {
		t.Fatalf("GetProjectWorkflow: %v", err)
	}
	var got string
	for _, col := range workflow {
		if col.Key == added.Key {
			got = col.Name
			break
		}
	}
	if got != wantName {
		t.Fatalf("stored name: want %q, got %q", wantName, got)
	}
}

func TestAddLane_ServerGeneratedKeyUniqueWhenNamesCollide(t *testing.T) {
	st, cleanup := newTestStore(t)
	defer cleanup()

	ctx := context.Background()
	project, err := st.CreateProject(ctx, "workflow-add-unique")
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}

	first, err := st.AddWorkflowColumn(ctx, project.ID, "Review")
	if err != nil {
		t.Fatalf("AddWorkflowColumn first: %v", err)
	}
	second, err := st.AddWorkflowColumn(ctx, project.ID, "Review")
	if err != nil {
		t.Fatalf("AddWorkflowColumn second: %v", err)
	}

	if first.Key != "review" {
		t.Fatalf("expected first key %q, got %q", "review", first.Key)
	}
	if second.Key != "review_2" {
		t.Fatalf("expected second key %q, got %q", "review_2", second.Key)
	}
	if first.Key == second.Key {
		t.Fatalf("expected unique generated keys, both were %q", first.Key)
	}
}

func TestAddLane_InvalidNameRejected(t *testing.T) {
	st, cleanup := newTestStore(t)
	defer cleanup()

	ctx := context.Background()
	project, err := st.CreateProject(ctx, "workflow-add-invalid")
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}

	tests := []struct {
		name     string
		laneName string
	}{
		{name: "WhitespaceOnly", laneName: "   "},
		{name: "TooLong", laneName: string(make([]byte, 201))},
	}
	tests[1].laneName = ""
	for i := 0; i < 201; i++ {
		tests[1].laneName += "a"
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := st.AddWorkflowColumn(ctx, project.ID, tc.laneName)
			if !errors.Is(err, ErrValidation) {
				t.Fatalf("expected ErrValidation, got %v", err)
			}
		})
	}
}

func TestAddLane_MaxLanesEnforced(t *testing.T) {
	st, cleanup := newTestStore(t)
	defer cleanup()

	ctx := context.Background()
	project, err := st.CreateProject(ctx, "workflow-add-max")
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}

	for i := 0; i < maxWorkflowColumns-5; i++ {
		if _, err := st.AddWorkflowColumn(ctx, project.ID, fmt.Sprintf("Lane %d", i+1)); err != nil {
			t.Fatalf("AddWorkflowColumn %d: %v", i+1, err)
		}
	}

	if _, err := st.AddWorkflowColumn(ctx, project.ID, "Overflow"); !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation when exceeding max lanes, got %v", err)
	}
}

func TestAddLane_IsDoneFalseEnforced(t *testing.T) {
	st, cleanup := newTestStore(t)
	defer cleanup()

	ctx := context.Background()
	project, err := st.CreateProject(ctx, "workflow-add-isdone")
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}

	added, err := st.AddWorkflowColumn(ctx, project.ID, "Review")
	if err != nil {
		t.Fatalf("AddWorkflowColumn: %v", err)
	}
	if added.IsDone {
		t.Fatalf("expected added lane to be non-done")
	}

	workflow, err := st.GetProjectWorkflow(ctx, project.ID)
	if err != nil {
		t.Fatalf("GetProjectWorkflow: %v", err)
	}
	for _, col := range workflow {
		if col.Key == added.Key && col.IsDone {
			t.Fatalf("expected added lane %q to remain non-done", added.Key)
		}
	}
}

func TestAddLane_PreservesSingleDoneLane(t *testing.T) {
	st, cleanup := newTestStore(t)
	defer cleanup()

	ctx := context.Background()
	project, err := st.CreateProjectWithWorkflow(ctx, "workflow-add-custom-done", []WorkflowColumn{
		{Key: "backlog_custom", Name: "Backlog", Color: "#9CA3AF", Position: 0},
		{Key: "build_custom", Name: "Build", Color: "#10B981", Position: 1},
		{Key: "shipped_custom", Name: "Shipped", Color: "#EF4444", Position: 2, IsDone: true},
	})
	if err != nil {
		t.Fatalf("CreateProjectWithWorkflow: %v", err)
	}

	added, err := st.AddWorkflowColumn(ctx, project.ID, "Review")
	if err != nil {
		t.Fatalf("AddWorkflowColumn: %v", err)
	}

	workflow, err := st.GetProjectWorkflow(ctx, project.ID)
	if err != nil {
		t.Fatalf("GetProjectWorkflow: %v", err)
	}

	doneCount := 0
	for _, col := range workflow {
		if col.IsDone {
			doneCount++
			if col.Key != "shipped_custom" {
				t.Fatalf("expected done lane key to remain %q, got %q", "shipped_custom", col.Key)
			}
		}
	}
	if doneCount != 1 {
		t.Fatalf("expected exactly one done lane, got %d", doneCount)
	}
	if workflow[len(workflow)-2].Key != added.Key || workflow[len(workflow)-1].Key != "shipped_custom" {
		t.Fatalf("expected added lane before done, got workflow=%+v", workflow)
	}
}
