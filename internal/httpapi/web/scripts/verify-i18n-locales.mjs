import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = process.env.SCRUMBOY_WEB_DIR
  ? path.resolve(process.env.SCRUMBOY_WEB_DIR)
  : path.resolve(__dirname, "..");
const localesDir = path.join(webDir, "modules", "i18n", "locales");

function flattenMessages(value, prefix = "", out = new Map()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${prefix || "catalog"} must be an object`);
  }
  for (const [key, child] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") {
      out.set(nextKey, child);
      continue;
    }
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flattenMessages(child, nextKey, out);
      continue;
    }
    throw new Error(`${nextKey} must be a string`);
  }
  return out;
}

async function readCatalog(fileName) {
  const raw = await fs.readFile(path.join(localesDir, fileName), "utf8");
  return flattenMessages(JSON.parse(raw));
}

function sortedDifference(left, right) {
  return [...left].filter((key) => !right.has(key)).sort();
}

async function main() {
  let entries;
  try {
    entries = await fs.readdir(localesDir, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Cannot read i18n locale directory: ${localesDir}`);
  }

  const localeFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  if (!localeFiles.includes("en.json")) {
    throw new Error("Missing canonical i18n source catalog: modules/i18n/locales/en.json");
  }

  const en = await readCatalog("en.json");
  const failures = [];

  for (const fileName of localeFiles) {
    const catalog = await readCatalog(fileName);
    const missing = sortedDifference(en.keys(), catalog);
    const extra = sortedDifference(catalog.keys(), en);
    if (missing.length > 0 || extra.length > 0) {
      failures.push({ fileName, missing, extra });
    }
  }

  if (failures.length > 0) {
    const lines = ["i18n locale key parity failed:"];
    for (const failure of failures) {
      lines.push(`- ${failure.fileName}`);
      if (failure.missing.length > 0) {
        lines.push(`  missing: ${failure.missing.join(", ")}`);
      }
      if (failure.extra.length > 0) {
        lines.push(`  extra: ${failure.extra.join(", ")}`);
      }
    }
    throw new Error(lines.join("\n"));
  }

  console.log(`i18n locale key parity passed (${localeFiles.length} catalogs).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
