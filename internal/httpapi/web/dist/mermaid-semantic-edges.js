export const MERMAID_SEMANTIC_EDGES_URL = "/mermaid-semantic-edges.json";
export const DEFAULT_MERMAID_SEMANTIC_EDGE_CONFIG = {
    positiveColor: "#16a34a",
    negativeColor: "#dc2626",
    pairs: [
        { positive: "yes", negative: "no" },
        { positive: "true", negative: "false" },
        { positive: "pass", negative: "fail" },
    ],
};
let semanticEdgeConfigPromise = null;
function normalizeLabel(value) {
    return value.trim().toLowerCase();
}
function normalizeNodeId(raw) {
    const match = raw.trim().match(/^([A-Za-z][\w-]*)/);
    return match?.[1] ?? raw.trim();
}
function isSkippableDiagramLine(line) {
    const trimmed = line.trim();
    if (!trimmed) {
        return true;
    }
    return /^(linkStyle|style\s|classDef\s|class\s|subgraph\s|end\b|direction\s|%%)/i.test(trimmed);
}
function parseFlowchartEdge(line) {
    const trimmed = line.trim();
    if (isSkippableDiagramLine(trimmed) || !trimmed.includes("-->")) {
        return null;
    }
    const pipeLabel = trimmed.match(/^(.*?)-->\s*\|([^|]+)\|\s*(.+)$/);
    if (pipeLabel) {
        return { from: normalizeNodeId(pipeLabel[1]), label: pipeLabel[2].trim() };
    }
    const middleLabel = trimmed.match(/^(.*?)\s*--\s*([^-]+?)\s*-->\s*(.+)$/);
    if (middleLabel) {
        return { from: normalizeNodeId(middleLabel[1]), label: middleLabel[2].trim() };
    }
    const plain = trimmed.match(/^(.*?)\s*--+>\s*(.+)$/);
    if (plain) {
        return { from: normalizeNodeId(plain[1]), label: "" };
    }
    return null;
}
function sanitizeConfig(raw) {
    if (!raw || typeof raw !== "object") {
        return null;
    }
    const value = raw;
    const positiveColor = typeof value.positiveColor === "string" && value.positiveColor.trim() ? value.positiveColor.trim() : null;
    const negativeColor = typeof value.negativeColor === "string" && value.negativeColor.trim() ? value.negativeColor.trim() : null;
    if (!positiveColor || !negativeColor || !Array.isArray(value.pairs)) {
        return null;
    }
    const pairs = [];
    for (const entry of value.pairs) {
        if (!entry || typeof entry !== "object") {
            continue;
        }
        const pair = entry;
        const positive = typeof pair.positive === "string" ? pair.positive.trim() : "";
        const negative = typeof pair.negative === "string" ? pair.negative.trim() : "";
        if (!positive || !negative || normalizeLabel(positive) === normalizeLabel(negative)) {
            continue;
        }
        pairs.push({ positive, negative });
    }
    return pairs.length > 0 ? { positiveColor, negativeColor, pairs } : null;
}
export async function loadMermaidSemanticEdgeConfig() {
    if (typeof window === "undefined") {
        return DEFAULT_MERMAID_SEMANTIC_EDGE_CONFIG;
    }
    if (!semanticEdgeConfigPromise) {
        semanticEdgeConfigPromise = (async () => {
            try {
                const response = await fetch(MERMAID_SEMANTIC_EDGES_URL, { cache: "no-store" });
                if (!response.ok) {
                    return DEFAULT_MERMAID_SEMANTIC_EDGE_CONFIG;
                }
                return sanitizeConfig(await response.json()) ?? DEFAULT_MERMAID_SEMANTIC_EDGE_CONFIG;
            }
            catch {
                return DEFAULT_MERMAID_SEMANTIC_EDGE_CONFIG;
            }
        })();
    }
    return semanticEdgeConfigPromise;
}
export function resetMermaidSemanticEdgeConfigCacheForTests() {
    semanticEdgeConfigPromise = null;
}
function matchPair(leftLabel, rightLabel, pairs) {
    const left = normalizeLabel(leftLabel);
    const right = normalizeLabel(rightLabel);
    for (const pair of pairs) {
        const positive = normalizeLabel(pair.positive);
        const negative = normalizeLabel(pair.negative);
        if (left === positive && right === negative) {
            return { positiveLabel: left, negativeLabel: right };
        }
        if (left === negative && right === positive) {
            return { positiveLabel: right, negativeLabel: left };
        }
    }
    return null;
}
export function buildMermaidSemanticLabelColors(source, config = DEFAULT_MERMAID_SEMANTIC_EDGE_CONFIG) {
    const colors = new Map();
    if (!source.trim()) {
        return colors;
    }
    const edges = [];
    for (const line of source.split("\n")) {
        const parsed = parseFlowchartEdge(line);
        if (!parsed) {
            continue;
        }
        edges.push({ index: edges.length, from: parsed.from, label: parsed.label });
    }
    const bySource = new Map();
    for (const edge of edges) {
        if (!edge.label) {
            continue;
        }
        const group = bySource.get(edge.from) ?? [];
        group.push(edge);
        bySource.set(edge.from, group);
    }
    for (const group of bySource.values()) {
        if (group.length !== 2) {
            continue;
        }
        const match = matchPair(group[0].label, group[1].label, config.pairs);
        if (!match) {
            continue;
        }
        colors.set(match.positiveLabel, config.positiveColor);
        colors.set(match.negativeLabel, config.negativeColor);
    }
    return colors;
}
// Recolors only the background of a matched edge label, scoped to that label's
// group. The visible pill is Mermaid's `.labelBkg` div (foreignObject/HTML path)
// or a `rect` (pure-SVG path). The label text span is colored too in case
// `edgeLabelBackground` is opaque. Connector lines (`.flowchart-link` paths) are
// never selected, so the lines stay untouched.
function colorMatchedLabel(label, color) {
    const group = label.closest("g.edgeLabel") ?? label;
    // HTML/foreignObject path: the gray pill is a `.labelBkg` div, which may be an
    // ancestor of the matched span or a sibling inside the label group.
    const ancestorBkg = label.closest(".labelBkg");
    if (ancestorBkg) {
        ancestorBkg.style.backgroundColor = color;
    }
    for (const bkg of Array.from(group.querySelectorAll(".labelBkg"))) {
        bkg.style.backgroundColor = color;
    }
    for (const span of Array.from(group.querySelectorAll("span.edgeLabel"))) {
        span.style.backgroundColor = color;
    }
    // Pure-SVG path: the background is a `rect`.
    for (const rect of Array.from(group.querySelectorAll("rect"))) {
        rect.setAttribute("fill", color);
    }
}
export function paintMermaidSemanticLabelBackgrounds(canvas, labelColors) {
    if (labelColors.size === 0) {
        return;
    }
    let attempts = 0;
    const paint = () => {
        const labels = Array.from(canvas.querySelectorAll(".edgeLabel"));
        // The inline SVG may not be attached for a frame after render; retry briefly.
        if (labels.length === 0 && attempts < 10 && canvas.isConnected) {
            attempts += 1;
            requestAnimationFrame(paint);
            return;
        }
        // Dedupe by label group so we color each edge label's box once, regardless
        // of whether the outer <g> or the inner <span> matched the text.
        const colored = new Set();
        for (const label of labels) {
            const text = label.textContent?.trim().toLowerCase() ?? "";
            const color = labelColors.get(text);
            if (!color) {
                continue;
            }
            const group = label.closest("g.edgeLabel") ?? label;
            if (colored.has(group)) {
                continue;
            }
            colored.add(group);
            colorMatchedLabel(label, color);
        }
    };
    paint();
}
