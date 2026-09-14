import fs from "node:fs";
const index=fs.readFileSync("public/index.html","utf8");
const sw=fs.readFileSync("public/service-worker.js","utf8");
const legacy=fs.readFileSync("public/assets/js/01-legacy-01.js","utf8");
const css=fs.readFileSync("public/assets/css/system/42-sales-order-parity.css","utf8");

const must=(ok,msg)=>{ if(!ok){ console.error("FAIL:",msg); process.exitCode=1; } else console.log("PASS:",msg); };

must(index.includes("./assets/js/01-legacy-01.js?v=1.7.3"),"critical Sales Order finder runtime is release-versioned");
must(index.includes("./sales-workspace.js?v=1.7.3"),"Sales Order workspace runtime is release-versioned");
must(index.includes("./assets/css/app.css?v=1.7.3"),"compiled UI stylesheet is release-versioned");
must(sw.includes("pool-shed-v1.7.3-sales-order-finder-polish"),"service worker cache namespace advanced");
must(sw.includes("./assets/js/01-legacy-01.js?v=1.7.3"),"service worker precaches versioned finder runtime");
must(legacy.includes("Smart product finder"),"smart finder mega menu exists");
must(legacy.includes("Frequently ordered"),"customer frequently ordered mode exists");
must(legacy.includes("Customer history"),"customer history mode exists");
must(legacy.includes("so5-did-you-mean"),"assisted keyword suggestions exist");
must(legacy.includes("Why shown"),"result reason signal exists");
must(legacy.includes("Results update as you type"),"live-as-you-type UX exists");
must(legacy.includes("window.setTimeout(run,90)"),"search is lightly debounced");
must(css.includes("grid-template-columns:220px minmax(0,1fr) 260px"),"three-column lab mega-menu layout is authoritative");
must(css.includes("z-index:2147483000"),"mega menu floats over surrounding order UI");
if(process.exitCode) process.exit(process.exitCode);
