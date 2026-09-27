import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CSS_MODULES } from "./css-modules.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssRoot = path.join(root, "public", "assets", "css");
const sources = CSS_MODULES;
const banner = `/*
 Pool Shed application stylesheet.
 GENERATED FILE — do not edit directly.
 Source order is deliberately stable. Colour authority lives in system/00-color-tokens.css; shared component/design authority lives
 in system/40-design-system.css.
*/\n`;
const output = banner + sources.map((rel) => {
  const full = path.join(cssRoot, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing CSS source module: ${rel}`);
  return `\n/* ===== MODULE: ${rel} ===== */\n${fs.readFileSync(full, "utf8")}`;
}).join("\n");
fs.writeFileSync(path.join(cssRoot, "app.css"), output);
console.log(`Built app.css from ${sources.length} maintained CSS modules.`);
