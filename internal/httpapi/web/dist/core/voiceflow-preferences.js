import { apiFetch } from '../api.js';
import { getUser } from '../state/selectors.js';
export const VOICE_FLOW_MODE_SAFE = "safe";
export const VOICE_FLOW_MODE_HANDS_FREE = "hands-free";
export const VOICE_FLOW_CONFIRM_DELETES = "deletes";
export const VOICE_FLOW_CONFIRM_MUTATIONS = "mutations";
export const VOICE_FLOW_MODE_STORAGE_KEY = "scrumboy.voiceFlowMode";
export const VOICE_FLOW_MODE_PREFERENCE_KEY = "voiceFlowMode";
export const VOICE_FLOW_HANDS_FREE_CONFIRMATION_STORAGE_KEY = "scrumboy.voiceFlowHandsFreeConfirmation";
export const VOICE_FLOW_HANDS_FREE_CONFIRMATION_PREFERENCE_KEY = "voiceFlowHandsFreeConfirmation";
export function normalizeVoiceFlowMode(value) {
    return value === VOICE_FLOW_MODE_HANDS_FREE ? VOICE_FLOW_MODE_HANDS_FREE : VOICE_FLOW_MODE_SAFE;
}
export function normalizeVoiceFlowHandsFreeConfirmation(value) {
    return value === VOICE_FLOW_CONFIRM_MUTATIONS ? VOICE_FLOW_CONFIRM_MUTATIONS : VOICE_FLOW_CONFIRM_DELETES;
}
export function getVoiceFlowModePreference() {
    try {
        return normalizeVoiceFlowMode(localStorage.getItem(VOICE_FLOW_MODE_STORAGE_KEY));
    }
    catch {
        return VOICE_FLOW_MODE_SAFE;
    }
}
export function getVoiceFlowHandsFreeConfirmationPreference() {
    try {
        return normalizeVoiceFlowHandsFreeConfirmation(localStorage.getItem(VOICE_FLOW_HANDS_FREE_CONFIRMATION_STORAGE_KEY));
    }
    catch {
        return VOICE_FLOW_CONFIRM_DELETES;
    }
}
export function setVoiceFlowModePreference(mode, opts) {
    const next = normalizeVoiceFlowMode(mode);
    try {
        localStorage.setItem(VOICE_FLOW_MODE_STORAGE_KEY, next);
    }
    catch {
    }
    if (opts?.skipRemote || !getUser())
        return;
    void apiFetch('/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ key: VOICE_FLOW_MODE_PREFERENCE_KEY, value: next }),
    }).catch(() => { });
}
export function setVoiceFlowHandsFreeConfirmationPreference(value, opts) {
    const next = normalizeVoiceFlowHandsFreeConfirmation(value);
    try {
        localStorage.setItem(VOICE_FLOW_HANDS_FREE_CONFIRMATION_STORAGE_KEY, next);
    }
    catch {
    }
    if (opts?.skipRemote || !getUser())
        return;
    void apiFetch('/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ key: VOICE_FLOW_HANDS_FREE_CONFIRMATION_PREFERENCE_KEY, value: next }),
    }).catch(() => { });
}
export function hydrateVoiceFlowModeFromServer(value) {
    setVoiceFlowModePreference(normalizeVoiceFlowMode(value), { skipRemote: true });
}
export function hydrateVoiceFlowHandsFreeConfirmationFromServer(value) {
    setVoiceFlowHandsFreeConfirmationPreference(normalizeVoiceFlowHandsFreeConfirmation(value), { skipRemote: true });
}
