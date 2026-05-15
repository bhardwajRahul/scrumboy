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
let markdownRenderer = null;
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
export function renderMarkdownToSafeHtml(markdown) {
    const html = getMarkdownRenderer().render(markdown || "");
    return sanitizeMarkdownHtml(html);
}
export function renderMarkdownPreviewInto(container, markdown) {
    const isEmpty = markdown.trim() === "";
    container.classList.toggle("todo-markdown-preview--empty", isEmpty);
    if (isEmpty) {
        container.textContent = "";
        return;
    }
    container.innerHTML = renderMarkdownToSafeHtml(markdown);
}
