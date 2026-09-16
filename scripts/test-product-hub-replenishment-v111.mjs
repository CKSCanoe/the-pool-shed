import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
assert(fs.existsSync('public/product-hub-engine.js'),'Product Hub engine must exist');
const data={
 products:[{id:'P1',sku:'VALVE',name:'Valve',supplier:'Certikin',supplierSku:'V-1',productType:'Stocked Product',cost:10,rrp:20,reorder:5,restockTo:20,replenishmentEnabled:true,preferredSupplier:'Certikin'}],
 stock:[{productId:'P1',locationId:'L1',qty:6,allocated:3}],
 supplierProducts:[{productId:'P1',supplier:'Certikin',supplierSku:'V-1',cost:10,minQty:10,packQty:5,leadTimeDays:4,available:true}],
 purchaseOrders:[{id:'PO-1',supplier:'Certikin',status:'Supplier Confirmed',lines:[{productId:'P1',qty:8,received:3}]}],
 salesOrders:[{id:'SO-1',status:'Needs Review',lines:[{productId:'P1',qty:10,allocated:2,shipped:0}]}],
 engineerRequests:[],jobs:[],locations:[{id:'L1',name:'Main Warehouse',type:'Warehouse',isMaster:true}],restockRules:[]
};
const ctx={console,globalThis:null,window:null,Math,Date,Set,Map,Intl};ctx.globalThis=ctx;ctx.window=ctx;ctx.__POOL_SHED_GET_DATA__=()=>data;ctx.productStockSummary=()=>({onHand:6,allocated:3,available:3});ctx.saveAppData=()=>true;
vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/product-hub-engine.js','utf8'),ctx);const hub=ctx.PoolShedProductHub;
let row=hub.replenishmentRow('P1');
assert.equal(row.available,3);assert.equal(row.inbound,5);assert.equal(row.demand,8);assert.equal(row.projectedAvailable,0);
assert.equal(row.reorderPoint,5);assert.equal(row.targetStock,20);assert.equal(row.moq,10);assert.equal(row.orderMultiple,5);assert.equal(row.suggestedQty,20,'suggestion should reach target and respect supplier pack multiple');
// Existing inbound must prevent needless over-ordering when it is enough.
data.purchaseOrders[0].lines[0].qty=35;row=hub.replenishmentRow('P1');assert.equal(row.inbound,32);assert.equal(row.projectedAvailable,27);assert.equal(row.suggestedQty,0);
// Restore shortage and create supplier draft.
data.purchaseOrders[0].lines[0].qty=8;row=hub.replenishmentRow('P1');const created=hub.createDraftPurchaseOrders([{productId:'P1',qty:row.suggestedQty}]);
assert.equal(created.length,1);assert.equal(created[0].status,'Draft - Review');assert.equal(created[0].supplier,'Certikin');assert.equal(created[0].lines[0].supplierSku,'V-1');assert.equal(created[0].lines[0].qty,20);assert.equal(created[0].source,'Product Hub replenishment');
const again=hub.createDraftPurchaseOrders([{productId:'P1',qty:5}]);assert.equal(again[0].id,created[0].id,'same supplier should merge into existing safe draft');assert.equal(created[0].lines[0].qty,25);
console.log('PASS Product Hub replenishment projected stock, MOQ/multiple and draft PO creation');
