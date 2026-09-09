import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const js = fs.readFileSync(path.join(root, "public", "assets", "js", "01-legacy-01.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "assets", "css", "system", "24-product-hub.css"), "utf8");
const failures = [];

for (const required of [
  "dashboardCommercialFilters",
  "dashboardCommercialOrders",
  "dashboardCommercialSummary",
  "dashboardCommercialSeries",
  "dashboardCommercialChartHtml",
  "dashboardCommercialSection",
  "dashboardBigProjectsHtml",
  "Sales & Profitability",
  "Big Job Projects",
  "data-dashboard-commercial-filter",
  "data-dashboard-commercial-export",
  "dashboardBreakdownDonutHtml",
  "Customer type",
  "Warehouse",
  "Advanced filters",
  "data-dashboard-job-open",
  "data-dashboard-project-new",
  "Project commercial value and margin are calculated only from sales orders explicitly linked to that job"
]) {
  if (!js.includes(required)) failures.push(`Missing commercial dashboard requirement: ${required}`);
}

for (const required of [
  ".dashboard-commercial-shell",
  ".dashboard-commercial-filters",
  ".dashboard-commercial-kpis",
  ".dashboard-commercial-chart",
  ".dashboard-commercial-insights",
  ".dashboard-big-projects",
  ".dashboard-project-progress"
]) {
  if (!css.includes(required)) failures.push(`Missing commercial dashboard styling: ${required}`);
}

if (!js.includes('status: "invoiced"')) failures.push("Default profitability status must remain invoiced-only.");
if (!js.includes('order.jobId === jobItem.id')) failures.push("Project margin must only use sales orders explicitly linked to that job.");
if (/gradient\s*\(/i.test(css)) failures.push("Commercial dashboard reintroduced gradients.");
if (/background:\s*var\(--color-brand-aqua\)[^;]*;\s*color:\s*var\(--color-brand-aqua\)/i.test(css)) failures.push("Commercial dashboard contains same-colour action text/background.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Commercial Dashboard checks passed: profitability filters/chart/export and linked-project margin rules are present.");
