function escapeHTML(s) {
    return String(s)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
export const FIELD_TOOLTIPS = {
    estimationPoints: 'Relative effort, not hours. Uses a modified Fibonacci scale (1–40). Compare to similar work on this board.',
    sprintTodo: 'Which time-boxed iteration this story belongs to. Leave empty if not scheduled yet.',
    status: 'Which workflow lane this story is in. Done is whichever lane is marked as done in Settings → Workflow; that lane drives dashboard completion stats.',
    linkedStories: 'Link related stories (dependencies, parent/child, duplicates). Search by local ID (#12) or title. Links are informational — they do not move cards automatically.',
    sprintName: 'A label for this iteration, e.g. Sprint 12 or 2026 Q1 Sprint 1.',
    sprintStart: 'Planned start of this sprint. Burndown and dashboard completion stats use the sprint date range.',
    sprintEnd: 'Planned end of this sprint. Burndown and dashboard completion stats use the sprint date range.',
    sprintDefaultWeeks: 'When you create a sprint, the end date defaults to this many weeks after the start date.',
    doneLane: 'Exactly one lane counts as done. Stories there get a completion timestamp used for dashboard stats and burndown, even if the lane is named Shipped instead of Done.',
    workflowAddLane: 'Adds a new column before the done lane. Lane names can be renamed later; internal keys stay fixed.',
    tags: 'Free-form labels for filtering and grouping. On shared boards, tag colors are the same for everyone; your personal tag colors apply across your projects.',
    boardSearch: 'Search titles and notes. Combine with tag and sprint chips to narrow the board.',
    sprintFilterScheduled: 'Stories assigned to any sprint.',
    sprintFilterUnscheduled: 'Stories not in a sprint yet (often your backlog).',
    sprintFilterActive: 'Currently active iteration — only one sprint can be active at a time.',
    voiceCommand: 'Story and todo mean the same thing. Use a local ID (12, #12) or a title phrase. One clear command per line — no pronouns like it or that.',
    memberRole: 'Viewer: read-only. Contributor: edit notes when assigned. Maintainer: create, move, assign, sprints, and settings.',
};
export function titleAttr(tip) {
    return ` title="${escapeHTML(tip)}"`;
}
export function fieldLabelHTML(label, tip) {
    return `<div class="field__label"${titleAttr(tip)}>${escapeHTML(label)}</div>`;
}
/** Apply native title tooltips to elements matching selectors within root (defaults to document). */
export function applyFieldTooltips(bindings, root = document) {
    for (const [selector, keyOrTip] of Object.entries(bindings)) {
        const el = root.querySelector(selector);
        if (!el)
            continue;
        const tip = keyOrTip in FIELD_TOOLTIPS
            ? FIELD_TOOLTIPS[keyOrTip]
            : keyOrTip;
        el.setAttribute('title', tip);
    }
}
export const TODO_DIALOG_TOOLTIPS = {
    '#todoEstimationField .field__label': 'estimationPoints',
    '#todoSprintField .field__label': 'sprintTodo',
    '#todoForm .field:has(#todoStatus) .field__label': 'status',
    '#todoLinksField .field__label': 'linkedStories',
    '#linksSearchInput': 'linkedStories',
    '#todoForm label.field:has(#todoTags) .field__label': 'tags',
    '#todoTags': 'tags',
};
export const BULK_EDIT_TOOLTIPS = {
    '#bulkEstimation': 'estimationPoints',
    '#bulkEditEstimationRow .bulk-edit-field__check span': 'estimationPoints',
    '#bulkSprint': 'sprintTodo',
    '#bulkEditSprintRow .bulk-edit-field__check span': 'sprintTodo',
    '#bulkStatus': 'status',
    '#bulkEditForm .bulk-edit-field:has(#bulkStatus) .bulk-edit-field__check span': 'status',
    '#bulkTagsInput': 'tags',
    '#bulkEditTagsRow .bulk-edit-field__check span': 'tags',
};
