export type McpToolName =
  | "todos.create"
  | "todos.get"
  | "todos.move"
  | "todos.delete"
  | "todos.update"
  | "members.list";

type McpEnvelope<T> =
  | { ok: true; data: T; meta?: Record<string, unknown> }
  | { ok: false; error?: { code?: string; message?: string; details?: unknown } };

export async function callMcpTool<T = unknown>(tool: McpToolName, input: Record<string, unknown>): Promise<T> {
  const res = await fetch("/mcp", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Scrumboy": "1",
    },
    body: JSON.stringify({ tool, input }),
  });
  const data = await res.json().catch(() => null) as McpEnvelope<T> | null;
  if (!res.ok || !data || data.ok !== true) {
    const message = data && "error" in data && data.error?.message ? data.error.message : `HTTP ${res.status}`;
    const err = new Error(message);
    (err as Error & { status?: number; data?: unknown }).status = res.status;
    (err as Error & { status?: number; data?: unknown }).data = data;
    throw err;
  }
  return data.data;
}
