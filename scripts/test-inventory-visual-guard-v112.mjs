import fs from 'node:fs';import assert from 'node:assert/strict';
const cssPath='public/assets/css/system/47-inventory-location-control.css';assert(fs.existsSync(cssPath),'Inventory CSS authority must exist');const css=fs.readFileSync(cssPath,'utf8');const build=fs.readFileSync('scripts/build-css.mjs','utf8');
assert(build.includes('47-inventory-location-control.css'),'Inventory CSS must be included in generated app.css');
assert(css.includes('.inventory-control-v112'),'Inventory selectors must be scoped');
assert(css.includes('@media'),'Inventory CSS needs responsive guards');
assert(/overflow-x\s*:\s*auto/.test(css),'Wide Inventory tables need controlled horizontal scrolling');
assert(/font-size\s*:\s*(10|11|12|13|14|15|16)px/.test(css),'Inventory must use readable fixed minimum text sizes');
assert(!/darkgreen|#0b3d2e|#064e3b/i.test(css),'Legacy dark-green interaction styling must not return');
console.log('PASS Inventory visual authority and responsive guard');
