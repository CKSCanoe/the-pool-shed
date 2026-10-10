/* Pool Shed shared-master hardening.
   Keeps the existing workspace engine authoritative while making deletion
   conflicts fail-safe and forcing important changes to confirm remotely. */
(function(global){
  'use strict';

  const PENDING_KEY='poolshed:v172:pendingSync';
  const REMOTE_REVISION_KEY='poolshed:v172:remoteRevision';
  const LAST_CONFIRMED_KEY='poolshed:v172:lastConfirmedSharedSave';
  const STATUS_SELECTOR='select[data-po-status],select[data-order-field][data-field="status"]';
  const STATUS_ACTIONS=new Set(['save-workflow-status','move-workflow-status','remove-workflow-status','add-workflow-status']);
  let flushTimer=null;
  let flushPromise=null;
  let statusIntent=false;
  let warned=false;

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function equal(a,b){if(a===b)return true;try{return JSON.stringify(a)===JSON.stringify(b);}catch(_){return false;}}

  function stableArrayKey(item){
    if(!item||typeof item!=='object'||Array.isArray(item))return '';
    const candidates=['lineId','receiptLineId','_lineId','id','goodsNoteId','salesOrderId','purchaseOrderId','productId','sku','code','name'];
    for(const key of candidates){
      if(typeof item[key]!=='undefined'&&item[key]!==null&&String(item[key])!=='')return key+':'+String(item[key]);
    }
    return '';
  }

  function canMergeArrays(values){
    const arrays=values.filter(Array.isArray);
    if(!arrays.length)return false;
    return arrays.every(list=>{
      if(!list.length)return true;
      const keys=list.map(stableArrayKey);
      return keys.every(Boolean)&&new Set(keys).size===keys.length;
    });
  }

  /* Three-way merge with deletion authority.
     Both local and remote deletions beat stale edits. The caller preserves the
     unsynced local snapshot in Recovery before this function runs, so nothing
     is silently destroyed while deleted live records cannot be resurrected. */
  function mergeValue(base,local,remote,path,conflicts){
    conflicts=conflicts||[];
    if(equal(local,base))return clone(remote);
    if(equal(remote,base))return clone(local);
    if(equal(local,remote))return clone(local);

    const localObj=local&&typeof local==='object'&&!Array.isArray(local);
    const remoteObj=remote&&typeof remote==='object'&&!Array.isArray(remote);
    const baseObj=base&&typeof base==='object'&&!Array.isArray(base);

    if(Array.isArray(local)&&Array.isArray(remote)&&Array.isArray(base)&&canMergeArrays([base,local,remote])){
      const baseMap=new Map(base.map(item=>[stableArrayKey(item),item]));
      const localMap=new Map(local.map(item=>[stableArrayKey(item),item]));
      const remoteMap=new Map(remote.map(item=>[stableArrayKey(item),item]));
      const order=[];
      remote.forEach(item=>{const key=stableArrayKey(item);if(key&&!order.includes(key))order.push(key);});
      local.forEach(item=>{const key=stableArrayKey(item);if(key&&!order.includes(key))order.push(key);});
      const merged=[];
      order.forEach(key=>{
        const hasBase=baseMap.has(key),hasLocal=localMap.has(key),hasRemote=remoteMap.has(key);
        const b=baseMap.get(key),l=localMap.get(key),r=remoteMap.get(key);
        const itemPath=(path||'workspace')+'['+key+']';
        if(!hasBase){
          if(hasLocal&&hasRemote)merged.push(mergeValue({},l,r,itemPath,conflicts));
          else if(hasLocal)merged.push(clone(l));
          else if(hasRemote)merged.push(clone(r));
          return;
        }
        if(!hasLocal&&!hasRemote)return;
        if(!hasLocal&&hasRemote){
          if(!equal(r,b))conflicts.push(itemPath+' deleted locally / changed remotely · deletion retained');
          return;
        }
        if(hasLocal&&!hasRemote){
          if(!equal(l,b))conflicts.push(itemPath+' changed locally / deleted remotely · shared deletion retained');
          return;
        }
        merged.push(mergeValue(b,l,r,itemPath,conflicts));
      });
      return merged;
    }

    if(localObj&&remoteObj&&baseObj){
      const result={};
      const keys=new Set(Object.keys(base).concat(Object.keys(local),Object.keys(remote)));
      keys.forEach(key=>{
        const hasBase=Object.prototype.hasOwnProperty.call(base,key);
        const hasLocal=Object.prototype.hasOwnProperty.call(local,key);
        const hasRemote=Object.prototype.hasOwnProperty.call(remote,key);
        const fieldPath=(path?path+'.':'')+key;
        if(!hasBase){
          if(hasLocal&&hasRemote)result[key]=mergeValue({},local[key],remote[key],fieldPath,conflicts);
          else if(hasLocal)result[key]=clone(local[key]);
          else if(hasRemote)result[key]=clone(remote[key]);
          return;
        }
        if(!hasLocal&&!hasRemote)return;
        if(!hasLocal&&hasRemote){
          if(!equal(remote[key],base[key]))conflicts.push(fieldPath+' deleted locally / changed remotely · deletion retained');
          return;
        }
        if(hasLocal&&!hasRemote){
          if(!equal(local[key],base[key]))conflicts.push(fieldPath+' changed locally / deleted remotely · shared deletion retained');
          return;
        }
        result[key]=mergeValue(base[key],local[key],remote[key],fieldPath,conflicts);
      });
      return result;
    }

    conflicts.push(path||'workspace');
    return clone(local);
  }

  global.workspaceStableArrayKey=stableArrayKey;
  global.workspaceArrayCanMergeByKey=canMergeArrays;
  global.workspaceMergeValue=mergeValue;

  function pending(){try{return localStorage.getItem(PENDING_KEY)==='1';}catch(_){return false;}}
  function toastMessage(message){try{if(typeof global.toast==='function')global.toast(message);}catch(_){}}

  async function flushShared(label,notifySuccess){
    if(flushPromise)return flushPromise;
    flushPromise=(async()=>{
      if(!pending()){
        if(notifySuccess&&label)toastMessage(label+' saved for everyone.');
        return true;
      }
      if(!navigator.onLine)return false;
      for(let attempt=0;attempt<3;attempt+=1){
        try{
          const fn=typeof global.flushSharedWorkspaceSave==='function'?global.flushSharedWorkspaceSave:null;
          const ok=fn?await fn(''):false;
          if(ok&&!pending()){
            try{localStorage.setItem(LAST_CONFIRMED_KEY,new Date().toISOString());}catch(_){}
            warned=false;
            if(notifySuccess&&label)toastMessage(label+' saved for everyone.');
            return true;
          }
        }catch(error){console.warn('One-truth shared save retry failed',error);}
        await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));
      }
      if(!warned){
        warned=true;
        toastMessage((label||'Change')+' is safe locally but has not been confirmed in the shared master yet. Keep Pool Shed open while it retries.');
      }
      return false;
    })();
    try{return await flushPromise;}finally{flushPromise=null;}
  }

  function scheduleFlush(options){
    const opts=options||{};
    if(opts.status)statusIntent=true;
    clearTimeout(flushTimer);
    flushTimer=setTimeout(async()=>{
      flushTimer=null;
      const notify=statusIntent;
      statusIntent=false;
      await flushShared(notify?'Status':'Workspace change',notify);
    },opts.immediate?40:850);
  }

  const originalSave=typeof global.saveAppData==='function'?global.saveAppData:null;
  if(originalSave){
    global.saveAppData=function(){
      const result=originalSave.apply(this,arguments);
      scheduleFlush({immediate:false});
      return result;
    };
  }

  document.addEventListener('change',event=>{
    const target=event.target;
    if(target&&target.matches&&target.matches(STATUS_SELECTOR))scheduleFlush({status:true,immediate:true});
  });

  document.addEventListener('click',event=>{
    const action=event.target&&event.target.closest&&event.target.closest('[data-settings-action]');
    if(action&&STATUS_ACTIONS.has(String(action.dataset.settingsAction||'')))scheduleFlush({status:true,immediate:true});
  });

  window.addEventListener('online',()=>{if(pending())scheduleFlush({immediate:true});});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'&&pending())scheduleFlush({immediate:true});
  });
  window.addEventListener('pagehide',()=>{
    try{if(pending()&&navigator.onLine&&typeof global.saveRemoteWorkspace==='function')global.saveRemoteWorkspace(false);}catch(_){}
  });

  global.PoolShedOneTruth={
    version:'1.0.0',
    mergeValue,
    stableArrayKey,
    flush:flushShared,
    inspect(){
      let data={};try{data=global.__POOL_SHED_GET_DATA__?global.__POOL_SHED_GET_DATA__():(global.data||{});}catch(_){}
      return {
        pending:pending(),
        remoteRevision:localStorage.getItem(REMOTE_REVISION_KEY)||'',
        localRevision:localStorage.getItem('poolshed:v172:localRevision')||'',
        lastConfirmedSharedSave:localStorage.getItem(LAST_CONFIRMED_KEY)||'',
        purchaseOrders:Array.isArray(data.purchaseOrders)?data.purchaseOrders.length:0,
        salesOrders:Array.isArray(data.salesOrders)?data.salesOrders.length:0
      };
    }
  };
})(typeof globalThis!=='undefined'?globalThis:window);
