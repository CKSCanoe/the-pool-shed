import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cssRoot = path.join(root, "public", "assets", "css", "system");
const design = fs.readFileSync(path.join(cssRoot, "40-design-system.css"), "utf8");
const failures = [];

for (const required of [
  "READABILITY HARDENING — v1.0.10",
  ".partial-fulfilment-head",
  ".catalogue-health-command",
  ".inventory-sync-banner",
  ".import-admin-banner",
  "background: var(--color-brand-navy)",
  "color: #FFFFFF",
  "var(--color-status-success-bg)",
  "var(--color-status-attention-bg)",
  "var(--color-status-danger-bg)",
  "font-size: max(var(--ps-font-micro), 1em)",
]) {
  if (!design.includes(required)) failures.push(`Missing readability hardening contract item: ${required}`);
}

for (const rel of fs.readdirSync(cssRoot).filter((x) => x.endsWith(".css") && x !== "40-design-system.css")) {
  const source = fs.readFileSync(path.join(cssRoot, rel), "utf8");
  for (const match of source.matchAll(/font-size\s*:\s*([0-9.]+)(px|rem)\s*;/g)) {
    const value = Number(match[1]);
    const unit = match[2];
    if ((unit === "px" && value < 10) || (unit === "rem" && value < 0.72)) {
      failures.push(`${rel} still contains sub-micro text size: ${match[0]}`);
      break;
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Readability hardening checks passed: no remaining sub-micro copy and critical command surfaces have explicit readable foreground/background.");
