export type VoiceCommandCapabilityInput = {
  projectId: number | null | undefined;
  projectSlug: string | null | undefined;
  role: string | null | undefined;
  isTemporary: boolean;
  isAnonymous: boolean;
};

export function canShowVoiceCommands(input: VoiceCommandCapabilityInput): boolean {
  return typeof input.projectId === "number"
    && Number.isFinite(input.projectId)
    && input.projectId > 0
    && typeof input.projectSlug === "string"
    && input.projectSlug.trim().length > 0
    && input.role === "maintainer"
    && !input.isTemporary
    && !input.isAnonymous;
}
