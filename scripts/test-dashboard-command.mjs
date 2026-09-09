import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const js = fs.readFileSync(path.join(root, "public", "assets", "js", "01-legacy-01.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "assets", "css", "system", "24-product-hub.css"), "utf8");
const failures = [];

for (const required of [
  "dashboard-command-layout",
  "dashboard-command-metrics",
  "dashboard-command-grid",
  "dashboard-status-grid",
  "dashboard-action-list",
  "dashboard-location-list",
  "Today’s operating picture",
  "Sales Order Flow",
  "Needs Action",
  "data-open-status-orders",
  "data-open-restock-report"
]) {
  if (!js.includes(required) && !css.includes(required)) failures.push(`Missing Dashboard Command requirement: ${required}`);
}

for (const required of [
  "background: var(--color-brand-navy)",
  "background: var(--color-surface-default) !important",
  "border-left: 4px solid var(--status-bg) !important",
  "grid-template-columns: minmax(0, 1.55fr) minmax(300px, .85fr)"
]) {
  if (!css.includes(required)) failures.push(`Missing selected Option A styling: ${required}`);
}

const cardRule = css.match(/\.dashboard-status-grid \.status-summary-card\s*\{([\s\S]*?)\}/);
if (!cardRule || !/background:\s*var\(--color-surface-default\)\s*!important/.test(cardRule[1])) {
  failures.push("Dashboard status cards are not locked to calm surface backgrounds.");
}
if (/gradient\s*\(/i.test(css)) failures.push("Dashboard feature stylesheet reintroduced gradients.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Dashboard Command checks passed: Option A hierarchy, calm status rows and existing dashboard hooks are present.");
