import fs from "node:fs";
const sw = fs.readFileSync("public/sales-workspace.js","utf8");
const legacy = fs.readFileSync("public/assets/js/01-legacy-01.js","utf8");
const cssBuild = fs.readFileSync("scripts/build-css.mjs","utf8");
const css = fs.readFileSync("public/assets/css/system/42-sales-order-parity.css","utf8");
const index = fs.readFileSync("public/index.html","utf8");
const serviceWorker = fs.readFileSync("public/service-worker.js","utf8");

function need(cond,msg){ if(!cond) throw new Error(msg); }

need(sw.includes("if (salesOrderTab === 'products')") && sw.includes("activeBody = so2ProductsContent(order);"),
  "Items & Pricing must render the approved command workspace directly");
need(sw.includes("so4-finder-shell") && sw.includes("so4-secondary-tools"),
  "Sales Order product finder and secondary line tools must use the v1.7.2 parity structure");
need(sw.includes("Take / Record Payment") && sw.includes("Save Order"),
  "Approved payment and save actions must remain in the Sales Order command");
need(sw.includes("so2-variant-control") && sw.includes("data-so2-variant"),
  "Variant-aware exact-SKU control must remain present");
need(legacy.includes("Frequently ordered") && legacy.includes("Customer history") &&
     legacy.includes("salesOrderCustomerProductStats") && legacy.includes("salesOrderDidYouMean"),
  "Smart Product Finder must retain customer history, frequent-order and typo assistance");
need(cssBuild.includes("system/42-sales-order-parity.css"),
  "Parity CSS module must be part of the canonical CSS build");
need(css.includes(".so4-finder-shell") && css.includes(".so-finder-mega-grid") &&
     css.includes(".so2-lines-table") && css.includes(".so3-summary-grid"),
  "Parity CSS must own finder, item lines and Sales Order summary surfaces");
need(index.includes("app.css?v=1.7.5") && index.includes("sales-workspace.js?v=1.7.5"),
  "Critical Sales Order assets must be release-versioned");
need(serviceWorker.includes("pool-shed-v1.7.5-ui-ownership") &&
     serviceWorker.includes("app.css?v=1.7.5") && serviceWorker.includes("sales-workspace.js?v=1.7.5"),
  "Service worker must invalidate the previous Sales Order asset generation");
console.log("Sales Order v1.7.2 Design Lab parity checks passed.");
