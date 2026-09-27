import assert from 'node:assert/strict';
import { store } from '../server/azzy/src/data/demo-store.js';
import { executeTool } from '../server/azzy/src/tools/registry.js';
import { normalisePoolShedWorkspace } from '../server/azzy/integration/pool-shed-normalizer.js';
import { buildAzzyPoolShedSnapshot } from '../server/azzy/integration/pool-shed-server-runtime.js';
import { withRuntimeData } from '../server/azzy/src/data/runtime-data.js';
import { memory } from '../server/azzy/src/core/memory.js';
import { approveAction } from '../server/azzy/src/core/agent.js';

let passed=0;
async function test(name,fn){await fn();console.log('✓',name);passed++;}
const db=store.snapshot(),aaron=db.users.aaron,warehouse=db.users.warehouse;

await test('today ordering combines sales-order shortage, free stock, incoming stock and reorder floor',async()=>{
  const r=executeTool('get_procurement_demand',{},aaron);assert.equal(r.ok,true);const pipe=r.data.find(x=>x.sku==='PB-PIPE-015');assert.ok(pipe);assert.equal(pipe.committedShortage,2);assert.equal(pipe.recommendedQty,9);assert.equal(pipe.bestSupplier.supplier,'CPC');assert.equal(pipe.sources[0].salesOrderId,'SO-411');
});
await test('supplier comparison keeps equivalent products together rather than comparing unlike fittings',async()=>{
  const r=executeTool('get_supplier_price_comparison',{query:'Who is cheapest for 10 units of 1.5 inch pressure pipe?',qty:10},aaron);assert.equal(r.ok,true);assert.equal(r.data.groups.length,1);assert.equal(r.data.best.poolSku,'PB-PIPE-015');assert.equal(r.data.best.supplier,'CPC');assert.equal(r.data.best.totalNet,142);
});
await test('broad pipework comparison returns separate comparable product groups',async()=>{
  const r=executeTool('get_supplier_price_comparison',{query:'Who is cheapest for 1.5 inch pipework?',qty:10},aaron);assert.equal(r.ok,true);assert.ok(r.data.groups.length>=2);assert.ok(r.data.groups.some(g=>g.poolSku==='PB-PIPE-015'));assert.ok(r.data.groups.some(g=>g.poolSku==='PB-ELB-015'));
});
await test('warehouse pick list is bin sorted and exposes its sales-order shortfall',async()=>{
  const r=executeTool('get_pick_list',{salesOrderId:'SO-411'},warehouse);assert.equal(r.ok,true);assert.equal(r.data.printUrl,'/warehouse/pick-list/SO-411/print');assert.equal(r.data.shortfall,2);assert.deepEqual(r.data.rows.map(x=>x.bin),[...r.data.rows.map(x=>x.bin)].sort());
});
await test('sales-order allocation is a bounded proposal and does not over-allocate',async()=>{
  const before=structuredClone(db.products['PB-PIPE-015']);const r=executeTool('prepare_sales_order_allocation',{salesOrderId:'SO-411'},warehouse);assert.equal(r.ok,true);assert.equal(r.data.type,'sales_order_allocation');const pipe=r.data.lines.find(x=>x.sku==='PB-PIPE-015');assert.equal(pipe.allocateQty,2);assert.equal(r.data.remainingShortfall,0);assert.deepEqual(db.products['PB-PIPE-015'],before);
});
await test('urgent buying can be grouped into review-only draft POs with carriage',async()=>{
  const r=executeTool('prepare_procurement_purchase_orders',{urgentOnly:true},aaron);assert.equal(r.ok,true);assert.equal(r.data.type,'draft_po_batch');assert.equal(r.data.requiresApproval,true);const cpc=r.data.purchaseOrders.find(x=>x.supplier==='CPC');assert.ok(cpc);assert.equal(cpc.lines[0].sku,'PB-PIPE-015');assert.equal(cpc.carriageNet,18);assert.equal(cpc.totalNet,129.6);
});
await test('supplier performance scorecard uses recorded delivery history',async()=>{
  const r=executeTool('get_supplier_scorecards',{},aaron);assert.equal(r.ok,true);assert.equal(r.data[0].supplier,'CPC');assert.equal(r.data[0].onTimePct,92.9);assert.equal(r.data.at(-1).supplier,'CETCO');
});
await test('three-way match flags a supplier invoice exception before payment review',async()=>{
  const r=executeTool('get_three_way_match',{billId:'BILL-810'},aaron);assert.equal(r.ok,true);assert.equal(r.data.status,'Review');assert.ok(r.data.exceptions.some(x=>x.sku==='MISC-FREIGHT'));
});
await test('cycle count plan prioritises stock that needs verification',async()=>{
  const r=executeTool('get_cycle_count_plan',{limit:4},warehouse);assert.equal(r.ok,true);assert.equal(r.data.length,4);assert.ok(r.data[0].score>=r.data[1].score);
});
await test('exception inbox is permission filtered and decision focused',async()=>{
  const management=executeTool('get_exception_inbox',{limit:20},aaron);const wh=executeTool('get_exception_inbox',{limit:20},warehouse);assert.ok(management.data.some(x=>x.kind==='invoice_match'));assert.ok(!wh.data.some(x=>x.kind==='invoice_match'));assert.ok(wh.data.some(x=>x.kind==='buying'));
});
await test('chemical safety answers only from stored Pool Shed documents',async()=>{
  const r=executeTool('get_chemical_safety',{sku:'PB-CHL-20'},aaron);assert.equal(r.ok,true);assert.equal(r.data.current.length,1);assert.ok(r.data.current[0].controls.some(x=>/Do not mix with acids/i.test(x)));
});

const raw={
  products:[{id:'P-1',sku:'PB-TEST-01',name:'Test fitting',reorderLevel:4,unitCost:3.5,equivalenceKey:'test-fitting'}],
  stock:[{sku:'PB-TEST-01',qty:5,allocated:4,bin:'T-01'}],
  customers:[{id:'CUS-1',name:'Test Customer'}],suppliers:[{id:'SUP-1',name:'Test Supplier'}],
  jobs:[{id:'PRJ-1',name:'Test Project',customerId:'CUS-1',progress:20,dueDate:'2026-10-01'}],
  salesOrders:[{id:'SO-1',projectId:'PRJ-1',status:'Part allocated',lines:[{sku:'PB-TEST-01',qty:3,allocatedQty:1}]}],
  purchaseOrders:[],supplierProducts:[{id:'SP-1',poolSku:'PB-TEST-01',productName:'Test fitting',supplierId:'SUP-1',supplier:'Test Supplier',supplierSku:'TF-1',unitNet:3.2,carriageNet:8,freeCarriageThreshold:100,lastUpdated:'2026-09-26'}]
};
const liveUser={id:'user-1',name:'Live User',role:'manager',permissions:['projects.read','stock.read','purchasing.read','customers.read','knowledge.read','actions.prepare','actions.approve']};
await test('Pool Shed normalizer maps canonical workspace collections without mutating the source',async()=>{
  const before=JSON.stringify(raw),live=normalisePoolShedWorkspace(raw,{users:[liveUser],revision:44,today:'2026-09-27'});assert.equal(live.meta.mode,'pool-shed-live');assert.equal(live.meta.revision,44);assert.equal(live.products['PB-TEST-01'].onHand,5);assert.equal(live.salesOrders['SO-1'].lines[0].allocatedQty,1);assert.equal(live.projects['PRJ-1'].salesOrderIds[0],'SO-1');assert.equal(JSON.stringify(raw),before);
});
await test('server integration builder creates a user-scoped live Azzy snapshot',async()=>{
  const live=buildAzzyPoolShedSnapshot({workspace:raw,user:liveUser,permissions:liveUser.permissions,revision:45,today:'2026-09-27'});assert.equal(live.meta.mode,'pool-shed-live');assert.deepEqual(Object.keys(live.users),['user-1']);assert.ok(live.users['user-1'].permissions.includes('actions.approve'));
});
await test('runtime data injection makes live Pool Shed data the sole tool source for that request',async()=>{
  const live=buildAzzyPoolShedSnapshot({workspace:raw,user:liveUser,permissions:liveUser.permissions,revision:46,today:'2026-09-27'});const r=await withRuntimeData(live,()=>executeTool('get_procurement_demand',{},liveUser));assert.equal(r.ok,true);assert.equal(r.data[0].sku,'PB-TEST-01');assert.ok(!r.data.some(x=>x.sku==='PB-PIPE-015'));
});
await test('approved live actions hand off to Pool Shed action authority instead of mutating Azzy data',async()=>{
  const live=buildAzzyPoolShedSnapshot({workspace:raw,user:liveUser,permissions:liveUser.permissions,revision:47,today:'2026-09-27'}),before=JSON.stringify(live);const id=`ACT-LIVE-${Date.now()}`;memory.saveAction({id,type:'sales_order_allocation',salesOrderId:'SO-1',status:'prepared',requiresApproval:true,requestedBy:'user-1'});let called=0;const out=await withRuntimeData(live,()=>approveAction('user-1',id),{actionExecutor:async({action,user})=>{called++;assert.equal(user.id,'user-1');assert.equal(action.salesOrderId,'SO-1');return {ok:true,result:{allocationId:'ALLOC-1'}};}});assert.equal(out.ok,true);assert.equal(out.action.status,'executed');assert.equal(called,1);assert.equal(JSON.stringify(live),before);
});

console.log(`\nPool Shed ready: ${passed} passed, 0 failed`);
