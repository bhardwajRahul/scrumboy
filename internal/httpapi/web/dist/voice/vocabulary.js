import { normalizeLookup } from './normalize.js';
export const ENTITY_ALIASES = new Set(["story", "stories", "todo", "todos", "to do", "to dos"]);
export const ENTITY_ALIAS_PATTERN = "(?:story|stories|todo|todos|to[-\\s]+dos|to[-\\s]+do)";
export const BUILTIN_STATUS_ALIASES = [
    ["backlog", "backlog"],
    ["not started", "not_started"],
    ["in progress", "doing"],
    ["doing", "doing"],
    ["testing", "testing"],
    ["done", "done"],
    ["to do", "todo"],
    ["todo", "todo"],
];
const YES_ALIASES = new Set(["yes", "yeah", "yep"]);
const NO_ALIASES = new Set(["no", "nope", "nah"]);
const CANCEL_ALIASES = new Set(["cancel", "stop"]);
const DISAMBIGUATION_ALIASES = new Map([
    ["first one", "option_1"],
    ["number one", "option_1"],
    ["option one", "option_1"],
    ["one", "option_1"],
    ["1", "option_1"],
    ["second one", "option_2"],
    ["number two", "option_2"],
    ["option two", "option_2"],
    ["two", "option_2"],
    ["2", "option_2"],
    ["third one", "option_3"],
    ["number three", "option_3"],
    ["option three", "option_3"],
    ["three", "option_3"],
    ["3", "option_3"],
]);
export function normalizeEntityAlias(input) {
    return ENTITY_ALIASES.has(normalizeLookup(input)) ? "todo" : null;
}
export function normalizeConfirmationResponse(input) {
    const normalized = normalizeLookup(input);
    if (YES_ALIASES.has(normalized))
        return "yes";
    if (NO_ALIASES.has(normalized))
        return "no";
    if (CANCEL_ALIASES.has(normalized))
        return "cancel";
    return null;
}
export function isBuiltinStatusPhrase(input) {
    const normalized = normalizeLookup(input);
    return BUILTIN_STATUS_ALIASES.some(([alias]) => normalizeLookup(alias) === normalized);
}
export function normalizeDisambiguationChoice(input) {
    return DISAMBIGUATION_ALIASES.get(normalizeLookup(input)) ?? null;
}
