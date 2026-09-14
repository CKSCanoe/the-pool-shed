import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const index = fs.readFileSync('public/index.html','utf8');
const sw = fs.readFileSync('public/service-worker.js','utf8');
const legacy = fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');

const version = '1.6.3';
const indexLocal = [...index.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)]
  .map(m => m[1])
  .filter(asset => /\.(?:js|css)(?:\?|$)/.test(asset));
const swCore = [...sw.matchAll(/["'](\.\/[^"']+)["']/g)].map(m => m[1]);

const checks = [
  ['release version', pkg.version === version],
  ['service worker cache namespace advanced', sw.includes(`pool-shed-v${version}-asset-freshness`)],
  ['service worker update bypasses HTTP cache', legacy.includes('updateViaCache:"none"')],
  ['approved Sales workspace loads after fulfilment and customer picker',
    index.indexOf('./sales-workspace.js') > index.indexOf('./partial-fulfilment.js') &&
    index.indexOf('./sales-workspace.js') > index.indexOf('./sales-order-customer-picker.js')],
  ['critical presentation CSS is versioned', index.includes(`./assets/css/app.css?v=${version}`)],
  ['critical Sales workspace is versioned', index.includes(`./sales-workspace.js?v=${version}`)],
  ['critical versioned presentation assets are precached',
    sw.includes(`./assets/css/app.css?v=${version}`) && sw.includes(`./sales-workspace.js?v=${version}`)],
  ['every local JS/CSS shell asset is represented in precache',
    indexLocal.every(asset => swCore.includes(asset))],
  ['legacy runtime remains loaded before the Sales workspace',
    index.indexOf('./assets/js/01-legacy-01.js') < index.indexOf('./sales-workspace.js')]
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
