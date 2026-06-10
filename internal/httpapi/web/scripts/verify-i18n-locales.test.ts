import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "verify-i18n-locales.mjs",
);

describe("verify-i18n-locales script", () => {
  it("fails clearly when locale keys drift from English", async () => {
    const webDir = await fs.mkdtemp(path.join(os.tmpdir(), "scrumboy-i18n-check-"));
    const localesDir = path.join(webDir, "modules", "i18n", "locales");
    await fs.mkdir(localesDir, { recursive: true });
    await fs.writeFile(path.join(localesDir, "en.json"), JSON.stringify({
      "common.cancel": "Cancel",
      "common.save": "Save",
    }));
    await fs.writeFile(path.join(localesDir, "pseudo.json"), JSON.stringify({
      "common.cancel": "[!! Cancel !!]",
      "common.extra": "[!! Extra !!]",
    }));

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: webDir,
      encoding: "utf8",
      env: {
        ...process.env,
        SCRUMBOY_WEB_DIR: webDir,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr || result.stdout).toContain("i18n locale key parity failed");
    expect(result.stderr || result.stdout).toContain("missing: common.save");
    expect(result.stderr || result.stdout).toContain("extra: common.extra");
  });
});
