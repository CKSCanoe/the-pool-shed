import fs from 'node:fs';import assert from 'node:assert/strict';
const js=fs.readFileSync('public/finance-command-workspace.js','utf8');
for(const token of ["active='salesorders'","selectedSalesOrderId=order","salesOrderView='detail'","active='purchase'","purchaseOrderView='suppliers'","selectedSupplierName=el.dataset.fcSupplier","openPurchaseOrderTab","financeCommand","customerPolicies","unallocatedPayments","customerCredits","chases","allocations","paymentRuns","saveAppData"])assert(js.includes(token),`Finance Command cross-module/persistence contract missing ${token}`);
assert(js.includes("invoiceConfirmOrderId=order"),'Invoice Ready must hand off to the existing Sales Order invoice workflow');
assert(js.includes("purchaseOrderView='returns'"),'Supplier credit requests must hand off to the purchasing returns workflow');
console.log('PASS Finance Command persistence and cross-module routing contract');
