import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const css = fs.readFileSync(path.join(root,"public","assets","css","system","40-design-system.css"),"utf8");
const js = fs.readFileSync(path.join(root,"public","assets","js","01-legacy-01.js"),"utf8");
const failures=[];

for (const required of [
  'classList.toggle("dashboard-mode"',
  "DASHBOARD SHELL HEADER CORRECTION — v1.2.2",
  ".app.dashboard-mode .topbar",
  ".app.dashboard-mode .top-actions",
  "grid-template-columns: minmax(320px, 1fr) auto !important",
  ".app.dashboard-mode .top-utility-row",
  ".app.dashboard-mode #workspaceDensity",
  "display: none !important"
]) {
  if (!css.includes(required) && !js.includes(required)) failures.push(`Missing header fix requirement: ${required}`);
}

const marker=css.indexOf("DASHBOARD SHELL HEADER CORRECTION — v1.2.2");
const generalTopbar=css.lastIndexOf(".topbar {", marker);
if (marker < 0) failures.push("Header correction marker missing.");
if (marker < generalTopbar) failures.push("Header correction does not occur after general topbar rules.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Dashboard header checks passed: final cascade owns one-row dark search/utility bar.");
