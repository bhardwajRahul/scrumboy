export async function callMcpTool(tool, input) {
    const res = await fetch("/mcp", {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            "X-Scrumboy": "1",
        },
        body: JSON.stringify({ tool, input }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
        const message = data && "error" in data && data.error?.message ? data.error.message : `HTTP ${res.status}`;
        const err = new Error(message);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data.data;
}
