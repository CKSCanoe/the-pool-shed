import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const html=fs.readFileSync('public/index.html','utf8');
const sw=fs.readFileSync('public/service-worker.js','utf8');
const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const ready=fs.readFileSync('public/production-readiness-engine.js','utf8');
const xero=fs.readFileSync('server/accounting.js','utf8');

const [major,minor]=pkg.version.split('.').map(Number); assert(major>1||(major===1&&minor>=21),'Full system regression guard requires 1.21.0 or newer');
assert(html.includes(`v=${pkg.version}`),'Every runtime entry point must use the current release cache version');
assert(sw.includes(`pool-shed-v${pkg.version}-`),'Service worker must identify the current release');
assert(!html.includes('v=1.20.1'),'Index must not reference the previous runtime version');
assert(!sw.includes('v=1.20.1'),'Service worker core list must not reference the previous runtime version');
assert(legacy.includes(`service-worker.js?v=${pkg.version}`),'Legacy bootstrap must register the current service worker');
assert(ready.includes(`const VERSION='${pkg.version}'`),'Production Readiness must report the current release version');
for(const label of ['Dashboard','CRM','Projects','Sales Orders','Engineer Requests','Product Hub','Inventory','Purchasing','Warehouse','Fulfilment','Accounting','Analytics','Automation','Settings']){
  assert(legacy.includes(`label: "${label}"`),`Main navigation must expose ${label}`);
}
assert(legacy.includes('Dashboard → CRM → Projects → Sales Orders → Engineer Requests → Product Hub → Inventory → Purchasing → Warehouse → Fulfilment → Accounting → Analytics → Automation → Settings.'),'Suggested operating flow must use final navigation terminology');
assert(/XERO_INTEGRATION_MODE/.test(xero),'Xero integration mode gate must remain present');
assert(/ready/.test(xero),'Xero Ready mode must remain present');
console.log(`PASS full-system release contract retained on v${pkg.version}`);
