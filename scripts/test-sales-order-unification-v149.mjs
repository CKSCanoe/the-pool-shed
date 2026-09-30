import fs from 'node:fs';
import assert from 'node:assert/strict';

const sales=fs.readFileSync('public/sales-workspace.js','utf8');
const purchase=fs.readFileSync('public/purchase-workspace.js','utf8');
const supplier=fs.readFileSync('public/supplier-command-workspace.js','utf8');
const supplierEngine=fs.readFileSync('public/supplier-command-engine.js','utf8');

assert.match(sales,/label!=='Customer Orders'/,'Customer Orders must be removed from Sales Orders navigation');
assert.match(sales,/subgroup==='Customer Orders'.*subgroup='Sales Orders'/s,'legacy Customer Orders navigation must redirect safely');
assert.match(sales,/salesOrderView==='customerOrders'.*salesOrderView='list'/s,'legacy customerOrders view must redirect to Sales Orders');
assert.match(sales,/so2SupplierFundingPanel/,'Sales Order connections must show supplier funding');
assert.match(sales,/data-so-open-po-funding/,'Sales Order must link back to Purchase Order');
assert.match(sales,/data-so-open-supplier-funding/,'Sales Order must link back to supplier funding workspace');

for(const token of ['data-po-open-sales-order','poSupplierFundingState','Pro Forma funding shortfall','Open supplier funding']){
  assert(purchase.includes(token),`Purchase Order funding link missing ${token}`);
}
for(const token of ['SUPPLIER PROFILE','SUPPLIER OPERATIONS','CUSTOMER CASH COVER','BILLS & COMMITMENTS DUE','SUPPLIER PAYMENT TIMELINE','data-sc-open-sales-order','openSupplierCommand','scSupplierAccountType']){
  assert(supplier.includes(token),`Supplier Option B integration missing ${token}`);
}
assert.match(supplierEngine,/fundingControl/,'Supplier engine must expose funding control');
assert.match(supplierEngine,/cashRemaining/,'Funding control must prevent duplicate use of customer receipts');

console.log('PASS Customer Orders are unified into Sales Orders and PO / SO / Supplier funding links are connected');
