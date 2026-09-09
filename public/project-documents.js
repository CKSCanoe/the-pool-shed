async function psProjectBlobStore(mode,key,value){
 return new Promise((resolve,reject)=>{const request=indexedDB.open('pool-shed-project-documents',1);request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('files',mode==='get'?'readonly':'readwrite'),store=tx.objectStore('files');const r=mode==='get'?store.get(key):store.put(value,key);let result;r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error||Error('File could not be stored'));};};});
}
function psProjectFileOwner(){return supabaseSession?.user?.id||currentUser().id;}
async function psProjectUploadFile(jobId,file,costId){
 if(!isAdminUser()||!canAccessTab('jobs'))throw Error('A project manager must add documents.');
 if(!['application/pdf','image/png','image/jpeg'].includes(file.type)||file.size>10*1024*1024||!file.size)throw Error('Choose a PDF, PNG or JPEG no larger than 10 MB.');
 const j=data.jobs.find(j=>j.id===jobId);if(!j)throw Error('Project not found');const p=psProjectModel(j);
 const bytes=await file.arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
 if(p.documents.some(d=>d.sha256===digest))throw Error('This file is already attached to the project.');
 const record={id:crypto.randomUUID(),name:file.name,type:file.type,size:file.size,sha256:digest,owner:psProjectFileOwner(),createdAt:new Date().toISOString(),reference:p.costs.find(c=>c.id===costId)?.ref||'',costId:costId||''};
 await psProjectBlobStore('put',WORKSPACE_ID+':'+record.owner+':'+record.id,file);
 p.documents.push(record);p.audit.push({id:crypto.randomUUID(),action:'document_added',at:record.createdAt,user:currentUser().name,details:{name:file.name,sha256:digest}});
 if(saveAppData()===false)throw Error('File is stored on this device but its project record could not be saved. Keep the original.');
 if(navigator.onLine&&supabaseSession?.access_token)try{await psProjectSyncDocuments(jobId);}catch{toast('Saved on this device. Shared upload is pending; check project storage setup.');}
 return record;
}
async function psProjectSyncDocuments(jobId){
 if(!isAdminUser()||!supabaseSession?.access_token||!supabaseClient||!navigator.onLine)throw Error('Sign in online as a project manager to share documents.');
 const j=data.jobs.find(j=>j.id===jobId);if(!j)throw Error('Project not found');
 for(const d of psProjectModel(j).documents.filter(d=>!d.storagePath)){
  if(d.owner!==psProjectFileOwner())continue;
  const file=await psProjectBlobStore('get',WORKSPACE_ID+':'+d.owner+':'+d.id);if(!file)throw Error('The local file is missing. Upload the original again.');
  const path=WORKSPACE_ID+'/'+encodeURIComponent(jobId)+'/'+d.id;
  const result=await supabaseClient.storage.from('project-documents').upload(path,file,{contentType:d.type,upsert:false});
  if(result.error&&String(result.error.statusCode)!=='409')throw Error('Private document upload failed. Check storage permissions.');
  if(result.error){const existing=await supabaseClient.storage.from('project-documents').download(path);if(existing.error)throw Error('Could not verify the existing upload');const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await existing.data.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('');if(digest!==d.sha256)throw Error('The shared file differs from this document.');}
  d.storagePath=path;if(saveAppData()===false)throw Error('Shared file uploaded but its local link could not be saved.');
 }
}
async function psProjectDownload(jobId,id){
 const d=data.jobs.find(j=>j.id===jobId)?.project?.documents.find(d=>d.id===id);if(!d)throw Error('Document not found');
 let file=d.owner===psProjectFileOwner()?await psProjectBlobStore('get',WORKSPACE_ID+':'+d.owner+':'+id):null;
 if(!file&&d.storagePath){if(!supabaseSession)throw Error('Sign in to download shared files.');const r=await supabaseClient.storage.from('project-documents').download(d.storagePath);if(r.error)throw Error('Document download failed');file=r.data;}
 if(!file)throw Error('This file is only on the device where it was uploaded.');
 const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=d.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
document.addEventListener('change',async e=>{if(e.target.id!=='psProjectFiles')return;const files=Array.from(e.target.files||[]),jobId=psProjectSelected,costId=document.getElementById('psProjectDocumentCost')?.value;e.target.disabled=true;try{for(const f of files)await psProjectUploadFile(jobId,f,costId);render();}catch(e){toast(e.message);render();}});
