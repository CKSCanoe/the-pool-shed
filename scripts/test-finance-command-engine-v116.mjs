import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
assert(fs.existsSync('public/finance-command-engine.js'),'Finance Command engine must exist');
const data={
 customers:[{id:'C1',name:'White Residence',creditLimit:15000},{id:'C2',name:'Andy Morton'}],
 salesOrders:[
  {id:'SO-1',customerId:'C1',status:'Invoiced',created:'2026-08-25',total:5000,lines:[]},
  {id:'SO-2',customerId:'C1',status:'Shipped',created:'2026-09-10',total:3500,tags:['Invoice Ready'],lines:[]},
  {id:'SO-3',customerId:'C1',status:'Open',created:'2026-09-14',total:2500,lines:[]},
  {id:'SO-4',customerId:'C2',status:'Invoiced',created:'2026-09-01',total:1200,lines:[]}
 ],
 goodsNotes:[{id:'GN-2',salesOrderId:'SO-2',shipped:true,shippedAt:'2026-09-15T10:00:00Z',lines:[]}],
 suppliers:[{name:'Certikin',creditLimit:15000}],
 purchaseOrders:[
  {id:'PO-1',supplier:'Certikin',status:'Received',orderedDate:'2026-09-01',lines:[{productId:'P1',qty:10,received:8,unitCost:100}]},
  {id:'PO-2',supplier:'Certikin',status:'Received',orderedDate:'2026-09-02',lines:[{productId:'P2',qty:5,received:5,unitCost:200}]}
 ],
 purchaseReturns:[{id:'PR-1',supplier:'Certikin',poId:'PO-1',status:'Awaiting credit',expectedCredit:150,createdAt:'2026-09-10'}],
 financeCommand:{
  customerPolicies:{C1:{creditLimit:15000,watchPct:70,warningPct:85,holdPct:100}},
  unallocatedPayments:[{id:'PAY-U1',customerId:'C1',amount:900,remaining:900,date:'2026-09-16',xeroPaymentId:'XPAY-1'}],
  customerCredits:[{id:'CR-U1',customerId:'C1',amount:420,remaining:420,date:'2026-09-15',xeroCreditNoteId:'XCN-1'}],
  chases:[{id:'CH-1',customerId:'C1',date:'2026-09-14',nextChase:'2026-09-18',method:'Email',outcome:'Promise to pay'}]
 }
};
const finance={connection:{tenant_name:'Pool Bros Ltd',last_sync:'2026-09-16T09:45:00Z'},documents:[
 {id:'D1',source_id:'SO-1',kind:'ACCREC',xero_id:'XI-1',xero_number:'INV-1062',status:'AUTHORISED',amount_due:3000,amount_paid:2000,amount_credited:0,currency:'GBP',remote:{InvoiceID:'XI-1',InvoiceNumber:'INV-1062',Total:5000,DueDate:'2026-09-10',AmountDue:3000,AmountPaid:2000,AmountCredited:0}},
 {id:'D2',source_id:'SO-4',kind:'ACCREC',xero_id:'XI-4',xero_number:'INV-1090',status:'PAID',amount_due:0,amount_paid:1200,amount_credited:0,currency:'GBP',remote:{InvoiceID:'XI-4',Total:1200,DueDate:'2026-09-20'}},
 {id:'B1',source_id:'PO-1',kind:'ACCPAY',xero_id:'XB-1',xero_number:'BILL-8910',status:'AUTHORISED',amount_due:980,amount_paid:0,amount_credited:0,currency:'GBP',remote:{InvoiceID:'XB-1',InvoiceNumber:'BILL-8910',Total:980,DueDate:'2026-09-14',AmountDue:980}},
 {id:'B2',source_id:'PO-2',kind:'ACCPAY',xero_id:'XB-2',xero_number:'BILL-8911',status:'AUTHORISED',amount_due:1000,amount_paid:0,amount_credited:0,currency:'GBP',remote:{InvoiceID:'XB-2',InvoiceNumber:'BILL-8911',Total:1000,DueDate:'2026-09-25',AmountDue:1000}}
 ],jobs:[{id:'J1',document_id:'D1',state:'review',last_error:'Remote total changed'}]};
const ctx={console,globalThis:null,window:null,Date,Math,Set,Map,Intl};ctx.globalThis=ctx;ctx.window=ctx;ctx.__POOL_SHED_GET_DATA__=()=>data;ctx.psFinanceSnapshot=()=>finance;ctx.saveAppData=()=>{};vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/finance-command-engine.js','utf8'),ctx);
const f=ctx.PoolShedFinanceCommand;assert(f,'PoolShedFinanceCommand API missing');
const account=f.customerAccount('C1',{today:'2026-09-16'});assert.equal(account.outstanding,3000);assert.equal(account.overdue,3000);assert.equal(account.unallocatedPayments,900);assert.equal(account.unallocatedCredits,420);assert.equal(account.openOrderExposure,6000);assert.equal(account.projectedExposure,9000);assert.equal(account.creditLimit,15000);assert.equal(account.creditPct,60);assert.equal(account.creditSeverity,'good');assert.equal(account.lastChase.method,'Email');
assert.equal(f.salesOrderFinanceStatus('SO-1',{today:'2026-09-16'}).state,'Overdue');assert.equal(f.salesOrderFinanceStatus('SO-2',{today:'2026-09-16'}).state,'Invoice Ready');assert.equal(f.salesOrderFinanceStatus('SO-4',{today:'2026-09-16'}).state,'Paid');
const suggestion=f.suggestAllocation('C1',{today:'2026-09-16'});assert.equal(suggestion.available,1320);assert.equal(suggestion.allocations.length,2);assert.equal(suggestion.allocations.reduce((s,a)=>s+a.amount,0),1320);assert.equal(suggestion.allocations[0].documentId,'D1');
const matches=f.threeWayRows({today:'2026-09-16'});const po1=matches.find(r=>r.poId==='PO-1'),po2=matches.find(r=>r.poId==='PO-2');assert.equal(po1.status,'BLOCK PAYMENT');assert.equal(po1.missingQty,2);assert.equal(po1.valueVariance,-20);assert.equal(po2.status,'Matched');
const supplier=f.supplierAccount('Certikin',{today:'2026-09-16'});assert.equal(supplier.outstanding,1980);assert.equal(supplier.overdue,980);assert.equal(supplier.availableCredits,150);
const ready=f.invoiceReadyRows({today:'2026-09-16'});assert.deepEqual(Array.from(ready.map(r=>r.orderId)),['SO-2']);
const rec=f.reconciliationRows({today:'2026-09-16'});assert(rec.some(r=>r.type==='sync-review'));assert(rec.some(r=>r.type==='customer-payment-allocation'));assert(rec.some(r=>r.type==='customer-credit-allocation'));assert(rec.some(r=>r.type==='value-mismatch'&&r.sourceId==='PO-1'));
const month=f.monthEndRows({today:'2026-09-16'});for(const code of ['overdue-ar','overdue-ap','three-way','unallocated-cash','invoice-ready','sync-exceptions'])assert(month.some(r=>r.code===code),`missing month-end exception ${code}`);
const snap=f.snapshot({today:'2026-09-16'});assert.equal(snap.metrics.customersOweUs,3000);assert.equal(snap.metrics.supplierBillsOverdue,980);assert.equal(snap.metrics.invoiceReady,1);assert(snap.attention.length>=4);
console.log('PASS Finance Command engine AR/AP, allocation, credit exposure, three-way match, reconciliation and month-end controls');
