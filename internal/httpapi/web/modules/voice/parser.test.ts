import { describe, expect, it } from 'vitest';
import { parseCommand } from './parser.js';

describe('voice command parser', () => {
  it('accepts exactly the MVP command forms', () => {
    expect(parseCommand('create story Fix login')).toEqual({
      ok: true,
      value: { intent: 'todos.create', title: 'Fix login' },
    });
    expect(parseCommand('move story fifty six to in progress')).toEqual({
      ok: true,
      value: { intent: 'todos.move', localId: 56, rawStatus: 'in progress', ambiguousId: false },
    });
    expect(parseCommand('delete story #56')).toEqual({
      ok: true,
      value: { intent: 'todos.delete', localId: 56, ambiguousId: false },
    });
    expect(parseCommand('assign story 56 to Ada')).toEqual({
      ok: true,
      value: { intent: 'todos.assign', localId: 56, rawUser: 'ada', ambiguousId: false },
    });
    expect(parseCommand('story 56 is done')).toEqual({
      ok: true,
      value: { intent: 'todos.move', localId: 56, rawStatus: 'done', ambiguousId: false },
    });
  });

  it('rejects broadened grammar and project-scope phrases', () => {
    expect(parseCommand('new story Fix login').ok).toBe(false);
    expect(parseCommand('create todo Fix login').ok).toBe(false);
    expect(parseCommand('move story 56 to done in project beta')).toEqual({
      ok: false,
      code: 'project_scope',
      message: 'Project scope is fixed by the current board.',
    });
  });
});
