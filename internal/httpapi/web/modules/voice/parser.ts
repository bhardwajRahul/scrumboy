import { commandFailure, isCommandFailure, type CommandResult, type ParsedCommandDraft, type TodoTargetReference } from './schema.js';
import {
  containsProjectScopeOverride,
  normalizePhrase,
  normalizeTitleReference,
  parseSpokenNumber,
  stripWrappingQuotes,
} from './normalize.js';
import { ENTITY_ALIAS_PATTERN, isBuiltinStatusPhrase } from './vocabulary.js';

function parseId(raw: string): CommandResult<{ localId: number; ambiguousId: boolean }> {
  const parsed = parseSpokenNumber(raw);
  if (!parsed) {
    return commandFailure("invalid_id", "Todo ID was not recognized.");
  }
  return { ok: true, value: { localId: parsed.value, ambiguousId: parsed.ambiguous } };
}

function targetDisplay(target: TodoTargetReference): string {
  return target.kind === "id" ? String(target.localId) : target.display;
}

function parseTarget(raw: string): CommandResult<TodoTargetReference> {
  const normalized = normalizeTitleReference(raw);
  if (!normalized) {
    return commandFailure("unknown_story", "Todo reference is required.");
  }
  if (["it", "that", "that one", "this", "this one"].includes(normalized)) {
    return commandFailure("unsupported", "Unsupported command.");
  }
  if (["#", "id", "number"].includes(normalized)) {
    return commandFailure("invalid_id", "Todo ID was not recognized.");
  }
  const id = parseId(raw);
  if (!isCommandFailure(id)) {
    return {
      ok: true,
      value: {
        kind: "id",
        localId: id.value.localId,
        ambiguousId: id.value.ambiguousId,
        display: String(id.value.localId),
      },
    };
  }
  return { ok: true, value: { kind: "title", phrase: normalized, display: normalized } };
}

function optionalEntityTarget(raw: string): string {
  const normalized = normalizePhrase(raw);
  const match = normalized.match(new RegExp(`^${ENTITY_ALIAS_PATTERN}\\s+(.+)$`, "i"));
  return match ? match[1] : normalized;
}

function requiredEntityTarget(raw: string): string | null {
  const normalized = normalizePhrase(raw);
  const match = normalized.match(new RegExp(`^${ENTITY_ALIAS_PATTERN}\\s+(.+)$`, "i"));
  return match ? match[1] : null;
}

function splitByCommandDelimiter(raw: string, delimiter: "to" | "is"): { target: string; value: string } | null {
  const normalized = normalizePhrase(raw);
  const token = ` ${delimiter} `;
  const positions: number[] = [];
  let index = normalized.indexOf(token);
  while (index >= 0) {
    positions.push(index);
    index = normalized.indexOf(token, index + token.length);
  }
  if (positions.length === 0) return null;

  for (const position of positions) {
    const target = normalized.slice(0, position).trim();
    const value = normalized.slice(position + token.length).trim();
    if (target && value && isBuiltinStatusPhrase(value)) {
      return { target, value };
    }
  }

  const position = positions[positions.length - 1];
  const target = normalized.slice(0, position).trim();
  const value = normalized.slice(position + token.length).trim();
  return target && value ? { target, value } : null;
}

function splitLastTo(raw: string): { target: string; value: string } | null {
  const normalized = normalizePhrase(raw);
  const token = " to ";
  const position = normalized.lastIndexOf(token);
  if (position < 0) return null;
  const target = normalized.slice(0, position).trim();
  const value = normalized.slice(position + token.length).trim();
  return target && value ? { target, value } : null;
}

function parseCreate(input: string): CommandResult<ParsedCommandDraft> | null {
  const match = input.match(new RegExp(`^create\\s+${ENTITY_ALIAS_PATTERN}\\s+(.+)$`, "i"));
  if (!match) return null;
  const title = stripWrappingQuotes(match[1]);
  if (!title) {
    return commandFailure("invalid_title", "Todo title is required.");
  }
  return { ok: true, value: { intent: "todos.create", title, display: `create todo ${title}` } };
}

function parseMove(input: string): CommandResult<ParsedCommandDraft> | null {
  const match = input.match(/^move\s+(.+)$/i);
  if (!match) return null;
  const parts = splitByCommandDelimiter(optionalEntityTarget(match[1]), "to");
  if (!parts) return null;
  const target = parseTarget(parts.target);
  if (isCommandFailure(target)) return target;
  const rawStatus = normalizePhrase(parts.value);
  if (!rawStatus) {
    return commandFailure("unknown_status", "Status is required.");
  }
  return {
    ok: true,
    value: {
      intent: "todos.move",
      target: target.value,
      rawStatus,
      display: `move todo ${targetDisplay(target.value)} to ${rawStatus}`,
    },
  };
}

function parseTodoIs(input: string): CommandResult<ParsedCommandDraft> | null {
  const rest = requiredEntityTarget(input);
  if (!rest) return null;
  const parts = splitByCommandDelimiter(rest, "is");
  if (!parts) return null;
  const target = parseTarget(parts.target);
  if (isCommandFailure(target)) return target;
  const rawStatus = normalizePhrase(parts.value);
  if (!rawStatus) {
    return commandFailure("unknown_status", "Status is required.");
  }
  return {
    ok: true,
    value: {
      intent: "todos.move",
      target: target.value,
      rawStatus,
      display: `todo ${targetDisplay(target.value)} is ${rawStatus}`,
    },
  };
}

function parseDelete(input: string): CommandResult<ParsedCommandDraft> | null {
  const match = input.match(/^delete\s+(.+)$/i);
  if (!match) return null;
  const target = parseTarget(optionalEntityTarget(match[1]));
  if (isCommandFailure(target)) return target;
  return {
    ok: true,
    value: {
      intent: "todos.delete",
      target: target.value,
      display: `delete todo ${targetDisplay(target.value)}`,
    },
  };
}

function parseOpen(input: string): CommandResult<ParsedCommandDraft> | null {
  const match = input.match(/^(open|edit)\s+(.+)$/i);
  if (!match) return null;
  const target = parseTarget(optionalEntityTarget(match[2]));
  if (isCommandFailure(target)) return target;
  return {
    ok: true,
    value: {
      intent: "open_todo",
      target: target.value,
      display: `${normalizePhrase(match[1])} todo ${targetDisplay(target.value)}`,
    },
  };
}

function parseAssign(input: string): CommandResult<ParsedCommandDraft> | null {
  const match = input.match(/^assign\s+(.+)$/i);
  if (!match) return null;
  const targetAndUser = requiredEntityTarget(match[1]);
  if (!targetAndUser) return null;
  const parts = splitLastTo(targetAndUser);
  if (!parts) return null;
  const target = parseTarget(parts.target);
  if (isCommandFailure(target)) return target;
  const rawUser = normalizePhrase(parts.value);
  if (!rawUser) {
    return commandFailure("unknown_user", "Assignee is required.");
  }
  return {
    ok: true,
    value: {
      intent: "todos.assign",
      target: target.value,
      rawUser,
      display: `assign todo ${targetDisplay(target.value)} to ${rawUser}`,
    },
  };
}

export function parseCommand(input: string): CommandResult<ParsedCommandDraft> {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) {
    return commandFailure("unsupported", "Command is required.");
  }
  if (containsProjectScopeOverride(trimmed)) {
    return commandFailure("project_scope", "Project scope is fixed by the current board.");
  }

  const parsers = [parseCreate, parseMove, parseDelete, parseOpen, parseAssign, parseTodoIs];
  for (const parser of parsers) {
    const parsed = parser(trimmed);
    if (parsed) return parsed;
  }

  return commandFailure("unsupported", "Unsupported command.");
}
