import fs from 'node:fs';

const js = fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const css = fs.readFileSync('public/assets/css/system/32-sales-workspace.css','utf8');
const workspace = fs.readFileSync('public/sales-workspace.js','utf8');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const sw = fs.readFileSync('public/service-worker.js','utf8');

const checks = [
  ['release version', pkg.version === '1.7.1'],
  ['smart product ranking', js.includes('function salesOrderProductMatches(query)') && js.includes('score += 10000')],
  ['search covers variant and SKU fields', js.includes('p.variantValue') && js.includes('p.supplierSku')],
  ['product dropdown is viewport portal', js.includes('function positionSalesOrderProductResults') && css.includes('.so-product-results-portal')],
  ['multi item drawer exists', js.includes('function salesOrderBatchPicker(order)') && css.includes('.so-batch-drawer')],
  ['multi item batch preserves selection', js.includes('__salesOrderBatchSelections')],
  ['batch add uses existing order lines', js.includes('function addBatchProductsToSalesOrder') && js.includes('existing.qty += qty')],
  ['batch add does not allocate stock', js.includes('allocated:0, picked:0, packed:0')],
  ['variant metadata shown on order lines', js.includes('function salesOrderVariantMeta') && css.includes('.so-variant-chips')],
  ['goods note directory is discoverable', js.includes('function salesOrderGoodsNotesDirectory') && js.includes('data-so-goods-note-search')],
  ['existing delete safeguard remains', js.includes('function canRemoveSalesOrderLine(line)') && js.includes('data-remove-sales-line')],
  ['existing allocation engine remains', js.includes('function allocateSalesOrder') && js.includes('function allocateSalesOrderLine')],
  ['existing custom line engine remains', js.includes('function addCustomSalesLine') && js.includes('data-add-custom-line')],
  ['existing shipping line engine remains', js.includes('function addShippingSalesLine') && js.includes('data-add-shipping-line')],
  ['selected Concept A page shell', workspace.includes('sales-command-page') && workspace.includes('so2-page') && css.includes('Sales Order Command v1.6.2')],
  ['selected Concept A items workspace', workspace.includes('so2-items-workspace') && workspace.includes('so2-entry-grid')],
  ['selected Concept A readable table', workspace.includes('so2-lines-table') && workspace.includes('so2-variant-control') && css.includes('min-width:1080px')],
  ['selected Concept A live totals rail', workspace.includes('so2-totals-card') && workspace.includes('Take / Record Payment') && css.includes('.so2-totals-card')],
  ['service worker invalidated', sw.includes('pool-shed-v1.7.4-ui-ownership')]
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
