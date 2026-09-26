import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('public/warehouse-workspace.js','utf8');
const screen = { innerHTML: '' };
const data = {
  products: [{id:'P',sku:'SKU-P',name:'Test Pump',supplier:'Certikin',cost:100}],
  customers: [{id:'C',name:'Test Customer'}],
  locations: [
    {id:'L-WH-A1',name:'Main Warehouse A1',type:'Warehouse Bin'},
    {id:'L-RECEIVING',name:'Goods In / Receiving Bay',type:'Receiving Bay'},
    {id:'L-QUARANTINE',name:'Quarantine Hold',type:'Quarantine'}
  ],
  stock: [
    {productId:'P',locationId:'L-WH-A1',qty:2,allocated:1},
    {productId:'P',locationId:'L-RECEIVING',qty:1,allocated:0}
  ],
  salesOrders: [
    {id:'SO-OLD',customerId:'C',created:'2026-09-01',due:'2026-09-18',status:'Part Stock',lines:[{productId:'P',qty:2,allocated:1}]},
    {id:'SO-NEW',customerId:'C',created:'2026-09-05',due:'2026-09-16',status:'Part Stock',lines:[{productId:'P',qty:1,allocated:0}]}
  ],
  purchaseOrders: [{id:'PO-1',supplier:'Certikin',status:'Sent',due:'2026-09-15',lines:[{productId:'P',qty:3,received:1,receiptLineId:'RL-1',salesOrderId:'SO-NEW',salesOrderAllocations:[]}]}],
  receiptEvents: [{id:'REC-1',poId:'PO-1',lineId:'RL-1',productId:'P',qty:1,locationId:'L-RECEIVING',supplier:'Certikin',date:'2026-09-15T09:00:00Z'}],
  putawayTransfers: [], movements: [], allocationEvents: [], warehouseQcEvents: [], stockTakes: []
};
const c = {
  data, console,
  activeSubPage:{warehouse:'Work Queue'},
  warehousePoView:'list', selectedGoodsInPoId:'PO-1',
  selectedSubPage:(id)=>c.activeSubPage[id] || '',
  defaultSubPage:(id)=>id==='warehouse'?'Goods In':'',
  sidebarSubGroups:(id)=>id==='warehouse'?['Goods In','QC Checks']:[],
  openSidebarSubGroup:(tab,sub)=>{c.activeSubPage[tab]=sub;},
  escapeHtml:(v)=>String(v??''), money:(v)=>`£${Number(v||0).toFixed(2)}`,
  product:(id)=>data.products.find(p=>p.id===id), customer:(id)=>data.customers.find(x=>x.id===id), salesOrder:(id)=>data.salesOrders.find(o=>o.id===id),
  available:(row)=>['L-RECEIVING','L-QUARANTINE'].includes(row.locationId)?0:Math.max(0,row.qty-row.allocated),
  locationById:(id)=>data.locations.find(l=>l.id===id),
  poLinePending:(line)=>Math.max(0,Number(line.qty||0)-Number(line.received||0)),
  goodsInSummary:(po)=>po.lines.reduce((s,l)=>({ordered:s.ordered+l.qty,received:s.received+l.received}),{ordered:0,received:0}),
  putawayTransferTotals:()=>new Map(),
  receiptRemaining:(event)=>event.locationId==='L-RECEIVING'?event.qty:0,
  pendingPutawayUnits:()=>1,
  stockRowsForLocation:(id)=>data.stock.filter(r=>r.locationId===id),
  locationOptions:()=>'', transferForm:()=>'<form>transfer</form>', barcodeTransferForm:()=>'<form>barcode</form>',
  stockTakeApprovalQueue:()=>'<div>counts</div>', inventoryAuditTrail:()=>'<div>audit</div>', returnsRows:()=>'<tr><td>return</td></tr>', damagedRows:()=>'<tr><td>damage</td></tr>',
  bindGoodsIn:()=>{}, bindPutaway:()=>{}, bindTransferForm:()=>{}, render:()=>{}, saveAppData:()=>{}, toast:()=>{},
  addMovement:()=>{}, addSalesOrderNotification:()=>{}, updateSalesOrderStatusAfterAllocation:()=>{}, todayIso:()=> '2026-09-15', currentUser:()=>({name:'Tester'}),
  document:{
    getElementById:(id)=>id==='screen-warehouse'?screen:null,
    querySelector:()=>null,
    querySelectorAll:()=>[]
  }
};
c.globalThis=c;
vm.createContext(c);vm.runInContext(source,c,{filename:'warehouse-workspace.js'});

assert.equal(typeof c.renderWarehouse,'function','Warehouse Precision Desk must own renderWarehouse');
assert.deepEqual(Array.from(c.sidebarSubGroups('warehouse')),['Work Queue','Inbound','Transfers','Returns & Quarantine','Counts','Audit']);
c.renderWarehouse();
const html=screen.innerHTML;
assert(html.includes('warehouse-precision-page'),'selected Precision Desk root must render');
for (const label of ['Work Queue','Inbound','Transfers','Returns & Quarantine','Counts','Audit']) assert(c.sidebarSubGroups('warehouse').includes(label),label+' view must be reachable from the sidebar');
assert(!html.includes('warehouse-precision-tabs'),'Warehouse must not duplicate module navigation on the page');
assert(html.includes('Receive') && html.includes('QC') && html.includes('Putaway'),'Inbound lifecycle must visibly connect Receive, QC and Putaway');
assert.match(html,/FIFO/i,'FIFO allocation must be explained in Warehouse');
assert.match(html,/oldest/i,'oldest-order allocation rule must be visible');
assert(html.includes('data-wh-reallocate'),'manual post-FIFO reallocation control must be present');
assert(!html.includes('data-allocate-linked-line'),'old linked-order allocation button must not exist');
assert(!html.includes('data-allocate-matched-line'),'old manual matched-order allocation button must not exist');
c.activeSubPage.warehouse='Inbound';
c.renderWarehouse();
const inboundHtml=screen.innerHTML;
assert(inboundHtml.includes('data-wh-confirm-booking'),'Inbound must expose one-confirmation booking-in action');
assert(inboundHtml.includes('data-wh-book-decision'),'Inbound must expose a clear QC decision per delivery line');
assert(inboundHtml.includes('data-wh-putaway-receipt'),'accepted Receiving stock must expose QC/putaway release action');
assert(!inboundHtml.includes('data-allocate-linked-line'),'Inbound must not restore linked-order manual allocation');
assert(!inboundHtml.includes('data-allocate-matched-line'),'Inbound must not restore matched-order manual allocation');
console.log('Warehouse Precision Desk structure, process visibility and allocation controls passed.');
