import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = process.env.SCRUMBOY_WEB_DIR
  ? path.resolve(process.env.SCRUMBOY_WEB_DIR)
  : path.resolve(__dirname, "..");
const srcDir = path.join(webDir, "modules", "i18n", "locales");
const dstDir = path.join(webDir, "dist", "i18n", "locales");

async function main() {
  await fs.rm(dstDir, { recursive: true, force: true });
  await fs.mkdir(dstDir, { recursive: true });

  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  const copied = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    await fs.copyFile(path.join(srcDir, entry.name), path.join(dstDir, entry.name));
    copied.push(entry.name);
  }

  console.log(`Copied i18n locales: ${copied.sort().join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
