import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('public/warehouse-workspace.js','utf8');
const data = {
  locations:[{id:'L-WH-A1',name:'Main Warehouse A1'},{id:'L-QUARANTINE',name:'Quarantine'},{id:'L-RECEIVING',name:'Receiving'}],
  stock:[{productId:'P-1',locationId:'L-WH-A1',qty:0,allocated:0},{productId:'P-1',locationId:'L-RECEIVING',qty:0,allocated:0},{productId:'P-2',locationId:'L-RECEIVING',qty:0,allocated:0},{productId:'P-2',locationId:'L-QUARANTINE',qty:0,allocated:0}],
  purchaseOrders:[{id:'PO-1',supplier:'Certikin',status:'Sent',due:'2026-09-20',lines:[
    {receiptLineId:'RL-1',productId:'P-1',qty:3,received:0,preferredLocationId:'L-WH-A1'},
    {receiptLineId:'RL-2',productId:'P-2',qty:2,received:0,preferredLocationId:'L-WH-A1'},
    {receiptLineId:'RL-3',productId:'P-3',qty:4,received:0,preferredLocationId:'L-WH-A1'}
  ]}],
  salesOrders:[{id:'SO-1',created:'2026-09-01',due:'2026-09-18',status:'Part Stock',lines:[{productId:'P-1',qty:3,allocated:0}]}],
  receiptEvents:[],putawayTransfers:[],warehouseQcEvents:[],allocationEvents:[],movements:[],stockTakes:[]
};
function stockRow(pid,loc){let r=data.stock.find(x=>x.productId===pid&&x.locationId===loc);if(!r){r={productId:pid,locationId:loc,qty:0,allocated:0};data.stock.push(r);}return r;}
const c={data,console,crypto:{randomUUID:()=>`id-${Math.random()}`},todayIso:()=> '2026-09-15',currentUser:()=>({name:'Aaron'}),
 product:(id)=>({id,sku:id,name:id}),salesOrder:(id)=>data.salesOrders.find(o=>o.id===id),
 locationById:(id)=>data.locations.find(l=>l.id===id),
 available:(r)=>['L-RECEIVING','L-QUARANTINE'].includes(r.locationId)?0:Math.max(0,r.qty-r.allocated),
 addStock:(pid,loc,qty)=>{stockRow(pid,loc).qty+=qty;},removeStock:(pid,loc,qty)=>{const r=stockRow(pid,loc);if(r.qty<qty)return false;r.qty-=qty;return true;},
 addMovement:(type,productId,qty,from,to,ref,user,note)=>data.movements.push({type,productId,qty,from,to,ref,user,note}),
 addSalesOrderNotification:()=>{},updateSalesOrderStatusAfterAllocation:(o)=>{o.status=o.lines.every(l=>l.allocated>=l.qty)?'Ready To Pick':'Part Stock';},
 poLinePending:(l)=>Math.max(0,l.qty-l.received),isLocationStockTakeFrozen:()=>false,
 normalizeReceiptLedger:()=>{},putawayTransferTotals:()=>new Map(),receiptRemaining:(e)=>Math.max(0,e.qty-data.putawayTransfers.filter(t=>t.receiptId===e.id).reduce((n,t)=>n+t.qty,0)),
 recordPurchaseReceipt:(po,line,qty,destination,expected,metadata)=>{if(qty<=0||qty>line.qty-line.received)return false;const e={id:`REC-${data.receiptEvents.length+1}`,poId:po.id,lineId:line.receiptLineId,productId:line.productId,qty,locationId:destination,supplier:po.supplier,supplierReference:metadata.supplierReference||'',note:metadata.note||'',date:'2026-09-15T10:00:00Z',user:'Aaron'};data.receiptEvents.push(e);line.received+=qty;stockRow(line.productId,destination).qty+=qty;return e;},
 escapeHtml:(v)=>String(v??''),money:(v)=>`£${Number(v||0).toFixed(2)}`,toast:()=>{},render:()=>{},saveAppData:()=>{},
 document:{querySelectorAll:()=>[],getElementById:()=>null,querySelector:()=>null}
};c.globalThis=c;vm.createContext(c);vm.runInContext(source,c,{filename:'warehouse-workspace.js'});
assert.equal(typeof c.warehouseBookDelivery,'function','Batch booking-in API must exist');
const result=c.warehouseBookDelivery('PO-1',[
 {lineKey:'RL-1',qty:3,decision:'Accepted',destination:'L-WH-A1'},
 {lineKey:'RL-2',qty:2,decision:'Damaged',destination:'L-WH-A1'},
 {lineKey:'RL-3',qty:0,decision:'Shortage',destination:'L-WH-A1'}
],'DN-100','One supplier delivery');
assert.equal(result.ok,true);
assert.equal(data.purchaseOrders[0].lines[0].received,3,'accepted line is physically received');
assert.equal(data.salesOrders[0].lines[0].allocated,3,'accepted line FIFO allocates after QC');
assert.equal(stockRow('P-2','L-QUARANTINE').qty,2,'damaged line is quarantined');
assert.equal(data.purchaseOrders[0].lines[2].received,0,'shortage does not fake a receipt');
assert(data.warehouseQcEvents.some(e=>e.decision==='Shortage'),'shortage is recorded as an exception');
assert.equal(data.movements.filter(m=>m.type==='FIFO Sales Allocation').length,1,'FIFO movement is audited');
console.log('PASS one-confirmation booking-in handles accepted, damaged and shortage lines safely');
