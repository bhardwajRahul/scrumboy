// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setUser } from '../state/mutations.js';
import {
  getVoiceFlowHandsFreeConfirmationPreference,
  getVoiceFlowModePreference,
  hydrateVoiceFlowHandsFreeConfirmationFromServer,
  hydrateVoiceFlowModeFromServer,
  normalizeVoiceFlowHandsFreeConfirmation,
  setVoiceFlowHandsFreeConfirmationPreference,
  setVoiceFlowModePreference,
  VOICE_FLOW_HANDS_FREE_CONFIRMATION_STORAGE_KEY,
  VOICE_FLOW_MODE_STORAGE_KEY,
} from './voiceflow-preferences.js';

beforeEach(() => {
  localStorage.clear();
  setUser(null);
  vi.unstubAllGlobals();
});

afterEach(() => {
  setUser(null);
  vi.unstubAllGlobals();
});

describe('VoiceFlow preferences', () => {
  it('defaults to Safe-Mode and persists Hands-Free locally', () => {
    expect(getVoiceFlowModePreference()).toBe('safe');
    setVoiceFlowModePreference('hands-free', { skipRemote: true });
    expect(localStorage.getItem(VOICE_FLOW_MODE_STORAGE_KEY)).toBe('hands-free');
    expect(getVoiceFlowModePreference()).toBe('hands-free');
  });

  it('hydrates invalid server values back to Safe-Mode', () => {
    hydrateVoiceFlowModeFromServer('unexpected');
    expect(getVoiceFlowModePreference()).toBe('safe');
  });

  it('saves the mode through the existing user preference endpoint when signed in', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setUser({ id: 1, name: 'Ada' });

    setVoiceFlowModePreference('hands-free');

    expect(fetchMock).toHaveBeenCalledWith('/api/user/preferences', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ key: 'voiceFlowMode', value: 'hands-free' }),
    }));
  });

  it('defaults to confirming deletes only and persists mutating confirmation locally', () => {
    expect(getVoiceFlowHandsFreeConfirmationPreference()).toBe('deletes');
    setVoiceFlowHandsFreeConfirmationPreference('mutations', { skipRemote: true });
    expect(localStorage.getItem(VOICE_FLOW_HANDS_FREE_CONFIRMATION_STORAGE_KEY)).toBe('mutations');
    expect(getVoiceFlowHandsFreeConfirmationPreference()).toBe('mutations');
  });

  it('hydrates invalid confirmation values back to delete confirmations only', () => {
    hydrateVoiceFlowHandsFreeConfirmationFromServer('unexpected');
    expect(getVoiceFlowHandsFreeConfirmationPreference()).toBe('deletes');
  });

  it('normalizes confirmation preference values', () => {
    expect(normalizeVoiceFlowHandsFreeConfirmation('deletes')).toBe('deletes');
    expect(normalizeVoiceFlowHandsFreeConfirmation('mutations')).toBe('mutations');
    expect(normalizeVoiceFlowHandsFreeConfirmation('unexpected')).toBe('deletes');
  });

  it('saves the confirmation policy through the existing user preference endpoint when signed in', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setUser({ id: 1, name: 'Ada' });

    setVoiceFlowHandsFreeConfirmationPreference('mutations');

    expect(fetchMock).toHaveBeenCalledWith('/api/user/preferences', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ key: 'voiceFlowHandsFreeConfirmation', value: 'mutations' }),
    }));
  });
});
