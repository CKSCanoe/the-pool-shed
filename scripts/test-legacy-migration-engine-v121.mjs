import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

assert(fs.existsSync('public/legacy-migration-engine.js'),'legacy migration engine must exist');

const current={
  products:[
    {id:'P-CUR',sku:'PB-1',name:'Current Pump',supplier:'Certikin',supplierSku:'SUP-1',barcode:'111',cost:120,rrp:220,description:'',aliases:[]},
    {id:'P-DUP-A',sku:'PB-DUP-A',name:'Dup A',supplier:'Other',supplierSku:'DUP-77',cost:10},
    {id:'P-DUP-B',sku:'PB-DUP-B',name:'Dup B',supplier:'Other',supplierSku:'DUP-77',cost:11}
  ],
  customers:[{id:'C-CUR',code:'C-CUR',name:'Current Customer Ltd',email:'office@example.com',phone:'',addresses:{primary:{postcode:'HR1 1AA'}}}],
  suppliers:[{id:'SUP-CERT',name:'Certikin',creditLimit:10000}],
  locations:[{id:'L1',name:'Main Warehouse',type:'Warehouse',isMaster:true}],
  jobs:[],
  salesOrders:[{id:'SO-1',customerId:'C-CUR',status:'Ready To Pick',notes:'Current note',lines:[{id:'SOL-1',productId:'P-CUR',qty:1,price:220}]}],
  purchaseOrders:[{id:'PO-1',supplier:'Certikin',status:'Open',lines:[{id:'POL-1',productId:'P-CUR',qty:2,received:0}]}],
  stock:[{productId:'P-CUR',locationId:'L1',qty:5,allocated:1}],
  allocations:[],
  movements:[{id:'M-1',type:'Goods In',productId:'P-CUR',qty:5,to:'L1',ref:'PO-1'}],
  goodsNotes:[], engineerRequests:[], salesCredits:[], notifications:[], sales:[]
};

const legacy={
  products:[
    {id:'OLD-P1',sku:'PB-1',name:'Old Pump Name',supplier:'Certikin',supplierSku:'SUP-1',barcode:'111',cost:80,rrp:180,description:'Useful old technical description'},
    {id:'OLD-P2',sku:'PB-2',name:'Legacy Valve',supplier:'Lighthouse Pools',supplierSku:'LHP-2',barcode:'222',cost:15,rrp:35},
    {id:'OLD-CONFLICT',sku:'',name:'Ambiguous legacy item',supplier:'Other',supplierSku:'DUP-77',cost:9}
  ],
  customers:[
    {id:'OLD-C1',code:'OLD-C1',name:'Old Customer Name',email:'office@example.com',phone:'01432000000',addresses:{primary:{postcode:'HR1 1AA'}}},
    {id:'OLD-C2',code:'OLD-C2',name:'New Legacy Customer',email:'new@example.com',phone:'07000000000',addresses:{primary:{postcode:'WR1 2BB'}}}
  ],
  locations:[
    {id:'OLD-L1',name:'Main Warehouse',type:'Warehouse'},
    {id:'OLD-L2',name:'Legacy Van',type:'Van'}
  ],
  jobs:[{id:'JOB-OLD',customerId:'OLD-C2',name:'Legacy Pool Job',status:'Active'}],
  salesOrders:[
    {id:'SO-1',customerId:'OLD-C1',status:'Shipped',legacyRef:'KEEP-ME',lines:[{id:'SOL-1',productId:'OLD-P1',qty:1,price:180},{id:'SOL-LEGACY-EXTRA',productId:'OLD-P2',qty:2,price:35}]},
    {id:'SO-2',customerId:'OLD-C2',status:'New Order',lines:[{id:'SOL-2',productId:'OLD-P2',qty:3,price:35}]}
  ],
  purchaseOrders:[
    {id:'PO-1',supplier:'Certikin',status:'Received',legacyMemo:'historic',lines:[{id:'POL-1',productId:'OLD-P1',qty:2,received:2}]},
    {id:'PO-2',supplier:'Lighthouse Pools',status:'Open',lines:[{id:'POL-2',productId:'OLD-P2',qty:4,received:1}]}
  ],
  stock:[
    {productId:'OLD-P1',locationId:'OLD-L1',qty:99,allocated:10},
    {productId:'OLD-P2',locationId:'OLD-L2',qty:3,allocated:0}
  ],
  allocations:[{id:'A-2',jobId:'JOB-OLD',productId:'OLD-P2',fromLocationId:'OLD-L2',qty:1,status:'Allocated'}],
  movements:[
    {id:'M-1',type:'Goods In',productId:'OLD-P1',qty:5,to:'OLD-L1',ref:'PO-1'},
    {id:'M-2',type:'Transfer',productId:'OLD-P2',qty:1,from:'OLD-L2',to:'OLD-L1',ref:'JOB-OLD'}
  ],
  goodsNotes:[], engineerRequests:[], salesCredits:[], notifications:[], sales:[{id:'SALE-LEG-1',customerId:'OLD-C2',productId:'OLD-P2',qty:2,total:70,date:'2026-06-01'}]
};

const ctx={console,globalThis:null,window:null,Date,Math,Set,Map,Intl,structuredClone,localStorage:{_m:new Map(),setItem(k,v){this._m.set(k,v)},getItem(k){return this._m.get(k)||null},removeItem(k){this._m.delete(k)},key(i){return [...this._m.keys()][i]||null},get length(){return this._m.size}}};
ctx.globalThis=ctx;ctx.window=ctx;ctx.__POOL_SHED_GET_DATA__=()=>current;ctx.saveAppData=()=>{ctx.saved=true};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/legacy-migration-engine.js','utf8'),ctx);
const mig=ctx.PoolShedLegacyMigration;
assert(mig,'PoolShedLegacyMigration API missing');

const preview=mig.plan(legacy,current,{source:'test'});
assert(preview&&preview.merged&&preview.report,'plan must return merged preview and report');

const pump=preview.merged.products.find(p=>p.id==='P-CUR');
assert.equal(pump.name,'Current Pump','current product name must win');
assert.equal(pump.cost,120,'current product cost must not be overwritten');
assert.equal(pump.description,'Useful old technical description','blank current product field should be enriched from legacy');
assert(preview.mappings.products['OLD-P1']==='P-CUR','legacy product ID must map to current product ID');
assert(preview.merged.products.some(p=>p.sku==='PB-2'),'new legacy product must be added');
assert(!preview.merged.products.some(p=>p.name==='Ambiguous legacy item'),'ambiguous product must not be created silently');
assert(preview.report.conflicts.some(c=>c.entity==='products'&&c.legacyId==='OLD-CONFLICT'),'ambiguous product must be reported as conflict');

const customer=preview.merged.customers.find(c=>c.id==='C-CUR');
assert.equal(customer.name,'Current Customer Ltd','current customer name must win');
assert.equal(customer.phone,'01432000000','blank current customer field should be enriched');
assert(preview.merged.customers.some(c=>c.email==='new@example.com'),'new legacy customer must be added');

assert(preview.merged.suppliers.some(s=>s.name==='Certikin'),'existing supplier must remain');
assert(preview.merged.suppliers.some(s=>s.name==='Lighthouse Pools'),'supplier must be derived from legacy product/PO data');

const currentStock=preview.merged.stock.find(s=>s.productId==='P-CUR'&&s.locationId==='L1');
assert.equal(currentStock.productId,'P-CUR'); assert.equal(currentStock.locationId,'L1'); assert.equal(currentStock.qty,5); assert.equal(currentStock.allocated,1,'legacy stock must never be added onto existing current balance');
const legacyStock=preview.merged.stock.find(s=>s.productId===preview.mappings.products['OLD-P2']&&s.locationId===preview.mappings.locations['OLD-L2']);
assert.equal(legacyStock.qty,3,'absent legacy product/location balance should be introduced');

const so1=preview.merged.salesOrders.find(o=>o.id==='SO-1');
assert.equal(so1.status,'Ready To Pick','existing order status must not be overwritten');
assert.equal(so1.legacyRef,'KEEP-ME','blank current order field may be enriched');
assert(so1.lines.some(l=>l.id==='SOL-LEGACY-EXTRA'),'missing historical order line should be added');
const so2=preview.merged.salesOrders.find(o=>o.id==='SO-2');
assert.equal(so2.customerId,preview.mappings.customers['OLD-C2'],'new order customer link must be remapped');
assert.equal(so2.lines[0].productId,preview.mappings.products['OLD-P2'],'new order product link must be remapped');

assert.equal(preview.merged.movements.filter(m=>m.id==='M-1').length,1,'duplicate movement must not be duplicated');
assert(preview.merged.movements.some(m=>m.id==='M-2'),'missing movement history should be added');
assert(preview.merged.sales.some(x=>x.id==='SALE-LEG-1'),'legacy standalone sales history should be retained');
assert.equal(preview.merged.sales[0].customerId,preview.mappings.customers['OLD-C2']);
assert.equal(preview.merged.sales[0].productId,preview.mappings.products['OLD-P2']);
assert(preview.report.entities.products.created>=1);
assert(preview.report.entities.products.matched>=1);
assert(preview.report.entities.stock.skipped>=1,'existing current stock balance should be counted as skipped');

const before=JSON.stringify(current);
const applied=mig.apply(legacy,{source:'test-source'});
assert(applied.ok,'apply should succeed');
assert(ctx.saved,'apply must save through normal Pool Shed persistence');
assert.notEqual(JSON.stringify(current),before,'apply must mutate the canonical current object in place');
assert(Array.isArray(current.legacyMigrationHistory)&&current.legacyMigrationHistory.length===1,'migration audit history must be recorded');
assert(applied.backup&&applied.backup.data,'apply must return a complete pre-migration backup');
assert([...ctx.localStorage._m.keys()].some(k=>k.startsWith('poolshed:v12') && k.includes(':migrationBackup:')),'pre-migration backup must be persisted locally when possible');

console.log('PASS v1.21 legacy migration merge safety, conflict handling, backup and apply');

// Legacy source discovery contract.
ctx.localStorage.setItem('poolbros:system:appData',JSON.stringify({products:[{id:'OLD-A',sku:'OLD-A'}]}));
ctx.localStorage.setItem('poolbros:user-aaron:appData',JSON.stringify({customers:[{id:'OLD-C'}]}));
assert.equal(typeof mig.detectLocalStorage,'function','migration engine must detect legacy browser storage');
const localSources=mig.detectLocalStorage(ctx.localStorage);
assert.equal(localSources.length,2,'system and per-user legacy appData snapshots should be discovered');
assert(localSources.some(x=>x.id.includes('poolbros:system:appData')));

const legacyRuntime=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
assert(legacyRuntime.includes('__POOL_SHED_READ_LEGACY_REMOTE__'),'canonical runtime must expose a read-only legacy Supabase snapshot bridge');
