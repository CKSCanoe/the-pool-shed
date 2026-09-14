import fs from "node:fs";

const js = fs.readFileSync("public/assets/js/01-legacy-01.js","utf8");
const css = fs.readFileSync("public/assets/css/system/32-sales-workspace.css","utf8");
const design = fs.readFileSync("public/assets/css/system/40-design-system.css","utf8");
const pkg = JSON.parse(fs.readFileSync("package.json","utf8"));
const sw = fs.readFileSync("public/service-worker.js","utf8");

const checks = [
  ["release version", pkg.version === "1.7.5"],
  ["Option A order queue shell", js.includes('class="so-list-page"') && js.includes('>Order queue<')],
  ["operational KPI strip", js.includes("so-list-kpis") && js.includes("ACTIVE ORDERS") && js.includes("NEED ACTION") && js.includes("READY TO PROCESS") && js.includes("DUE TODAY")],
  ["queue tabs include action views", js.includes('{ id: "needs", label: "Needs action"') && js.includes('{ id: "backorder", label: "Backorders"')],
  ["smart list search covers products and Goods Notes", js.includes("function salesOrderSearchText(order)") && js.includes("goodsNotesForOrder(order.id)") && js.includes("p.sku")],
  ["status due and stock filters", js.includes("data-so-list-status") && js.includes("data-so-list-due") && js.includes("data-so-list-stock")],
  ["extra source and channel filters", js.includes("data-so-list-source") && js.includes("data-so-list-channel") && js.includes("data-so-list-more")],
  ["list stock derives from authoritative line coverage", js.includes("function salesOrderStockSummary(order)") && js.includes("salesLineCoverage(line, order.id)")],
  ["list value uses VAT-inclusive authoritative totals", js.includes("const totals = salesOrderTotals(order)") && js.includes("inc VAT")],
  ["fulfilment derives from existing progress and Goods Notes", js.includes("const progress = salesOrderProgress(order)") && js.includes("openNotes")],
  ["bulk actions only surface after selection", js.includes('data-so-list-bulk hidden') && js.includes("function refreshSalesOrderBulkBar()")],
  ["existing bulk engines retained", js.includes('data-sales-list-action="allocate"') && js.includes('data-sales-list-action="fulfil"') && js.includes('data-sales-list-action="invoice"')],
  ["old list presentation removed", !js.includes("<th>Invoice</th><th>Contact</th><th>Status</th><th>Process</th><th>Tags</th>")],
  ["bounded sticky order list", css.includes(".so-list-table-wrap") && css.includes("max-height:clamp(360px,58vh,680px)") && css.includes(".so-list-table th") && css.includes("position:sticky")],
  ["selected Option A palette uses calm light fields", css.includes("Approved light workspace palette") && design.includes("UPDATED PAGE PALETTE GUARD")],
  ["palette guard scoped to CRM and Sales Orders only", design.includes('#screen-crm :is(input:not([type="checkbox"]):not([type="radio"]),select,textarea)') && design.includes('#screen-salesorders :is(input:not([type="checkbox"]):not([type="radio"]),select,textarea)')],
  ["service worker release cache invalidated", sw.includes("pool-shed-v1.7.5-ui-ownership")]
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log("Sales Order List Option A checks passed.");
