import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const data={
  suppliers:[
    {name:'Supplier A',accountType:'Credit',terms:'Net 30',creditLimit:10000},
    {name:'Supplier B',accountType:'Pro Forma',terms:'Pro Forma',creditLimit:0}
  ],
  products:[{id:'P1',cost:100,taxCode:'20% VAT'}],
  salesOrders:[
    {id:'SO-1',payments:[{amount:3000,date:'2026-09-30'}],lines:[]}
  ],
  purchaseOrders:[
    {id:'PO-OLD',supplier:'Supplier A',status:'Received',due:'2026-09-20',payments:[{amount:1200}],lines:[{productId:'P1',qty:10,unitCost:100,taxCode:'20% VAT',salesOrderId:'SO-1'}]},
    {id:'PO-B',supplier:'Supplier B',status:'Sent',due:'2026-10-01',payments:[],lines:[{productId:'P1',qty:10,unitCost:100,taxCode:'20% VAT',salesOrderId:'SO-1'}]},
    {id:'PO-A',supplier:'Supplier A',status:'Sent',due:'2026-10-05',supplierInvoiceRef:'INV-A',supplierInvoiceTotal:2400,supplierInvoiceDueDate:'2026-10-05',payments:[{amount:400,date:'2026-09-30'}],lines:[{productId:'P1',qty:20,unitCost:100,taxCode:'20% VAT',salesOrderId:'SO-1'}]}
  ],
  receiptEvents:[],purchaseReturns:[],stock:[],supplierProducts:[]
};
const ctx={console,window:{},Date,Map,Set,Math,Number,String,Array,Object,RegExp};
ctx.window.__POOL_SHED_GET_DATA__=()=>data;
ctx.window.saveAppData=()=>true;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/supplier-command-engine.js','utf8'),ctx);
const engine=ctx.window.PoolShedSupplierCommand;
assert.equal(typeof engine.fundingControl,'function');

const b=engine.fundingControl('Supplier B',{today:'2026-09-30'});
assert.equal(b.accountType,'Pro Forma');
assert.equal(b.rows.length,1);
assert.equal(Math.round(b.rows[0].linkedRequirement),1200);
assert.equal(Math.round(b.rows[0].customerCover),1200);
assert.equal(Math.round(b.rows[0].customerShortfall),0);

const a=engine.fundingControl('Supplier A',{today:'2026-09-30'});
assert.equal(a.accountType,'Credit');
const live=a.rows.find(r=>r.poId==='PO-A');
const paidOld=a.rows.find(r=>r.poId==='PO-OLD');
assert(live,'live Supplier A PO missing');
assert(paidOld,'historic paid PO should remain visible for traceability');
assert.equal(Math.round(paidOld.linkedRequirement),0,'paid PO must not consume customer cash');
assert.equal(Math.round(live.linkedRequirement),2000,'recorded PO payment must reduce the remaining supplier obligation');
assert.equal(Math.round(live.customerCover),1800,'SO receipt must only have £1,800 left after earlier cross-supplier commitment');
assert.equal(Math.round(live.customerShortfall),200,'customer cash must not be double-counted and supplier payments must reduce the shortfall');
assert.equal(Math.round(a.customerCover),1800);
assert.equal(Math.round(a.credit.currentBalance),2000,'credit balance must use live PO payment history');
assert.equal(Math.round(a.shortfall),200);

console.log('PASS supplier funding allocates customer receipts once across linked unpaid PO commitments and distinguishes Credit / Pro Forma');
