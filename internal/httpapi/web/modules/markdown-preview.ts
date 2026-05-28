import {
  buildMermaidSemanticLabelColors,
  loadMermaidSemanticEdgeConfig,
  paintMermaidSemanticLabelBackgrounds,
} from "./mermaid-semantic-edges.js";
import { escapeHTML } from "./utils.js";

const SAFE_TAGS = [
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "ul",
];

const SAFE_ATTRS = ["href", "rel", "target"];
const MERMAID_PLACEHOLDER_PREFIX = "__SCRUMBOY_MERMAID_BLOCK__";
const MERMAID_SCRIPT_SRC = "/vendor/mermaid.min.js";
const MERMAID_MAX_TEXT_SIZE = 50_000;
const MERMAID_MAX_EDGES = 500;
const MERMAID_MAX_BLOCKS_PER_PREVIEW = 4;
const MERMAID_MAX_CHARS_PER_BLOCK = 4_000;
const MERMAID_MAX_TOTAL_CHARS_PER_PREVIEW = 8_000;
const MERMAID_DIRECTIVE_BLOCK_RE = /%%\{[\s\S]*?\}%%/g;

type MarkdownPreviewOptions = {
  mermaidEnabled?: boolean;
};

type MermaidBlock = {
  placeholder: string;
  displaySource: string;
  renderSource: string;
  warningMessage?: string;
};

type MermaidHost = {
  block: MermaidBlock;
  canvas: HTMLElement;
  host: HTMLElement;
};

type MermaidPreviewThemeKey = "light" | "dark";

let markdownRenderer: MarkdownItInstance | null = null;
let mermaidConfiguredThemeKey: MermaidPreviewThemeKey | null = null;
let mermaidLoadPromise: Promise<MermaidInstance> | null = null;
const renderEpochByContainer = new WeakMap<HTMLElement, number>();

function getMarkdownFactory(): MarkdownItFactory {
  if (typeof window === "undefined" || typeof window.markdownit !== "function") {
    throw new Error("Markdown preview is unavailable: missing /vendor/markdown-it.min.js");
  }
  return window.markdownit;
}

function getDOMPurify(): DOMPurifyLike {
  if (typeof window === "undefined" || !window.DOMPurify || typeof window.DOMPurify.sanitize !== "function") {
    throw new Error("Markdown preview is unavailable: missing /vendor/purify.min.js");
  }
  return window.DOMPurify;
}

function getMermaidGlobal(): MermaidInstance {
  if (typeof window === "undefined" || !window.mermaid) {
    throw new Error("Markdown preview is unavailable: missing /vendor/mermaid.min.js");
  }
  return window.mermaid;
}

function renderImageTokenAsText(token: any): string {
  const alt = token?.content ?? "";
  const src = token?.attrGet?.("src") ?? "";
  const title = token?.attrGet?.("title") ?? "";
  const titlePart = title ? ` "${title}"` : "";
  return escapeHTML(`![${alt}](${src}${titlePart})`);
}

function getMarkdownRenderer(): MarkdownItInstance {
  if (markdownRenderer) {
    return markdownRenderer;
  }

  const factory = getMarkdownFactory();
  const renderer = factory("default", {
    html: false,
    breaks: true,
    linkify: false,
  });

  renderer.renderer.rules.image = (tokens, idx) => renderImageTokenAsText(tokens[idx]);
  markdownRenderer = renderer;
  return renderer;
}

function getFenceLanguage(info: string | undefined): string {
  return (info || "").trim().split(/\s+/, 1)[0]?.toLowerCase() || "";
}

function renderFenceToken(token: any): string {
  const language = getFenceLanguage(token?.info ?? "");
  const classAttr = language ? ` class="language-${escapeHTML(language)}"` : "";
  return `<pre><code${classAttr}>${escapeHTML(token?.content ?? "")}</code></pre>\n`;
}

function createMermaidPlaceholderNonce(): string {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replace(/-/g, "");
    }
    if (typeof crypto.getRandomValues === "function") {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

function buildMermaidPlaceholder(nonce: string, index: number): string {
  return `${MERMAID_PLACEHOLDER_PREFIX}${nonce}_${index}__`;
}

function stripUnsupportedMermaidDirectives(source: string): string {
  return source.replace(MERMAID_DIRECTIVE_BLOCK_RE, "").trim();
}

function getMermaidWarningMessage(
  blockIndex: number,
  displaySource: string,
  renderSource: string,
  totalCharsBeforeBlock: number,
): string | undefined {
  if (renderSource.trim() === "") {
    return "This Mermaid block contains only ignored Mermaid directives. Showing source instead.";
  }
  if (blockIndex >= MERMAID_MAX_BLOCKS_PER_PREVIEW) {
    return `Only the first ${MERMAID_MAX_BLOCKS_PER_PREVIEW} Mermaid diagrams are rendered in note preview. Showing source instead.`;
  }
  if (displaySource.length > MERMAID_MAX_CHARS_PER_BLOCK) {
    return `This Mermaid diagram exceeds the ${MERMAID_MAX_CHARS_PER_BLOCK}-character preview limit. Showing source instead.`;
  }
  if (totalCharsBeforeBlock + displaySource.length > MERMAID_MAX_TOTAL_CHARS_PER_PREVIEW) {
    return `This note exceeds the ${MERMAID_MAX_TOTAL_CHARS_PER_PREVIEW}-character Mermaid preview budget. Showing source instead.`;
  }
  return undefined;
}

function renderMarkdownHtml(markdown: string, mermaidEnabled: boolean): { html: string; mermaidBlocks: MermaidBlock[] } {
  const renderer = getMarkdownRenderer();
  if (!mermaidEnabled) {
    return { html: renderer.render(markdown || ""), mermaidBlocks: [] };
  }

  const mermaidBlocks: MermaidBlock[] = [];
  const placeholderNonce = createMermaidPlaceholderNonce();
  let totalMermaidChars = 0;
  const originalFence = renderer.renderer.rules.fence;

  renderer.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    if (getFenceLanguage(token?.info ?? "") !== "mermaid") {
      return renderFenceToken(token);
    }

    const displaySource = token?.content ?? "";
    const renderSource = stripUnsupportedMermaidDirectives(displaySource);
    const placeholder = buildMermaidPlaceholder(placeholderNonce, mermaidBlocks.length);
    const warningMessage = getMermaidWarningMessage(
      mermaidBlocks.length,
      displaySource,
      renderSource,
      totalMermaidChars,
    );
    if (!warningMessage) {
      totalMermaidChars += displaySource.length;
    }
    mermaidBlocks.push({ placeholder, displaySource, renderSource, warningMessage });
    return `<pre><code>${escapeHTML(placeholder)}</code></pre>\n`;
  };

  try {
    return {
      html: renderer.render(markdown || ""),
      mermaidBlocks,
    };
  } finally {
    renderer.renderer.rules.fence = originalFence;
  }
}

function isSafeLinkHref(href: string): boolean {
  const value = href.trim();
  if (!value) {
    return false;
  }
  if (
    value.startsWith("#") ||
    value.startsWith("?") ||
    (value.startsWith("/") && !value.startsWith("//")) ||
    value.startsWith("./") ||
    value.startsWith("../")
  ) {
    return true;
  }
  if (value.startsWith("//")) {
    return false;
  }

  const normalized = value.replace(/[\u0000-\u001f\u007f\s]+/g, "");
  const schemeMatch = normalized.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!schemeMatch) {
    return true;
  }

  const scheme = schemeMatch[1].toLowerCase();
  return scheme === "http" || scheme === "https";
}

function isExternalHref(href: string): boolean {
  const value = href.trim().toLowerCase();
  return value.startsWith("http://") || value.startsWith("https://");
}

function sanitizeMarkdownHtml(markdownHtml: string): string {
  const sanitized = getDOMPurify().sanitize(markdownHtml, {
    ALLOWED_TAGS: SAFE_TAGS,
    ALLOWED_ATTR: SAFE_ATTRS,
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
  });

  const template = document.createElement("template");
  template.innerHTML = sanitized;

  for (const element of Array.from(template.content.querySelectorAll("img, iframe, object, embed, script, svg"))) {
    element.remove();
  }

  for (const link of Array.from(template.content.querySelectorAll("a"))) {
    const href = link.getAttribute("href") || "";
    if (!isSafeLinkHref(href)) {
      link.replaceWith(document.createTextNode(link.textContent || ""));
      continue;
    }

    if (isExternalHref(href)) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    } else {
      link.removeAttribute("target");
      link.removeAttribute("rel");
    }
  }

  return template.innerHTML;
}

function beginRenderEpoch(container: HTMLElement): number {
  const nextEpoch = (renderEpochByContainer.get(container) || 0) + 1;
  renderEpochByContainer.set(container, nextEpoch);
  return nextEpoch;
}

function isActiveRender(container: HTMLElement, epoch: number): boolean {
  return renderEpochByContainer.get(container) === epoch;
}

function replaceMermaidPlaceholders(container: HTMLElement, mermaidBlocks: MermaidBlock[]): MermaidHost[] {
  const blockByPlaceholder = new Map<string, MermaidBlock>();
  for (const block of mermaidBlocks) {
    blockByPlaceholder.set(block.placeholder, block);
  }

  const hosts: MermaidHost[] = [];
  for (const code of Array.from(container.querySelectorAll("pre > code"))) {
    const placeholder = code.textContent || "";
    const block = blockByPlaceholder.get(placeholder);
    if (!block) {
      continue;
    }

    const pre = code.parentElement;
    if (!pre) {
      continue;
    }

    const host = document.createElement("div");
    host.className = "todo-mermaid-host todo-mermaid-host--loading";

    const status = document.createElement("div");
    status.className = "todo-mermaid-status";
    status.textContent = "Rendering diagram...";

    const canvas = document.createElement("div");
    canvas.className = "mermaid todo-mermaid-canvas";
    canvas.textContent = block.displaySource;

    host.append(status, canvas);
    pre.replaceWith(host);
    hosts.push({ block, canvas, host });
  }

  return hosts;
}

function setMermaidFallbackState(
  host: HTMLElement,
  displaySource: string,
  statusText: string,
  statusTone: "warning" | "error",
): void {
  host.className = "todo-mermaid-host todo-mermaid-host--fallback";

  const status = document.createElement("div");
  status.className = `todo-mermaid-status todo-mermaid-status--${statusTone}`;
  status.textContent = statusText;

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = displaySource;
  pre.append(code);

  host.replaceChildren(status, pre);
}

function setMermaidErrorState(host: HTMLElement, displaySource: string): void {
  setMermaidFallbackState(
    host,
    displaySource,
    "Could not render Mermaid diagram. Showing source instead.",
    "error",
  );
}

function setMermaidSuccessState(host: HTMLElement): void {
  host.classList.remove("todo-mermaid-host--loading", "todo-mermaid-host--fallback");
  host.classList.add("todo-mermaid-host--ready");
  const status = host.querySelector(".todo-mermaid-status");
  status?.remove();
}

function getMermaidPreviewThemeKey(): MermaidPreviewThemeKey {
  if (typeof document === "undefined") {
    return "dark";
  }
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function readPreviewCssColor(variableName: string, fallback: string): string {
  if (typeof document === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  return value || fallback;
}

function buildMermaidPreviewThemeConfig(themeKey: MermaidPreviewThemeKey): Pick<MermaidConfig, "theme" | "themeVariables"> {
  const isLight = themeKey === "light";
  const panel2 = readPreviewCssColor("--panel2", isLight ? "#e5dfd5" : "#0f172a");
  const text = readPreviewCssColor("--text", isLight ? "#111827" : "#e5e7eb");
  const accent = readPreviewCssColor("--accent", isLight ? "#3b82f6" : "#60a5fa");
  const border = readPreviewCssColor("--border", isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.08)");

  return {
    theme: "base",
    themeVariables: {
      darkMode: !isLight,
      background: panel2,
      mainBkg: panel2,
      secondBkg: panel2,
      tertiaryBkg: panel2,
      primaryTextColor: text,
      textColor: text,
      lineColor: text,
      primaryColor: accent,
      primaryBorderColor: border,
      edgeLabelBackground: "transparent",
    },
  };
}

function configureMermaidPreview(mermaid: MermaidInstance, themeKey: MermaidPreviewThemeKey): void {
  if (mermaidConfiguredThemeKey === themeKey) {
    return;
  }

  const themeConfig = buildMermaidPreviewThemeConfig(themeKey);
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    maxTextSize: MERMAID_MAX_TEXT_SIZE,
    maxEdges: MERMAID_MAX_EDGES,
    suppressErrorRendering: true,
    ...themeConfig,
  });
  mermaidConfiguredThemeKey = themeKey;
}

function loadMermaid(): Promise<MermaidInstance> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Markdown preview is unavailable outside the browser"));
  }
  if (window.mermaid) {
    return Promise.resolve(getMermaidGlobal());
  }
  if (mermaidLoadPromise) {
    return mermaidLoadPromise;
  }

  mermaidLoadPromise = new Promise<MermaidInstance>((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${MERMAID_SCRIPT_SRC}"]`) as HTMLScriptElement | null;
    const handleLoad = () => {
      try {
        resolve(getMermaidGlobal());
      } catch (err) {
        mermaidLoadPromise = null;
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    const handleError = () => {
      mermaidLoadPromise = null;
      reject(new Error("Markdown preview is unavailable: missing /vendor/mermaid.min.js"));
    };

    if (existingScript) {
      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = MERMAID_SCRIPT_SRC;
    script.async = true;
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    document.head.appendChild(script);
  });

  return mermaidLoadPromise;
}

export function renderMarkdownToSafeHtml(markdown: string): string {
  const { html } = renderMarkdownHtml(markdown, false);
  return sanitizeMarkdownHtml(html);
}

export async function renderMarkdownPreviewInto(
  container: HTMLElement,
  markdown: string,
  options: MarkdownPreviewOptions = {},
): Promise<void> {
  const renderEpoch = beginRenderEpoch(container);
  const isEmpty = markdown.trim() === "";
  container.classList.toggle("todo-markdown-preview--empty", isEmpty);
  if (isEmpty) {
    container.textContent = "";
    return;
  }

  const mermaidEnabled = !!options.mermaidEnabled;
  const { html, mermaidBlocks } = renderMarkdownHtml(markdown, mermaidEnabled);
  if (!isActiveRender(container, renderEpoch)) {
    return;
  }

  container.innerHTML = sanitizeMarkdownHtml(html);
  if (!mermaidEnabled || mermaidBlocks.length === 0) {
    return;
  }

  const hosts = replaceMermaidPlaceholders(container, mermaidBlocks);
  if (hosts.length === 0) {
    return;
  }

  const renderableHosts = hosts.filter(({ block, host }) => {
    if (!block.warningMessage) {
      return true;
    }
    setMermaidFallbackState(host, block.displaySource, block.warningMessage, "warning");
    return false;
  });
  if (renderableHosts.length === 0) {
    return;
  }

  const themeKey = getMermaidPreviewThemeKey();
  const semanticEdgeConfig = await loadMermaidSemanticEdgeConfig();
  const mermaid = await loadMermaid();
  if (!isActiveRender(container, renderEpoch)) {
    return;
  }

  configureMermaidPreview(mermaid, themeKey);
  for (const { block, canvas, host } of renderableHosts) {
    if (!isActiveRender(container, renderEpoch) || !host.isConnected) {
      return;
    }

    try {
      const labelColors = buildMermaidSemanticLabelColors(block.renderSource, semanticEdgeConfig);
      canvas.textContent = block.renderSource;
      await mermaid.run({ nodes: [canvas] });
      if (!isActiveRender(container, renderEpoch) || !host.isConnected) {
        return;
      }
      paintMermaidSemanticLabelBackgrounds(canvas, labelColors);
      setMermaidSuccessState(host);
    } catch {
      if (!isActiveRender(container, renderEpoch) || !host.isConnected) {
        return;
      }
      setMermaidErrorState(host, block.displaySource);
    }
  }
}
