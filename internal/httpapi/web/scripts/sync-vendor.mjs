import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = process.env.SCRUMBOY_WEB_DIR
  ? path.resolve(process.env.SCRUMBOY_WEB_DIR)
  : path.resolve(__dirname, "..");
const vendorDir = path.join(webDir, "vendor");

const assets = [
  {
    source: path.join(webDir, "node_modules", "uplot", "dist", "uPlot.iife.min.js"),
    destination: path.join(vendorDir, "uplot.min.js"),
  },
  {
    source: path.join(webDir, "node_modules", "uplot", "dist", "uPlot.min.css"),
    destination: path.join(vendorDir, "uplot.min.css"),
  },
  {
    source: path.join(webDir, "node_modules", "markdown-it", "dist", "markdown-it.min.js"),
    destination: path.join(vendorDir, "markdown-it.min.js"),
  },
  {
    source: path.join(webDir, "node_modules", "dompurify", "dist", "purify.min.js"),
    destination: path.join(vendorDir, "purify.min.js"),
  },
];

async function main() {
  await fs.mkdir(vendorDir, { recursive: true });

  for (const asset of assets) {
    try {
      await fs.copyFile(asset.source, asset.destination);
      console.log(`Synced ${path.relative(webDir, asset.destination)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Skipped ${path.relative(webDir, asset.destination)}: ${message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
