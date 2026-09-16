import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const current={suppliers:[],products:[],customers:[],locations:[],jobs:[],salesOrders:[],purchaseOrders:[],stock:[],allocations:[],movements:[],goodsNotes:[],engineerRequests:[],salesCredits:[],notifications:[],sales:[]};
const legacy={restockRules:[{id:'rr1',productId:'p1',locationId:'l1',min:2,max:10,restockTo:8,priority:'Critical'}],supplierBills:[{id:'bill1',supplier:'Certikin',gross:120}],productImportBatches:[{id:'ib1',sourceFilename:'catalog.csv',rowsTotal:100}]};
const ctx={console,globalThis:null,window:null,Date,Math,Set,Map,Intl,localStorage:{setItem(){},getItem(){return null},removeItem(){},length:0,key(){return null}}};ctx.globalThis=ctx;ctx.window=ctx;ctx.__POOL_SHED_GET_DATA__=()=>current;ctx.saveAppData=()=>{};vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/legacy-migration-engine.js','utf8'),ctx);
const preview=ctx.PoolShedLegacyMigration.plan(legacy,current,{source:'v122-test'});
assert.equal(preview.merged.restockRules.length,1,'restock rules must migrate');
assert.equal(preview.merged.supplierBills.length,1,'supplier bill history must migrate');
assert.equal(preview.merged.productImportBatches.length,1,'product import audit history must migrate');
console.log('PASS v1.22 extended recovery entities merge into canonical workspace');
