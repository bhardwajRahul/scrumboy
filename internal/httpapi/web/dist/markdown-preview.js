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
const MERMAID_PLACEHOLDER_PREFIX = "__SCRUMBOY_MERMAID_BLOCK_";
const MERMAID_SCRIPT_SRC = "/vendor/mermaid.min.js";
const MERMAID_MAX_TEXT_SIZE = 50000;
const MERMAID_MAX_EDGES = 500;
const MERMAID_INIT_DIRECTIVE_RE = /%%\{\s*(?:init|initialize)\s*:[\s\S]*?\}%%/gi;
let markdownRenderer = null;
let mermaidInitialized = false;
let mermaidLoadPromise = null;
const renderEpochByContainer = new WeakMap();
function getMarkdownFactory() {
    if (typeof window === "undefined" || typeof window.markdownit !== "function") {
        throw new Error("Markdown preview is unavailable: missing /vendor/markdown-it.min.js");
    }
    return window.markdownit;
}
function getDOMPurify() {
    if (typeof window === "undefined" || !window.DOMPurify || typeof window.DOMPurify.sanitize !== "function") {
        throw new Error("Markdown preview is unavailable: missing /vendor/purify.min.js");
    }
    return window.DOMPurify;
}
function getMermaidGlobal() {
    if (typeof window === "undefined" || !window.mermaid) {
        throw new Error("Markdown preview is unavailable: missing /vendor/mermaid.min.js");
    }
    return window.mermaid;
}
function renderImageTokenAsText(token) {
    const alt = token?.content ?? "";
    const src = token?.attrGet?.("src") ?? "";
    const title = token?.attrGet?.("title") ?? "";
    const titlePart = title ? ` "${title}"` : "";
    return escapeHTML(`![${alt}](${src}${titlePart})`);
}
function getMarkdownRenderer() {
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
function getFenceLanguage(info) {
    return (info || "").trim().split(/\s+/, 1)[0]?.toLowerCase() || "";
}
function renderFenceToken(token) {
    const language = getFenceLanguage(token?.info ?? "");
    const classAttr = language ? ` class="language-${escapeHTML(language)}"` : "";
    return `<pre><code${classAttr}>${escapeHTML(token?.content ?? "")}</code></pre>\n`;
}
function buildMermaidPlaceholder(index) {
    return `${MERMAID_PLACEHOLDER_PREFIX}${index}__`;
}
function stripUnsupportedMermaidDirectives(source) {
    return source.replace(MERMAID_INIT_DIRECTIVE_RE, "").trim();
}
function renderMarkdownHtml(markdown, mermaidEnabled) {
    const renderer = getMarkdownRenderer();
    if (!mermaidEnabled) {
        return { html: renderer.render(markdown || ""), mermaidBlocks: [] };
    }
    const mermaidBlocks = [];
    const originalFence = renderer.renderer.rules.fence;
    renderer.renderer.rules.fence = (tokens, idx) => {
        const token = tokens[idx];
        if (getFenceLanguage(token?.info ?? "") !== "mermaid") {
            return renderFenceToken(token);
        }
        const displaySource = token?.content ?? "";
        const renderSource = stripUnsupportedMermaidDirectives(displaySource);
        const placeholder = buildMermaidPlaceholder(mermaidBlocks.length);
        mermaidBlocks.push({ placeholder, displaySource, renderSource });
        return `<pre><code>${escapeHTML(placeholder)}</code></pre>\n`;
    };
    try {
        return {
            html: renderer.render(markdown || ""),
            mermaidBlocks,
        };
    }
    finally {
        renderer.renderer.rules.fence = originalFence;
    }
}
function isSafeLinkHref(href) {
    const value = href.trim();
    if (!value) {
        return false;
    }
    if (value.startsWith("#") ||
        value.startsWith("?") ||
        (value.startsWith("/") && !value.startsWith("//")) ||
        value.startsWith("./") ||
        value.startsWith("../")) {
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
function isExternalHref(href) {
    const value = href.trim().toLowerCase();
    return value.startsWith("http://") || value.startsWith("https://");
}
function sanitizeMarkdownHtml(markdownHtml) {
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
        }
        else {
            link.removeAttribute("target");
            link.removeAttribute("rel");
        }
    }
    return template.innerHTML;
}
function beginRenderEpoch(container) {
    const nextEpoch = (renderEpochByContainer.get(container) || 0) + 1;
    renderEpochByContainer.set(container, nextEpoch);
    return nextEpoch;
}
function isActiveRender(container, epoch) {
    return renderEpochByContainer.get(container) === epoch;
}
function replaceMermaidPlaceholders(container, mermaidBlocks) {
    const blockByPlaceholder = new Map();
    for (const block of mermaidBlocks) {
        blockByPlaceholder.set(block.placeholder, block);
    }
    const hosts = [];
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
function setMermaidErrorState(host, displaySource) {
    host.className = "todo-mermaid-host todo-mermaid-host--error";
    const status = document.createElement("div");
    status.className = "todo-mermaid-status todo-mermaid-status--error";
    status.textContent = "Could not render Mermaid diagram. Showing source instead.";
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = displaySource;
    pre.append(code);
    host.replaceChildren(status, pre);
}
function setMermaidSuccessState(host) {
    host.classList.remove("todo-mermaid-host--loading", "todo-mermaid-host--error");
    host.classList.add("todo-mermaid-host--ready");
    const status = host.querySelector(".todo-mermaid-status");
    status?.remove();
}
function loadMermaid() {
    if (typeof window === "undefined") {
        return Promise.reject(new Error("Markdown preview is unavailable outside the browser"));
    }
    if (window.mermaid) {
        return Promise.resolve(getMermaidGlobal());
    }
    if (mermaidLoadPromise) {
        return mermaidLoadPromise;
    }
    mermaidLoadPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector(`script[src="${MERMAID_SCRIPT_SRC}"]`);
        const handleLoad = () => {
            try {
                resolve(getMermaidGlobal());
            }
            catch (err) {
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
function ensureMermaidInitialized(mermaid) {
    if (mermaidInitialized) {
        return;
    }
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: "sandbox",
        maxTextSize: MERMAID_MAX_TEXT_SIZE,
        maxEdges: MERMAID_MAX_EDGES,
        suppressErrorRendering: true,
    });
    mermaidInitialized = true;
}
export function renderMarkdownToSafeHtml(markdown) {
    const { html } = renderMarkdownHtml(markdown, false);
    return sanitizeMarkdownHtml(html);
}
export async function renderMarkdownPreviewInto(container, markdown, options = {}) {
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
    const mermaid = await loadMermaid();
    if (!isActiveRender(container, renderEpoch)) {
        return;
    }
    ensureMermaidInitialized(mermaid);
    for (const { block, canvas, host } of hosts) {
        if (!isActiveRender(container, renderEpoch) || !host.isConnected) {
            return;
        }
        try {
            canvas.textContent = block.renderSource || block.displaySource;
            await mermaid.run({ nodes: [canvas] });
            if (!isActiveRender(container, renderEpoch) || !host.isConnected) {
                return;
            }
            setMermaidSuccessState(host);
        }
        catch {
            if (!isActiveRender(container, renderEpoch) || !host.isConnected) {
                return;
            }
            setMermaidErrorState(host, block.displaySource);
        }
    }
}
