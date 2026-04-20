import { apiFetch } from '../api.js';
import { getUser } from '../state/selectors.js';

export type VoiceFlowMode = "safe" | "hands-free";

export const VOICE_FLOW_MODE_SAFE: VoiceFlowMode = "safe";
export const VOICE_FLOW_MODE_HANDS_FREE: VoiceFlowMode = "hands-free";
export const VOICE_FLOW_MODE_STORAGE_KEY = "scrumboy.voiceFlowMode";
export const VOICE_FLOW_MODE_PREFERENCE_KEY = "voiceFlowMode";

export function normalizeVoiceFlowMode(value: unknown): VoiceFlowMode {
  return value === VOICE_FLOW_MODE_HANDS_FREE ? VOICE_FLOW_MODE_HANDS_FREE : VOICE_FLOW_MODE_SAFE;
}

export function getVoiceFlowModePreference(): VoiceFlowMode {
  try {
    return normalizeVoiceFlowMode(localStorage.getItem(VOICE_FLOW_MODE_STORAGE_KEY));
  } catch {
    return VOICE_FLOW_MODE_SAFE;
  }
}

export function setVoiceFlowModePreference(mode: VoiceFlowMode, opts?: { skipRemote?: boolean }): void {
  const next = normalizeVoiceFlowMode(mode);
  try {
    localStorage.setItem(VOICE_FLOW_MODE_STORAGE_KEY, next);
  } catch {
  }
  if (opts?.skipRemote || !getUser()) return;
  void apiFetch('/api/user/preferences', {
    method: 'PUT',
    body: JSON.stringify({ key: VOICE_FLOW_MODE_PREFERENCE_KEY, value: next }),
  }).catch(() => {});
}

export function hydrateVoiceFlowModeFromServer(value: unknown): void {
  setVoiceFlowModePreference(normalizeVoiceFlowMode(value), { skipRemote: true });
}
