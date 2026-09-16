import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
assert(fs.existsSync('public/supplier-command-engine.js'),'Supplier Command engine must exist');
const data={
 suppliers:[{name:'Certikin',code:'CERT',creditLimit:10000,leadTimeDays:5,terms:'Net 30',preferred:true},{name:'Lighthouse',code:'LIGHT',creditLimit:5000,creditUsed:1200,leadTimeDays:3}],
 products:[{id:'P1',sku:'PB-VALVE',name:'Ball Valve',supplier:'Certikin',supplierSku:'CER-VALVE',cost:20,rrp:40},{id:'P2',sku:'PB-PUMP',name:'Pump',supplier:'Lighthouse',supplierSku:'LIG-PUMP',cost:200,rrp:350},{id:'P3',sku:'PB-ELBOW',name:'Elbow',supplier:'Lighthouse',supplierSku:'LIG-ELBOW',cost:3,rrp:7}],
 supplierProducts:[{id:'SP1',productId:'P1',supplier:'Certikin',supplierSku:'CER-VALVE',cost:20,leadTimeDays:4,available:true},{id:'SP2',productId:'P2',supplier:'Certikin',supplierSku:'CER-PUMP',cost:210,leadTimeDays:5,available:true}],
 purchaseOrders:[
  {id:'PO-OPEN',supplier:'Certikin',status:'Supplier Confirmed',orderedDate:'2026-09-10',due:'2026-09-18',supplierConfirmedAt:'2026-09-11T09:00:00Z',lines:[{productId:'P1',qty:250,received:0,unitCost:20,confirmedEta:'2026-09-18'}]},
  {id:'PO-LATE',supplier:'Certikin',status:'Received',orderedDate:'2026-09-01',due:'2026-09-10',supplierInvoiceRef:'INV-LATE',supplierInvoiceTotal:1000,supplierInvoiceDueDate:'2026-09-14',invoiceMatchStatus:'Matched',lines:[{productId:'P1',qty:50,received:50,unitCost:20}]},
  {id:'PO-SHORT',supplier:'Certikin',status:'Part Received',orderedDate:'2026-09-05',due:'2026-09-12',lines:[{productId:'P1',qty:10,received:6,unitCost:20,chaseStatus:'Waiting',nextChaseDate:'2026-09-15'}]},
  {id:'PO-MATCH',supplier:'Certikin',status:'Received',orderedDate:'2026-09-02',due:'2026-09-08',supplierInvoiceRef:'INV-MATCH',supplierInvoiceTotal:600,invoiceMatchStatus:'Needs review',lines:[{productId:'P1',qty:30,received:30,unitCost:20}]},
  {id:'PO-NOINV',supplier:'Certikin',status:'Received',orderedDate:'2026-09-03',due:'2026-09-09',lines:[{productId:'P1',qty:5,received:5,unitCost:20}]}
 ],
 receiptEvents:[
  {id:'R1',poId:'PO-LATE',productId:'P1',qty:50,date:'2026-09-12T10:00:00Z'},
  {id:'R2',poId:'PO-SHORT',productId:'P1',qty:6,date:'2026-09-11T10:00:00Z'},
  {id:'R3',poId:'PO-MATCH',productId:'P1',qty:30,date:'2026-09-08T10:00:00Z'},
  {id:'R4',poId:'PO-NOINV',productId:'P1',qty:5,date:'2026-09-09T10:00:00Z'}
 ],
 purchaseReturns:[{id:'PR-1',poId:'PO-LATE',supplier:'Certikin',productId:'P1',qty:2,status:'Awaiting credit',expectedCredit:40,createdAt:'2026-09-08'}],
 warehouseQcEvents:[],stock:[],locations:[],notifications:[]
};
const finance={documents:[{id:'D1',source_id:'PO-LATE',kind:'ACCPAY',status:'AUTHORISED',amount_due:4000,amount_paid:0,amount_credited:0,currency:'GBP',updated_at:'2026-09-15T10:00:00Z'}]};
const ctx={console,globalThis:null,window:null,Date,Math,Set,Map,Intl};ctx.globalThis=ctx;ctx.window=ctx;ctx.__POOL_SHED_GET_DATA__=()=>data;ctx.psFinanceSnapshot=()=>finance;ctx.saveAppData=()=>{};vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/supplier-command-engine.js','utf8'),ctx);
const sc=ctx.PoolShedSupplierCommand;assert(sc,'PoolShedSupplierCommand API missing');
const credit=sc.creditPosition('Certikin',{today:'2026-09-16'});assert.equal(credit.limit,10000);assert.equal(credit.currentBalance,4000);assert.equal(credit.openPoExposure,5080);assert.equal(credit.projectedExposure,9080);assert.equal(credit.availableCredit,6000);assert.equal(credit.projectedHeadroom,920);assert.equal(credit.severity,'warning');
const legacyCredit=sc.creditPosition('Lighthouse',{today:'2026-09-16'});assert.equal(legacyCredit.currentBalance,1200,'legacy supplier creditUsed must remain visible until connected bills replace it');
const openTiming=sc.poTiming(data.purchaseOrders[0],{today:'2026-09-16'});assert.equal(openTiming.daysToPromised,2);assert.equal(openTiming.daysSinceOrder,6);assert.equal(openTiming.elapsedDays,6);assert.equal(openTiming.state,'due');
const lateTiming=sc.poTiming(data.purchaseOrders[1],{today:'2026-09-16'});assert.equal(lateTiming.receivedDeltaDays,2);assert.equal(lateTiming.elapsedDays,11);assert.equal(lateTiming.state,'received-late');
const performance=sc.deliveryPerformance('Certikin',{today:'2026-09-16'});assert(performance.completed>=3);assert(performance.averageLeadDays>0);assert(performance.onTimePct<100);
const flags=sc.smartFlags('Certikin',{today:'2026-09-16'});for(const type of ['credit-warning','short-receipt','chase-due','invoice-match','invoice-missing','payment-overdue','supplier-credit'])assert(flags.some(f=>f.type===type),`missing smart flag ${type}`);
const rows=sc.productRows('Certikin');assert.equal(rows.length,2);assert(rows.some(r=>r.productId==='P2'),'alternate supplier offer must appear in supplier-only list');assert(!rows.some(r=>r.productId==='P3'));
const preview=sc.previewPriceList('Certikin','Supplier SKU,Net Cost,Lead Time,Status\nCER-VALVE,22,6,Active\nUNKNOWN,99,3,Active');assert.equal(preview.rows.length,2);assert.equal(preview.summary.increased,1);assert.equal(preview.summary.unmatched,1);const changed=preview.rows.find(r=>r.supplierSku==='CER-VALVE');assert.equal(changed.oldCost,20);assert.equal(changed.newCost,22);
assert.equal(typeof sc.stagePriceList,'function','Supplier price-list comparisons must be staged for later review');sc.stagePriceList('Certikin',preview);assert(sc.smartFlags('Certikin',{today:'2026-09-16'}).some(f=>f.type==='cost-change'),'pending supplier price changes must create a smart flag');
const committed=sc.commitPriceList('Certikin',preview,[changed.id]);assert.equal(committed.updated,1);assert.equal(data.supplierProducts.find(x=>x.id==='SP1').cost,22);assert(Array.isArray(data.suppliers[0].priceListImports)&&data.suppliers[0].priceListImports.length===1,'price-list audit must be retained');assert(data.suppliers[0].pendingPriceListReview&&data.suppliers[0].pendingPriceListReview.rows.some(r=>r.change==='unmatched'),'unresolved price-list rows must stay in the review queue');
console.log('PASS Supplier Command engine credit, timers, smart flags, supplier products and governed price lists');
