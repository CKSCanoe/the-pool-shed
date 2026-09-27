import { AsyncLocalStorage } from 'node:async_hooks';
import { store as demoStore } from './demo-store.js';

const scope=new AsyncLocalStorage();
const defaultProvider=()=>demoStore.snapshot();

function assertSnapshot(db){
  if(!db||typeof db!=='object')throw new Error('Azzy data provider returned no Pool Shed snapshot.');
  for(const key of ['meta','users','projects','products','salesOrders','purchaseOrders'])if(!(key in db))throw new Error(`Azzy data snapshot is missing ${key}.`);
  return db;
}

export function snapshot(){
  const current=scope.getStore();
  return assertSnapshot(current?.db||defaultProvider());
}

export function currentUser(userId){
  const db=snapshot(),users=db.users||{},requested=users[userId];
  if(requested)return requested;
  const first=Object.values(users)[0];
  if(!first)throw new Error('No authorised Pool Shed user is available to Azzy.');
  return first;
}



export function withRuntimeData(db,fn,{actionExecutor=null}={}){
  assertSnapshot(db);
  if(typeof fn!=='function')throw new Error('Azzy runtime callback is required.');
  return scope.run({db,actionExecutor:typeof actionExecutor==='function'?actionExecutor:null},fn);
}

export function actionExecutor(){return scope.getStore()?.actionExecutor||null;}
export function isSandbox(){return (snapshot().meta?.mode||'unknown')==='sandbox';}
export function demoStoreForDevelopment(){return demoStore;}
