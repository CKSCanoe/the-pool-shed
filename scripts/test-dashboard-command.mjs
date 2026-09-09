import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const js = fs.readFileSync(path.join(root,"public","assets","js","01-legacy-01.js"),"utf8");
const css = fs.readFileSync(path.join(root,"public","assets","css","system","24-product-hub.css"),"utf8");
const renderStart = js.indexOf("function renderDashboard()");
const renderEnd = js.indexOf("function restockReportRows()", renderStart);
const render = js.slice(renderStart, renderEnd);
const failures = [];

for (const required of [
  "dashboard-reference-page",
  "dashboard-reference-hero",
  "dashboardCommercialSection(commercialOrders, commercialRange)",
  "dashboardBigProjectsHtml()",
  "Sales (Invoiced)",
  "Cost of Goods",
  "Gross Profit",
  "Profit Margin"
]) {
  if (!render.includes(required)) failures.push(`Focused dashboard missing: ${required}`);
}

for (const removed of [
  "Sales Order Flow",
  "Value By Location",
  "Recent Movements",
  "Inventory ledger",
  "Restock Alerts"
]) {
  if (render.includes(removed)) failures.push(`Superseded dashboard section remains visible: ${removed}`);
}

for (const required of [
  ".dashboard-reference-page",
  ".dashboard-reference-hero",
  ".dashboard-reference-kpis",
  ".dashboard-right-rail",
  ".dashboard-reference-workspace"
]) {
  if (!css.includes(required)) failures.push(`Reference dashboard styling missing: ${required}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Focused Dashboard checks passed with approved right-rail composition.");
