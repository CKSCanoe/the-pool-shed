import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cssRoot = path.join(root, "public", "assets", "css", "system");
const design = fs.readFileSync(path.join(cssRoot, "40-design-system.css"), "utf8");
const failures = [];

for (const required of [
  "FINAL VISUAL CONSISTENCY CONTRACT",
  ".order-lines-scroll",
  ".catalogue-row",
  ".ci-command-centre",
  ".so-search-popover",
  ".tab-chip.active",
  "var(--ps-radius-dialog)",
  "var(--color-border-default)",
]) {
  if (!design.includes(required)) failures.push(`Design system missing visual consistency contract item: ${required}`);
}

const featureModules = [
  "20-sales-product.css",
  "21-catalogue.css",
  "22-bundles.css",
  "23-platform-feature-overrides.css",
  "24-product-hub.css",
  "30-workspace-core.css",
  "31-project-workspace.css",
  "32-sales-workspace.css",
  "33-workspace-polish.css",
];

for (const rel of featureModules) {
  const source = fs.readFileSync(path.join(cssRoot, rel), "utf8");
  if (/\.tab-chip\.active\s*\{[^}]*box-shadow\s*:\s*(?!none)/s.test(source)) {
    failures.push(`${rel} reintroduces elevated active tabs`);
  }
}

const appHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const stylesheetLinks = [...appHtml.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)];
if (stylesheetLinks.length !== 1 || !stylesheetLinks[0][0].includes("./assets/css/app.css")) {
  failures.push("Production must still load exactly one generated app.css");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Visual consistency checks passed: flat operational surfaces, shared dialog geometry/elevation, flat underline tabs.");
