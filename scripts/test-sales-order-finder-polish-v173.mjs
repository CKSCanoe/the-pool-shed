import fs from "node:fs";
import path from "node:path";
const root=path.resolve(new URL("..",import.meta.url).pathname);
const legacy=fs.readFileSync(path.join(root,"public/assets/js/01-legacy-01.js"),"utf8");
const sales=fs.readFileSync(path.join(root,"public/sales-workspace.js"),"utf8");
const css=fs.readFileSync(path.join(root,"public/assets/css/system/43-sales-order-finder-polish.css"),"utf8");
const index=fs.readFileSync(path.join(root,"public/index.html"),"utf8");
const sw=fs.readFileSync(path.join(root,"public/service-worker.js"),"utf8");
const failures=[];
const must=(ok,msg)=>{if(!ok)failures.push(msg);};

must(legacy.includes("so5-nav-item"),"finder renders structured navigation");
must(legacy.includes("Recommended for this customer"),"customer recommendations retained");
must(legacy.includes("Popular with your team"),"team recommendation rail retained");
must(legacy.includes("Customer history"),"customer history filter retained");
must(legacy.includes("Why shown"),"result reasoning retained");
must(legacy.includes("so5-did-you-mean"),"did-you-mean guidance retained");
must(legacy.includes("so5-selected-product"),"selected-product confirmation bar retained");
must(legacy.includes("salesOrderTeamProductStats"),"team popularity derives from real sales history");
must(legacy.includes("salesOrderFinderProductImage"),"finder supports product imagery with fallback");
must(sales.includes("so5-line-thumb"),"added Sales Order line receives polished product thumbnail");
must(sales.includes("so2-variant-cell"),"variant remains a dedicated column");
must(sales.includes("so2-line-menu"),"three-dot line action menu remains available");
must(css.includes(".so-finder-result:hover"),"finder hover state explicitly styled");
must(css.includes("background:#F2F9FB!important"),"selected/hover state uses calm blue-grey rather than success green");
must(css.includes(".so5-line-product"),"order-line product presentation is polished");
must(index.includes("./assets/css/app.css?v=1.7.3"),"versioned stylesheet loaded");
must(index.includes("./assets/js/01-legacy-01.js?v=1.7.3"),"versioned finder runtime loaded");
must(index.includes("./sales-workspace.js?v=1.7.3"),"versioned Sales Order workspace loaded");
must(sw.includes("pool-shed-v1.7.3-sales-order-finder-polish"),"service worker cache namespace advanced");

if(failures.length){
  console.error("Sales Order finder polish v1.7.3 failed:");
  failures.forEach(x=>console.error(" - "+x));
  process.exit(1);
}
console.log("Sales Order finder polish v1.7.3 passed.");
