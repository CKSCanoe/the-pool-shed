import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const path='public/purchase-workspace.js';
assert(fs.existsSync(path),'Purchase workspace must exist');
const source=fs.readFileSync(path,'utf8');
const data={
 locations:[{id:'L-WH-A1',name:'Main Warehouse A1'}],
 stock:[{productId:'P-1',locationId:'L-WH-A1',qty:5,allocated:1}],
 products:[
  {id:'P-1',sku:'VALVE-1',name:'Valve',cost:20,supplier:'Certikin',supplierSku:'CERT-V1',taxCode:'20% VAT'},
  {id:'S-CRANE',sku:'CRANE-HIRE',name:'Crane Hire',cost:2500,supplier:'Carro Pools',taxCode:'20% VAT'}
 ],
 purchaseOrders:[
  {id:'PO-1',supplier:'Certikin',status:'Received',lines:[{productId:'P-1',qty:5,received:5,unitCost:20,supplierSku:'CERT-V1',taxCode:'20% VAT'}]},
  {id:'PO-2',supplier:'Carro Pools',status:'Received',projectId:'J-1',lines:[{productId:'S-CRANE',receiptLineId:'S-CRANE',lineType:'custom-purchase',nonStockPurchase:true,receivingTreatment:'Non-stock direct purchase',purchaseCategory:'Hire',projectId:'J-1',qty:1,received:1,unitCost:2500,taxCode:'20% VAT'}]}
 ],
 purchaseReturns:[],movements:[],salesOrders:[],quotes:[],allocations:[],toolAssignments:[],
 receiptEvents:[{id:'GRN-1',poId:'PO-1',productId:'P-1',qty:5,locationId:'L-WH-A1'}],
 jobs:[{id:'J-1',name:'Pool project',customerId:'C-1',status:'Approved',project:{version:4,quoteNet:10000,quoteRef:'Q-1',quoteAccepted:true,targetMargin:30,minimumMargin:20,lossWarningMargin:5,remainingNet:0,billingMode:'orders',invoiceExposureThresholdPct:40,invoiceExposureThresholdNet:0,variations:[],costs:[],phases:[],tasks:[],documents:[],materialPlan:[],stockEvents:[],audit:[],labour:[],quoteLinks:[]}}],
 customers:[{id:'C-1',name:'Customer'}],
 financeCommand:{supplierCredits:[]},
 auditLog:[]
};
function row(pid,loc){let r=data.stock.find(x=>x.productId===pid&&x.locationId===loc);if(!r){r={productId:pid,locationId:loc,qty:0,allocated:0};data.stock.push(r);}return r;}
const c={data,console,crypto:{randomUUID:()=>`id-${Math.random()}`},currentUser:()=>({name:'Aaron'}),
 product:(id)=>data.products.find(p=>p.id===id),purchaseOrderById:(id)=>data.purchaseOrders.find(p=>p.id===id),
 available:(r)=>Math.max(0,r.qty-r.allocated),addStock:(pid,loc,qty)=>{row(pid,loc).qty+=qty;},removeStock:(pid,loc,qty)=>{const r=row(pid,loc);if(r.qty-r.allocated<qty)return false;r.qty-=qty;return true;},
 addMovement:(type,productId,qty,from,to,ref,user,note)=>data.movements.push({type,productId,qty,from,to,ref,user,note}),
 saveAppData:()=>true,render:()=>{},toast:()=>{},escapeHtml:(v)=>String(v??''),money:(v)=>`£${Number(v||0).toFixed(2)}`,
 document:{querySelectorAll:()=>[],getElementById:()=>null,querySelector:()=>null}
};
c.globalThis=c;vm.createContext(c);vm.runInContext(source,c,{filename:path});

for(const fn of ['purchaseCreateSupplierReturn','purchaseAuthoriseSupplierReturn','purchaseDispatchSupplierReturn','purchaseCompleteSupplierReturn','purchaseCancelSupplierReturn','purchaseResolvedCreditTotals']){
 assert.equal(typeof c[fn],'function',fn+' API must exist');
}

// Physical return: hold -> authorise -> dispatch -> supplier credit.
const beforeOnHand=data.stock.reduce((n,r)=>n+r.qty,0);
const created=c.purchaseCreateSupplierReturn({poId:'PO-1',productId:'P-1',qty:2,reason:'Mis-ordered by Pool Bros',locationId:'L-WH-A1',receiptId:'GRN-1'});
assert.equal(created.ok,true);
assert.equal(created.return.status,'Awaiting Supplier Authorisation');
assert.equal(created.return.expectedCredit,40);
assert.equal(created.return.stockHeld,true);
assert.equal(row('P-1','L-WH-A1').qty,3);
assert.equal(row('P-1','L-RETURNS-HOLD').qty,2);
assert.equal(data.stock.reduce((n,r)=>n+r.qty,0),beforeOnHand,'Returns Hold preserves physical On Hand before dispatch');
assert.equal(data.movements.at(-1).type,'Supplier Return Hold');

const authorised=c.purchaseAuthoriseSupplierReturn(created.return.id,{rma:'RMA-123'});
assert.equal(authorised.ok,true);
assert.equal(authorised.return.status,'Supplier Authorised');
assert.equal(authorised.return.rma,'RMA-123');

const dispatched=c.purchaseDispatchSupplierReturn(created.return.id);
assert.equal(dispatched.ok,true);
assert.equal(dispatched.return.status,'Dispatched / Awaiting Credit');
assert.equal(row('P-1','L-RETURNS-HOLD').qty,0);
assert.equal(data.stock.reduce((n,r)=>n+r.qty,0),beforeOnHand-2,'Dispatched return leaves Pool Bros On Hand');
assert.equal(data.movements.at(-1).type,'Supplier Return Dispatch');

const credited=c.purchaseCompleteSupplierReturn(created.return.id,{resolutionType:'supplier-credit',creditReference:'CN-123',creditNet:40,creditDate:'2026-10-05'});
assert.equal(credited.ok,true);
assert.equal(credited.return.status,'Closed');
assert.equal(credited.return.creditNet,40);
assert.equal(credited.return.creditVat,8);
assert.equal(credited.return.creditGross,48);
assert.equal(data.purchaseOrders[0].lines[0].qty,5,'Original ordered quantity remains for audit history');
assert.equal(data.purchaseOrders[0].lines[0].received,5,'Original received quantity remains for audit history');
assert.equal(data.purchaseOrders[0].lines[0].creditedQty,2);
assert.equal(data.purchaseOrders[0].lines[0].creditedNet,40);
assert.equal(data.purchaseOrders[0].supplierCredits.length,1);
assert.equal(data.financeCommand.supplierCredits.length,1);
assert.equal(data.financeCommand.supplierCredits[0].remaining,0,'Credit is applied directly to the source PO, not left unallocated');
assert.equal(c.purchaseResolvedCreditTotals(data.purchaseOrders[0]).net,40);
assert.equal(c.purchaseResolvedCreditTotals(data.purchaseOrders[0]).gross,48);
assert.equal(c.purchaseReturnStatusSummary(data.purchaseOrders[0]).open,0);
assert.equal(c.purchaseReturnStatusSummary(data.purchaseOrders[0]).resolvedCredit,40);

// A second physical return can be cancelled and restores stock from Returns Hold.
const cancelCase=c.purchaseCreateSupplierReturn({poId:'PO-1',productId:'P-1',qty:1,reason:'No longer required',locationId:'L-WH-A1',receiptId:'GRN-1'});
assert.equal(cancelCase.ok,true);
assert.equal(row('P-1','L-RETURNS-HOLD').qty,1);
const cancelled=c.purchaseCancelSupplierReturn(cancelCase.return.id,'Kept for another job');
assert.equal(cancelled.ok,true);
assert.equal(cancelled.return.status,'Cancelled');
assert.equal(row('P-1','L-RETURNS-HOLD').qty,0);
assert.equal(row('P-1','L-WH-A1').qty,3,'Cancelled return restores stock to its source location');

// Service / non-stock correction never invents a warehouse movement.
const projectSource=fs.readFileSync('public/project-engine.js','utf8');
vm.runInContext(projectSource,c,{filename:'public/project-engine.js'});
const beforeProject=c.PoolShedProjectEngine.summary(data.jobs[0],data,Date.parse('2026-10-05T12:00:00Z'));
assert.equal(beforeProject.forecast,250000,'Project forecast includes the received £2,500 service before correction');

const movementCount=data.movements.length;
const serviceCase=c.purchaseCreateSupplierReturn({poId:'PO-2',productId:'S-CRANE',qty:1,reason:'Duplicate cost / entered in error',locationId:'',receiptId:''});
assert.equal(serviceCase.ok,true);
assert.equal(serviceCase.return.nonStock,true);
assert.equal(serviceCase.return.stockHeld,false);
assert.equal(data.movements.length,movementCount,'Non-stock service correction creates no stock movement');

const corrected=c.purchaseCompleteSupplierReturn(serviceCase.return.id,{resolutionType:'internal-correction',creditNet:2500,creditDate:'2026-10-05',note:'Duplicate crane hire entered in error'});
assert.equal(corrected.ok,true);
assert.equal(corrected.return.status,'Closed');
assert.equal(corrected.return.resolutionType,'internal-correction');
assert.equal(data.purchaseOrders[1].returnCorrections.length,1);
assert.equal(data.financeCommand.supplierCredits.length,1,'Internal correction does not fabricate a supplier credit note');
assert.equal(data.purchaseOrders[1].lines[0].creditedNet,2500);

const afterProject=c.PoolShedProjectEngine.summary(data.jobs[0],data,Date.parse('2026-10-05T12:00:00Z'));
assert.equal(afterProject.forecast,0,'Closed internal correction removes the duplicate service cost from linked Project forecast');
assert.equal(afterProject.poRows[0].credit,250000,'Project keeps the supplier correction as linked audit evidence');

// Finance command uses the same completed credit authority.
const financeSource=fs.readFileSync('public/finance-command-engine.js','utf8');
vm.runInContext(financeSource,c,{filename:'public/finance-command-engine.js'});
assert.equal(c.PoolShedFinanceCommand.poValue(data.purchaseOrders[0]),60,'Physical PO value is net of completed supplier credit');
assert.equal(c.PoolShedFinanceCommand.poValue(data.purchaseOrders[1]),0,'Internally corrected service no longer contributes to effective PO value');

assert(data.auditLog.some(x=>x.action==='Supplier credit completed'),'Supplier credit completion must be audited');
assert(data.auditLog.some(x=>x.action==='Purchase receipt/cost internally corrected'),'Internal correction must be audited');
console.log('PASS supplier return -> authorise -> dispatch -> credit and non-stock internal correction reverse linked PO, Project, Finance and stock effects with audit history');
