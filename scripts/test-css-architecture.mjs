import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const cssRoot = path.join(root, "public", "assets", "css");
const modules = [
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
  "system/40-design-system.css",
];
const failures = [];

const stylesheetLinks = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)];
if (stylesheetLinks.length !== 1 || !stylesheetLinks[0][0].includes("./assets/css/app.css")) {
  failures.push("index.html must load exactly one application stylesheet: assets/css/app.css");
}
for (const rel of modules) {
  if (!fs.existsSync(path.join(cssRoot, rel))) failures.push(`Missing maintained CSS module: ${rel}`);
}
for (const rel of [
  "assets/css/04-legacy-04.css","assets/css/05-legacy-05.css","assets/css/06-legacy-06.css",
  "assets/css/07-legacy-07.css","assets/css/08-legacy-08.css","assets/css/09-legacy-09.css"
]) {
  if (!fs.existsSync(path.join(root, "public", rel))) failures.push(`Missing print-only stylesheet: ${rel}`);
}
for (const obsolete of [
  "sales-order-search.css","partial-fulfilment.css","catalogue-intelligence.css",
  "bundle-system.css","bundle-studio.css","professional-workspace.css",
  "project-workspace.css","sales-workspace.css","workspace-polish.css",
  "assets/css/01-legacy-01.css","assets/css/15-pool-shed-precision-foundation.css"
]) {
  if (fs.existsSync(path.join(root, "public", obsolete))) failures.push(`Obsolete active CSS source still exists: ${obsolete}`);
}

const sharedBaseSelectors = new Set([
  ".panel-head",".panel-body",".action-row",".pill",".topbar",".field",".form-grid",
  ".tabs-row",".tab-chip",".customer-tabs",".ps-section-nav",".modal",".kpi",
  ".record-card",".mini-card",".profile-card",".breadcrumb",
  "button","input","select","textarea","table","th","td"
]);
for (const rel of modules.filter((rel) => rel !== "system/40-design-system.css")) {
  const source = fs.readFileSync(path.join(cssRoot, rel), "utf8");
  for (const selector of sharedBaseSelectors) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const exactRule = new RegExp(`(?:^|})\\s*${escaped}\\s*\\{`, "m");
    if (exactRule.test(source)) failures.push(`Shared base selector ${selector} leaked back into ${rel}`);
  }
}

const designSystem = fs.readFileSync(path.join(cssRoot, "system/40-design-system.css"), "utf8");
for (const token of [
  "--color-action-primary", "--ps-control-height", "--ps-table-row-height",
  "--ps-radius-control", "--ps-radius-panel", "--ps-font-page-title"
]) {
  if (!designSystem.includes(token)) failures.push(`Design-system authority missing ${token}`);
}
const app = fs.readFileSync(path.join(cssRoot, "app.css"), "utf8");
let previous = -1;
for (const rel of modules) {
  const at = app.indexOf(`MODULE: ${rel}`);
  if (at < 0) failures.push(`Generated app.css is missing module ${rel}`);
  if (at <= previous) failures.push(`Generated app.css module order is wrong at ${rel}`);
  previous = at;
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("CSS architecture checks passed: 1 runtime bundle, 11 ownership modules, 6 separate print styles, shared primitives owned by design system.");
