import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const js = fs.readFileSync(path.join(root,"public","assets","js","01-legacy-01.js"),"utf8");
const review = fs.readFileSync(path.join(root,"public","business-review.js"),"utf8");
const quarterly = fs.readFileSync(path.join(root,"public","quarterly-review.js"),"utf8");
const css = fs.readFileSync(path.join(root,"public","assets","css","system","24-product-hub.css"),"utf8");

const failures = [];
const renderStart = js.indexOf("function renderDashboard()");
const renderEnd = js.indexOf("function restockReportRows()", renderStart);
const render = js.slice(renderStart, renderEnd);

for (const required of [
  "dashboard-final-page",
  "dashboard-final-layout",
  "dashboard-final-main",
  "dashboardRightRailHtml(alerts)",
  "dashboardCommercialSection(commercialOrders, commercialRange)",
  "dashboardBigProjectsHtml()",
  "Sales (Invoiced)",
  "Cost of Goods",
  "Gross Profit",
  "Profit Margin"
]) {
  if (!render.includes(required)) failures.push(`Final dashboard missing: ${required}`);
}

for (const required of [
  "dashboardQuickActionsHtml",
  "dashboardReviewRailHtml",
  "dashboardAiRailHtml",
  "New sales order",
  "New project",
  "Add customer",
  "Create purchase order",
  "Record goods in",
  "View reports",
  "Alerts & tasks",
  "Today’s review",
  "AI daily briefing"
]) {
  if (!js.includes(required)) failures.push(`Dashboard rail missing: ${required}`);
}

for (const removed of [
  "Sales Order Flow",
  "Value By Location",
  "Recent Movements",
  "Inventory ledger"
]) {
  if (render.includes(removed)) failures.push(`Old dashboard content still rendered: ${removed}`);
}

if (/insertAdjacentHTML\([^)]*reviewMarkup/.test(review)) failures.push("Legacy full-width Today’s review is still injected.");
if (/screen-dashboard[^;\n]*insertAdjacentHTML/.test(quarterly)) failures.push("Quarterly review still injects into Dashboard.");

for (const required of [
  ".dashboard-final-layout",
  ".dashboard-right-rail",
  ".dashboard-quick-list",
  ".dashboard-rail-alert",
  ".dashboard-review-item",
  ".dashboard-ai-card"
]) {
  if (!css.includes(required)) failures.push(`Final dashboard styling missing: ${required}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Final Dashboard composition checks passed: only approved commercial content and right-rail quick actions/review remain.");
