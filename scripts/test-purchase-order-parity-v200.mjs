import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const path='public/purchase-workspace.js';
const source=fs.readFileSync(path,'utf8');

for(const token of [
  'Items & Costing',
  'Fulfilment',
  'Addresses',
  'Cost & Payments',
  'Sales Orders & Credits',
  'Activity & Payments',
  'Subtotal net',
  'Total inc VAT',
  'data-po-remove-line',
  'Return / credit',
  'Clean-up rule',
  'data-po-supplier-change',
  'Supplier can still be corrected after receipt',
  'Live totals',
  'Paid to supplier',
  'Record supplier payment',
  'View payment history',
  'Supplier payment history'
]) assert(source.includes(token),'PO Sales Order parity missing '+token);

const data={
  purchaseOrders:[
    {id:'PO-CLEAN',supplier:'Certikin',status:'Supplier Confirmed',supplierConfirmedAt:'2026-09-30T08:00:00Z',supplierEmailSentAt:'2026-09-30T08:05:00Z',lines:[{productId:'P1',qty:2,received:0,unitCost:50}]},
    {id:'PO-RECEIVED',supplier:'Not applicable',status:'Received',lines:[{productId:'P2',qty:2,received:2,unitCost:75}]}
  ],
  products:[{id:'P1',sku:'SKU-1',name:'Unreceived item',cost:50},{id:'P2',sku:'SKU-2',name:'Received item',cost:75}],
  receiptEvents:[{id:'GRN-1',poId:'PO-RECEIVED',productId:'P2',qty:2,date:'2026-09-30'}],
  suppliers:[{name:'Carropools',contact:'Orders',email:'orders@carropools.test'}],locations:[],salesOrders:[],purchaseReturns:[],warehouseQcEvents:[],stock:[],auditLog:[]
};
const notices=[];
const c={
  data,console,Date,Math,JSON,
  currentUser:()=>({name:'Aaron'}),
  purchaseOrderById:id=>data.purchaseOrders.find(po=>po.id===id),
  product:id=>data.products.find(p=>p.id===id),
  saveAppData:()=>true,
  render:()=>{},
  toast:m=>notices.push(m),
  prompt:()=> 'Duplicate line entered',
  confirm:()=>true,
  money:n=>'£'+Number(n||0).toFixed(2),
  escapeHtml:v=>String(v??''),
  document:{querySelectorAll:()=>[],getElementById:()=>null,querySelector:()=>null},
  globalThis:null
};
c.globalThis=c;
vm.createContext(c);
vm.runInContext(source,c,{filename:path});

assert.equal(typeof c.purchaseOrderLineDeleteAssessment,'function');
assert.equal(typeof c.removePurchaseOrderLine,'function');
assert.equal(typeof c.changePurchaseOrderSupplier,'function');

const clean=data.purchaseOrders[0],received=data.purchaseOrders[1];
assert.equal(c.purchaseOrderLineDeleteAssessment(clean,clean.lines[0]).allowed,true,'Unreceived line should be removable');
assert.equal(c.purchaseOrderLineDeleteAssessment(received,received.lines[0]).allowed,false,'Received line must be retained for credit/return history');

c.removePurchaseOrderLine('PO-CLEAN',0);
assert.equal(clean.lines.length,0,'Unreceived line should be removed');
assert.equal(clean.lineCorrections.length,1,'Line correction history must be retained');
assert.equal(clean.lineCorrections[0].reason,'Duplicate line entered');
assert.equal(clean.reviewStatus,'Needs review','Supplier-visible PO must return to review after a line correction');
assert.equal(clean.supplierEmailStatus,'Changes pending');
assert.equal(clean.status,'Draft - Review');
assert(data.auditLog.some(x=>x.action==='Purchase order line removed'),'Global audit must retain the correction');

c.removePurchaseOrderLine('PO-RECEIVED',0);
assert.equal(received.lines.length,1,'Received line must never be deleted');
assert(notices.some(x=>/receiving history/i.test(x)),'Received line should direct user to returns/credits');

const receivedQtyBefore=received.lines[0].received;
const receiptsBefore=JSON.stringify(data.receiptEvents);
assert.equal(c.changePurchaseOrderSupplier('PO-RECEIVED','Carropools'),true,'Received custom-line PO supplier should be correctable');
assert.equal(received.supplier,'Carropools');
assert.equal(received.status,'Received','Post-receipt supplier correction must not reopen physical receiving');
assert.equal(received.lines[0].received,receivedQtyBefore,'Supplier correction must not alter received quantity');
assert.equal(JSON.stringify(data.receiptEvents),receiptsBefore,'Supplier correction must not alter Goods In history');
assert.equal(received.supplierCorrections.length,1,'Supplier correction history must be retained');
assert.equal(received.supplierCorrections[0].from,'Not applicable');
assert.equal(received.supplierCorrections[0].to,'Carropools');
assert(data.auditLog.some(x=>x.action==='Purchase order supplier corrected'),'Supplier correction must be globally audited');

console.log('PASS PO Sales Order parity, safe line controls and post-receipt supplier correction');
