import { describe, expect, it } from 'vitest';
import { normalizeLookup, parseSpokenNumber } from './normalize.js';

describe('voice command normalization', () => {
  it('normalizes supported story ID forms', () => {
    expect(parseSpokenNumber('56')).toEqual({ value: 56, ambiguous: false });
    expect(parseSpokenNumber('#56')).toEqual({ value: 56, ambiguous: false });
    expect(parseSpokenNumber('fifty six')).toEqual({ value: 56, ambiguous: false });
    expect(parseSpokenNumber('one hundred two')).toEqual({ value: 102, ambiguous: false });
  });

  it('marks digit-word sequences as ambiguous IDs', () => {
    expect(parseSpokenNumber('five six')).toEqual({ value: 56, ambiguous: true });
  });

  it('normalizes lookup phrases without preserving punctuation variants', () => {
    expect(normalizeLookup('In-Progress!')).toBe('in progress');
    expect(normalizeLookup('"Ada Lovelace"')).toBe('ada lovelace');
  });
});
