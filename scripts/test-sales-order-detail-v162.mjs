import fs from 'node:fs';

const workspace = fs.readFileSync('public/sales-workspace.js','utf8');
const css = fs.readFileSync('public/assets/css/system/32-sales-workspace.css','utf8');
const legacy = fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));

const checks = [
  ['release version', pkg.version === '1.6.2'],
  ['smart customer intelligence', workspace.includes('so2CustomerCard') && workspace.includes('Credit headroom') && workspace.includes('Open CRM')],
  ['first class save action preserved', workspace.includes("save.textContent = 'Save Order'") && legacy.includes('data-save-order')],
  ['payment beside totals', workspace.includes('Take / Record Payment') && workspace.includes('data-open-payment') && workspace.includes('View payment history')],
  ['clear operational tabs', workspace.includes("['products','Items & Pricing']") && workspace.includes("['fulfilment','Fulfilment']") && css.includes('.so2-tabs-shell')],
  ['precision order line', workspace.includes('so2LineRows') && workspace.includes('so2-lines-table') && workspace.includes('Line total')],
  ['dedicated variant column', workspace.includes('so2VariantSelect') && workspace.includes('data-so2-variant') && css.includes('.so2-variant-cell')],
  ['variant lifecycle safeguard', workspace.includes('Release allocation and fulfilment activity before changing variant') && workspace.includes("goodsNotesForOrder(order.id)")],
  ['variant duplicate safeguard', workspace.includes('That exact variant is already on this order')],
  ['line action dropdown is viewport layer', workspace.includes('positionLineMenu') && css.includes('z-index:100000') && css.includes('position:fixed')],
  ['line menu uses real engines', workspace.includes('data-allocate-line') && workspace.includes('data-unallocate-line') && workspace.includes('data-remove-sales-line') && workspace.includes('data-open-product')],
  ['catalogue stays neutral', css.includes('.so-smart-product-result.good') && css.includes('background:#fff!important')],
  ['product search engine preserved', legacy.includes('function salesOrderProductMatches(query)') && legacy.includes('function renderSalesOrderProductResults')],
  ['allocation engine preserved', legacy.includes('function allocateSalesOrder') && legacy.includes('function allocateSalesOrderLine')],
  ['goods note engine preserved', legacy.includes('function salesOrderGoodsNotesDirectory') && legacy.includes('goodsNotesForOrder')],
  ['custom and shipping engines preserved', legacy.includes('function addCustomSalesLine') && legacy.includes('function addShippingSalesLine')],
  ['responsive layout', css.includes('@media (max-width:860px)') && css.includes('@media (max-width:600px)')]
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
