import fs from 'node:fs';
import assert from 'node:assert/strict';

const path = 'public/purchase-workspace.js';
assert(fs.existsSync(path), 'Purchase Order authority layer must exist');
const js = fs.readFileSync(path, 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));

for (const token of [
  'purchase-command-page',
  'Supplier Order Command',
  'Items & Costing',
  'Demand Sources',
  'Supplier Confirmation',
  'Deliveries & Receipts',
  'Costs & Invoice Match',
  'Returns & Credits',
  'Activity',
  'data-po-command-tab',
  'data-po-open-receiving'
]) assert(js.includes(token), `Purchase Order command missing ${token}`);

assert(js.includes('Demand source') && js.includes('FIFO'), 'PO must distinguish demand source from FIFO physical allocation');
for (const section of ['Procurement Demand','Purchase Orders','Suppliers','Supplier Returns & Credits','Invoice Matching']) assert(js.includes(section), `Purchasing workspace missing ${section}`);
assert(js.includes('purchaseCreateOrMergeDemandPo'), 'Procurement Demand must be able to create or merge a supplier PO');
assert(html.includes(`./purchase-workspace.js?v=${pkg.version}`), 'Purchase Order authority must load as a current versioned runtime asset');
console.log('PASS Purchase Order Supplier Command structure and seven-tab contract');
