import { describe, expect, it } from 'vitest';
import { canShowVoiceCommands, type VoiceCommandCapabilityInput } from './board-command-capabilities.js';

const base: VoiceCommandCapabilityInput = {
  projectId: 1,
  projectSlug: 'alpha',
  role: 'maintainer',
  isTemporary: false,
  isAnonymous: false,
};

describe('voice command board capabilities', () => {
  it('allows durable project boards for maintainers only', () => {
    expect(canShowVoiceCommands(base)).toBe(true);
    expect(canShowVoiceCommands({ ...base, role: 'contributor' })).toBe(false);
    expect(canShowVoiceCommands({ ...base, role: 'editor' })).toBe(false);
    expect(canShowVoiceCommands({ ...base, role: 'viewer' })).toBe(false);
    expect(canShowVoiceCommands({ ...base, role: null })).toBe(false);
  });

  it('rejects boards without session-backed durable project scope', () => {
    expect(canShowVoiceCommands({ ...base, isTemporary: true })).toBe(false);
    expect(canShowVoiceCommands({ ...base, isAnonymous: true })).toBe(false);
    expect(canShowVoiceCommands({ ...base, projectSlug: '' })).toBe(false);
    expect(canShowVoiceCommands({ ...base, projectSlug: null })).toBe(false);
    expect(canShowVoiceCommands({ ...base, projectId: 0 })).toBe(false);
    expect(canShowVoiceCommands({ ...base, projectId: Number.NaN })).toBe(false);
    expect(canShowVoiceCommands({ ...base, projectId: null })).toBe(false);
  });
});
