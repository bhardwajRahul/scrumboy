export function canShowVoiceCommands(input) {
    return typeof input.projectId === "number"
        && Number.isFinite(input.projectId)
        && input.projectId > 0
        && typeof input.projectSlug === "string"
        && input.projectSlug.trim().length > 0
        && input.role === "maintainer"
        && !input.isTemporary
        && !input.isAnonymous;
}
