// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setUser } from '../state/mutations.js';
import {
  getVoiceFlowModePreference,
  hydrateVoiceFlowModeFromServer,
  setVoiceFlowModePreference,
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
});
