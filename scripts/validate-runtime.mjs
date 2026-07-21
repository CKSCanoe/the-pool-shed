import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(process.argv[2] || 'public');
const htmlPath = path.join(root, 'index.html');
const swPath = path.join(root, 'service-worker.js');
const configPath = path.join(root, 'config.js');
const salesSearchPath = path.join(root, 'sales-order-search.js');
const salesSearchCssPath = path.join(root, 'sales-order-search.css');

for (const file of [htmlPath, swPath, configPath, salesSearchPath, salesSearchCssPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing required deployment file: ${file}`);
}

const html = fs.readFileSync(htmlPath, 'utf8');
if (!html.includes('<!doctype html>') || !html.includes('The Pool Shed')) {
  throw new Error('index.html does not look like The Pool Shed app');
}
if (!html.includes('./sales-order-search.css') || !html.includes('./sales-order-search.js')) {
  throw new Error('The v1.10.5 sales order search assets are not connected to index.html');
}

const scriptRegex = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
while ((match = scriptRegex.exec(html))) {
  count += 1;
  try {
    new vm.Script(match[1], { filename: `index-inline-${count}.js` });
  } catch (error) {
    throw new Error(`Inline JavaScript ${count} failed syntax validation: ${error.message}`);
  }
}
if (!count) throw new Error('No inline application scripts were found');


for (const requiredStatusControl of ['so-status-control', 'so-status-indicator', 'aria-label=\"Sales order status\"', 'flex: 0 0 210px']) {
  if (!html.includes(requiredStatusControl)) throw new Error(`Sales order status control is incomplete: ${requiredStatusControl}`);
}

const swSource = fs.readFileSync(swPath, 'utf8');
new vm.Script(swSource, { filename: 'service-worker.js' });
for (const asset of ['sales-order-search.css', 'sales-order-search.js']) {
  if (!swSource.includes(asset)) throw new Error(`Offline cache is missing ${asset}`);
}
if (!swSource.includes('pool-shed-v1.10.7-sales-status-layout')) {
  throw new Error('Service worker cache version was not advanced to v1.10.7');
}

const searchSource = fs.readFileSync(salesSearchPath, 'utf8');
new vm.Script(searchSource, { filename: 'sales-order-search.js' });
const cssSource = fs.readFileSync(salesSearchCssPath, 'utf8');
for (const requiredStyle of ['.so-catalogue-picker', '.so-search-popover', 'position: fixed', '.so-selected-product']) {
  if (!cssSource.includes(requiredStyle)) throw new Error(`Sales order search styling is incomplete: ${requiredStyle}`);
}

const documentStub = {
  addEventListener() {},
  querySelectorAll() { return []; },
  getElementById() { return null; },
  documentElement: {}
};
const windowStub = {
  addEventListener() {},
  innerWidth: 1440,
  innerHeight: 900
};
const context = {
  window: windowStub,
  document: documentStub,
  navigator: { onLine: true },
  MutationObserver: class { observe() {} disconnect() {} },
  setTimeout() { return 1; },
  clearTimeout() {},
  console,
  data: { products: [], stock: [], locations: [] }
};
windowStub.window = windowStub;
windowStub.document = documentStub;
windowStub.navigator = context.navigator;
vm.createContext(context);
vm.runInContext(searchSource, context, { filename: 'sales-order-search-diagnostics.js' });
const diagnostics = windowStub.PoolShedSalesSearch;
if (!diagnostics || diagnostics.version !== '1.10.5') {
  throw new Error('Sales order search diagnostics API did not initialise');
}

const chlorine5kg = {
  id: 'P-TEST-1',
  parentName: 'Multifunctional 200g Chlorine Tablets',
  variantValue: '5 kg',
  name: 'Multifunctional 200g Chlorine Tablets 5 kg',
  sku: 'PB-CPC-MFTAB2005BH',
  supplierSku: 'MFTAB2005BH',
  barcode: '5012345678901',
  brand: 'CPC',
  category: 'Chemicals'
};
const union = {
  id: 'P-TEST-2',
  name: '1.5 inch Socket unions 5 per pack',
  sku: 'PB-CPC-UNION15',
  supplierSku: 'UNION15-5',
  category: 'Pipework'
};
const tests = [
  [chlorine5kg, 'chlorine tablets 5 kg', 'normal word search'],
  [chlorine5kg, '5kg chlorine tablets', 'mixed word order and unit spacing'],
  [chlorine5kg, 'clorine 5kg tabs', 'typo and synonym tolerance'],
  [chlorine5kg, 'PB-CPC-MFTAB2005BH', 'exact Pool Bros SKU'],
  [chlorine5kg, 'MFTAB2005BH', 'supplier SKU'],
  [union, '1.5 socket union', 'size and product type']
];
for (const [product, query, label] of tests) {
  if (!diagnostics.productMatchesQuery(product, query)) {
    throw new Error(`Smart search test failed for ${label}: ${query}`);
  }
}
const ranked = diagnostics.rankProducts([union, chlorine5kg], 'PB-CPC-MFTAB2005BH');
if (!ranked.length || ranked[0].product.id !== chlorine5kg.id) {
  throw new Error('Exact SKU was not ranked first');
}

if (html.includes("reconcileInventory('Product Hub render')")) {
  throw new Error('Unsafe inventory reconciliation remains inside Product Hub render');
}
if (!html.includes('scheduleHubRender') || !html.includes('data-delete-po')) {
  throw new Error('Product Hub safe search or PO deletion controls are missing');
}
if (html.includes("hubState[f.dataset.hubFilter]=f.value;render()")) {
  throw new Error('Unsafe synchronous Product Hub input re-render detected');
}

for (const requiredFix of ['stockRowsForLocationScope', 'dashboardHealthSummary', 'source.statuses = seed.statuses.map(clone)', 'L-WH-A1', 'orderedDashboardStatuses']) {
  if (!html.includes(requiredFix)) throw new Error(`Dashboard/inventory fix missing: ${requiredFix}`);
}
for (const required of ['matchesSearchProduct', 'renderProducts', 'render', 'saveAppData', 'deletePurchaseOrder']) {
  if (!html.includes(required)) throw new Error(`Required application function missing: ${required}`);
}
for (const requiredSearchFeature of ['data-so-select-product-v1105', 'productMatchesQuery', 'Offline catalogue active', 'Add selected item']) {
  if (!searchSource.includes(requiredSearchFeature)) throw new Error(`Sales order search feature missing: ${requiredSearchFeature}`);
}


for (const statusToken of ['statusEditorModal', 'data-add-status', 'data-edit-status', 'data-delete-status', 'RAL_STATUS_COLOURS', 'deleteSalesOrderStatus']) {
  if (!html.includes(statusToken)) throw new Error(`Status management is incomplete: ${statusToken}`);
}
console.log(`Runtime validation passed: ${count} inline scripts, service worker, offline search assets, required app functions and 6 smart-search tests.`);
