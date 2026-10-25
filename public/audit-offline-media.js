/* Durable, device-local audit photographs awaiting secure Pool Shed upload. */
(function(global){
  'use strict';
  const media=global.PoolShedBusinessMedia;
  if(!media)return;
  const DB='pool-shed-audit-media-v1',STORE='photos',LOCAL=/^audit-local:[0-9a-f-]{36}$/i;
  const urls=new Map();
  const baseUrl=media.url,baseEnsure=media.ensure,baseRefsFrom=media.refsFrom;
  function open(){return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'ref'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||Error('Audit photo storage is unavailable.'));
  });}
  async function transaction(mode,operation){
    const db=await open();
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode),request=operation(tx.objectStore(STORE));
      let value;
      if(request){request.onsuccess=()=>{value=request.result;};request.onerror=()=>reject(request.error||Error('Audit photo storage failed.'));}
      tx.oncomplete=()=>resolve(value);
      tx.onerror=()=>reject(tx.error||Error('Audit photo storage failed.'));
      tx.onabort=()=>reject(tx.error||Error('Audit photo storage was interrupted.'));
    });}finally{db.close();}
  }
  const get=ref=>transaction('readonly',store=>store.get(ref));
  const all=()=>transaction('readonly',store=>store.getAll());
  const put=value=>transaction('readwrite',store=>store.put(value));
  async function queueAuditPhoto(customerId,auditId,itemId,file,meta){
    if(!customerId||!auditId||!file||!['image/jpeg','image/png'].includes(file.type)||file.size>6*1024*1024)throw Error('Select a customer and choose a JPEG or PNG smaller than 6 MB.');
    const ref='audit-local:'+crypto.randomUUID();
    const entry={ref,customerId,auditId,itemId,blob:file,name:file.name||'Pool Bros audit photograph',type:file.type,meta:meta||{},createdAt:new Date().toISOString(),uploadedRef:''};
    await put(entry);
    const confirmed=await get(ref);
    if(!confirmed||confirmed.blob.size!==file.size)throw Error('The photo was not saved on this device. Try again before leaving this screen.');
    urls.set(ref,URL.createObjectURL(file));
    return {ref};
  }
  async function ensureLocal(ref){
    if(urls.has(ref))return urls.get(ref);
    let entries;
    try{entries=LOCAL.test(ref)?[await get(ref)]:await all();}
    catch(error){if(LOCAL.test(ref))throw error;return '';}
    const entry=entries.find(row=>row&&(row.ref===ref||row.uploadedRef===ref));
    if(!entry)return '';
    const url=URL.createObjectURL(entry.blob);
    urls.set(ref,url);
    return url;
  }
  function refsFrom(value){
    const refs=baseRefsFrom(value);
    (function walk(item){
      if(typeof item==='string'&&LOCAL.test(item))refs.push(item);
      else if(Array.isArray(item))item.forEach(walk);
      else if(item&&typeof item==='object')Object.values(item).forEach(walk);
    })(value);
    return [...new Set(refs)];
  }
  async function ensure(refs){
    const list=[...new Set((refs||[]).map(String))];
    await Promise.all(list.map(ref=>ensureLocal(ref)));
    if(navigator.onLine)await baseEnsure(list.filter(media.secureRef));
    return Object.fromEntries(list.map(ref=>[ref,media.url(ref)]));
  }
  async function cacheAuditPhotos(value){
    if(!navigator.onLine)throw Error('Connect to download existing audit photographs.');
    for(const ref of refsFrom(value).filter(ref=>LOCAL.test(ref))){
      const saved=await get(ref);
      if(!saved||!saved.blob||!saved.blob.size)throw Error('A new audit photograph is missing from this iPad. Add it again before leaving site.');
    }
    const refs=baseRefsFrom(value);
    if(!refs.length)return 0;
    await baseEnsure(refs);
    let cached=0;
    for(const ref of refs){
      if(await ensureLocal(ref)){cached++;continue;}
      const source=baseUrl(ref);
      if(!source)throw Error('An existing audit photograph could not be opened for offline use.');
      const response=await fetch(source);
      if(!response.ok)throw Error('An existing audit photograph could not be downloaded.');
      const blob=await response.blob();
      if(!blob.size)throw Error('An existing audit photograph is empty.');
      const entry={ref,uploadedRef:ref,blob,name:'Audit photograph',type:blob.type||'image/jpeg',cachedAt:new Date().toISOString()};
      await put(entry);
      const verified=await get(ref);
      if(!verified||verified.blob.size!==blob.size)throw Error('An existing audit photograph could not be saved on this iPad.');
      urls.set(ref,URL.createObjectURL(blob));
      cached++;
    }
    return cached;
  }
  async function syncAuditPhotos(bridge){
    if(!navigator.onLine)return false;
    let entries;
    try{entries=await all();}
    catch(error){
      if(bridge.getAll().some(audit=>refsFrom(audit).some(ref=>LOCAL.test(ref))))throw error;
      return true;
    }
    for(const entry of entries){
      if(!LOCAL.test(entry.ref))continue;
      if(!bridge.isOfflinePhotoReferenced(entry.ref,entry.auditId,entry.customerId))continue;
      const uploaded=entry.uploadedRef ? {ref:entry.uploadedRef} : await media.upload('customer',entry.customerId,'site_photo',
        new File([entry.blob],entry.name,{type:entry.type}),entry.meta);
      if(!uploaded?.ref)throw Error('An audit photo did not upload. The device copy remains safe.');
      if(!entry.uploadedRef){entry.uploadedRef=uploaded.ref;await put(entry);}
      await bridge.replaceOfflinePhoto(entry.ref,uploaded.ref,entry.auditId,entry.customerId);
      if(urls.has(entry.ref))urls.set(uploaded.ref,urls.get(entry.ref));
    }
    return true;
  }
  media.queueAuditPhoto=queueAuditPhoto;
  media.cacheAuditPhotos=cacheAuditPhotos;
  media.syncAuditPhotos=syncAuditPhotos;
  media.isManagedRef=ref=>media.secureRef(ref)||LOCAL.test(String(ref||''));
  media.url=ref=>urls.get(ref)||baseUrl(ref);
  media.ensure=ensure;
  media.ensureValue=value=>ensure(refsFrom(value));
  media.refsFrom=refsFrom;
  media.pendingAuditPhotos=async bridge=>(await all()).filter(entry=>bridge.isOfflinePhotoReferenced(entry.ref,entry.auditId,entry.customerId)).length;
})(globalThis);
