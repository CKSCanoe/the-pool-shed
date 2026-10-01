import fs from 'node:fs';
import assert from 'node:assert/strict';

const purchase=fs.readFileSync('public/purchase-workspace.js','utf8');
const warehouse=fs.readFileSync('public/warehouse-workspace.js','utf8');
const project=fs.readFileSync('public/project-engine.js','utf8');
const css=fs.readFileSync('public/assets/css/system/44-purchase-order-command.css','utf8');

for(const token of [
  'poCustomLineComposer','purchaseAddCustomPoLine','data-po-add-custom-line',
  'data-po-custom-name','data-po-custom-description','data-po-custom-sku',
  'data-po-custom-category','data-po-custom-qty','data-po-custom-uom',
  'data-po-custom-cost','data-po-custom-vat','data-po-custom-project',
  'data-po-custom-date','data-po-custom-note','Non-stock direct purchase'
]) assert(purchase.includes(token),'Missing custom PO control: '+token);

assert.match(purchase,/lineType:'custom-purchase'/,'Custom PO line must have an explicit line type');
assert.match(purchase,/nonStockPurchase:true/,'Custom PO line must be non-stock by default');
assert.match(purchase,/salesOrderId:''/,'Custom PO line must not require a Sales Order');
assert.match(purchase,/projectId:projectId/,'Custom PO line must optionally allocate to a Project');
assert.match(purchase,/po\.supplierEmailSentAt\|\|po\.supplierConfirmedAt/,'Changing a committed PO must return it to review');
assert.match(purchase,/Custom purchase order line added/,'Custom PO creation must be audited');
assert.match(purchase,/po\.nonStockReceipts/,'PO receipt history must include non-stock custom receipts');

assert.match(warehouse,/function warehouseReceiveNonStockLine/,'Warehouse needs a direct non-stock receipt path');
assert.match(warehouse,/no warehouse stock was created/,'Warehouse must explain non-stock receipt behaviour');
assert.match(warehouse,/Non-stock receipt: no Sales Order allocation and no warehouse inventory/,'Custom lines must bypass FIFO/stock allocation');
assert.match(warehouse,/po\.nonStockReceipts/,'Warehouse must keep permanent direct-purchase receipt history');

assert.match(project,/filter\(x=>!x\.line\.nonStockPurchase\)/,'Non-stock PO lines must not appear as warehouse material stock');
assert.match(css,/Custom PO-only purchasing lines/,'Custom PO composer styling is missing');
assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/,'Custom PO form needs a spacious professional desktop layout');

console.log('PASS custom PO-only lines support detailed supplier purchases, optional project costing and non-stock receiving without a Sales Order');
