import { describe, expect, it } from 'vitest';
import { transitionVoiceInteractionState } from './state-machine.js';

describe('voice interaction state machine', () => {
  it('keeps command listening and confirmation listening as separate states', () => {
    let state = transitionVoiceInteractionState('idle', 'start_command');
    expect(state).toBe('listening_command');
    state = transitionVoiceInteractionState(state, 'parsed');
    expect(state).toBe('parsed');
    state = transitionVoiceInteractionState(state, 'show_feedback');
    expect(state).toBe('showing_feedback_or_confirmation');
    state = transitionVoiceInteractionState(state, 'speak_confirmation');
    expect(state).toBe('speaking_confirmation');
    state = transitionVoiceInteractionState(state, 'listen_confirmation');
    expect(state).toBe('listening_confirmation');
    state = transitionVoiceInteractionState(state, 'execute');
    expect(state).toBe('executing');
  });

  it('moves unclear confirmation to error or cancel without executing', () => {
    expect(transitionVoiceInteractionState('listening_confirmation', 'error')).toBe('error');
    expect(transitionVoiceInteractionState('listening_confirmation', 'cancel')).toBe('cancelled');
  });

  it('keeps command, target disambiguation, and confirmation listening separate', () => {
    let state = transitionVoiceInteractionState('idle', 'start_command');
    expect(state).toBe('listening_command');
    state = transitionVoiceInteractionState(state, 'resolve_target');
    expect(state).toBe('resolving_target');
    state = transitionVoiceInteractionState(state, 'prompt_disambiguation');
    expect(state).toBe('disambiguation_prompt');
    state = transitionVoiceInteractionState(state, 'listen_disambiguation');
    expect(state).toBe('listening_disambiguation');
    state = transitionVoiceInteractionState(state, 'target_resolved');
    expect(state).toBe('resolved_target');
    state = transitionVoiceInteractionState(state, 'show_feedback');
    expect(state).toBe('showing_feedback_or_confirmation');
  });
});
