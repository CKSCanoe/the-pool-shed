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
  'Clean-up rule'
]) assert(source.includes(token),'PO Sales Order parity missing '+token);

const data={
  purchaseOrders:[
    {id:'PO-CLEAN',supplier:'Certikin',status:'Supplier Confirmed',supplierConfirmedAt:'2026-09-30T08:00:00Z',supplierEmailSentAt:'2026-09-30T08:05:00Z',lines:[{productId:'P1',qty:2,received:0,unitCost:50}]},
    {id:'PO-RECEIVED',supplier:'Certikin',status:'Part Received',lines:[{productId:'P2',qty:2,received:1,unitCost:75}]}
  ],
  products:[{id:'P1',sku:'SKU-1',name:'Unreceived item',cost:50},{id:'P2',sku:'SKU-2',name:'Received item',cost:75}],
  receiptEvents:[{id:'GRN-1',poId:'PO-RECEIVED',productId:'P2',qty:1,date:'2026-09-30'}],
  suppliers:[],locations:[],salesOrders:[],purchaseReturns:[],warehouseQcEvents:[],stock:[],auditLog:[]
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

console.log('PASS PO Sales Order parity, safe unreceived line deletion, audit history and received-line credit protection');
