import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssRoot = path.join(root, "public", "assets", "css");
const sources = [
  "system/10-legacy-compat.css",
  "system/20-sales-product.css",
  "system/21-catalogue.css",
  "system/22-bundles.css",
  "system/23-platform-feature-overrides.css",
  "system/24-product-hub.css",
  "system/30-workspace-core.css",
  "system/31-project-workspace.css",
  "system/32-sales-workspace.css",
  "system/33-workspace-polish.css",
  "system/34-customer-workspace.css",
  "system/40-design-system.css",
];
const banner = `/*
 Pool Shed application stylesheet.
 GENERATED FILE — do not edit directly.
 Source order is deliberately stable. Shared component/design authority lives
 in system/40-design-system.css.
*/\n`;
const output = banner + sources.map((rel) => {
  const full = path.join(cssRoot, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing CSS source module: ${rel}`);
  return `\n/* ===== MODULE: ${rel} ===== */\n${fs.readFileSync(full, "utf8")}`;
}).join("\n");
fs.writeFileSync(path.join(cssRoot, "app.css"), output);
console.log(`Built app.css from ${sources.length} maintained CSS modules.`);
