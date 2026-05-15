import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = process.env.SCRUMBOY_WEB_DIR
  ? path.resolve(process.env.SCRUMBOY_WEB_DIR)
  : path.resolve(__dirname, "..");

const requiredVendorFiles = [
  "vendor/uplot.min.js",
  "vendor/uplot.min.css",
  "vendor/markdown-it.min.js",
  "vendor/purify.min.js",
];

async function main() {
  const missing = [];

  for (const relativePath of requiredVendorFiles) {
    const absolutePath = path.join(webDir, relativePath);
    try {
      const stat = await fs.stat(absolutePath);
      if (!stat.isFile() || stat.size === 0) {
        missing.push(relativePath);
      }
    } catch {
      missing.push(relativePath);
    }
  }

  if (missing.length > 0) {
    console.error(
      [
        "Missing required browser vendor assets:",
        ...missing.map((entry) => `- ${entry}`),
        "",
        "Run `npm install` or `npm run sync:vendor` in internal/httpapi/web before building or testing.",
      ].join("\n"),
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
