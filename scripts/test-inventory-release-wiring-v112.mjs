import fs from 'node:fs';import assert from 'node:assert/strict';
const html=fs.readFileSync('public/index.html','utf8'),sw=fs.readFileSync('public/service-worker.js','utf8'),pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const release=pkg.version;
for(const asset of [`./inventory-control-engine.js?v=${release}`,`./inventory-workspace.js?v=${release}`,`./product-hub-workspace.js?v=${release}`,`./assets/css/app.css?v=${release}`]) assert(html.includes(asset),`Runtime missing ${asset}`);
assert(html.indexOf('inventory-control-engine.js')<html.indexOf('inventory-workspace.js'),'Inventory engine must load before workspace');
assert(sw.includes(`pool-shed-v${release}-`),'Service worker cache must use current release version');
for(const asset of [`./inventory-control-engine.js?v=${release}`,`./inventory-workspace.js?v=${release}`]) assert(sw.includes(asset),`Service worker must cache ${asset}`);
assert(fs.readFileSync('public/assets/css/app.css','utf8').includes('MODULE: system/47-inventory-location-control.css'),'Generated CSS must contain Inventory authority');
console.log(`PASS Inventory authority runtime, cache and asset wiring on v${release}`);
