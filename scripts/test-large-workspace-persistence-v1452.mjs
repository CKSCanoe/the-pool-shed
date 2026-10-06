import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const helperStart=src.indexOf('      function cacheWorkspaceLocally(');
const helperEnd=src.indexOf('      function normalizeAddress',helperStart);
const saveStart=src.indexOf('      function saveAppData()');
const saveEnd=src.indexOf('      function loadAppData()',saveStart);
assert(helperStart>0&&helperEnd>helperStart&&saveStart>0&&saveEnd>saveStart);

const store={};
let queued=0,offlineWrites=0,statusUpdates=0,toasts=0;
const localStorage={
  getItem:key=>Object.prototype.hasOwnProperty.call(store,key)?store[key]:null,
  setItem(key,value){
    if(key==='poolshed:v172:appData'){
      const error=new Error('QuotaExceededError');
      error.name='QuotaExceededError';
      throw error;
    }
    store[key]=String(value);
  },
  removeItem:key=>{delete store[key];}
};

const context={
  WORKSPACE_LOCALSTORAGE_SAFE_CHARS:10_000_000,
  localStorage,
  data:{products:Array.from({length:7000},(_,i)=>({id:'P-'+i,sku:'SKU-'+i,name:'Large imported product '+i}))},
  normalizeAppData:d=>d,
  workspaceLocalRevisionCounter:0,
  workspaceLocalSaveFailed:false,
  offlineSaveTimer:null,
  clearTimeout(){},
  setTimeout(fn){fn();return 1;},
  writeOfflineSnapshot:async pending=>{offlineWrites+=pending?1:100;return true;},
  updateOfflineStatus:()=>{statusUpdates+=1;},
  queueRemoteWorkspaceSave:()=>{queued+=1;},
  toast:()=>{toasts+=1;},
  console
};
vm.createContext(context);
vm.runInContext(src.slice(helperStart,helperEnd)+'\n'+src.slice(saveStart,saveEnd),context);

assert.equal(context.saveAppData(),true);
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(store['poolshed:v172:pendingSync'],'1');
assert.equal(store['poolshed:v172:localSnapshotMode'],'indexeddb');
assert.equal(store['poolshed:v172:appData'],undefined);
assert.equal(store['poolshed:v172:localRevision'],'1');
assert.equal(offlineWrites,1);
assert.equal(queued,1);
assert.equal(context.workspaceLocalSaveFailed,false);
assert.equal(toasts,0);
assert(statusUpdates>=1);

const bootStart=src.indexOf('      async function bootApp()');
const getSession=src.indexOf('supabaseClient.auth.getSession()',bootStart);
const restore=src.indexOf('await restoreOfflineSnapshotIfNeeded()',bootStart);
assert(restore>bootStart&&restore<getSession,'Durable snapshot must restore before remote workspace reconciliation');

console.log('PASS large product imports survive localStorage quota via IndexedDB and restore before shared sync');