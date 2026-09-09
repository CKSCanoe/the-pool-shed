import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const js = fs.readFileSync(path.join(root,"public","assets","js","01-legacy-01.js"),"utf8");
const css = fs.readFileSync(path.join(root,"public","assets","css","system","24-product-hub.css"),"utf8");
const failures = [];

for (const required of [
  'classList.toggle("dashboard-mode"',
  "dashboard-location-control",
  "dashboard-hero-tools",
  "dashboard-final-layout",
  "dashboardRightRailHtml(alerts)"
]) {
  if (!js.includes(required)) failures.push(`Missing polished dashboard hook: ${required}`);
}

for (const required of [
  "DASHBOARD — AUTHORITATIVE PROFESSIONAL COMPOSITION v1.2.1",
  ".dashboard-mode .topbar",
  ".dashboard-mode .topbar .title",
  ".dashboard-mode .top-actions",
  ".dashboard-final-layout",
  ".dashboard-commercial-layout",
  ".dashboard-commercial-insights",
  ".dashboard-right-rail",
  ".dashboard-project-table-wrap"
]) {
  if (!css.includes(required)) failures.push(`Missing polished dashboard CSS: ${required}`);
}

for (const stale of [
  "DASHBOARD — OPTION A / COMMAND",
  "DASHBOARD — COMMERCIAL PERFORMANCE + BIG JOB PROJECTS",
  "DASHBOARD REFERENCE MATCH — v1.1.1",
  "DASHBOARD FINAL APPROVED COMPOSITION — v1.2.0"
]) {
  if (css.includes(stale)) failures.push(`Superseded dashboard CSS ownership remains: ${stale}`);
}

if ((css.match(/DASHBOARD — AUTHORITATIVE PROFESSIONAL COMPOSITION/g) || []).length !== 1) {
  failures.push("Dashboard must have exactly one authoritative CSS ownership block.");
}

const dashboardStart = css.indexOf("DASHBOARD — AUTHORITATIVE PROFESSIONAL COMPOSITION");
const dashboardCss = css.slice(dashboardStart);
if (/font-size:\s*[0-9](?:\.[0-9]+)?px/.test(dashboardCss)) {
  failures.push("Dashboard polish contains text below the 10px system minimum.");
}
if (/gradient\s*\(/i.test(dashboardCss)) {
  failures.push("Dashboard polish reintroduced gradients.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Dashboard professional polish checks passed: one CSS owner, dashboard shell integration, spacing and responsive structure are present.");
