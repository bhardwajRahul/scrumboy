// Drag + resize gesture controller for the Scrumbaby/Wall feature.
//
// This module owns:
//   - Multi-participant note drag (with rAF-coalesced moves, transient fanout).
//   - Single-note resize.
//   - Trash-strip visibility + hit test.
//   - Per-note transient scheduling / flushing.
//
// It does NOT own:
//   - Delete confirmation (kept in the caller so the controller stays free of
//     `confirmDelete` / `utils.js` coupling).
//   - `findNote` / `noteElementById` lookups (kept behind injected callbacks so
//     the controller can test in isolation without the full wall doc model).
//
// The injection shape is small on purpose: one options bag per top-level
// gesture function, filled in once from `wall.ts::bindSurfaceHandlers`.
import { wallSurface, wallTrash } from "../dom/elements.js";
import { clampDim, updateEdgesForNote, MAX_NOTE_HEIGHT, MAX_NOTE_WIDTH, MIN_NOTE_HEIGHT, MIN_NOTE_WIDTH, } from "./wall-rendering.js";
import { TRANSIENT_COALESCE_MS } from "./wall-postbaby-constants.js";
import { postTransient } from "./wall-api.js";
import { getMounted } from "./wall-state.js";
// ---- Transient (non-durable) drag fanout ---------------------------------
export function scheduleTransient(state, noteId, x, y) {
    let entry = state.transient.get(noteId);
    if (!entry) {
        entry = { lastX: x, lastY: y, lastSentAt: 0, timer: null };
        state.transient.set(noteId, entry);
    }
    entry.lastX = x;
    entry.lastY = y;
    const now = performance.now();
    const elapsed = now - entry.lastSentAt;
    if (elapsed >= TRANSIENT_COALESCE_MS) {
        sendTransientNow(state, noteId);
        return;
    }
    if (!entry.timer) {
        entry.timer = setTimeout(() => {
            if (getMounted() !== state)
                return;
            sendTransientNow(state, noteId);
        }, TRANSIENT_COALESCE_MS - elapsed);
    }
}
export function flushTransient(state, noteId) {
    const entry = state.transient.get(noteId);
    if (!entry)
        return;
    if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = null;
    }
    sendTransientNow(state, noteId);
    state.transient.delete(noteId);
}
export function sendTransientNow(state, noteId) {
    const entry = state.transient.get(noteId);
    if (!entry)
        return;
    if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = null;
    }
    entry.lastSentAt = performance.now();
    void postTransient(state.slug, { noteId, x: entry.lastX, y: entry.lastY });
}
// ---- Trash strip -------------------------------------------------------
export function showTrash(visible) {
    if (!wallTrash)
        return;
    wallTrash.classList.toggle("wall-trash--visible", visible);
    if (!visible)
        wallTrash.classList.remove("wall-trash--active");
}
export function updateTrashHoverAny(participants) {
    if (!wallTrash)
        return;
    const active = participants.some((p) => isOverTrash(p.el));
    wallTrash.classList.toggle("wall-trash--active", active);
}
export function isOverTrash(noteEl) {
    if (!wallTrash)
        return false;
    const a = noteEl.getBoundingClientRect();
    const b = wallTrash.getBoundingClientRect();
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}
// ---- Drag (document-scoped, rAF) ----------------------------------------
export function beginDrag(opts) {
    const { state, ev, noteEl, noteId, downX, downY } = opts;
    const primary = opts.findNote(noteId);
    if (!primary)
        return;
    opts.cancelColorTimer(state, noteId);
    const surface = wallSurface;
    if (!surface)
        return;
    const surfaceRect = surface.getBoundingClientRect();
    const noteRect = noteEl.getBoundingClientRect();
    // shiftX/shiftY: offset from pointer-down position to the primary note's
    // top-left, measured within the surface. Using the original downX/downY
    // (rather than current pointer position) preserves the visual feel of
    // Postbaby's `shiftX = clientX - rect.left` so the note doesn't jump.
    const shiftX = downX - noteRect.left;
    const shiftY = downY - noteRect.top;
    const isGroup = state.selected.has(noteId) && state.selected.size > 1;
    const participants = [];
    if (isGroup) {
        for (const id of state.selected) {
            const n = opts.findNote(id);
            const el = opts.noteElementById(id);
            if (!n || !el)
                continue;
            participants.push({ id, el, startX: n.x, startY: n.y, note: n });
        }
    }
    else {
        participants.push({ id: noteId, el: noteEl, startX: primary.x, startY: primary.y, note: primary });
    }
    for (const p of participants)
        p.el.classList.add("wall-note--dragging");
    showTrash(true);
    let animationFrameId = null;
    let lastClientX = ev.clientX;
    let lastClientY = ev.clientY;
    function moveAt(clientX, clientY) {
        lastClientX = clientX;
        lastClientY = clientY;
        if (animationFrameId !== null)
            return;
        animationFrameId = requestAnimationFrame(() => {
            animationFrameId = null;
            const rawX = lastClientX - surfaceRect.left - shiftX;
            const rawY = lastClientY - surfaceRect.top - shiftY;
            let minDeltaX = rawX - primary.x;
            let minDeltaY = rawY - primary.y;
            for (const p of participants) {
                if (p.startX + minDeltaX < 0)
                    minDeltaX = -p.startX;
                if (p.startY + minDeltaY < 0)
                    minDeltaY = -p.startY;
            }
            for (const p of participants) {
                const nx = p.startX + minDeltaX;
                const ny = p.startY + minDeltaY;
                p.el.style.left = `${Math.round(nx)}px`;
                p.el.style.top = `${Math.round(ny)}px`;
                scheduleTransient(state, p.id, nx, ny);
                if (wallSurface) {
                    updateEdgesForNote(wallSurface, p.id, nx + p.el.offsetWidth / 2, ny + p.el.offsetHeight / 2);
                }
            }
            updateTrashHoverAny(participants);
        });
    }
    const onMove = (mv) => {
        mv.preventDefault();
        moveAt(mv.clientX, mv.clientY);
    };
    const onUp = (up) => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        for (const p of participants)
            p.el.classList.remove("wall-note--dragging");
        const overlappingTrash = participants.some((p) => isOverTrash(p.el));
        showTrash(false);
        if (overlappingTrash) {
            // Revert visuals to starting positions before confirming so notes
            // don't sit over the trash while the native dialog is up.
            for (const p of participants) {
                p.el.style.left = `${Math.round(p.startX)}px`;
                p.el.style.top = `${Math.round(p.startY)}px`;
                if (wallSurface) {
                    updateEdgesForNote(wallSurface, p.id, p.startX + p.el.offsetWidth / 2, p.startY + p.el.offsetHeight / 2);
                }
            }
            opts.onDropOnTrash(participants.map((p) => p.id), isGroup);
            return;
        }
        const commits = [];
        for (const p of participants) {
            const finalX = parseInt(p.el.style.left || "0", 10);
            const finalY = parseInt(p.el.style.top || "0", 10);
            scheduleTransient(state, p.id, finalX, finalY);
            flushTransient(state, p.id);
            if (finalX !== p.note.x || finalY !== p.note.y) {
                commits.push({ id: p.id, x: finalX, y: finalY });
            }
        }
        if (commits.length > 0)
            opts.onCommitDragPositions(commits);
        if (isGroup)
            opts.onClearSelectionAfterGroupDrop();
        void up;
    };
    document.addEventListener("pointermove", onMove, { signal: state.abort.signal, passive: false });
    document.addEventListener("pointerup", onUp, { signal: state.abort.signal });
    document.addEventListener("pointercancel", onUp, { signal: state.abort.signal });
}
export function startResize(opts) {
    const { state, ev, noteEl, noteId } = opts;
    const note = opts.findNote(noteId);
    if (!note)
        return;
    const startX = ev.clientX;
    const startY = ev.clientY;
    const origW = note.width;
    const origH = note.height;
    const onMove = (mv) => {
        mv.preventDefault();
        const dw = mv.clientX - startX;
        const dh = mv.clientY - startY;
        const w = clampDim(origW + dw, MIN_NOTE_WIDTH, MAX_NOTE_WIDTH);
        const h = clampDim(origH + dh, MIN_NOTE_HEIGHT, MAX_NOTE_HEIGHT);
        noteEl.style.width = `${Math.round(w)}px`;
        noteEl.style.height = `${Math.round(h)}px`;
    };
    const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        const finalW = parseInt(noteEl.style.width || "0", 10);
        const finalH = parseInt(noteEl.style.height || "0", 10);
        if (finalW !== origW || finalH !== origH) {
            opts.onCommitResize(noteId, finalW, finalH);
        }
    };
    document.addEventListener("pointermove", onMove, { signal: state.abort.signal, passive: false });
    document.addEventListener("pointerup", onUp, { signal: state.abort.signal });
    document.addEventListener("pointercancel", onUp, { signal: state.abort.signal });
}
