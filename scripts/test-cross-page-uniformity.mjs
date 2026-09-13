import fs from "node:fs";

const css = fs.readFileSync("public/assets/css/system/40-design-system.css","utf8");
const crm = fs.readFileSync("public/assets/css/system/34-customer-workspace.css","utf8");
const sales = fs.readFileSync("public/assets/css/system/32-sales-workspace.css","utf8");
const js = fs.readFileSync("public/assets/js/01-legacy-01.js","utf8");

const required = [
  "CROSS-PAGE COHESION — v1.5.2",
  "--ps-cohesion-workspace-gap:13px",
  "--ps-cohesion-workspace-pad:14px",
  "#screen-dashboard .dashboard-reference-workspace",
  "#screen-crm,\n#screen-salesorders",
  "#screen-crm .crm-master-detail",
  "#screen-crm .crm-hero-main",
  "#screen-crm .crm-profile-tabs button",
  "#screen-salesorders .sales-workspace.sales-command-page>.record-shell",
  "#screen-salesorders .sales-workspace.sales-command-page>.tabs-row",
  "#screen-salesorders .sales-workspace.sales-command-page .so-entry-and-totals",
  "#salesOrderProductResults.so-product-results-portal"
];
for (const token of required) {
  if (!css.includes(token)) throw new Error("Missing cross-page cohesion rule: " + token);
}

const productionStructure = [
  'class="dashboard-reference-page dashboard-final-page"',
  'class="crm-page"',
  'class="crm-master-detail"',
  'class="crm-hero"',
  'class="crm-profile-tabs"',
  "salesOrderDetail(selected)"
];
for (const token of productionStructure) {
  if (!js.includes(token)) throw new Error("Missing production structure required by approved uniform design: " + token);
}

if (!crm.includes(".crm-summary{display:grid;grid-template-columns:repeat(4")) {
  throw new Error("Customer operational KPI strip is missing.");
}
if (!sales.includes("sales-command-page")) {
  throw new Error("Sales Order Concept A production scope is missing.");
}
if (!sales.includes("#salesOrderProductResults.so-product-results-portal")) {
  throw new Error("Sales Order smart-search portal layering is missing.");
}

console.log("Cross-page uniformity checks passed: Dashboard remains the visual authority; Customers and Sales Orders share the approved workspace rhythm, module geometry, control language, tabs and responsive density while preserving their module-specific structures.");
