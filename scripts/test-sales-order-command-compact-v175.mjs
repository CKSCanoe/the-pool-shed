import fs from 'node:fs';

const workspace = fs.readFileSync('public/sales-workspace.js','utf8');
const css = fs.readFileSync('public/assets/css/system/42-sales-order-parity.css','utf8');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const html = fs.readFileSync('public/index.html','utf8');
const sw = fs.readFileSync('public/service-worker.js','utf8');

const customerStart = workspace.indexOf('function so2CustomerCard');
const customerEnd = workspace.indexOf('\n  customerProfileCard = so2CustomerCard;', customerStart);
const customerBlock = workspace.slice(customerStart, customerEnd);
const detailStart = workspace.indexOf('salesOrderDetail = function(order)');
const detailEnd = workspace.indexOf('\n  function closeLineMenus', detailStart);
const detailBlock = workspace.slice(detailStart, detailEnd);

const checks = [
  ['release bumped so cached 1.7.5 assets cannot survive', pkg.version === '1.7.5' && html.includes('?v=1.7.5') && sw.includes('pool-shed-v1.7.5-ui-ownership')],
  ['sales-order customer header is compact', customerBlock.includes('so2-customer-title') && customerBlock.includes('so2-customer-search') && customerBlock.includes('Open CRM')],
  ['sales-order customer header does not duplicate account workspace', !customerBlock.includes('so2-customer-facts') && !customerBlock.includes('so2-customer-commercial') && !customerBlock.includes('Credit headroom') && !customerBlock.includes('Outstanding')],
  ['customer commercial data is not deleted from the application runtime', workspace.includes('customerFinancialSummary') || fs.readFileSync('public/assets/js/01-legacy-01.js','utf8').includes('customerFinancialSummary')],
  ['top fulfilment card does not embed the full goods-note directory', !detailBlock.includes('so3-goods-notes')],
  ['fulfilment remains accessible from the command card', detailBlock.includes('data-so-tab="fulfilment"')],
  ['dead customer expansion styles removed from final Sales Order parity owner', !css.includes('.so2-customer-facts') && !css.includes('.so2-customer-commercial') && !css.includes('.so2-account-state')],
  ['compact customer identity carries useful CRM context', customerBlock.includes('so2-customer-contact') && customerBlock.includes('priceList') && customerBlock.includes('terms')],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
