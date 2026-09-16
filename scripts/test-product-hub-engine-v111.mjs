import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

assert(fs.existsSync('public/product-hub-engine.js'),'Product Hub engine must exist');
const data={
 products:[
  {id:'P1',sku:'PB-VALVE-15',name:'1.5 inch Ball Valve',supplier:'Certikin',supplierSku:'C-VALVE-150',barcode:'501111',mpn:'VAL15',aliases:['Old Valve Code'],brand:'Cepex',category:'Valves',productType:'Stocked Product',cost:20,rrp:40,reorder:5,restockTo:20,replenishmentEnabled:true,preferredSupplier:'Certikin'},
  {id:'P2',sku:'PB-TUBE',name:'Chlorine Tube',supplier:'Lighthouse',supplierSku:'100509',productType:'Stocked Product',cost:2,rrp:5,reorder:2,restockTo:10,replenishmentEnabled:true},
  {id:'B1',sku:'PB-KIT',name:'Dosing Kit',productType:'Bundle / Kit',bundleEnabled:true,rrp:120,bundleItems:[{productId:'P1',qty:2},{productId:'P2',qty:5}]},
  {id:'B2',sku:'PB-NESTED',name:'Nested Kit',productType:'Bundle / Kit',bundleEnabled:true,rrp:200,bundleItems:[{productId:'B1',qty:1}]}
 ],
 stock:[{productId:'P1',locationId:'L1',qty:9,allocated:3},{productId:'P2',locationId:'L1',qty:12,allocated:2}],
 supplierProducts:[{productId:'P1',supplier:'Certikin',supplierSku:'C-VALVE-150',cost:20,minQty:10,packQty:5,leadTimeDays:4,available:true}],
 purchaseOrders:[],salesOrders:[],engineerRequests:[],jobs:[],locations:[{id:'L1',name:'Main Warehouse',type:'Warehouse',isMaster:true}],restockRules:[]
};
const ctx={console,globalThis:null,window:null,Math,Date,Set,Map,Intl};ctx.globalThis=ctx;ctx.window=ctx;ctx.__POOL_SHED_GET_DATA__=()=>data;ctx.productStockSummary=(id)=>{const rows=data.stock.filter(r=>r.productId===id);const onHand=rows.reduce((n,r)=>n+r.qty,0),allocated=rows.reduce((n,r)=>n+r.allocated,0);return {onHand,allocated,available:onHand-allocated};};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/product-hub-engine.js','utf8'),ctx);
const hub=ctx.PoolShedProductHub;
assert(hub,'PoolShedProductHub API missing');
assert.equal(hub.search('c-valve-150')[0].id,'P1','supplier SKU search should find exact product');
assert.equal(hub.search('old valve code')[0].id,'P1','alias search should find product');
assert.equal(hub.search('VAL15')[0].id,'P1','MPN search should find product');
const metrics=hub.bundleMetrics(data.products[2]);
assert.equal(metrics.valid,true);
assert.equal(metrics.buildable,2,'bundle buildability must use limiting component Available stock');
assert.equal(metrics.componentCost,50,'bundle cost must use live component costs');
assert.equal(hub.bundleMetrics(data.products[3]).valid,false,'nested bundles must be rejected');
assert(hub.bundleMetrics(data.products[3]).errors.some(e=>/nested/i.test(e)));
console.log('PASS Product Hub engine universal search and existing-SKU bundle rules');
