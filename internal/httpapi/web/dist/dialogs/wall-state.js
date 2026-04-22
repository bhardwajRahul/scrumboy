// Singleton-scoped mutable state for the Scrumbaby/Wall feature.
//
// This module is intentionally tiny. The goal is to put *all* cross-function
// module-level `let` bindings behind explicit getter/setter functions so the
// rest of the wall code (including future splits: wall-realtime, wall-edit,
// wall-drag-controller, ...) never imports a live `let` binding.
//
// Invariant: there is at most one mounted wall at a time. `setMounted(null)`
// is the "unmount" signal; everything else is a reference to the active
// session's state object.
let mounted = null;
/** Guard flags for the SSE refetch vs. in-progress-edit race. */
let activeEditNoteId = null;
let pendingRefetchWhileEditing = false;
export function getMounted() {
    return mounted;
}
export function setMounted(next) {
    mounted = next;
}
export function getActiveEditNoteId() {
    return activeEditNoteId;
}
export function setActiveEditNoteId(id) {
    activeEditNoteId = id;
}
export function getPendingRefetch() {
    return pendingRefetchWhileEditing;
}
export function setPendingRefetch(flag) {
    pendingRefetchWhileEditing = flag;
}
/** Reset the edit-race flags. Called from teardown and from edit-finish. */
export function resetEditGuards() {
    activeEditNoteId = null;
    pendingRefetchWhileEditing = false;
}
