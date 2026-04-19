import { commandFailure, isCommandFailure } from './schema.js';
import { containsProjectScopeOverride, normalizePhrase, parseSpokenNumber, stripWrappingQuotes, } from './normalize.js';
function parseId(raw) {
    const parsed = parseSpokenNumber(raw);
    if (!parsed) {
        return commandFailure("invalid_id", "Story ID was not recognized.");
    }
    return { ok: true, value: { localId: parsed.value, ambiguousId: parsed.ambiguous } };
}
function parseCreate(input) {
    const match = input.match(/^create\s+story\s+(.+)$/i);
    if (!match)
        return null;
    const title = stripWrappingQuotes(match[1]);
    if (!title) {
        return commandFailure("invalid_title", "Story title is required.");
    }
    return { ok: true, value: { intent: "todos.create", title } };
}
function parseMove(input) {
    const match = input.match(/^move\s+story\s+(.+?)\s+to\s+(.+)$/i);
    if (!match)
        return null;
    const id = parseId(match[1]);
    if (isCommandFailure(id))
        return id;
    const rawStatus = normalizePhrase(match[2]);
    if (!rawStatus) {
        return commandFailure("unknown_status", "Status is required.");
    }
    return {
        ok: true,
        value: {
            intent: "todos.move",
            localId: id.value.localId,
            rawStatus,
            ambiguousId: id.value.ambiguousId,
        },
    };
}
function parseStoryIs(input) {
    const match = input.match(/^story\s+(.+?)\s+is\s+(.+)$/i);
    if (!match)
        return null;
    const id = parseId(match[1]);
    if (isCommandFailure(id))
        return id;
    const rawStatus = normalizePhrase(match[2]);
    if (!rawStatus) {
        return commandFailure("unknown_status", "Status is required.");
    }
    return {
        ok: true,
        value: {
            intent: "todos.move",
            localId: id.value.localId,
            rawStatus,
            ambiguousId: id.value.ambiguousId,
        },
    };
}
function parseDelete(input) {
    const match = input.match(/^delete\s+story\s+(.+)$/i);
    if (!match)
        return null;
    const id = parseId(match[1]);
    if (isCommandFailure(id))
        return id;
    return {
        ok: true,
        value: {
            intent: "todos.delete",
            localId: id.value.localId,
            ambiguousId: id.value.ambiguousId,
        },
    };
}
function parseAssign(input) {
    const match = input.match(/^assign\s+story\s+(.+?)\s+to\s+(.+)$/i);
    if (!match)
        return null;
    const id = parseId(match[1]);
    if (isCommandFailure(id))
        return id;
    const rawUser = normalizePhrase(match[2]);
    if (!rawUser) {
        return commandFailure("unknown_user", "Assignee is required.");
    }
    return {
        ok: true,
        value: {
            intent: "todos.assign",
            localId: id.value.localId,
            rawUser,
            ambiguousId: id.value.ambiguousId,
        },
    };
}
export function parseCommand(input) {
    const trimmed = String(input ?? "").trim();
    if (!trimmed) {
        return commandFailure("unsupported", "Command is required.");
    }
    if (containsProjectScopeOverride(trimmed)) {
        return commandFailure("project_scope", "Project scope is fixed by the current board.");
    }
    const parsers = [parseCreate, parseMove, parseDelete, parseAssign, parseStoryIs];
    for (const parser of parsers) {
        const parsed = parser(trimmed);
        if (parsed)
            return parsed;
    }
    return commandFailure("unsupported", "Unsupported command.");
}
