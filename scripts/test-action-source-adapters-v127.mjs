import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const file='public/action-source-adapters.js';assert.ok(fs.existsSync(file),'Action source adapters missing');
const adapters={};const registered=[];
const ctx={console,Date,Math,JSON,Set,Map,Intl,globalThis:null,window:null};ctx.globalThis=ctx;ctx.window=ctx;
ctx.PoolShedActionAuthority={registerSourceAdapter:(name,fn)=>{adapters[name]=fn;registered.push(name);return true;}};
ctx.PoolShedFinanceCommand={snapshot:()=>({attention:[
 {type:'customer-overdue',severity:'critical',customerId:'C-1',title:'Customer payment overdue',amount:1200},
 {type:'three-way',severity:'critical',poId:'PO-2',title:'Supplier bill blocked',detail:'Qty mismatch'},
 {type:'invoice-ready',severity:'warning',orderId:'SO-2',title:'Sales Order ready to invoice',amount:800}
]})};
ctx.PoolShedProjectEngine={summary:(job)=>job._summary};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
assert.deepEqual(new Set(registered),new Set(['purchasing','sales','warehouse','projects','finance','automation']));
const d={
 purchaseOrders:[
  {id:'PO-1',supplier:'Certikin',status:'Ordered',dueDate:'2026-09-10',lines:[{qty:5,receivedQty:2}]},
  {id:'PO-2',supplier:'Bayrol',status:'Ordered',orderedAt:'2026-09-10',lines:[{qty:2,receivedQty:0,eta:''}]},
  {id:'PO-3',supplier:'Done',status:'Received',dueDate:'2026-09-01',lines:[{qty:2,receivedQty:2}]}
 ],
 salesOrders:[
  {id:'SO-1',customerId:'C-1',status:'Open',lines:[{qty:3,allocatedQty:1,onPurchaseOrderQty:0}]},
  {id:'SO-2',customerId:'C-2',status:'Shipped',invoiceStatus:'Not invoiced',lines:[{qty:1,allocatedQty:1}]}
 ],
 stockTakes:[{ref:'ST-1',locationId:'L-1',status:'Submitted',lines:[{systemQty:10,countedQty:7}]}],
 purchaseReturns:[{id:'RET-1',supplier:'Certikin',status:'Awaiting QC',expectedCredit:50}],
 jobs:[
  {id:'J-1',name:'Low Margin',_summary:{margin:12,profit:120,revenue:1000,profile:{minimumMargin:20,targetMargin:30},alerts:[]}},
  {id:'J-2',name:'Loss',_summary:{margin:-5,profit:-100,revenue:2000,profile:{minimumMargin:20,targetMargin:30},alerts:[]}}
 ],
 automationCommand:{runs:[{id:'RUN-1',ruleId:'AUTO-1',result:'Failed',status:'Failed',createdAt:'2026-09-17T10:00:00Z'}],approvals:[{id:'AA-1',status:'Pending',name:'Automation activation'}]}
};
const p=adapters.purchasing(d);assert.ok(p.some(x=>x.dedupeKey==='purchase-order:PO-1:delivery-overdue'));assert.ok(p.some(x=>x.dedupeKey==='purchase-order:PO-2:missing-eta'));assert.ok(!p.some(x=>x.source.id==='PO-3'));
const s=adapters.sales(d);assert.ok(s.some(x=>x.dedupeKey==='sales-order:SO-1:stock-uncovered'));assert.ok(s.some(x=>x.dedupeKey==='sales-order:SO-2:billing-review'));
const w=adapters.warehouse(d);assert.ok(w.some(x=>x.dedupeKey==='stocktake:ST-1:approval'));assert.ok(w.some(x=>x.dedupeKey==='return:RET-1:qc'));
const pj=adapters.projects(d);assert.ok(pj.some(x=>x.dedupeKey==='project:J-1:margin-risk'));assert.ok(pj.some(x=>x.dedupeKey==='project:J-2:forecast-loss'));
const f=adapters.finance(d);assert.ok(f.some(x=>x.dedupeKey==='finance:customer-overdue:C-1'));assert.ok(f.some(x=>x.dedupeKey==='finance:three-way:PO-2'));assert.ok(f.some(x=>x.dedupeKey==='finance:invoice-ready:SO-2'));
const au=adapters.automation(d);assert.ok(au.some(x=>x.dedupeKey==='automation-run:RUN-1:failed'));assert.ok(au.some(x=>x.dedupeKey==='automation-approval:AA-1'));
for(const rows of [p,s,w,pj,f,au])for(const x of rows){assert.ok(x.ownerRole);assert.ok(x.source&&x.source.module&&x.source.route);assert.ok(x.dedupeKey);}
console.log('PASS v1.31 source adapters for Purchasing, Sales, Warehouse, Projects, Finance and Automation');
