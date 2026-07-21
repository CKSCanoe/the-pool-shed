import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(process.argv[2] || 'public');
const htmlPath = path.join(root, 'index.html');
const swPath = path.join(root, 'service-worker.js');
const configPath = path.join(root, 'config.js');
const salesSearchPath = path.join(root, 'sales-order-search.js');
const salesSearchCssPath = path.join(root, 'sales-order-search.css');
const partialFulfilmentPath = path.join(root, 'partial-fulfilment.js');
const partialFulfilmentCssPath = path.join(root, 'partial-fulfilment.css');
const catalogueIntelligencePath = path.join(root, 'catalogue-intelligence.js');
const catalogueIntelligenceCssPath = path.join(root, 'catalogue-intelligence.css');

for (const file of [htmlPath, swPath, configPath, salesSearchPath, salesSearchCssPath, partialFulfilmentPath, partialFulfilmentCssPath, catalogueIntelligencePath, catalogueIntelligenceCssPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing required deployment file: ${file}`);
}

const html = fs.readFileSync(htmlPath, 'utf8');
if (!html.includes('<!doctype html>') || !html.includes('The Pool Shed')) {
  throw new Error('index.html does not look like The Pool Shed app');
}
if (!html.includes('./sales-order-search.css') || !html.includes('./sales-order-search.js')) {
  throw new Error('The v1.10.5 sales order search assets are not connected to index.html');
}
if (!html.includes('./partial-fulfilment.css') || !html.includes('./partial-fulfilment.js')) {
  throw new Error('The v1.10.9 partial shipment assets are not connected to index.html');
}
if (!html.includes('./catalogue-intelligence.css') || !html.includes('./catalogue-intelligence.js')) {
  throw new Error('The v1.11.2 catalogue intelligence assets are not connected to index.html');
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


for (const requiredStatusControl of ['status-picker-sales', 'status-picker-po', 'status-picker-label', 'status-picker-native', 'salesOrderStatusPicker', 'purchaseOrderStatusPicker', 'aria-label=\"Sales order status\"', 'aria-label=\"Purchase order status\"']) {
  if (!html.includes(requiredStatusControl)) throw new Error(`Status picker is incomplete: ${requiredStatusControl}`);
}
if (html.includes('<div class=\"so-status-control\"')) {
  throw new Error('Legacy blank-prone sales order status control remains');
}
if ((html.match(/purchaseOrderStatusPicker\(po/g) || []).length < 5) {
  throw new Error('Not every Purchase Order status location uses the visible-label picker');
}

const swSource = fs.readFileSync(swPath, 'utf8');
new vm.Script(swSource, { filename: 'service-worker.js' });
for (const asset of ['sales-order-search.css', 'sales-order-search.js', 'partial-fulfilment.css', 'partial-fulfilment.js', 'catalogue-intelligence.css', 'catalogue-intelligence.js']) {
  if (!swSource.includes(asset)) throw new Error(`Offline cache is missing ${asset}`);
}
if (!swSource.includes('pool-shed-v1.11.2-solid-catalogue-search')) {
  throw new Error('Service worker cache version was not advanced to v1.11.2');
}

const searchSource = fs.readFileSync(salesSearchPath, 'utf8');
new vm.Script(searchSource, { filename: 'sales-order-search.js' });
const cssSource = fs.readFileSync(salesSearchCssPath, 'utf8');
for (const requiredStyle of ['.so-catalogue-picker', '.so-search-popover', 'position: fixed', '.so-selected-product']) {
  if (!cssSource.includes(requiredStyle)) throw new Error(`Sales order search styling is incomplete: ${requiredStyle}`);
}


const partialSource = fs.readFileSync(partialFulfilmentPath, 'utf8');
new vm.Script(partialSource, { filename: 'partial-fulfilment.js' });
const partialCss = fs.readFileSync(partialFulfilmentCssPath, 'utf8');
for (const requiredPartialFeature of [
  'PoolShedPartialFulfilment',
  "version: VERSION",
  'partialFulfilmentModal',
  'Create a partial shipment',
  'lineShipmentState',
  'openGoodsNoteQuantity',
  'Create another shipment',
  'shipGoodsNote = function',
  'line.allocated = Math.max(0',
  "action !== 'pickList'"
]) {
  if (!partialSource.includes(requiredPartialFeature)) throw new Error(`Partial shipment feature missing: ${requiredPartialFeature}`);
}
for (const requiredPartialStyle of [
  '@keyframes poolShedRainbowFlow',
  '.order-lines-scroll',
  '.order-shipment-summary',
  '.partial-fulfilment-modal',
  '.goods-note-partial-banner',
  '.so-search-clear:hover',
  'translateY(-50%)'
]) {
  if (!partialCss.includes(requiredPartialStyle)) throw new Error(`Partial shipment styling is incomplete: ${requiredPartialStyle}`);
}
if (html.indexOf('./partial-fulfilment.js') < html.indexOf('./sales-order-search.js')) {
  throw new Error('partial-fulfilment.js must load after sales-order-search.js and the core app');
}

if (html.indexOf('./catalogue-intelligence.js') < html.indexOf('./sales-order-search.js') || html.indexOf('./catalogue-intelligence.js') > html.indexOf('./partial-fulfilment.js')) {
  throw new Error('catalogue-intelligence.js must load after sales-order-search.js and before partial-fulfilment.js');
}

const catalogueSource = fs.readFileSync(catalogueIntelligencePath, 'utf8');
new vm.Script(catalogueSource, { filename: 'catalogue-intelligence.js' });
const catalogueCss = fs.readFileSync(catalogueIntelligenceCssPath, 'utf8');
for (const requiredFeature of [
  'PoolShedCatalogueIntelligence',
  "const VERSION = '1.11.2'",
  'ci-command-centre',
  'ci-po-catalogue-picker',
  'applyHubQuery',
  'purchaseOffers',
  "event.key === 'Enter'",
  'data-ci-hub-submit',
  'data-ci-po-add',
  'Offline catalogue ready',
  'ci-search-backdrop',
  'showSearchLayer',
  'tidySearchLayer',
  'Showing the top'
]) {
  if (!catalogueSource.includes(requiredFeature)) throw new Error(`Catalogue intelligence feature missing: ${requiredFeature}`);
}
for (const requiredStyle of [
  '.ci-command-centre',
  '.ci-search-popover',
  '.ci-po-catalogue-picker',
  '.ci-selected-offer',
  '@keyframes ci-spectrum',
  'position: fixed',
  'prefers-reduced-motion',
  '.ci-popover-results',
  'background: var(--surface)',
  'solid Product Hub refinements',
  '.ci-search-backdrop',
  'background: #ffffff !important',
  'button.ci-result-row',
  '.ci-popover-footer'
]) {
  if (!catalogueCss.includes(requiredStyle)) throw new Error(`Catalogue intelligence styling is incomplete: ${requiredStyle}`);
}

if (html.includes('<div class="inventory-sync-banner">')) {
  throw new Error('Redundant Product Hub inventory synchronisation banner is still rendered');
}
for (const requiredPremiumFeature of [
  'Find the exact product in seconds',
  'Best catalogue matches',
  'ci-popover-results',
  'Catalogue ready online',
  "screen.querySelectorAll('.inventory-sync-banner')"
]) {
  if (!catalogueSource.includes(requiredPremiumFeature)) throw new Error(`Premium Product Hub feature missing: ${requiredPremiumFeature}`);
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

context.data.products = [union, chlorine5kg];
context.data.supplierProducts = [
  { productId: chlorine5kg.id, supplier: 'CPC', supplierSku: 'MFTAB2005BH', cost: 12.5, leadTimeDays: 2, available: true },
  { productId: chlorine5kg.id, supplier: 'Alternative', supplierSku: 'ALT-5KG', cost: 11.9, leadTimeDays: 5, available: true }
];
vm.runInContext(catalogueSource, context, { filename: 'catalogue-intelligence-diagnostics.js' });
const catalogueDiagnostics = windowStub.PoolShedCatalogueIntelligence;
if (!catalogueDiagnostics || catalogueDiagnostics.version !== '1.11.2') {
  throw new Error('Catalogue intelligence diagnostics API did not initialise');
}
const catalogueRanked = catalogueDiagnostics.rankProducts('clorine 5kg tabs', 10);
if (!catalogueRanked.length || catalogueRanked[0].product.id !== chlorine5kg.id) {
  throw new Error('Catalogue intelligence did not rank the typo-tolerant 5 kg variant first');
}
const exactCatalogueRanked = catalogueDiagnostics.rankProducts('PB-CPC-MFTAB2005BH', 10);
if (!exactCatalogueRanked.length || exactCatalogueRanked[0].product.id !== chlorine5kg.id || !exactCatalogueRanked[0].exact) {
  throw new Error('Catalogue intelligence exact SKU handling failed');
}
const poOffers = catalogueDiagnostics.purchaseOffers({ id: 'PO-TEST', supplier: 'CPC' }, '5kg chlorine tablets');
if (!poOffers.length || poOffers[0].product.id !== chlorine5kg.id || !poOffers.some(row => row.supplier.name === 'CPC')) {
  throw new Error('Purchase order supplier-offer search failed');
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



// Behaviour test: shipping 4 from an order of 16 must leave 12 on the sales order,
// 12 physically in stock and 12 still allocated for later goods notes.
{
  const testOrder = { id: 'SO-PARTIAL', status: 'Ready To Pick', tags: [], lines: [{ productId: 'P-DRUM', qty: 16, allocated: 16, picked: 0, packed: 0, shipped: 0 }] };
  const testNote = { id: 'GN-PARTIAL-1', salesOrderId: testOrder.id, packed: true, shipped: false, courier: 'Test Courier', trackingRef: 'TRACK-1', lines: [{ productId: 'P-DRUM', qty: 4, picked: 4, packed: 4, shipped: 0 }] };
  const testStock = [{ productId: 'P-DRUM', locationId: 'L-WH-A1', qty: 16, allocated: 16 }];
  const partialData = { goodsNotes: [testNote], stock: testStock };
  const partialDocument = {
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    createElement() { return { id: '', className: '', innerHTML: '', querySelectorAll() { return []; }, addEventListener() {}, appendChild() {}, content: { querySelector() { return null; }, cloneNode() { return {}; } } }; },
    body: { appendChild() {} }
  };
  const partialWindow = { addEventListener() {} };
  const partialContext = {
    console,
    window: partialWindow,
    document: partialDocument,
    CSS: { escape(value) { return String(value); } },
    FormData: class {},
    data: partialData,
    selectedSalesOrderId: testOrder.id,
    selectedGoodsNoteId: '',
    active: '',
    salesOrderView: '',
    salesLineCoverage() { return {}; }, salesLineHealth() { return {}; }, goodsNoteAvailableLines() { return []; },
    applyGoodsNoteTotalsToOrder() { return false; }, syncSalesOrderStatusFromGoodsNotes() { return false; }, updateSalesOrderStatusAfterAllocation() { return false; },
    allocateSalesOrderLine() {}, allocateSalesOrder() {}, updateSalesOrderLineNumber() {}, shipGoodsNote() { return false; }, fulfilSalesOrder() {},
    createSelectedLineGoodsNote() {}, runBulkGoodsOutAction() {}, goodsNoteWorkspace() { return '<div class="stage-grid">'; }, splitOrderControl() { return ''; }, salesOrderDetail() { return '<div></div>'; },
    isNonStockSalesLine() { return false; },
    goodsNotesForOrder(id) { return partialData.goodsNotes.filter(note => note.salesOrderId === id); },
    salesOrder(id) { return id === testOrder.id ? testOrder : null; },
    product(id) { return { id, sku: 'SKU-DRUM', name: 'Hypochlorite drum' }; }, customer() { return { name: 'Customer' }; }, goodsNoteStatus() { return 'Packed'; },
    nextGoodsNoteId() { return 'GN-PARTIAL-2'; }, currentUser() { return { name: 'Aaron' }; }, toast() {}, render() {}, saveAppData() {}, addNotification() {}, addSalesOrderNotification() {}, addMovement() {},
    lineAvailability() { return { free: 0, linkedPoQty: 0 }; }, stockRowsForProduct(id) { return testStock.filter(row => row.productId === id); }, available(row) { return Number(row.qty || 0) - Number(row.allocated || 0); },
    releaseAllocatedStockForLine() {},
    goodsNoteTotalsForOrder(id) {
      const totals = {};
      partialData.goodsNotes.filter(note => note.salesOrderId === id).forEach(note => (note.lines || []).forEach(line => {
        totals[line.productId] ||= { picked: 0, packed: 0, shipped: 0 };
        totals[line.productId].picked += Number(line.picked || 0);
        totals[line.productId].packed += Number(line.packed || 0);
        totals[line.productId].shipped += note.shipped ? Number(line.qty || 0) : Number(line.shipped || 0);
      }));
      return totals;
    },
    selectedGoodsOutQueueNotes() { return []; }, printBulkPickingList() { return true; }, markGoodsNotePrinted() { return true; }, goodsNote(id) { return partialData.goodsNotes.find(note => note.id === id); },
    escapeHtml(value) { return String(value); }
  };
  partialWindow.window = partialWindow;
  partialWindow.document = partialDocument;
  vm.createContext(partialContext);
  vm.runInContext(partialSource, partialContext, { filename: 'partial-fulfilment-behaviour.js' });
  if (!partialWindow.PoolShedPartialFulfilment || partialWindow.PoolShedPartialFulfilment.version !== '1.10.9') throw new Error('Partial fulfilment diagnostics API did not initialise');
  if (!partialContext.shipGoodsNote(testNote)) throw new Error('Partial goods note could not be shipped in behaviour test');
  const remainingState = partialWindow.PoolShedPartialFulfilment.lineShipmentState(testOrder, testOrder.lines[0]);
  if (testStock[0].qty !== 12 || testStock[0].allocated !== 12 || testOrder.lines[0].allocated !== 12 || remainingState.shipped !== 4 || remainingState.remaining !== 12 || testOrder.status !== 'Part Shipped') {
    throw new Error(`Partial shipment balance failed: ${JSON.stringify({ stock: testStock[0], line: testOrder.lines[0], state: remainingState, status: testOrder.status })}`);
  }
}

for (const statusToken of ['statusEditorModal', 'data-add-status', 'data-edit-status', 'data-delete-status', 'RAL_STATUS_COLOURS', 'deleteSalesOrderStatus']) {
  if (!html.includes(statusToken)) throw new Error(`Status management is incomplete: ${statusToken}`);
}
console.log(`Runtime validation passed: ${count} inline scripts, service worker, offline sales search, catalogue intelligence, PO supplier-offer search, partial shipment balance test, solid catalogue search UI and required app functions.`);
