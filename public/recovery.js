(function(){
'use strict';
const APP_KEY='poolshed:v172:appData',PENDING_KEY='poolshed:v172:pendingSync',HOLD_KEY='poolshed:v172:recoveryHold';
const DB_NAME='pool-shed-live-v1.8',STORE='snapshots',REMOTE_REVISION_KEY='poolshed:v172:remoteRevision',MASTER_PUBLISHED_KEY='poolshed:v172:lastSharedRecoveryPublish';
let sharedClient=null;
const $=id=>document.getElementById(id);
const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
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
function preserveLocalCopy(reason,data){
  try{
    const savedAt=new Date().toISOString(),key='poolshed:v172:recovery:'+reason+'-'+Date.now();
    localStorage.setItem(key,JSON.stringify({reason,savedAt,data}));
    return key;
  }catch(_){return ''}
}
function getSharedClient(){
  if(sharedClient)return sharedClient;
  const cfg=window.POOL_SHED_CONFIG||{};
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey)throw new Error('Pool Shed sign-in is not available on this page.');
  sharedClient=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return sharedClient;
}
async function adminSession(){
  const client=getSharedClient(),sessionResult=await client.auth.getSession(),session=sessionResult.data&&sessionResult.data.session;
  if(!session)throw new Error('Please open Pool Shed, sign in as Admin, then return to this page.');
  return session;
}
function renderSharedHealth(result){
  const status=$('healthStatus'),details=$('healthDetails'),repair=$('repairSharedUsers');
  if(!status||!details)return;
  const master=result&&result.master||{},team=result&&result.team||{},countsValue=master.counts||{},users=arr(team.users);
  const masterGood=!!master.exists&&master.requiredArraysOk===true;
  const usersGood=team.allActiveConnected===true;
  status.innerHTML='<strong class="'+(masterGood&&usersGood?'health-good':'health-warn')+'">'+(masterGood&&usersGood?'Shared workspace is healthy.':'Shared workspace needs attention.')+'</strong> '+
    (master.exists?('Master updated '+esc(master.updatedAt||'unknown time')+'.'):'No server master is currently published.');
  const userRows=users.map(user=>'<tr><td><strong>'+esc(user.name)+'</strong><br><span class="muted">'+esc(user.email)+'</span></td><td>'+esc(user.role)+'</td><td>'+(user.active?'<span class="health-good">Active</span>':'Inactive')+'</td><td>'+(user.connected?'<span class="health-good">Connected</span>':'<span class="health-bad">Not connected</span>')+'</td><td>'+esc(user.workspaceRole||'—')+'</td></tr>').join('');
  details.innerHTML='<div class="health-summary">'+
    '<div class="health-metric"><strong class="'+(masterGood?'health-good':'health-bad')+'">'+(masterGood?'Ready':'Attention')+'</strong><span>Shared master</span></div>'+
    '<div class="health-metric"><strong>'+Number(countsValue.projects||0)+'</strong><span>Projects on server</span></div>'+
    '<div class="health-metric"><strong>'+Number(countsValue.salesOrders||0)+'</strong><span>Sales Orders on server</span></div>'+
    '<div class="health-metric"><strong>'+Number(countsValue.purchaseOrders||0)+'</strong><span>Purchase Orders on server</span></div>'+
    '<div class="health-metric"><strong class="'+(usersGood?'health-good':'health-bad')+'">'+Number(team.connected||0)+' / '+Number(team.active||0)+'</strong><span>Active users connected</span></div>'+
    '<div class="health-metric"><strong>'+Number((result.revisions&&result.revisions.recentCount)||0)+'</strong><span>Recent server revisions retained</span></div>'+
    '</div>'+
    (master.missingArrays&&master.missingArrays.length?'<p class="health-bad"><strong>Master is missing required data sections:</strong> '+esc(master.missingArrays.join(', '))+'</p>':'')+
    '<table class="health-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Workspace</th><th>Workspace role</th></tr></thead><tbody>'+userRows+'</tbody></table>';
  if(repair)repair.classList.toggle('hidden',usersGood);
}
async function runSharedHealth(repairMembers){
  const status=$('healthStatus'),button=repairMembers?$('repairSharedUsers'):$('runSharedHealth');
  if(button)button.disabled=true;
  try{
    if(status)status.textContent=repairMembers?'Connecting all active Pool Shed users…':'Checking the shared Pool Shed master and all active users…';
    const session=await adminSession();
    const response=await fetch('/api/workspace-health?action='+(repairMembers?'repair-members':'status'),{
      method:'POST',credentials:'same-origin',headers:{Authorization:'Bearer '+session.access_token}
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||'Shared workspace audit failed.');
    renderSharedHealth(result);
    return result;
  }catch(error){
    if(status)status.innerHTML='<span class="health-bad"><strong>Audit could not complete.</strong> '+esc(error&&error.message?error.message:String(error))+'</span>';
    return null;
  }finally{if(button)button.disabled=false}
}
async function publishShared(candidate,options){
  options=options||{};
  const directCurrent=options.allowCurrent===true&&candidate&&candidate.key===APP_KEY;
  const onHold=localStorage.getItem(HOLD_KEY)==='1';
  if(!onHold&&!directCurrent)return alert('Restore and verify the recovered workspace locally before making it the shared master.');
  const c=candidate&&candidate.counts?candidate.counts:counts(candidate&&candidate.data);
  const sourceLabel=directCurrent?'CURRENT BROWSER workspace':'recovered workspace';
  const message='Make this '+sourceLabel+' the shared Pool Shed master for ALL users from now on?\n\nProjects '+c.projects+' · Sales Orders '+c.salesOrders+' · Purchase Orders '+c.purchaseOrders+'\n\nThe current server workspace will be preserved in revision history first. Existing receipt and putaway history is protected and cannot be deleted by this action.';
  if(!confirm(message))return;
  const button=document.activeElement;if(button&&button.tagName==='BUTTON')button.disabled=true;
  try{
    // Keep two independent safety copies before changing the shared master:
    // a local recovery entry and a user-downloaded JSON file.
    preserveLocalCopy('pre-shared-master',candidate.data);
    download(candidate);
    $('status').textContent='Creating server revision and publishing the '+(directCurrent?'current browser workspace':'recovered workspace')+' as the shared master…';
    const session=await adminSession();
    const response=await fetch('/api/workspace-recovery-publish?workspace=pool-bros-main',{
      method:'POST',
      credentials:'same-origin',
      headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
      body:JSON.stringify({snapshot:candidate.data})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||'The shared master could not be published.');
    if(result.updatedAt)localStorage.setItem(REMOTE_REVISION_KEY,result.updatedAt);
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(HOLD_KEY);
    localStorage.setItem(MASTER_PUBLISHED_KEY,new Date().toISOString());
    localStorage.setItem('poolshed:v172:masterSource',directCurrent?'current-browser':'recovery');
    $('status').textContent='Shared master published safely. Server history preserved. Projects '+result.after.projects+', Sales Orders '+result.after.salesOrders+', Purchase Orders '+result.after.purchaseOrders+'. All active staff are connected to the same shared workspace.';
    await runSharedHealth(false);
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
    if(c.key===APP_KEY){
      const publishBtn=document.createElement('button');
      publishBtn.className='primary';publishBtn.textContent='Make current browser data the shared master';
      publishBtn.title='Admin only. Creates a local backup, downloads JSON, preserves the previous server revision, then publishes this exact browser workspace for all users.';
      publishBtn.onclick=()=>publishShared(c,{allowCurrent:true});actions.appendChild(publishBtn);
    }
    $('results').appendChild(el);
  });
}
$('rescan').addEventListener('click',scan);
$('runSharedHealth').addEventListener('click',()=>runSharedHealth(false));
$('repairSharedUsers').addEventListener('click',()=>runSharedHealth(true));
scan();
setTimeout(()=>runSharedHealth(false),500);
})();