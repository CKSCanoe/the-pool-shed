import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cssRoot = path.join(root, "public", "assets", "css", "system");
const modules = fs.readdirSync(cssRoot).filter((name) => name.endsWith(".css"));
const failures = [];

const design = fs.readFileSync(path.join(cssRoot, "40-design-system.css"), "utf8");
for (const required of [
  "ACCESSIBLE COLOUR + TEXT RHYTHM CONTRACT",
  "::selection",
  "background: var(--color-action-primary)",
  "color: #FFFFFF",
  "var(--color-status-success-bg)",
  "var(--color-status-attention-bg)",
  "var(--color-status-danger-bg)",
  "var(--color-status-info-bg)",
  "#screen-fulfilment .panel:first-child::before",
]) {
  if (!design.includes(required)) failures.push(`Missing contrast/text-rhythm contract item: ${required}`);
}

if (design.includes("--color-text-inverse: var(--ps-palette-dark-canvas);")) {
  failures.push("Dark theme still maps inverse action text to the dark canvas colour");
}

for (const rel of modules) {
  const source = fs.readFileSync(path.join(cssRoot, rel), "utf8");
  if (/gradient\s*\(/i.test(source)) failures.push(`${rel} reintroduces a gradient`);
  if (/poolShedRainbowFlow|ci-spectrum/.test(source)) failures.push(`${rel} reintroduces decorative spectrum animation`);
}

for (const selector of [
  ".panel-head::before",
  ".settings-panel > .panel-head::before",
  ".partial-fulfilment-head::before",
  ".ci-command-centre::before",
  ".ci-po-catalogue-picker::before",
  ".so-catalogue-picker::after",
]) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = new RegExp(`${escaped}\\s*\\{`);
  for (const rel of modules) {
    const source = fs.readFileSync(path.join(cssRoot, rel), "utf8");
    if (rule.test(source)) failures.push(`${rel} reintroduces decorative line rule ${selector}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Contrast/text rhythm checks passed: readable highlights/statuses, no decorative gradients or header stripes.");
