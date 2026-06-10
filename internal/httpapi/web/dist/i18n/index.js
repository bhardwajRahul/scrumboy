export const SUPPORTED_LOCALES = ["en", "de", "pseudo"];
export const PUBLIC_LOCALES = ["en", "de"];
export const LOCALE_STORAGE_KEY = "scrumboy.locale";
export const I18N_LOCALE_CHANGED = "scrumboy:i18n-locale-changed";
export const LOCALE_LABELS = {
    en: "English",
    de: "Deutsch",
    pseudo: "Pseudo",
};
const BOOTSTRAP_EN_CATALOG = {
    "common.add": "Add",
    "common.apply": "Apply",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.confirm": "Confirm",
    "common.delete": "Delete",
    "common.prompt": "Prompt",
    "common.remove": "Remove",
    "common.save": "Save",
    "common.value": "Value",
    "board.actions.changeProjectImage": "Change project image",
    "board.actions.clearSearch": "Clear search",
    "board.actions.deleteProject": "Delete project",
    "board.actions.manageMembers": "Members",
    "board.actions.newTodo": "New Todo",
    "board.actions.openWall": "Open wall",
    "board.actions.renameProject": "Rename",
    "board.actions.settings": "Settings",
    "board.backToProjects": "\u2190 Projects",
    "board.bulkEdit.editingMultiple": "Editing {count} todos.",
    "board.bulkEdit.editingSingle": "Editing 1 todo.",
    "board.bulkEdit.noTodosSelected": "No todos on the board to edit.",
    "board.bulkEdit.nothingToUpdate": "Nothing to update.",
    "board.bulkEdit.removeTag": "Remove tag",
    "board.bulkEdit.title": "Bulk edit",
    "board.bulkEdit.updatedMultiple": "Updated {count} todos",
    "board.bulkEdit.updatedPartial": "Updated {success} of {total} todos ({failed} failed)",
    "board.bulkEdit.updatedSingle": "Updated 1 todo",
    "board.filters.all": "All",
    "board.filters.label": "Tags:",
    "board.filters.next": "Next tags",
    "board.filters.previous": "Previous tags",
    "board.filters.scheduled": "Scheduled",
    "board.filters.unscheduled": "Unscheduled",
    "board.loadMore": "Load more",
    "board.loadMoreFailed": "Failed to load more",
    "board.members.addFailed": "Failed to add member",
    "board.members.addMember": "Add Member",
    "board.members.addNewMember": "Add New Member",
    "board.members.added": "Member added successfully",
    "board.members.allUsersAreMembers": "All users are already members",
    "board.members.close": "Close",
    "board.members.currentMembers": "Current Members",
    "board.members.demoteAction": "Demote",
    "board.members.demoteConfirm": "Demote {name} to {role}?",
    "board.members.demoteTitle": "Demote member?",
    "board.members.dialogTitle": "Manage Members",
    "board.members.dialogTitleReadOnly": "Members",
    "board.members.loadFailed": "Failed to load members",
    "board.members.noMembers": "No members yet",
    "board.members.projectLabel": "Project: {name}",
    "board.members.remove": "Remove",
    "board.members.removeConfirm": "Remove {name} from this project?",
    "board.members.removeFailed": "Failed to remove member",
    "board.members.removeFromProject": "Remove from project",
    "board.members.removeTitle": "Remove member?",
    "board.members.removed": "Member removed from project",
    "board.members.role": "Role",
    "board.members.role.contributor": "Contributor",
    "board.members.role.maintainer": "Maintainer",
    "board.members.role.viewer": "Viewer",
    "board.members.roleUpdated": "Role updated",
    "board.members.selectUser": "Select a user...",
    "board.members.thisMember": "this member",
    "board.members.updateRoleFailed": "Failed to update role",
    "board.members.user": "User",
    "board.noResults": "No todos found matching \"{search}\"",
    "board.openTodo.accessDenied": "You don't have access to this todo",
    "board.openTodo.failed": "Failed to load todo",
    "board.openTodo.notFound": "Todo not found",
    "board.project.imageUpdated": "Project image updated",
    "board.project.imageUploadFailed": "Upload failed",
    "board.project.nameLabel": "Project Name",
    "board.project.namePlaceholder": "Project name",
    "board.project.renamed": "Project renamed",
    "board.project.renameAction": "Rename",
    "board.project.renameFailed": "Failed to rename project",
    "board.project.renameTitle": "Rename Project",
    "board.search.placeholder.desktop": "Search todos...",
    "board.search.placeholder.mobile": "Search",
    "board.selection.multiple": "Edit {count} selected",
    "board.selection.single": "Edit 1 selected",
    "board.status.backlog": "Backlog",
    "board.todo.dragToReorder": "Drag to reorder",
    "board.voice.boardChanged": "The board changed before commands opened",
    "board.voice.loadFailed": "Commands failed to load",
    "board.voice.unavailable": "Commands are unavailable for this board",
    "board.wallOpenFailed": "Could not open the wall",
    "errors.generic": "Something went wrong.",
    "errors.httpStatus": "HTTP {status}",
    "nav.temporaryBoards.long": "Temporary Boards",
    "nav.temporaryBoards.short": "Temporary",
    "projects.actions.create": "Create",
    "projects.actions.createTemporaryBoard": "Create Temporary Board",
    "projects.actions.delete": "Delete",
    "projects.actions.rename": "Rename",
    "projects.actions.renameProject": "Rename project",
    "projects.actions.settings": "Settings",
    "projects.delete.confirmMessage": "Delete this project and all its todos?",
    "projects.empty.projects": "No projects yet.",
    "projects.empty.temporary": "No temporary boards yet.",
    "projects.fields.namePlaceholder": "New project name",
    "projects.rename.confirmAction": "Rename",
    "projects.rename.label": "Project Name",
    "projects.rename.placeholder": "Project name",
    "projects.rename.success": "Project renamed",
    "projects.rename.title": "Rename Project",
    "projects.tabs.dashboard": "Dashboard",
    "projects.tabs.projects": "Projects",
    "projects.title": "Projects",
    "projects.validation.nameRequired": "Project name is required.",
    "projects.view.grid": "Grid view",
    "projects.view.list": "List view",
    "projects.workflow.addLaneAction": "Add",
    "projects.workflow.addLaneAriaLabel": "Add lane",
    "projects.workflow.addLanePlaceholder": "Add lane...",
    "projects.workflow.cancelAction": "Cancel",
    "projects.workflow.confirmAction": "Confirm",
    "projects.workflow.creating": "Creating...",
    "projects.workflow.doneLabel": "Done",
    "projects.workflow.helper": "Configure lanes before creating the project.",
    "projects.workflow.laneColor": "Lane color for {name}",
    "projects.workflow.reorderLane": "Reorder lane",
    "projects.workflow.setDoneLane": "Set {name} as done lane",
    "projects.workflow.title": "Customize Workflow",
    "projects.workflow.validation.duplicateKey": "Duplicate lane keys. Rename lanes to fix.",
    "projects.workflow.validation.emptyName": "Lane names cannot be empty.",
    "projects.workflow.validation.exactlyOneDone": "Exactly one lane must be marked as Done.",
    "projects.workflow.validation.invalidColor": "Lane colors must be valid hex colors.",
    "projects.workflow.validation.invalidKey": "Lane keys must be snake_case (letters, numbers, underscore).",
    "projects.workflow.validation.minLanes": "Workflow must have at least 2 lanes.",
    "realtime.assigned": "Assigned: {title}",
    "realtime.todoFallback": "Todo",
    "shell.bulkEdit.addTags": "Add tags",
    "shell.bulkEdit.assignSprint": "Assign sprint",
    "shell.bulkEdit.assignTo": "Assign to",
    "shell.bulkEdit.assignUser": "Assign user",
    "shell.bulkEdit.changeStatus": "Change status",
    "shell.bulkEdit.estimationPoints": "Estimation points",
    "shell.bulkEdit.noEstimate": "No estimate",
    "shell.bulkEdit.setEstimationPoints": "Set estimation points",
    "shell.bulkEdit.sprint": "Sprint",
    "shell.bulkEdit.status": "Status",
    "shell.bulkEdit.tagsPlaceholder": "Type tag and press Enter",
    "shell.contextMenu.newTodo": "New Todo",
    "settings.language.description": "Choose the language used for Scrumboy on this browser.",
    "settings.language.selectLabel": "Language",
    "settings.language.title": "Language",
    "todo.assignee.current": "Current: {name}",
    "todo.assignee.me": "Me",
    "todo.assignee.unassigned": "Unassigned",
    "todo.confirm.deleteAction": "Delete",
    "todo.confirm.deleteMessage": "Delete this todo?",
    "todo.confirm.deleteTitle": "Delete",
    "todo.confirm.discardAction": "Discard",
    "todo.confirm.discardMessage": "You have unsaved changes. Discard them?",
    "todo.confirm.discardTitle": "Unsaved changes",
    "todo.created": "Todo created",
    "todo.deleteFailed": "Failed to delete todo",
    "todo.dialog.title.edit": "Edit Todo",
    "todo.dialog.title.new": "New Todo",
    "todo.dialog.title.view": "View Todo",
    "todo.estimation.none": "No estimate",
    "todo.fields.assignedTo": "Assigned to",
    "todo.fields.estimationPoints": "Estimation Points",
    "todo.fields.linkedStories": "Linked Stories",
    "todo.fields.notes": "Notes",
    "todo.fields.sprint": "Sprint",
    "todo.fields.status": "Status",
    "todo.fields.tags": "Tags",
    "todo.fields.title": "Title",
    "todo.links.addPrompt": "Type #id or title, then tap Add",
    "todo.links.cannotShare": "Cannot share: no story in context",
    "todo.links.copySuccess": "Link copied",
    "todo.links.linkFailed": "Failed to link story",
    "todo.links.remove": "Remove link",
    "todo.links.removeFailed": "Failed to remove link",
    "todo.links.searchFailed": "Failed to search stories",
    "todo.links.searchPlaceholder": "Search by #id or title...",
    "todo.links.shareAriaLabel": "Share story link",
    "todo.links.shareFailed": "Share failed",
    "todo.links.shareSuccess": "Link shared",
    "todo.links.shareUnsupported": "Share not supported",
    "todo.links.storyFallbackTitle": "Story #{id}",
    "todo.loadLinkedFailed": "Failed to load linked stories",
    "todo.notes.markdown": "markdown",
    "todo.notes.modeLabel": "Notes editor mode",
    "todo.notes.preview": "preview",
    "todo.notes.previewUnavailable": "Markdown preview is unavailable",
    "todo.saveFailed": "Failed to save todo",
    "todo.sprint.state.ACTIVE": "Active",
    "todo.sprint.state.CLOSED": "Closed",
    "todo.sprint.state.PLANNED": "Planned",
    "todo.status.backlog": "Backlog",
    "todo.status.done": "Done",
    "todo.status.inProgress": "In Progress",
    "todo.status.notStarted": "Not Started",
    "todo.status.testing": "Testing",
    "todo.tags.placeholder": "Type tag and press Enter or Tab",
    "todo.updated": "Todo updated",
    "tooltips.boardSearch": "Search titles and notes. Combine with tag and sprint chips to narrow the board.",
    "tooltips.doneLane": "Exactly one lane counts as done. Stories there get a completion timestamp used for dashboard stats and burndown, even if the lane is named Shipped instead of Done.",
    "tooltips.estimationPoints": "Relative effort, not hours. Uses a modified Fibonacci scale (1\u201340). Compare to similar work on this board.",
    "tooltips.linkedStories": "Link related stories (dependencies, parent/child, duplicates). Search by local ID (#12) or title. Links are informational \u2014 they do not move cards automatically.",
    "tooltips.memberRole": "Viewer: read-only. Contributor: edit notes when assigned. Maintainer: create, move, assign, sprints, and settings.",
    "tooltips.sprintDefaultWeeks": "When you create a sprint, the end date defaults to this many weeks after the start date.",
    "tooltips.sprintEnd": "Planned end of this sprint. Burndown and dashboard completion stats use the sprint date range.",
    "tooltips.sprintFilterActive": "Currently active iteration \u2014 only one sprint can be active at a time.",
    "tooltips.sprintFilterScheduled": "Stories assigned to any sprint.",
    "tooltips.sprintFilterUnscheduled": "Stories not in a sprint yet (often your backlog).",
    "tooltips.sprintName": "A label for this iteration, e.g. Sprint 12 or 2026 Q1 Sprint 1.",
    "tooltips.sprintStart": "Planned start of this sprint. Burndown and dashboard completion stats use the sprint date range.",
    "tooltips.sprintTodo": "Which time-boxed iteration this story belongs to. Leave empty if not scheduled yet.",
    "tooltips.status": "Which workflow lane this story is in. Done is whichever lane is marked as done in Settings \u2192 Workflow; that lane drives dashboard completion stats.",
    "tooltips.tags": "Free-form labels for filtering and grouping. On shared boards, tag colors are the same for everyone; your personal tag colors apply across your projects.",
    "tooltips.voiceCommand": "Story and todo mean the same thing. Use a local ID (12, #12) or a title phrase. One clear command per line \u2014 no pronouns like it or that.",
    "tooltips.workflowAddLane": "Adds a new column before the done lane. Lane names can be renamed later; internal keys stay fixed.",
};
const HYDRATION_BINDINGS = [
    ["data-i18n-text", "textContent"],
    ["data-i18n-aria-label", "aria-label"],
    ["data-i18n-placeholder", "placeholder"],
    ["data-i18n-title", "title"],
];
let activeLocale = "en";
let activeCatalog = BOOTSTRAP_EN_CATALOG;
let englishCatalog = BOOTSTRAP_EN_CATALOG;
let loader = defaultLoadLocale;
const catalogCache = new Map();
const warnedMissingKeys = new Set();
function getNodeEnv() {
    return String((globalThis.process?.env?.NODE_ENV) || "");
}
function getDefaultStorage() {
    try {
        return globalThis.localStorage || null;
    }
    catch {
        return null;
    }
}
function getDefaultLanguages() {
    const nav = globalThis.navigator;
    if (Array.isArray(nav?.languages) && nav.languages.length > 0) {
        return nav.languages;
    }
    return nav?.language ? [nav.language] : [];
}
function getDefaultDocumentElement() {
    return globalThis.document?.documentElement || null;
}
export function normalizeLocale(value) {
    if (!value)
        return null;
    const normalized = value.trim().toLowerCase().replace("_", "-");
    if (normalized === "pseudo")
        return "pseudo";
    if (normalized === "de" || normalized.startsWith("de-"))
        return "de";
    if (normalized === "en" || normalized.startsWith("en-"))
        return "en";
    return null;
}
export function isPublicLocale(locale) {
    return PUBLIC_LOCALES.includes(locale);
}
export function publicLocaleOptions() {
    return PUBLIC_LOCALES.map((id) => ({ id, label: LOCALE_LABELS[id] }));
}
export function detectLocale(options = {}) {
    const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
    try {
        const stored = normalizeLocale(storage?.getItem(LOCALE_STORAGE_KEY));
        if (stored)
            return stored;
    }
    catch {
        // localStorage may be blocked; fall through to browser language.
    }
    const languages = options.languages ?? getDefaultLanguages();
    for (const language of languages) {
        const locale = normalizeLocale(language);
        if (locale)
            return locale;
    }
    return "en";
}
function getAppVersion() {
    const meta = globalThis.document?.querySelector?.('meta[name="app-version"]');
    return meta?.getAttribute("content") || "";
}
async function defaultLoadLocale(locale) {
    if (typeof fetch !== "function") {
        throw new Error("Cannot load i18n catalog: fetch is unavailable");
    }
    const version = getAppVersion();
    const suffix = version ? `?v=${encodeURIComponent(version)}` : "";
    const res = await fetch(`/dist/i18n/locales/${locale}.json${suffix}`, {
        headers: { Accept: "application/json" },
    });
    if (!res.ok) {
        throw new Error(`Failed to load i18n catalog ${locale}: HTTP ${res.status}`);
    }
    return normalizeCatalog(await res.json(), locale);
}
function normalizeCatalog(raw, locale) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error(`Invalid i18n catalog ${locale}: expected object`);
    }
    const catalog = {};
    for (const [key, value] of Object.entries(raw)) {
        if (typeof value !== "string") {
            throw new Error(`Invalid i18n catalog ${locale}: ${key} must be a string`);
        }
        catalog[key] = value;
    }
    return catalog;
}
async function ensureLocaleLoaded(locale) {
    const cached = catalogCache.get(locale);
    if (cached)
        return cached;
    const catalog = await loader(locale);
    catalogCache.set(locale, catalog);
    if (locale === "en")
        englishCatalog = catalog;
    return catalog;
}
function updateDocumentLang(locale, element = getDefaultDocumentElement()) {
    if (!element)
        return;
    element.lang = locale === "pseudo" ? "en" : locale;
    element.setAttribute("data-locale", locale);
}
function persistLocale(locale, storage = getDefaultStorage()) {
    try {
        storage?.setItem(LOCALE_STORAGE_KEY, locale);
    }
    catch {
        // Storage is best effort; the active in-memory locale still changes.
    }
}
function dispatchLocaleChanged(locale) {
    const eventTarget = globalThis.document;
    if (!eventTarget || typeof eventTarget.dispatchEvent !== "function")
        return;
    eventTarget.dispatchEvent(new CustomEvent(I18N_LOCALE_CHANGED, { detail: { locale } }));
}
export async function initI18n(options = {}) {
    if (options.loadLocale) {
        loader = options.loadLocale;
        catalogCache.clear();
        activeLocale = "en";
        englishCatalog = BOOTSTRAP_EN_CATALOG;
        activeCatalog = BOOTSTRAP_EN_CATALOG;
    }
    const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
    const desiredLocale = normalizeLocale(options.locale) ||
        detectLocale({ storage, languages: options.languages });
    const en = await ensureLocaleLoaded("en");
    let nextLocale = desiredLocale;
    let nextCatalog = en;
    if (desiredLocale !== "en") {
        try {
            nextCatalog = await ensureLocaleLoaded(desiredLocale);
        }
        catch (err) {
            console.warn(`Falling back to English because locale "${desiredLocale}" failed to load.`, err);
            nextLocale = "en";
            nextCatalog = en;
        }
    }
    activeLocale = nextLocale;
    activeCatalog = nextCatalog;
    updateDocumentLang(activeLocale, options.documentElement ?? getDefaultDocumentElement());
    if (options.persist === true && storage) {
        persistLocale(activeLocale, storage);
    }
    return activeLocale;
}
export async function setLocale(locale) {
    const previousLocale = activeLocale;
    const previousCatalog = activeCatalog;
    const nextLocale = normalizeLocale(locale) || "en";
    const en = await ensureLocaleLoaded("en");
    let nextCatalog = en;
    let resolvedLocale = nextLocale;
    if (nextLocale !== "en") {
        try {
            nextCatalog = await ensureLocaleLoaded(nextLocale);
        }
        catch (err) {
            console.warn(`Falling back to English because locale "${nextLocale}" failed to load.`, err);
            resolvedLocale = "en";
        }
    }
    activeLocale = resolvedLocale;
    activeCatalog = nextCatalog;
    persistLocale(activeLocale);
    updateDocumentLang(activeLocale);
    if (previousLocale !== activeLocale || previousCatalog !== activeCatalog) {
        dispatchLocaleChanged(activeLocale);
    }
    return activeLocale;
}
export function getLocale() {
    return activeLocale;
}
function hasOwnMessage(catalog, key) {
    return Object.prototype.hasOwnProperty.call(catalog, key);
}
function strictMissingKeyMode() {
    const env = getNodeEnv();
    if (env === "test")
        return "throw";
    if (env === "development")
        return "warn";
    if (env === "production")
        return "off";
    const hostname = globalThis.location?.hostname || "";
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
        return "warn";
    }
    return "off";
}
function reportMissingKey(locale, key) {
    const message = `Missing i18n key "${key}" for locale "${locale}"`;
    const mode = strictMissingKeyMode();
    if (mode === "throw") {
        throw new Error(message);
    }
    if (mode === "warn" && !warnedMissingKeys.has(message)) {
        warnedMissingKeys.add(message);
        console.warn(message);
    }
}
function resolveMessage(key) {
    if (hasOwnMessage(activeCatalog, key)) {
        return activeCatalog[key];
    }
    const fallback = englishCatalog[key];
    reportMissingKey(activeLocale, key);
    return fallback || key;
}
function interpolate(message, values) {
    return message.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, name) => {
        const value = values[name];
        return value == null ? match : String(value);
    });
}
export function t(key, values = {}) {
    return interpolate(resolveMessage(key), values);
}
function elementsForAttribute(root, attributeName) {
    const elements = [];
    if (typeof Element !== "undefined" && root instanceof Element && root.hasAttribute(attributeName)) {
        elements.push(root);
    }
    root.querySelectorAll?.(`[${attributeName}]`).forEach((element) => elements.push(element));
    return elements;
}
export function hydrateI18n(root = globalThis.document) {
    if (!root)
        return;
    for (const [sourceAttribute, targetAttribute] of HYDRATION_BINDINGS) {
        for (const element of elementsForAttribute(root, sourceAttribute)) {
            const key = element.getAttribute(sourceAttribute);
            if (!key)
                continue;
            const message = t(key);
            if (targetAttribute === "textContent") {
                element.textContent = message;
            }
            else {
                element.setAttribute(targetAttribute, message);
            }
        }
    }
}
export function hasI18nKey(key) {
    return hasOwnMessage(activeCatalog, key) || hasOwnMessage(englishCatalog, key);
}
function intlLocale(locale = activeLocale) {
    return locale === "pseudo" ? "en" : locale;
}
export function formatDate(value, options) {
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat(intlLocale(), options).format(date);
}
export function formatNumber(value, options) {
    return new Intl.NumberFormat(intlLocale(), options).format(value);
}
function extractErrorBody(err) {
    const maybe = err;
    const data = maybe?.data ?? err;
    return data && typeof data === "object" ? data : null;
}
function nonEmptyString(value) {
    return typeof value === "string" && value.trim() ? value : null;
}
export function apiErrorMessage(err, options = {}) {
    const body = extractErrorBody(err);
    const error = body?.error;
    const details = error?.details || undefined;
    const reason = typeof details?.reason === "string" ? details.reason : "";
    const code = typeof error?.code === "string" ? error.code : "";
    if (code) {
        const reasonKey = reason ? `errors.${code}.${reason}` : "";
        if (reasonKey && hasI18nKey(reasonKey)) {
            return t(reasonKey, details);
        }
        const codeKey = `errors.${code}`;
        if (hasI18nKey(codeKey)) {
            return t(codeKey, (details || {}));
        }
    }
    if (options.fallbackKey && hasI18nKey(options.fallbackKey)) {
        return t(options.fallbackKey, (details || {}));
    }
    const rawApiMessage = nonEmptyString(error?.message);
    if (rawApiMessage) {
        return rawApiMessage;
    }
    const rawMessage = nonEmptyString(err?.message);
    if (rawMessage) {
        return rawMessage;
    }
    const status = err?.status;
    if (typeof status === "number" && Number.isFinite(status)) {
        return t("errors.httpStatus", { status });
    }
    return t("errors.generic");
}
export function resetI18nForTests() {
    activeLocale = "en";
    activeCatalog = BOOTSTRAP_EN_CATALOG;
    englishCatalog = BOOTSTRAP_EN_CATALOG;
    loader = defaultLoadLocale;
    catalogCache.clear();
    warnedMissingKeys.clear();
}
