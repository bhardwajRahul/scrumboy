import fs from "node:fs";
import path from "node:path";

const base = path.resolve("internal/httpapi/web/modules/i18n/locales");
const en = JSON.parse(fs.readFileSync(path.join(base, "en.json"), "utf8"));
const chunks = ["_ur_t1.json", "_ur_t2.json", "_ur_t3.json"];
const merged = {};
for (const file of chunks) {
  Object.assign(merged, JSON.parse(fs.readFileSync(path.join(base, file), "utf8")));
}
const keys = Object.keys(en);
const missing = keys.filter((k) => !(k in merged));
const extra = Object.keys(merged).filter((k) => !(k in en));
if (missing.length || extra.length) {
  console.error({ missing: missing.length, extra: extra.length, missingSample: missing.slice(0, 5), extraSample: extra.slice(0, 5) });
  process.exit(1);
}
const ordered = {};
for (const k of keys) ordered[k] = merged[k];
fs.writeFileSync(path.join(base, "ur.json"), JSON.stringify(ordered, null, 2) + "\n", "utf8");
console.log("ur.json keys:", Object.keys(ordered).length);
