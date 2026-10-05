(function(){
'use strict';
const APP_KEY='poolshed:v172:appData',PENDING_KEY='poolshed:v172:pendingSync',HOLD_KEY='poolshed:v172:recoveryHold';
const DB_NAME='pool-shed-live-v1.8',STORE='snapshots',REMOTE_REVISION_KEY='poolshed:v172:remoteRevision';
let sharedClient=null;
const $=id=>document.getElementById(id);
function arr(v){return Array.isArray(v)?v:[]}
function counts(d){
  d=d&&typeof d==='object'?d:{};
  return {
    projects:arr(d.jobs).length||arr(d.projects).length,
    salesOrders:arr(d.salesOrders).length,
    purchaseOrders:arr(d.purchaseOrders).length,
    customers:arr(d.customers).length,
    products:arr(d.products).length,
    suppliers:arr(d.suppliers).length
  };
}
function score(c){return (c.projects+c.salesOrders+c.purchaseOrders)*100+c.customers*10+c.products+c.suppliers*5}
function labelFor(key){if(key.startsWith('poolshed:v172:recovery:'))return 'Automatic recovery copy';if(key===APP_KEY)return 'Current browser workspace';if(key.includes('v171'))return 'Older v171 browser copy';if(key.includes('v165'))return 'Older v165 browser copy';if(key.startsWith('poolbros:'))return 'Per-user browser backup';if(key==='indexeddb:latest')return 'IndexedDB offline snapshot';return key}
function parseCandidate(key,raw){
  try{
    const parsed=typeof raw==='string'?JSON.parse(raw):raw;
    const data=parsed&&parsed.data&&typeof parsed.data==='object'?parsed.data:parsed;
    if(!data||typeof data!=='object')return null;
    const c=counts(data);
    return {key,label:labelFor(key),data,counts:c,score:score(c),savedAt:parsed&&parsed.savedAt||'',reason:parsed&&parsed.reason||'',size:JSON.stringify(data).length};
  }catch(_){return null}
}
function openDb(){return new Promise(resolve=>{try{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null)}catch(_){resolve(null)}})}
async function readIndexed(){const db=await openDb();if(!db)return null;return new Promise(resolve=>{try{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get('latest');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null)}catch(_){resolve(null)}})}
async function writeIndexed(data){const db=await openDb();if(!db)return;await new Promise(resolve=>{try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({key:'latest',savedAt:new Date().toISOString(),data,pendingSync:true});tx.oncomplete=()=>resolve();tx.onerror=()=>resolve()}catch(_){resolve()}})}
function preview(data){
  const jobs=arr(data.jobs).slice(-8).map(x=>x.id||x.name||x.title||'Project');
  const so=arr(data.salesOrders).slice(-8).map(x=>x.id||x.orderNumber||'Sales Order');
  const po=arr(data.purchaseOrders).slice(-8).map(x=>x.id||x.poNumber||x.supplier||'Purchase Order');
  return ['Projects: '+(jobs.join(', ')||'none'),'Sales Orders: '+(so.join(', ')||'none'),'Purchase Orders: '+(po.join(', ')||'none')].join('\n');
}
function download(candidate){
  const blob=new Blob([JSON.stringify(candidate.data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='pool-shed-recovery-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function getSharedClient(){
  if(sharedClient)return sharedClient;
  const cfg=window.POOL_SHED_CONFIG||{};
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)throw new Error('Pool Shed sign-in is not available on this page.');
  sharedClient=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return sharedClient;
}
async function publishShared(candidate){
  if(localStorage.getItem(HOLD_KEY)!=='1')return alert('Restore and verify the recovered workspace locally before making it the shared master.');
  if(!confirm('Make this recovered workspace the shared Pool Shed master for all users? The current server copy will be preserved in revision history first.'))return;
  const button=document.activeElement;if(button&&button.tagName==='BUTTON')button.disabled=true;
  try{
    // User-initiated download gives an independent copy outside the app before publishing.
    download(candidate);
    $('status').textContent='Creating server revision and publishing the recovered workspace…';
    const client=getSharedClient(),sessionResult=await client.auth.getSession(),session=sessionResult.data&&sessionResult.data.session;
    if(!session)throw new Error('Please open Pool Shed, sign in as Admin, then return to this recovery page.');
    const response=await fetch('/api/workspace-recovery-publish?workspace=pool-bros-main',{
      method:'POST',
      credentials:'same-origin',
      headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
      body:JSON.stringify({snapshot:candidate.data})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||'The recovered workspace could not be published.');
    if(result.updatedAt)localStorage.setItem(REMOTE_REVISION_KEY,result.updatedAt);
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(HOLD_KEY);
    localStorage.setItem('poolshed:v172:lastSharedRecoveryPublish',new Date().toISOString());
    $('status').textContent='Shared master published safely. Server history preserved. Projects '+result.after.projects+', Sales Orders '+result.after.salesOrders+', Purchase Orders '+result.after.purchaseOrders+'. Shared syncing is now enabled.';
    window.scrollTo({top:0,behavior:'smooth'});
  }catch(error){
    $('status').textContent='Nothing was replaced. '+(error&&error.message?error.message:String(error));
  }finally{if(button&&button.tagName==='BUTTON')button.disabled=false}
}
async function restore(candidate){
  if(!confirm('Restore this browser copy locally? Shared syncing will be paused until the recovery is verified.'))return;
  try{
    const current=localStorage.getItem(APP_KEY);
    if(current){
      const backupKey='poolshed:v172:recovery:pre-manual-restore-'+Date.now();
      localStorage.setItem(backupKey,JSON.stringify({reason:'pre-manual-restore',savedAt:new Date().toISOString(),data:JSON.parse(current)}));
    }
    localStorage.setItem(APP_KEY,JSON.stringify(candidate.data));
    localStorage.setItem(PENDING_KEY,'1');
    localStorage.setItem(HOLD_KEY,'1');
    localStorage.setItem('poolshed:v172:recoveryRestoredFrom',candidate.key);
    await writeIndexed(candidate.data);
    $('status').textContent='Recovered copy restored locally. Shared syncing is PAUSED. Open Pool Shed and verify your Projects, Sales Orders and Purchase Orders.';
    window.scrollTo({top:0,behavior:'smooth'});
  }catch(error){$('status').textContent='Restore failed: '+(error&&error.message?error.message:String(error))}
}
async function scan(){
  $('status').textContent='Scanning this browser for Pool Shed workspace copies…';$('results').innerHTML='';
  const candidates=[],seen=new Set();
  const currentCandidate=parseCandidate(APP_KEY,localStorage.getItem(APP_KEY));
  if(currentCandidate){const fingerprint=JSON.stringify(currentCandidate.data);seen.add(fingerprint);candidates.push(currentCandidate);}
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i)||'';
    if(key===APP_KEY)continue;
    if(!(key==='poolshed:v171:appData'||key==='poolshed:v165:appData'||key.startsWith('poolshed:v172:recovery:')||(key.startsWith('poolbros:')&&key.endsWith(':appData'))))continue;
    const c=parseCandidate(key,localStorage.getItem(key));if(!c)continue;
    const fingerprint=JSON.stringify(c.data);if(seen.has(fingerprint))continue;seen.add(fingerprint);candidates.push(c);
  }
  const indexed=await readIndexed(),ic=parseCandidate('indexeddb:latest',indexed);if(ic){const fp=JSON.stringify(ic.data);if(!seen.has(fp)){seen.add(fp);candidates.push(ic)}}
  candidates.sort((a,b)=>a.key===APP_KEY?-1:b.key===APP_KEY?1:(b.score-a.score||String(b.savedAt).localeCompare(String(a.savedAt))));
  $('status').textContent=candidates.length?('Found '+candidates.length+' distinct workspace cop'+(candidates.length===1?'y':'ies')+'. The copy with the most Projects / Sales Orders / POs is highlighted.'):'No recovery copies were found in this browser.';
  candidates.forEach((c,index)=>{
    const el=document.createElement('section');el.className='card'+(index===0?' best':'');
    el.innerHTML='<div>'+(index===0?'<span class="badge">Likely best recovery</span>':'')+'</div><h2>'+c.label+'</h2><div class="muted">'+(c.savedAt?('Saved '+c.savedAt):c.key)+(c.reason?(' · '+c.reason):'')+'</div>'+
      '<div class="counts"><div class="count"><strong>'+c.counts.projects+'</strong><span>Projects</span></div><div class="count"><strong>'+c.counts.salesOrders+'</strong><span>Sales Orders</span></div><div class="count"><strong>'+c.counts.purchaseOrders+'</strong><span>Purchase Orders</span></div></div>'+
      '<div class="muted">Customers '+c.counts.customers+' · Products '+c.counts.products+' · Suppliers '+c.counts.suppliers+' · '+Math.round(c.size/1024)+' KB</div><pre>'+preview(c.data).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</pre><div class="actions"></div>';
    const actions=el.querySelector('.actions'),restoreBtn=document.createElement('button'),downloadBtn=document.createElement('button');
    restoreBtn.className='primary';restoreBtn.textContent='Restore this copy locally';restoreBtn.onclick=()=>restore(c);
    downloadBtn.className='secondary';downloadBtn.textContent='Download backup JSON';downloadBtn.onclick=()=>download(c);
    actions.append(restoreBtn,downloadBtn);
    if(c.key===APP_KEY&&localStorage.getItem(HOLD_KEY)==='1'){
      const publishBtn=document.createElement('button');
      publishBtn.className='primary';publishBtn.textContent='Make this the shared master';
      publishBtn.onclick=()=>publishShared(c);actions.appendChild(publishBtn);
    }
    $('results').appendChild(el);
  });
}
$('rescan').addEventListener('click',scan);scan();
})();