// @vitest-environment happy-dom
import createDOMPurify from "dompurify";
import MarkdownIt from "markdown-it";
import { beforeEach, describe, expect, it, vi } from "vitest";

function installMarkdownVendors(): void {
  (window as any).markdownit = (preset?: string, options?: Record<string, unknown>) =>
    new MarkdownIt(preset, options);
  (window as any).DOMPurify = createDOMPurify(window);
}

describe("markdown preview rendering", () => {
  beforeEach(() => {
    vi.resetModules();
    installMarkdownVendors();
  });

  it("renders the supported markdown set for todo notes", async () => {
    const { renderMarkdownToSafeHtml } = await import("./markdown-preview.js");

    const html = renderMarkdownToSafeHtml(
      [
        "# Heading One",
        "## Heading Two",
        "### Heading Three",
        "",
        "**bold** and *italic*",
        "",
        "- one",
        "- two",
        "",
        "1. first",
        "2. second",
        "",
        "> quoted",
        "",
        "inline `code`",
        "",
        "```ts",
        "const answer = 42;",
        "```",
        "",
        "---",
        "",
        "[safe link](https://example.com/path)",
        "",
        "line one",
        "line two",
      ].join("\n"),
    );

    expect(html).toContain("<h1>Heading One</h1>");
    expect(html).toContain("<h2>Heading Two</h2>");
    expect(html).toContain("<h3>Heading Three</h3>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<pre><code>const answer = 42;");
    expect(html).toContain("<hr>");
    expect(html).toContain('href="https://example.com/path"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("<br>");
  });

  it("neutralizes raw html, dangerous links, and image syntax", async () => {
    const { renderMarkdownToSafeHtml } = await import("./markdown-preview.js");

    const html = renderMarkdownToSafeHtml(
      [
        "<script>alert(1)</script>",
        '<img src=x onerror=alert(1)>',
        "[x](javascript:alert(1))",
        "[x](data:text/html,<script>alert(1)</script>)",
        "[x](vbscript:msgbox(1))",
        "<iframe src=\"https://example.com\"></iframe>",
        "<object data=\"https://example.com/file.swf\"></object>",
        "<embed src=\"https://example.com/file.swf\">",
        "![alt](https://example.com/x.png)",
      ].join("\n\n"),
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<object");
    expect(html).not.toContain("<embed");
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('href="data:text/html');
    expect(html).not.toContain('href="vbscript:');
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("![alt](https://example.com/x.png)");

    const template = document.createElement("template");
    template.innerHTML = html;
    expect(template.content.querySelector("[onerror]")).toBeNull();

    const anchorCount = (html.match(/<a /g) || []).length;
    expect(anchorCount).toBe(0);
  });
});
