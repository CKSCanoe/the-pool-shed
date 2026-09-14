import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const legacy = fs.readFileSync(path.join(root,"public","assets","js","01-legacy-01.js"),"utf8");
const css = fs.readFileSync(path.join(root,"public","assets","css","system","41-sales-order-command.css"),"utf8");
const index = fs.readFileSync(path.join(root,"public","index.html"),"utf8");
const sw = fs.readFileSync(path.join(root,"public","service-worker.js"),"utf8");

function expect(value,message){ if(!value) throw new Error(message); }

expect(legacy.includes("salesOrderProductSearchIndex"),"cached product search index missing");
expect(legacy.includes("salesOrderCustomerProductStats"),"customer product history engine missing");
expect(legacy.includes("Frequently ordered"),"frequently ordered UX missing");
expect(legacy.includes('data-so-batch-tab="frequent"'),"batch frequent tab missing");
expect(legacy.includes('data-so-batch-tab="history"'),"batch customer history tab missing");
expect(legacy.includes("Recently ordered"),"recent customer history UX missing");
expect(legacy.includes("Why shown"),"result explanation missing");
expect(legacy.includes("salesOrderDidYouMean"),"did-you-mean support missing");
expect(legacy.includes("window.setTimeout(run,90)"),"live-search debounce missing");
expect(legacy.includes('data-so-customer-products="frequent"'),"frequent customer filter missing");
expect(legacy.includes('data-so-customer-products="recent"'),"recent customer filter missing");
expect(legacy.includes("isNonStockSalesLine(line)"),"history must exclude non-stock lines");
expect(legacy.includes("data-so-select-product"),"exact product selection hook missing");
expect(css.includes(".so-finder-mega-grid"),"mega-menu layout missing");
expect(css.includes(".so-finder-reason"),"why-shown styling missing");
expect(css.includes(".so-finder-customer-panel"),"customer recommendation panel styling missing");
expect(index.includes("app.css?v=1.7.4"),"versioned CSS asset missing");
expect(index.includes("sales-workspace.js?v=1.7.4"),"versioned Sales workspace asset missing");
expect(sw.includes("pool-shed-v1.7.4-ui-ownership"),"service worker cache not advanced");

console.log("Sales Order Smart Product Finder v1.7.2 regression passed.");
