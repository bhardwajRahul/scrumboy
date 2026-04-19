import { describe, expect, it, vi } from 'vitest';
import { buildMcpCall, executeCommandIR } from './execute.js';

describe('voice command MCP mapping', () => {
  it('maps supported intents to existing MCP tools only', () => {
    expect(buildMcpCall({
      intent: 'todos.create',
      projectId: 1,
      projectSlug: 'alpha',
      entities: { title: 'Fix login' },
    })).toEqual({
      tool: 'todos.create',
      input: { projectSlug: 'alpha', title: 'Fix login' },
    });

    expect(buildMcpCall({
      intent: 'todos.move',
      projectId: 1,
      projectSlug: 'alpha',
      entities: { localId: 56, toColumnKey: 'done' },
    })).toEqual({
      tool: 'todos.move',
      input: { projectSlug: 'alpha', localId: 56, toColumnKey: 'done' },
    });

    expect(buildMcpCall({
      intent: 'todos.delete',
      projectId: 1,
      projectSlug: 'alpha',
      entities: { localId: 56 },
    })).toEqual({
      tool: 'todos.delete',
      input: { projectSlug: 'alpha', localId: 56 },
    });

    expect(buildMcpCall({
      intent: 'todos.assign',
      projectId: 1,
      projectSlug: 'alpha',
      entities: { localId: 56, assigneeUserId: 7 },
    })).toEqual({
      tool: 'todos.update',
      input: { projectSlug: 'alpha', localId: 56, patch: { assigneeUserId: 7 } },
    });
  });

  it('records mutation and refreshes through injected hooks after MCP success', async () => {
    const callTool = vi.fn().mockResolvedValue({ todo: { localId: 56 } });
    const recordMutation = vi.fn();
    const refreshBoard = vi.fn().mockResolvedValue(undefined);

    await executeCommandIR({
      intent: 'todos.delete',
      projectId: 1,
      projectSlug: 'alpha',
      entities: { localId: 56 },
    }, { callTool, recordMutation, refreshBoard });

    expect(recordMutation).toHaveBeenCalledTimes(1);
    expect(callTool).toHaveBeenCalledWith('todos.delete', { projectSlug: 'alpha', localId: 56 });
    expect(refreshBoard).toHaveBeenCalledTimes(1);
  });
});
