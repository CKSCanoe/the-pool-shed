import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const governance=fs.readFileSync('public/assets/js/03-pb-import-governance-v192.js','utf8');

assert.match(governance,/Saving to shared workspace…/,'bulk import must visibly wait for the shared save');
assert.match(governance,/Shared workspace save confirmed/,'bulk import success must only be reported after shared persistence');
assert.match(governance,/data-retry-import-sync/,'failed shared imports need an in-product retry action');
assert.match(governance,/status='Pending sync'/,'failed shared import must remain explicitly pending');
assert.match(governance,/await persistImportBatchToSharedWorkspace\(batch,snapshots\)/,'bulk commit must await shared persistence');
assert.match(governance,/persistProducts:persistProductSnapshotsToSharedWorkspace/,'all product-file update paths need the shared persistence helper');
assert.doesNotMatch(
  governance,
  /changes\.push\(\{productId:after\.id,sku:after\.sku,changeType:[^}]+after:cloneValue\(after\)/,
  'audit history must not duplicate every full imported product snapshot into the workspace'
);
assert.match(legacy,/await window\.PoolShedProductImportPersistence\.persistProducts\(changedProducts, file\.name \|\| "Product CSV import"\)/,'price/stock product CSV must await shared persistence');
assert.match(legacy,/await window\.PoolShedProductImportPersistence\.persistProducts\(changedProducts, file\.name \|\| "Catalogue Health correction CSV"\)/,'Catalogue Health CSV must await shared persistence');

const start=governance.indexOf('  function waitForWorkspaceSaveIdle(');
const end=governance.indexOf('  bindBulkProductCreate=function(){',start);
assert(start>0&&end>start,'shared product import persistence helpers not found');
const helperSource=governance.slice(start,end);

const importedCount=6266;
const snapshots=Array.from({length:importedCount},(_,i)=>({
  id:'P-IMPORT-'+i,
  sku:'CERT-'+String(i).padStart(5,'0'),
  name:'Imported product '+i,
  supplier:'Certikin',
  category:'Imported',
  cost:10+i/100,
  trade:20+i/100,
  rrp:30+i/100
}));
const batch={
  id:'IMP-TEST',
  status:'Saving',
  fileName:'Certikin.csv',
  changes:snapshots.map(p=>({productId:p.id,sku:p.sku,changeType:'created',before:null}))
};

let saveAttempts=0;
let localSaves=0;
let offlineWrites=0;
const context={
  data:{products:[{id:'P-REMOTE',sku:'REMOTE-1',name:'Remote existing'}],productImportBatches:[]},
  cloneValue:v=>JSON.parse(JSON.stringify(v)),
  saveAppData(){localSaves+=1;return true;},
  writeOfflineSnapshot:async()=>{offlineWrites+=1;return true;},
  saveRemoteWorkspace:async()=>{
    saveAttempts+=1;
    if(saveAttempts===1){
      // Simulate another user winning the first shared revision. The core saver
      // reloads their newer master before returning false.
      context.data={
        products:[
          {id:'P-REMOTE',sku:'REMOTE-1',name:'Remote existing'},
          {id:'P-OTHER',sku:'OTHER-USER',name:'Other user product'}
        ],
        productImportBatches:[]
      };
      return false;
    }
    return true;
  },
  workspaceSaveInFlight:false,
  remoteSaveTimer:null,
  navigator:{onLine:true},
  supabaseClient:{},
  supabaseSession:{user:{id:'U1'}},
  window:{},
  setTimeout(fn){fn();return 1;},
  clearTimeout(){},
  Date,
  Map,
  Set,
  Promise,
  console
};
context.imports=()=>{
  if(!Array.isArray(context.data.productImportBatches))context.data.productImportBatches=[];
  return context.data.productImportBatches;
};
vm.createContext(context);
vm.runInContext(helperSource,context);

const ok=await context.persistImportBatchToSharedWorkspace(batch,snapshots);
assert.equal(ok,true,'product import should retry after a shared revision conflict');
assert.equal(saveAttempts,2,'product import should retry the shared save after conflict');
assert(localSaves>=2,'each product import attempt must create a durable local pending snapshot');
assert(offlineWrites>=2,'large imports must be protected in IndexedDB while saving');
assert.equal(batch.status,'Completed','verified shared import should finish as Completed');
assert.equal(context.data.products.filter(p=>String(p.sku).startsWith('CERT-')).length,importedCount,'all 6,266 imported products must survive conflict rebasing');
assert(context.data.products.some(p=>p.sku==='OTHER-USER'),'other-user shared changes must survive import rebasing');
assert(context.data.productImportBatches.some(b=>b.id==='IMP-TEST'),'import audit batch must survive conflict rebasing');

const persistedBatch=context.data.productImportBatches.find(b=>b.id==='IMP-TEST');
assert(persistedBatch.changes.every(c=>!Object.prototype.hasOwnProperty.call(c,'after')),'import audit must not duplicate full after-product payloads');

console.log('PASS 6,266-row product imports are locally protected, conflict-rebased, retried and confirmed in the shared workspace');