// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildMermaidSemanticLabelColors,
  paintMermaidSemanticLabelBackgrounds,
  resetMermaidSemanticEdgeConfigCacheForTests,
} from "./mermaid-semantic-edges.js";

describe("mermaid semantic edges", () => {
  beforeEach(() => {
    resetMermaidSemanticEdgeConfigCacheForTests();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("maps matched yes/no labels to green and red without modifying source", () => {
    const source = [
      "graph TD",
      "A[Start] --> B{Decision}",
      "B -- Yes --> C[Result One]",
      "B -- No --> D[Result Two]",
    ].join("\n");

    const colors = buildMermaidSemanticLabelColors(source);
    expect(colors.get("yes")).toBe("#16a34a");
    expect(colors.get("no")).toBe("#dc2626");
    expect(source).not.toContain("linkStyle");
  });

  it("does not map labels when only one branch matches the whitelist", () => {
    const source = ["graph TD", "B -- Yes --> C", "B -- Maybe --> D"].join("\n");
    expect(buildMermaidSemanticLabelColors(source).size).toBe(0);
  });

  it("recolors the label background box (rect) without touching connector paths", () => {
    const canvas = document.createElement("div");
    canvas.innerHTML = `
      <svg>
        <g class="edgePaths"><path class="flowchart-link" d="M0,0L10,10"></path></g>
        <g class="edgeLabels">
          <g class="edgeLabel"><rect class="background" fill="#ccc"></rect><text>Yes</text></g>
          <g class="edgeLabel"><rect class="background" fill="#ccc"></rect><text>No</text></g>
        </g>
      </svg>
    `;
    document.body.appendChild(canvas);

    paintMermaidSemanticLabelBackgrounds(
      canvas,
      new Map([
        ["yes", "#16a34a"],
        ["no", "#dc2626"],
      ]),
    );

    const rects = canvas.querySelectorAll(".edgeLabel rect");
    expect(rects[0]?.getAttribute("fill")).toBe("#16a34a");
    expect(rects[1]?.getAttribute("fill")).toBe("#dc2626");
    // connector line is left exactly as rendered
    expect(canvas.querySelector(".flowchart-link")?.getAttribute("fill")).toBeNull();
  });

  it("recolors the .labelBkg parent for the HTML/foreignObject label path", () => {
    const canvas = document.createElement("div");
    canvas.innerHTML = `
      <svg>
        <g class="edgeLabels">
          <foreignObject>
            <div class="labelBkg"><span class="edgeLabel"><p>Yes</p></span></div>
          </foreignObject>
        </g>
      </svg>
    `;
    document.body.appendChild(canvas);

    paintMermaidSemanticLabelBackgrounds(canvas, new Map([["yes", "#16a34a"]]));

    const bkg = canvas.querySelector(".labelBkg") as HTMLElement | null;
    expect(bkg?.style.backgroundColor).toBe("#16a34a");
  });
});
