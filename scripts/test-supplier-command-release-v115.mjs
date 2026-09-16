import fs from 'node:fs';
import assert from 'node:assert/strict';
import pkg from '../package.json' with {type:'json'};

const release=pkg.version;
const html=fs.readFileSync('public/index.html','utf8');
const sw=fs.readFileSync('public/service-worker.js','utf8');
const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const buildCss=fs.readFileSync('scripts/build-css.mjs','utf8');
const appCss=fs.readFileSync('public/assets/css/app.css','utf8');

const [major,minor]=release.split('.').map(Number);
assert(major>1 || (major===1 && minor>=15),'Supplier Command regression guard requires release 1.15.0 or newer');
for(const asset of [
  `./assets/css/app.css?v=${release}`,
  `./purchase-workspace.js?v=${release}`,
  `./supplier-command-engine.js?v=${release}`,
  `./supplier-command-workspace.js?v=${release}`,
  `./product-hub-engine.js?v=${release}`
]) assert(html.includes(asset),`Runtime missing ${asset}`);
assert(html.indexOf('./purchase-workspace.js') < html.indexOf('./supplier-command-engine.js'),'Supplier engine must load after Purchasing authority');
assert(html.indexOf('./supplier-command-engine.js') < html.indexOf('./supplier-command-workspace.js'),'Supplier engine must load before supplier workspace');
for(const asset of [`./supplier-command-engine.js?v=${release}`,`./supplier-command-workspace.js?v=${release}`]) assert(sw.includes(asset),`Service worker must cache ${asset}`);
assert(legacy.includes(`service-worker.js?v=${release}`),'Legacy bootstrap must register the current service worker version');
assert(buildCss.includes('system/49-supplier-command.css'),'CSS build must include Supplier Command authority module');
assert(appCss.includes('MODULE: system/49-supplier-command.css'),'Generated CSS must contain Supplier Command authority');
console.log(`PASS Supplier Command runtime, cache and visual authority wiring retained on v${release}`);
