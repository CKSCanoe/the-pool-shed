import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
assert(fs.existsSync('public/inventory-control-engine.js'),'Inventory control engine must exist');
const data={
 products:[
  {id:'P1',sku:'PB-VALVE',name:'1.5 Ball Valve',cost:20,category:'Valves',supplier:'Certikin'},
  {id:'P2',sku:'PB-ELBOW',name:'1.5 90 Elbow',cost:3,category:'Fittings',supplier:'Certikin'}
 ],
 locations:[
  {id:'L-WH-A1',name:'Main Warehouse A1',type:'Warehouse Shelf',owner:'Warehouse',parentId:'L-WH-MAIN'},
  {id:'L-VAN-DAVE',name:"Dave's Van",type:'Engineer Van',owner:'Dave',stockProfile:'Standard Service Van',countCadenceDays:7},
  {id:'L-JOB-1',name:'Project Alpha Job Bin',type:'Job Bin',owner:'Project Alpha',jobId:'J1'}
 ],
 stock:[
  {productId:'P1',locationId:'L-WH-A1',qty:30,allocated:2},
  {productId:'P1',locationId:'L-VAN-DAVE',qty:4,allocated:2},
  {productId:'P2',locationId:'L-VAN-DAVE',qty:16,allocated:0},
  {productId:'P1',locationId:'L-JOB-1',qty:3,allocated:0}
 ],
 restockRules:[
  {productId:'P1',locationId:'L-VAN-DAVE',min:5,restockTo:8,max:10,priority:'Critical'},
  {productId:'P2',locationId:'L-VAN-DAVE',min:5,restockTo:10,max:12,priority:'Normal'}
 ],
 jobs:[{id:'J1',name:'Project Alpha',status:'In Progress',engineer:'Dave'}],
 engineerRequests:[{id:'ER1',jobId:'J1',engineer:'Dave',status:'Requested',requiredDate:'2026-09-16',lines:[{productId:'P1',qty:2,allocated:0}]}],
 purchaseOrders:[],salesOrders:[],movements:[
  {id:'M1',type:'Stocktake Variance Down',productId:'P1',qty:1,from:"Dave's Van",to:"Dave's Van",date:'2026-09-05'},
  {id:'M2',type:'Stocktake Variance Down',productId:'P1',qty:1,from:"Dave's Van",to:"Dave's Van",date:'2026-09-10'},
  {id:'M3',type:'Transfer',productId:'P1',qty:3,from:'Main Warehouse A1',to:"Dave's Van",date:'2026-09-12'}
 ],
 stockTakes:[{ref:'ST-1',locationId:'L-VAN-DAVE',status:'Posted',lastCounted:'2026-09-01',lines:[]}],notifications:[]
};
const transfers=[];
const ctx={console,globalThis:null,window:null,Math,Date,Set,Map,Intl};ctx.globalThis=ctx;ctx.window=ctx;ctx.__POOL_SHED_GET_DATA__=()=>data;ctx.moveStockBetweenLocations=(pid,from,to,qty,ref,note)=>{transfers.push({pid,from,to,qty,ref,note});return true;};ctx.saveAppData=()=>{};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/inventory-control-engine.js','utf8'),ctx);
const inv=ctx.PoolShedInventoryControl;assert(inv,'PoolShedInventoryControl API missing');
const summary=inv.locationSummary('L-VAN-DAVE');
assert.equal(summary.onHand,20);assert.equal(summary.allocated,2);assert.equal(summary.available,18);assert.equal(summary.stockValue,128);
const rows=inv.locationRows('L-VAN-DAVE');const valve=rows.find(r=>r.productId==='P1');const elbow=rows.find(r=>r.productId==='P2');
assert.equal(valve.available,2,'van readiness must use free stock after reservation');
assert.equal(valve.suggestedTopUp,6,'below-min valve should top up free stock to Target 8');
assert.equal(valve.warehouseAvailable,28,'top-up should see real warehouse availability');
assert.equal(elbow.returnSuggested,6,'over-Max item should suggest reducing to Target');
assert.equal(inv.projectDemandForLocation('L-VAN-DAVE').find(x=>x.productId==='P1').qty,2,'engineer/project demand must feed van insight');
const readiness=inv.vanReadiness('L-VAN-DAVE');assert.equal(readiness.totalCore,2);assert.equal(readiness.belowMin,1);assert(readiness.readinessPct<100);
const alerts=inv.alerts({today:'2026-09-15'});assert(alerts.some(a=>a.type==='low-stock'&&a.locationId==='L-VAN-DAVE'));assert(alerts.some(a=>a.type==='count-overdue'));assert(alerts.some(a=>a.type==='repeated-variance'));
const suggestions=inv.smartThresholdSuggestions('L-VAN-DAVE');assert(suggestions.some(s=>s.productId==='P1'&&s.suggestedMin>=5),'smart Min is advisory and based on usage/demand');

// Transfer guard: a requested top-up is atomic. If eligible Warehouse free stock
// cannot cover the complete request, no partial transfer is allowed.
const originalWarehouseQty=data.stock.find(r=>r.productId==='P1'&&r.locationId==='L-WH-A1').qty;
const originalWarehouseAllocated=data.stock.find(r=>r.productId==='P1'&&r.locationId==='L-WH-A1').allocated;
data.stock.find(r=>r.productId==='P1'&&r.locationId==='L-WH-A1').qty=5;
data.stock.find(r=>r.productId==='P1'&&r.locationId==='L-WH-A1').allocated=2; // 3 free only
transfers.length=0;
const blocked=inv.createTopUpTransfer('L-VAN-DAVE','P1',6);
assert.equal(blocked.ok,false,'top-up must fail if full requested quantity is not free across Warehouse sources');
assert.equal(blocked.moved,0,'insufficient Warehouse stock must not create a partial transfer');
assert.equal(transfers.length,0,'no stock movement may be attempted when full top-up cannot be covered');
data.stock.find(r=>r.productId==='P1'&&r.locationId==='L-WH-A1').qty=originalWarehouseQty;
data.stock.find(r=>r.productId==='P1'&&r.locationId==='L-WH-A1').allocated=originalWarehouseAllocated;

const result=inv.createTopUpTransfer('L-VAN-DAVE','P1',6);assert.equal(result.ok,true);assert.equal(transfers.length,1);assert.equal(transfers[0].from,'L-WH-A1');assert.equal(transfers[0].to,'L-VAN-DAVE');
console.log('PASS Inventory control engine location, van readiness, alerts and connected transfer authority');
