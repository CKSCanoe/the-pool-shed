import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const canonical={suppliers:[],products:[],customers:[],locations:[{id:'seed-location',name:'Seed'}],jobs:[],purchaseOrders:[],salesOrders:[],goodsNotes:[],notifications:[],stock:[],restockRules:[],allocations:[],movements:[],engineerRequests:[],salesCredits:[],sales:[],supplierBills:[],productImportBatches:[]};
let saves=0;
const storage=new Map();
const ctx={console,Date,Math,Set,Map,Intl,crypto:{randomUUID:()=>`uuid-${Math.random()}`},globalThis:null,window:null,
  localStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)||null,get length(){return storage.size;},key:i=>[...storage.keys()][i]||null},
  __POOL_SHED_GET_DATA__:()=>canonical,__POOL_SHED_IS_ADMIN__:()=>true,saveAppData:()=>{saves++;}
};
ctx.globalThis=ctx;ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/legacy-migration-engine.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('public/legacy-recovery-engine.js','utf8'),ctx);
const legacy=ctx.PoolShedLegacyRecovery.fromSupabaseTables({
  suppliers:[{id:'sup-1',name:'Legacy Supplier',email:'supplier@example.com'}],
  customers:[{id:'cust-1',name:'Legacy Customer',email:'customer@example.com'}],
  projects:[{id:'job-1',customer_id:'cust-1',name:'Recovered Pool Project',status:'open'}],
  sales_orders:[{id:'so-1',sales_order_number:'SO-001',customer_id:'cust-1',project_id:'job-1',status:'draft'}],
  sales_order_items:[]
});
ctx.PoolShedLegacyMigration.discover=async()=>[{id:'normalized',label:'Legacy normalized tables',source:'Supabase tables',updatedAt:'2026-09-16T10:00:00Z',data:legacy}];
const result=await ctx.PoolShedLegacyAutoRecovery();
assert.equal(result.ok,true,'empty canonical workspace should automatically recover meaningful legacy records');
assert.equal(canonical.jobs.length,1,'recovered project must enter canonical jobs collection used by Projects');
assert.equal(canonical.jobs[0].name,'Recovered Pool Project');
assert.equal(canonical.customers.length,1);
assert.equal(canonical.salesOrders.length,1);
assert(canonical.suppliers.some(s=>s.name==='Legacy Supplier'),'direct legacy supplier must be retained');
assert.equal(saves,1,'automatic recovery must persist through canonical save path exactly once');
assert.equal(canonical.legacyMigrationHistory.length,1,'automatic recovery must record migration history');
const second=await ctx.PoolShedLegacyAutoRecovery();
assert.equal(second.ok,false,'automatic recovery must not apply twice');
assert.equal(saves,1,'second recovery attempt must not save again');
console.log('PASS v1.22 automatic normalized recovery populates Projects, Customers, Suppliers and Sales once');
