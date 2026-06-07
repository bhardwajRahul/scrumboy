/**
 * Port of internal/httpapi/web/modules/mermaid-semantic-edges.ts
 * for the standalone docs/diagrams viewer.
 */
(function (global) {
  const MERMAID_SEMANTIC_EDGES_URL = "mermaid-semantic-edges.json";

  const DEFAULT_MERMAID_SEMANTIC_EDGE_CONFIG = {
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
    const positiveColor =
      typeof raw.positiveColor === "string" && raw.positiveColor.trim() ? raw.positiveColor.trim() : null;
    const negativeColor =
      typeof raw.negativeColor === "string" && raw.negativeColor.trim() ? raw.negativeColor.trim() : null;
    if (!positiveColor || !negativeColor || !Array.isArray(raw.pairs)) {
      return null;
    }

    const pairs = [];
    for (const entry of raw.pairs) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const positive = typeof entry.positive === "string" ? entry.positive.trim() : "";
      const negative = typeof entry.negative === "string" ? entry.negative.trim() : "";
      if (!positive || !negative || normalizeLabel(positive) === normalizeLabel(negative)) {
        continue;
      }
      pairs.push({ positive, negative });
    }

    return pairs.length > 0 ? { positiveColor, negativeColor, pairs } : null;
  }

  async function loadMermaidSemanticEdgeConfig() {
    if (!semanticEdgeConfigPromise) {
      semanticEdgeConfigPromise = (async () => {
        try {
          const response = await fetch(MERMAID_SEMANTIC_EDGES_URL, { cache: "no-store" });
          if (!response.ok) {
            return DEFAULT_MERMAID_SEMANTIC_EDGE_CONFIG;
          }
          return sanitizeConfig(await response.json()) ?? DEFAULT_MERMAID_SEMANTIC_EDGE_CONFIG;
        } catch {
          return DEFAULT_MERMAID_SEMANTIC_EDGE_CONFIG;
        }
      })();
    }
    return semanticEdgeConfigPromise;
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

  function buildMermaidSemanticLabelColors(source, config) {
    const cfg = config ?? DEFAULT_MERMAID_SEMANTIC_EDGE_CONFIG;
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
      const match = matchPair(group[0].label, group[1].label, cfg.pairs);
      if (!match) {
        continue;
      }
      colors.set(match.positiveLabel, cfg.positiveColor);
      colors.set(match.negativeLabel, cfg.negativeColor);
    }

    return colors;
  }

  const SEMANTIC_LABEL_MIN_WIDTH = {
    yes: 44,
    no: 36,
    true: 48,
    false: 48,
    pass: 44,
    fail: 40,
  };

  function expandForeignObjectForLabel(label) {
    const bkg = label.closest(".labelBkg");
    if (!bkg) {
      return;
    }
    const foreignObject = label.closest("foreignObject");
    if (!foreignObject) {
      return;
    }

    const text = (bkg.textContent || "").trim().toLowerCase();
    const inner = bkg.querySelector("p, span");
    const padX = 16;
    const padY = 8;

    bkg.style.removeProperty("width");
    bkg.style.removeProperty("height");
    bkg.style.removeProperty("min-width");
    bkg.style.removeProperty("max-width");

    const textWidth = inner ? Math.max(inner.scrollWidth, inner.offsetWidth) : bkg.scrollWidth;
    const textHeight = inner ? Math.max(inner.scrollHeight, inner.offsetHeight) : bkg.scrollHeight;
    const minWidth = SEMANTIC_LABEL_MIN_WIDTH[text] || 40;
    const width = Math.max(minWidth, Math.ceil(textWidth + padX));
    const height = Math.max(24, Math.ceil(textHeight + padY));

    foreignObject.setAttribute("width", String(width));
    foreignObject.setAttribute("height", String(height));
    foreignObject.style.overflow = "visible";

    bkg.style.boxSizing = "border-box";
    bkg.style.width = "100%";
    bkg.style.height = "100%";
    bkg.style.display = "inline-flex";
    bkg.style.alignItems = "center";
    bkg.style.justifyContent = "center";
    bkg.style.padding = "2px 8px";
    bkg.style.whiteSpace = "nowrap";
  }

  function colorMatchedLabel(label, color) {
    const group = label.closest("g.edgeLabel") ?? label.closest(".labelBkg") ?? label;

    const ancestorBkg = label.closest(".labelBkg");
    if (ancestorBkg) {
      ancestorBkg.style.backgroundColor = color;
      ancestorBkg.style.borderRadius = "4px";
    }
    for (const bkg of group.querySelectorAll(".labelBkg")) {
      bkg.style.backgroundColor = color;
      bkg.style.borderRadius = "4px";
    }
    for (const span of group.querySelectorAll("span.edgeLabel")) {
      span.style.backgroundColor = color;
    }
    for (const rect of group.querySelectorAll("rect")) {
      rect.setAttribute("fill", color);
      rect.setAttribute("stroke", color);
    }
    expandForeignObjectForLabel(label);
  }

  function paintMermaidSemanticLabelBackgrounds(canvas, labelColors) {
    if (!labelColors || labelColors.size === 0) {
      return;
    }

    let attempts = 0;
    const paint = () => {
      // Mermaid 11 nests HTML labels under both <g class="edgeLabel"> and
      // <span class="edgeLabel">. Paint only the HTML span so sizing runs on
      // the foreignObject-backed pill, not the outer SVG group.
      const labels = Array.from(canvas.querySelectorAll("foreignObject .edgeLabel"));
      if (labels.length === 0) {
        labels.push(...canvas.querySelectorAll("g.edgeLabel"));
      }

      if (labels.length === 0 && attempts < 10 && canvas.isConnected) {
        attempts += 1;
        requestAnimationFrame(paint);
        return;
      }

      const colored = new Set();
      const matched = [];
      for (const label of labels) {
        const text = label.textContent?.trim().toLowerCase() ?? "";
        const color = labelColors.get(text);
        if (!color) {
          continue;
        }
        const group = label.closest(".labelBkg") ?? label.closest("g.edgeLabel") ?? label;
        if (colored.has(group)) {
          continue;
        }
        colored.add(group);
        colorMatchedLabel(label, color);
        matched.push(label);
      }

      if (matched.length > 0) {
        requestAnimationFrame(() => {
          for (const label of matched) {
            expandForeignObjectForLabel(label);
          }
        });
      }
    };

    paint();
  }

  global.MermaidSemanticEdges = {
    DEFAULT_MERMAID_SEMANTIC_EDGE_CONFIG,
    loadMermaidSemanticEdgeConfig,
    buildMermaidSemanticLabelColors,
    paintMermaidSemanticLabelBackgrounds,
  };
})(typeof window !== "undefined" ? window : globalThis);
