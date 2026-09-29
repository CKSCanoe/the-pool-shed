import assert from 'node:assert/strict';
import { store } from '../server/azzy/src/data/demo-store.js';
import { executeTool } from '../server/azzy/src/tools/registry.js';
import { normalisePoolShedWorkspace } from '../server/azzy/integration/pool-shed-normalizer.js';
import { buildAzzyPoolShedSnapshot } from '../server/azzy/integration/pool-shed-server-runtime.js';
import { withRuntimeData } from '../server/azzy/src/data/runtime-data.js';
import { memory } from '../server/azzy/src/core/memory.js';
import { approveAction } from '../server/azzy/src/core/agent.js';
import { deterministicPlan } from '../server/azzy/src/core/planner.js';

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


const realisticRaw={
  products:[{id:'PROD-900',sku:'PB-LIVE-900',name:'Live test pump',category:'Pumps',supplier:'Supplier Alpha',supplierSku:'ALPHA-900',cost:210,rrp:399,trade:349,wholesale:320,reorder:2,taxCode:'20% VAT'}],
  stock:[{productId:'PROD-900',qty:7,allocated:2,onOrder:3,bin:'P-09'}],
  customers:[{id:'CUS-900',name:'Live Customer'}],
  suppliers:[{id:'SUP-A',name:'Supplier Alpha',shippingCost:12,freeShippingThreshold:500,leadTimeDays:3},{id:'SUP-B',name:'Supplier Beta',shippingCost:8,freeShippingThreshold:400,leadTimeDays:5}],
  jobs:[{id:'PRJ-900',name:'Live Pool Project',customerId:'CUS-900',status:'Active',progress:55}],
  salesOrders:[{id:'SO-900',jobId:'PRJ-900',customerId:'CUS-900',status:'Part Stock',priceList:'rrp',due:'2026-10-10',lines:[{productId:'PROD-900',qty:4,allocated:2,picked:1,packed:0,taxCode:'20% VAT'}]}],
  purchaseOrders:[{id:'PO-900',supplier:'Supplier Alpha',jobId:'PRJ-900',originalSalesOrderId:'SO-900',status:'Sent',due:'2026-10-03',lines:[{productId:'PROD-900',qty:3,received:1,salesOrderId:'SO-900',cost:215,supplierSku:'ALPHA-900'}]}],
  supplierProducts:[
    {id:'SP-A',productId:'PROD-900',supplierId:'SUP-A',supplier:'Supplier Alpha',supplierSku:'ALPHA-900',cost:205,available:true,lastUpdated:'2026-09-29'},
    {id:'SP-B',productId:'PROD-900',supplierId:'SUP-B',supplier:'Supplier Beta',supplierSku:'BETA-900',cost:198,available:true,lastUpdated:'2026-09-28'}
  ],
  goodsReceipts:[{id:'GR-900',poId:'PO-900',receivedAt:'2026-09-29T12:00:00Z',lines:[{productId:'PROD-900',qty:1,cost:215,qc:'Accepted'}]}],
  goodsNotes:[{id:'GN-900',salesOrderId:'SO-900',status:'Picking',lines:[{productId:'PROD-900',qty:1,picked:1,packed:0}]}],
  salesCredits:[],quotes:[],locations:[{id:'L-1',name:'Main Warehouse'}],movements:[]
};

await test('live normalizer resolves Pool Shed productId links across stock, SOs, POs, receipts and supplier price rows',async()=>{
  const live=normalisePoolShedWorkspace(realisticRaw,{users:[liveUser],revision:50,updatedAt:'2026-09-29T21:30:00Z',today:'2026-09-29'});
  assert.equal(live.products['PB-LIVE-900'].onHand,7);
  assert.equal(live.salesOrders['SO-900'].lines[0].sku,'PB-LIVE-900');
  assert.equal(live.purchaseOrders['PO-900'].lines[0].sku,'PB-LIVE-900');
  assert.equal(live.goodsReceipts['GR-900'].lines[0].sku,'PB-LIVE-900');
  assert.equal(live.supplierOffers['SP-A'].poolSku,'PB-LIVE-900');
  assert.equal(live.supplierOffers['SP-A'].unitNet,205);
});
await test('Azzy gets complete live Sales Order detail with stock, fulfilment and linked PO context',async()=>{
  const live=buildAzzyPoolShedSnapshot({workspace:realisticRaw,user:liveUser,permissions:liveUser.permissions,revision:51,updatedAt:'2026-09-29T21:31:00Z',today:'2026-09-29'});
  const r=await withRuntimeData(live,()=>executeTool('get_sales_order',{salesOrderId:'SO-900'},liveUser));
  assert.equal(r.ok,true);assert.equal(r.data.status,'Part Stock');assert.equal(r.data.lines[0].sku,'PB-LIVE-900');
  assert.equal(r.data.lines[0].product.available,5);assert.equal(r.data.linkedPurchaseOrders[0].id,'PO-900');assert.equal(r.data.goodsNotes[0].id,'GN-900');
  assert.equal(r.data.workspaceUpdatedAt,'2026-09-29T21:31:00Z');
});
await test('Azzy gets complete live PO and product commercial context including current supplier comparisons',async()=>{
  const live=buildAzzyPoolShedSnapshot({workspace:realisticRaw,user:liveUser,permissions:liveUser.permissions,revision:52,updatedAt:'2026-09-29T21:32:00Z',today:'2026-09-29'});
  const po=await withRuntimeData(live,()=>executeTool('get_purchase_order',{poId:'PO-900'},liveUser));
  assert.equal(po.ok,true);assert.equal(po.data.outstanding[0].outstanding,2);assert.equal(po.data.linkedSalesOrders[0].id,'SO-900');assert.equal(po.data.receipts[0].id,'GR-900');
  const product=await withRuntimeData(live,()=>executeTool('get_product_record',{sku:'PB-LIVE-900'},liveUser));
  assert.equal(product.ok,true);assert.equal(product.data.rrp,399);assert.equal(product.data.trade,349);assert.equal(product.data.supplierOffers.length,2);assert.equal(product.data.bestSupplier.supplier,'Supplier Beta');
  const compare=await withRuntimeData(live,()=>executeTool('get_supplier_price_comparison',{query:'PB-LIVE-900',qty:2},liveUser));
  assert.equal(compare.ok,true);assert.equal(compare.data.best.supplier,'Supplier Beta');assert.equal(compare.data.best.unitNet,198);
});
await test('each new Azzy snapshot sees newly saved Pool Shed information instead of stale cached business data',async()=>{
  const before=buildAzzyPoolShedSnapshot({workspace:realisticRaw,user:liveUser,permissions:liveUser.permissions,revision:60,updatedAt:'2026-09-29T21:40:00Z',today:'2026-09-29'});
  const changed=structuredClone(realisticRaw);
  changed.salesOrders[0].status='Ready To Pick';
  changed.purchaseOrders[0].lines[0].received=3;
  changed.supplierProducts.find(x=>x.id==='SP-B').cost=187;
  const after=buildAzzyPoolShedSnapshot({workspace:changed,user:liveUser,permissions:liveUser.permissions,revision:61,updatedAt:'2026-09-29T21:41:00Z',today:'2026-09-29'});
  assert.equal(before.salesOrders['SO-900'].status,'Part Stock');assert.equal(after.salesOrders['SO-900'].status,'Ready To Pick');
  const so=await withRuntimeData(after,()=>executeTool('get_sales_order',{salesOrderId:'SO-900'},liveUser));assert.equal(so.data.status,'Ready To Pick');assert.equal(so.data.dataRevision,61);
  const po=await withRuntimeData(after,()=>executeTool('get_purchase_order',{poId:'PO-900'},liveUser));assert.equal(po.data.outstanding.length,0);
  const price=await withRuntimeData(after,()=>executeTool('get_supplier_price_comparison',{query:'PB-LIVE-900',qty:1},liveUser));assert.equal(price.data.best.unitNet,187);
});
await test('planner sends direct SO, PO, product detail and supplier price questions to the correct live tools',async()=>{
  const live=buildAzzyPoolShedSnapshot({workspace:realisticRaw,user:liveUser,permissions:liveUser.permissions,revision:62,today:'2026-09-29'});
  const so=deterministicPlan({message:'Tell me everything about sales order SO-900',contexts:[],history:[],db:live,user:liveUser});
  assert.equal(so.intent,'sales_order');assert.equal(so.tools[0].name,'get_sales_order');
  const po=deterministicPlan({message:'What is happening with PO-900?',contexts:[],history:[],db:live,user:liveUser});
  assert.equal(po.intent,'po');assert.equal(po.tools[0].name,'get_purchase_order');
  const product=deterministicPlan({message:'Tell me everything about product PB-LIVE-900',contexts:[],history:[],db:live,user:liveUser});
  assert.equal(product.intent,'product_detail');assert.equal(product.tools[0].name,'get_product_record');
  const price=deterministicPlan({message:'Who is cheapest for PB-LIVE-900?',contexts:[],history:[],db:live,user:liveUser});
  assert.equal(price.intent,'supplier_price');assert.equal(price.tools[0].name,'get_supplier_price_comparison');
});

console.log(`\nPool Shed ready: ${passed} passed, 0 failed`);
