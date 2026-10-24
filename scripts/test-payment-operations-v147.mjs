import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const data={
 customers:[{id:'C',name:'School'}],products:[{id:'P',rrp:250,cost:100}],
 suppliers:[{name:'Advance Chemicals',terms:'Pro Forma'},{name:'Trade Parts',terms:'Net 30 days'}],
 salesOrders:[{id:'SO-1',customerId:'C',status:'Open',lines:[{productId:'P',qty:2,unitPrice:250}]},{id:'SO-2',customerId:'C',status:'Open',lines:[{productId:'P',qty:1,unitPrice:250}]},{id:'SO-P',customerId:'C',projectId:'PROJ',lines:[{productId:'P',qty:1,unitPrice:250}]}],
 purchaseOrders:[
  {id:'PO-P',supplier:'Advance Chemicals',status:'Draft',lines:[{productId:'P',qty:1,unitCost:100,received:1}],payments:[]},
  {id:'PO-A',supplier:'Trade Parts',status:'Received',supplierInvoiceRef:'B-1',supplierInvoiceTotal:200,supplierInvoiceDate:'2026-10-01',invoiceMatchStatus:'Matched',lines:[{productId:'P',qty:2,received:2,unitCost:100,salesOrderId:'SO-1'}],payments:[]},
  {id:'PO-M',supplier:'Trade Parts',status:'Received',supplierInvoiceRef:'B-2',supplierInvoiceTotal:100,supplierInvoiceDate:'2026-10-01',invoiceMatchStatus:'Needs review',lines:[{productId:'P',qty:1,received:1,unitCost:100,salesOrderId:'SO-2'}],payments:[]}
 ],financeCommand:{paymentRuns:[]},purchaseReturns:[]
};
const context={console,Date,Math,Set,Map,Intl,__POOL_SHED_GET_DATA__:()=>data,psFinanceSnapshot:()=>({documents:[]})};context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync('public/finance-command-engine.js','utf8'),context);
const f=context.PoolShedFinanceCommand;
assert.equal(f.supplierPaymentPosition(data.purchaseOrders[0]).amountDue,120);
assert.equal(f.supplierPaymentPosition(data.purchaseOrders[0]).dueDate,'Before supplier release');
assert.equal(f.supplierPaymentPosition(data.purchaseOrders[1]).dueDate,'2026-10-31');
assert.deepEqual(Array.from(f.paymentRunCandidates(),x=>x.poId),['PO-A']);
assert.equal(f.orderProfitRows().find(x=>x.orderId==='SO-1').grossProfit,300);
assert.equal(f.orderProfitRows().find(x=>x.orderId==='SO-1').missingCostLines,0);
assert.equal(f.orderProfitRows().find(x=>x.orderId==='SO-2').grossProfit,150);
assert(!f.orderProfitRows().some(x=>x.orderId==='SO-P'));
data.financeCommand.paymentRuns=[{status:'Draft',items:[{poId:'PO-A'}]}];
assert.equal(f.paymentRunCandidates().length,0);
data.financeCommand.paymentRuns[0].status='Cancelled';
assert.equal(f.paymentRunCandidates().length,1);
data.purchaseOrders[0].payments=[{amount:120,reference:'BANK-1',date:'2026-10-24'}];
assert.equal(f.supplierPaymentPosition(data.purchaseOrders[0]).amountDue,0);
const ui=fs.readFileSync('public/finance-command-workspace.js','utf8');
for(const text of ['Run payment run','Due from','Due to','Include already overdue','Create draft payment batch','Pay before release','Order Profit','Select at least one matched'])assert(ui.includes(text),`Missing payment workflow: ${text}`);
assert(fs.readFileSync('public/purchase-workspace.js','utf8').includes('supplierInvoiceDueDate'));
console.log('PASS payment terms, proforma due, matched account bill filtering, draft deduplication and linked order profit');
