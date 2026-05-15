import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "verify-vendor.mjs",
);

describe("verify-vendor script", () => {
  it("fails clearly when required vendor assets are missing", async () => {
    const webDir = await fs.mkdtemp(path.join(os.tmpdir(), "scrumboy-vendor-check-"));
    await fs.mkdir(path.join(webDir, "vendor"), { recursive: true });
    await fs.writeFile(path.join(webDir, "vendor", "uplot.min.js"), "present");

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: webDir,
      encoding: "utf8",
      env: {
        ...process.env,
        SCRUMBOY_WEB_DIR: webDir,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr || result.stdout).toContain("Missing required browser vendor assets");
    expect(result.stderr || result.stdout).toContain("vendor/markdown-it.min.js");
    expect(result.stderr || result.stdout).toContain("vendor/purify.min.js");
  });
});
