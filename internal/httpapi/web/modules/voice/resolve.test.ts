import { describe, expect, it, vi } from 'vitest';
import type { Board } from '../types.js';
import type { BoardMember } from '../state/state.js';
import { parseCommand } from './parser.js';
import { resolveCommandDraft } from './resolve.js';

function board(overrides: Partial<Board> = {}): Board {
  return {
    project: {
      id: 1,
      name: 'Alpha',
      slug: 'alpha',
      dominantColor: '#123456',
      creatorUserId: 1,
    },
    tags: [],
    columnOrder: [
      { key: 'backlog', name: 'Backlog', isDone: false },
      { key: 'not_started', name: 'Not Started', isDone: false },
      { key: 'doing', name: 'In Progress', isDone: false },
      { key: 'testing', name: 'Testing', isDone: false },
      { key: 'done', name: 'Done', isDone: true },
    ],
    columns: {
      backlog: [],
      not_started: [],
      doing: [{ id: 10, localId: 56, title: 'Fix login', status: 'doing' }],
      testing: [],
      done: [],
    },
    ...overrides,
  };
}

const members: BoardMember[] = [
  { userId: 7, name: 'Ada Lovelace', email: 'ada@example.com', role: 'maintainer' },
  { userId: 8, name: 'Grace Hopper', email: 'grace@example.com', role: 'contributor' },
];

async function parseAndResolve(input: string, sourceBoard = board()) {
  const parsed = parseCommand(input);
  if (!parsed.ok) throw new Error('parse failed');
  return resolveCommandDraft(parsed.value, {
    projectId: 1,
    projectSlug: 'alpha',
    board: sourceBoard,
    members,
  });
}

describe('voice command resolution', () => {
  it('maps spoken status aliases to active board lane keys', async () => {
    const resolved = await parseAndResolve('story 56 is in progress');

    expect(resolved).toMatchObject({
      ok: true,
      value: {
        ir: {
          intent: 'todos.move',
          projectId: 1,
          projectSlug: 'alpha',
          entities: { localId: 56, toColumnKey: 'doing' },
        },
      },
    });
  });

  it('resolves assignees only from active project members', async () => {
    const resolved = await parseAndResolve('assign story 56 to ada');

    expect(resolved).toMatchObject({
      ok: true,
      value: {
        ir: {
          intent: 'todos.assign',
          entities: { localId: 56, assigneeUserId: 7 },
        },
      },
    });
  });

  it('rejects ambiguous lane names', async () => {
    const customBoard = board({
      columnOrder: [
        { key: 'review_a', name: 'Review', isDone: false },
        { key: 'review_b', name: 'Review', isDone: false },
      ],
      columns: {
        review_a: [{ id: 10, localId: 56, title: 'Fix login', status: 'review_a' }],
        review_b: [],
      },
    });

    const resolved = await parseAndResolve('move story 56 to review', customBoard);

    expect(resolved).toEqual({
      ok: false,
      code: 'ambiguous_status',
      message: 'Status matches more than one lane.',
    });
  });

  it('verifies unloaded stories through the active project MCP tool only', async () => {
    const parsed = parseCommand('delete story 99');
    if (!parsed.ok) throw new Error('parse failed');
    const callTool = vi.fn().mockResolvedValue({
      todo: { id: 11, localId: 99, title: 'Deferred story', status: 'backlog' },
    });

    const resolved = await resolveCommandDraft(parsed.value, {
      projectId: 1,
      projectSlug: 'alpha',
      board: board(),
      members,
      callTool,
    });

    expect(callTool).toHaveBeenCalledWith('todos.get', { projectSlug: 'alpha', localId: 99 });
    expect(resolved).toMatchObject({
      ok: true,
      value: { ir: { intent: 'todos.delete', entities: { localId: 99 } } },
    });
  });
});
