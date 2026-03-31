package mcp

import (
	"context"
	"errors"
	"net/http"

	"scrumboy/internal/store"
)

func (a *Adapter) handleMembersList(ctx context.Context, input any) (any, map[string]any, *adapterError) {
	auth, bootstrapAvailable, err := a.authState(ctx)
	if err != nil {
		return nil, nil, err
	}

	switch {
	case a.mode == "anonymous":
		return nil, nil, newAdapterError(http.StatusForbidden, CodeCapabilityUnavailable, "members.list is unavailable in anonymous mode", nil)
	case bootstrapAvailable:
		return nil, nil, newAdapterError(http.StatusForbidden, CodeCapabilityUnavailable, "members.list is unavailable before bootstrap", nil)
	case !auth.Authenticated:
		return nil, nil, newAdapterError(http.StatusUnauthorized, CodeAuthRequired, "Sign-in required for this tool", nil)
	}

	var in sprintProjectInput
	if err := decodeInput(input, &in); err != nil {
		return nil, nil, newAdapterError(http.StatusBadRequest, CodeValidationError, "invalid input", map[string]any{"detail": err.Error()})
	}
	if in.ProjectSlug == "" {
		return nil, nil, newAdapterError(http.StatusBadRequest, CodeValidationError, "missing projectSlug", map[string]any{"field": "projectSlug"})
	}

	pc, pcErr := a.store.GetProjectContextBySlug(ctx, in.ProjectSlug, a.storeMode())
	if pcErr != nil {
		return nil, nil, mapStoreError(pcErr)
	}

	userID, ok := store.UserIDFromContext(ctx)
	if !ok {
		return nil, nil, newAdapterError(http.StatusUnauthorized, CodeAuthRequired, "Sign-in required for this tool", nil)
	}

	members, mErr := a.store.ListProjectMembers(ctx, pc.Project.ID, userID)
	if mErr != nil {
		return nil, nil, mapStoreError(mErr)
	}

	items := make([]projectMemberItem, 0, len(members))
	for _, m := range members {
		items = append(items, projectMemberItem{
			ProjectSlug: in.ProjectSlug,
			UserID:      m.UserID,
			Email:       m.Email,
			Name:        m.Name,
			Image:       m.Image,
			Role:        string(m.Role),
			CreatedAt:   m.CreatedAt,
		})
	}

	return map[string]any{
		"items": items,
	}, map[string]any{}, nil
}

func (a *Adapter) handleMembersListAvailable(ctx context.Context, input any) (any, map[string]any, *adapterError) {
	auth, bootstrapAvailable, err := a.authState(ctx)
	if err != nil {
		return nil, nil, err
	}

	switch {
	case a.mode == "anonymous":
		return nil, nil, newAdapterError(http.StatusForbidden, CodeCapabilityUnavailable, "members.listAvailable is unavailable in anonymous mode", nil)
	case bootstrapAvailable:
		return nil, nil, newAdapterError(http.StatusForbidden, CodeCapabilityUnavailable, "members.listAvailable is unavailable before bootstrap", nil)
	case !auth.Authenticated:
		return nil, nil, newAdapterError(http.StatusUnauthorized, CodeAuthRequired, "Sign-in required for this tool", nil)
	}

	var in sprintProjectInput
	if err := decodeInput(input, &in); err != nil {
		return nil, nil, newAdapterError(http.StatusBadRequest, CodeValidationError, "invalid input", map[string]any{"detail": err.Error()})
	}
	if in.ProjectSlug == "" {
		return nil, nil, newAdapterError(http.StatusBadRequest, CodeValidationError, "missing projectSlug", map[string]any{"field": "projectSlug"})
	}

	pc, pcErr := a.store.GetProjectContextBySlug(ctx, in.ProjectSlug, a.storeMode())
	if pcErr != nil {
		return nil, nil, mapStoreError(pcErr)
	}

	userID, ok := store.UserIDFromContext(ctx)
	if !ok {
		return nil, nil, newAdapterError(http.StatusUnauthorized, CodeAuthRequired, "Sign-in required for this tool", nil)
	}

	users, uErr := a.store.ListAvailableUsersForProject(ctx, userID, pc.Project.ID)
	if uErr != nil {
		if errors.Is(uErr, store.ErrUnauthorized) {
			return nil, nil, newAdapterError(http.StatusForbidden, CodeForbidden, "maintainer or higher required", nil)
		}
		return nil, nil, mapStoreError(uErr)
	}

	items := make([]availableUserItem, 0, len(users))
	for _, u := range users {
		items = append(items, availableUserItem{
			UserID:      u.ID,
			Email:       u.Email,
			Name:        u.Name,
			SystemRole:  string(u.SystemRole),
			IsBootstrap: u.IsBootstrap,
			CreatedAt:   u.CreatedAt,
		})
	}

	return map[string]any{
		"items": items,
	}, map[string]any{}, nil
}
