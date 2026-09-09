/* Shared navigation, operational checks and job-linked tool management. */
function psToolData() {
 data.toolAssets = data.toolAssets || [];
 data.toolAssignments = data.toolAssignments || [];
 data.toolHistory = data.toolHistory || [];
}
function psToolOpen(a) {return !a.returnedAt || (a.ownership === 'Hired In' && !a.offHireAt);}
function psToolJobOutstanding(jobId) {psToolData();return data.toolAssignments.filter(a=>a.jobId===jobId && psToolOpen(a));}
function psToolCost(a, now) {
 const end = a.ownership === 'Hired In' ? a.offHireAt : a.returnedAt;
 const days = Math.max(1,Math.ceil(((end ? Date.parse(end) : now || Date.now())-Date.parse(a.startedAt))/86400000));
 return Math.round(days * Number(a.dailyRate || 0) * 100)/100;
}
function psToolApply(action, v) {
 psToolData();
 if (!canAccessTab('jobs')) throw Error('You do not have access to tools.');
 const now=new Date().toISOString();
 let tool=data.toolAssets.find(t=>t.id===v.id);
 if(action==='save') {
  if(!isAdminUser())throw Error('An administrator must create or edit a tool.');
  const name=String(v.name||'').trim();if(!name)throw Error('Enter the tool name.');
  const value=Number(v.replacementValue),rate=Number(v.dailyRate);
  if(!Number.isFinite(value)||value<0||!Number.isFinite(rate)||rate<0)throw Error('Enter valid non-negative costs.');
  if(tool && data.toolAssignments.some(a=>a.toolId===tool.id && psToolOpen(a)))throw Error('Return and off-hire this tool before editing its terms.');
  if(!tool){tool={id:crypto.randomUUID(),status:'Available',createdAt:now};data.toolAssets.push(tool);}
  const code=String(v.code||'').trim() || 'TOOL-'+tool.id.slice(0,8).toUpperCase();
  if(data.toolAssets.some(t=>t.id!==tool.id && t.code.toLowerCase()===code.toLowerCase()))throw Error('That asset code already exists.');
  Object.assign(tool,{code,name,ownership:v.ownership==='Hired In'?'Hired In':'Owned',replacementValue:value,dailyRate:rate,serial:String(v.serial||''),supplier:String(v.supplier||''),notes:String(v.notes||''),serviceDue:v.serviceDue||'',kit:String(v.kit||'').split('\n').map(x=>x.trim()).filter(Boolean)});
 } else {
  if(!tool)throw Error('Tool not found.');
  const assignment=data.toolAssignments.find(a=>a.toolId===tool.id && psToolOpen(a));
  if(action==='allocate') {
   if(tool.status!=='Available'||assignment)throw Error('This tool is not available.');
   if(tool.serviceDue && tool.serviceDue<now.slice(0,10))throw Error('Service is overdue. Inspect the tool and update its service date first.');
   if(!String(v.responsible||'').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(v.expectedReturn||'') || !Number.isFinite(Date.parse(v.expectedReturn)))throw Error('Enter who is responsible and the expected return date.');
   if(!v.jobId && !v.locationId)throw Error('Choose a job or location.');
   const j=v.jobId && data.jobs.find(j=>j.id===v.jobId);
   if(v.jobId && (!j || ['Completed','Invoiced'].includes(j.status)))throw Error('Select an open job.');
   if(v.locationId && !data.locations.some(l=>l.id===v.locationId))throw Error('Select an existing location.');
   data.toolAssignments.push({id:crypto.randomUUID(),toolId:tool.id,jobId:v.jobId||'',locationId:v.locationId||'',responsible:v.responsible,expectedReturn:v.expectedReturn,startedAt:now,ownership:tool.ownership,dailyRate:tool.dailyRate,kit:tool.kit.slice(),supplier:tool.supplier});
   tool.status='Allocated';
  } else if(action==='return') {
   if(!assignment || assignment.returnedAt)throw Error('There is no active allocation to return.');
   assignment.returnedAt=now;
   assignment.missingItems=(assignment.kit||[]).filter((_,i)=>!v['kit'+i]);
   assignment.condition=v.condition||'Inspection required';
   assignment.returnNote=String(v.returnNote||'');
   tool.status=assignment.missingItems.length || assignment.condition!=='Good'?'Inspection required':assignment.ownership==='Hired In'?'Off hire required':'Available';
  } else if(action==='offhire') {
   if(!assignment || assignment.ownership!=='Hired In' || !assignment.returnedAt)throw Error('Return the hired tool before confirming off-hire.');
   assignment.offHireAt=now;
   tool.status='Off hired';
  } else if(action==='service') {
   if(!isAdminUser())throw Error('An administrator must release a tool after inspection.');
   if(assignment)throw Error('Return and off-hire the tool first.');
   tool.status='Available';
  } else throw Error('Unknown tool action.');
 }
 data.toolHistory.push({id:crypto.randomUUID(),toolId:tool.id,action,date:now,user:currentUser().name,details:JSON.parse(JSON.stringify(tool)),assignment:JSON.parse(JSON.stringify(data.toolAssignments.filter(a=>a.toolId===tool.id).slice(-1)[0]||{}))});
 return tool;
}
function psToolTransaction(action,values) {
 const before=JSON.stringify(data);
 try {const result=psToolApply(action,values);localStorage.setItem('poolshed:v172:pendingSync','1');localStorage.setItem('poolshed:v172:appData',JSON.stringify(data));saveAppData();return result;}
 catch(e){data=JSON.parse(before);throw e;}
}
function psOperationalIssues() {
 const issues=[];const add=(module,record,message)=>issues.push({module,record,message});
 const products=new Set(data.products.map(p=>p.id)),locations=new Set(data.locations.map(l=>l.id)),orders=new Set(data.salesOrders.map(o=>o.id)),jobs=new Set(data.jobs.map(j=>j.id));
 (data.stock||[]).forEach(r=>{if(!products.has(r.productId)||!locations.has(r.locationId))add('locations',r.productId,'Stock references a missing product or location.');if(!Number.isFinite(Number(r.qty))||r.qty<0||r.allocated<0||r.allocated>r.qty)add('locations',r.productId,'Stock balance or reservation is invalid.');});
 data.purchaseOrders.forEach(po=>po.lines.forEach(l=>{if(!products.has(l.productId))add('purchase',po.id,'PO line references a missing product.');if(l.salesOrderId&&!orders.has(l.salesOrderId))add('purchase',po.id,'Linked sales order no longer exists.');if(l.received>l.qty)add('purchase',po.id,'Received quantity exceeds ordered quantity.');if(po.status==='Received'&&poLinePending(l)>0)add('purchase',po.id,'PO is marked Received but still has open quantities.');}));
 data.salesOrders.forEach(o=>{if(o.customerId&&!data.customers.some(c=>c.id===o.customerId))add('salesorders',o.id,'Customer link is missing.');o.lines.forEach(l=>{if(l.productId&&!products.has(l.productId))add('salesorders',o.id,'Product link is missing.');if(Number(l.allocated||0)>Number(l.qty||0))add('salesorders',o.id,'Allocated quantity exceeds ordered quantity.');});});
 data.jobs.forEach(j=>{if(j.locationId&&!locations.has(j.locationId))add('jobs',j.id,'Job location is missing.');if(['Completed','Invoiced'].includes(j.status)&&psToolJobOutstanding(j.id).length)add('jobs',j.id,'Closed job still has outstanding tools or hire.');});
 psToolData();data.toolAssignments.filter(psToolOpen).forEach(a=>{if(a.jobId&&!jobs.has(a.jobId))add('jobs',a.toolId,'Tool assignment references a missing job.');if(!a.returnedAt&&a.expectedReturn<todayIso())add('jobs',a.toolId,'Tool is overdue for return.');});
 return issues;
}
function psToolCosting(jobId) {
 psToolData();const rows=data.toolAssignments.filter(a=>!jobId||a.jobId===jobId);
 return '<div class="panel" style="margin-top:20px"><h3>Tool and hire costs</h3><p class="muted">Whole days, minimum one day. Internal rates are project costs. External hire continues until off-hire is confirmed.</p><div class="ps-table-region"><table><thead><tr><th>Tool</th><th>Job</th><th>Daily rate</th><th>Cost to date</th><th>Status</th></tr></thead><tbody>'+rows.map(a=>{const t=data.toolAssets.find(t=>t.id===a.toolId);return '<tr><td>'+escapeHtml(t?t.code:a.toolId)+'</td><td>'+escapeHtml(a.jobId||'No job')+'</td><td>'+money(a.dailyRate)+'</td><td>'+money(psToolCost(a))+'</td><td>'+escapeHtml(psToolOpen(a)?'Active':'Closed')+'</td></tr>';}).join('')+'</tbody></table></div><p><strong>Total tool / hire cost: '+money(rows.reduce((n,a)=>n+psToolCost(a),0))+'</strong></p></div>';
}
let psSelectedTool='';
function psToolWorkspace() {
 psToolData();const esc=escapeHtml;const t=data.toolAssets.find(t=>t.id===psSelectedTool);
 const query=typeof searchTerm==='function'?searchTerm():'';
 const rows=data.toolAssets.filter(t=>!query||[t.code,t.name,t.serial,t.status,t.supplier].join(' ').toLowerCase().includes(query)).map(t=>{const a=data.toolAssignments.find(a=>a.toolId===t.id&&psToolOpen(a));const status=a&&!a.returnedAt&&a.expectedReturn<todayIso()?'Overdue':t.status;return '<tr><td><button class="ghost" data-tool-open="'+t.id+'">'+esc(t.code)+'</button><br>'+esc(t.name)+'</td><td>'+esc(status)+'</td><td>'+esc(a?[(data.jobs.find(j=>j.id===a.jobId)||{}).name,(data.locations.find(l=>l.id===a.locationId)||{}).name,a.responsible].filter(Boolean).join(' · '):'—')+'</td><td>'+esc(a?a.expectedReturn:'—')+'</td><td>'+money(t.replacementValue)+'</td></tr>';}).join('');
 let detail='<p>Select a tool to allocate, return or view its history.</p>';
 const field=(label,name,value,type='text')=>'<label>'+label+'<input name="'+name+'" type="'+type+'" '+(type==='number'?'step="0.01" min="0"':'')+' value="'+esc(String(value??''))+'"></label>';
 if(psSelectedTool==='new' || t) {
  const a=t&&data.toolAssignments.find(a=>a.toolId===t.id&&psToolOpen(a));
  const id=t?t.id:'';
  detail='<h3>'+esc(t?t.name:'Add tool')+'</h3>';
  if(!a && isAdminUser()) detail+='<form class="ps-tool-form" data-tool-form="save"><input type="hidden" name="id" value="'+id+'">'+field('Asset code','code',t?.code)+field('Tool name','name',t?.name)+field('Serial number','serial',t?.serial)+'<label>Ownership<select name="ownership">'+optionList(['Owned','Hired In'],t?.ownership||'Owned')+'</select></label>'+field('Replacement value (£)','replacementValue',t?.replacementValue||0,'number')+field('Daily internal / hire rate (£)','dailyRate',t?.dailyRate||0,'number')+field('Hire supplier / reference','supplier',t?.supplier)+field('Next service date','serviceDue',t?.serviceDue,'date')+'<label>Kit contents — one item per line<textarea name="kit">'+esc((t?.kit||[]).join('\n'))+'</textarea></label><label>Notes<textarea name="notes">'+esc(t?.notes||'')+'</textarea></label><button>Save tool</button></form>';
  if(t && t.status==='Available' && !a) detail+='<hr><form class="ps-tool-form" data-tool-form="allocate"><input type="hidden" name="id" value="'+id+'"><h3>Allocate tool</h3><label>Job<select name="jobId"><option value="">No job</option>'+data.jobs.filter(j=>!['Completed','Invoiced'].includes(j.status)).map(j=>'<option value="'+esc(j.id)+'">'+esc(j.name)+'</option>').join('')+'</select></label><label>Location / van<select name="locationId"><option value="">No location</option>'+data.locations.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+'</option>').join('')+'</select></label>'+field('Responsible person','responsible','')+field('Expected return','expectedReturn','','date')+'<button>Allocate tool</button></form>';
  if(a && !a.returnedAt) detail+='<form class="ps-tool-form" data-tool-form="return"><input type="hidden" name="id" value="'+id+'"><h3>Return and check kit</h3>'+(a.kit||[]).map((k,i)=>'<label><span><input type="checkbox" name="kit'+i+'"> '+esc(k)+'</span></label>').join('')+'<label>Condition<select name="condition"><option>Inspection required</option><option>Good</option><option>Damaged</option></select></label><label>Return notes<textarea name="returnNote"></textarea></label><button>Confirm return</button></form>';
  if(a?.returnedAt && a.ownership==='Hired In' && !a.offHireAt)detail+='<p>Hire charges continue until the supplier confirms off-hire.</p><button data-tool-action="offhire" data-tool-id="'+id+'">Confirm supplier off-hire</button>';
  if(t?.status==='Inspection required'&&!a&&isAdminUser())detail+='<p>After inspecting and replacing any missing items:</p><button data-tool-action="service" data-tool-id="'+id+'">Release after inspection</button>';
  if(t)detail+='<details class="ps-tool-history"><summary>Movement and audit history</summary>'+data.toolHistory.filter(h=>h.toolId===id).slice().reverse().map(h=>'<p>'+esc(h.date+' · '+h.action+' · '+h.user)+(h.assignment?.missingItems?.length?'<br>Missing: '+esc(h.assignment.missingItems.join(', ')):'')+'</p>').join('')+'</details>';
 }
 return '<div class="panel" style="grid-column:1/-1"><div class="action-row"><h2>Tool Register</h2>'+(isAdminUser()?'<button data-tool-open="new">Add tool</button>':'')+'</div><p class="muted">'+data.toolAssets.length+' tools · '+money(data.toolAssets.reduce((n,t)=>n+t.replacementValue,0))+' replacement value · '+data.toolAssignments.filter(psToolOpen).length+' outstanding</p></div><div class="ps-tool-layout"><div class="panel"><div class="ps-table-region"><table><thead><tr><th>Tool</th><th>Status</th><th>Assigned to</th><th>Due back</th><th>Value</th></tr></thead><tbody>'+ (rows||'<tr><td colspan="5">No tools registered yet. Add the first tool to start tracking it.</td></tr>')+'</tbody></table></div></div><div class="panel">'+detail+'</div></div>';
}
(function(){
 const baseGroups=sidebarSubGroups;
 sidebarSubGroups=function(id){const list=baseGroups(id).slice();if(id==='jobs'&&!list.includes('Tool Register'))list.push('Tool Register');if(id==='settings'&&isAdminUser())list.push('Operations Review');return list;};
 const baseJobs=renderJobs;
 renderJobs=function(){if(selectedSubPage('jobs')==='Tool Register'){document.getElementById('screen-jobs').innerHTML=psToolWorkspace();return;}baseJobs();};
 const baseCost=jobCostingPanel;jobCostingPanel=function(id){return baseCost(id)+psToolCosting(id);};
 const baseSaveJob=saveJobFromForm;saveJobFromForm=function(form){const v=Object.fromEntries(new FormData(form));if(['Completed','Invoiced'].includes(v.status)&&psToolJobOutstanding(v.id||v.jobCode).length)return toast('Return outstanding tools and confirm external off-hire before closing this job.');return baseSaveJob(form);};
 const baseDelete=deleteJobReference;deleteJobReference=function(id){psToolData();if(data.toolAssignments.some(a=>a.jobId===id))return toast('This job has tool history and must be retained.');return baseDelete(id);};
 let conflictBackup=false;
 const baseRender=render;
 render=function(){baseRender();const screen=document.getElementById('screen-'+active);if(!screen)return;
  if(active==='settings'&&selectedSubPage('settings')==='Operations Review'&&isAdminUser()) {const issues=psOperationalIssues();screen.innerHTML='<div class="panel" style="grid-column:1/-1"><h2>Operations Review</h2><p class="muted">Checks linked records, stock balances, order quantities and outstanding tools. Review findings before changing data.</p><div class="ps-health-list">'+(issues.map(i=>'<div class="ps-health-item"><p><strong>'+escapeHtml(i.record)+'</strong><br>'+escapeHtml(i.message)+'</p><button class="secondary" data-review-module="'+i.module+'">Open '+escapeHtml(i.module)+'</button></div>').join('')||'<p>No issues found by these checks.</p>')+'</div></div>';}
  document.getElementById('psSyncConflict')?.remove();
  if(workspaceSyncConflict){const banner=document.createElement('div');banner.id='psSyncConflict';banner.className='panel';banner.setAttribute('role','alert');banner.innerHTML='<strong>Shared workspace has newer changes</strong><p>Your local work is preserved. Download a backup before loading the shared version. The backup must be reviewed and merged manually; it is not uploaded automatically.</p><div class="action-row"><button data-conflict-backup>Download local backup</button><button class="secondary" data-conflict-reload>Load shared version</button></div>';document.querySelector('.topbar').after(banner);}
  screen.querySelectorAll(':scope > .ps-section-nav').forEach(n=>n.remove());
  const groups=sidebarSubGroups(active);if(groups.length){const nav=document.createElement('nav');nav.className='ps-section-nav';nav.setAttribute('aria-label','Section navigation');nav.innerHTML=groups.map(g=>'<button type="button" data-section-open="'+escapeHtml(g)+'" class="'+((selectedSubPage(active)||defaultSubPage(active))===g?'active':'')+'" '+((selectedSubPage(active)||defaultSubPage(active))===g?'aria-current="page"':'')+'>'+escapeHtml(g)+'</button>').join('');screen.prepend(nav);}
  screen.querySelectorAll('table').forEach(t=>{if(t.closest('.table-scroll,.order-lines-scroll,.po-lines-wrap,.ps-table-region'))return;const wrap=document.createElement('div');wrap.className='ps-table-region';wrap.tabIndex=0;wrap.setAttribute('aria-label','Scrollable table');t.before(wrap);wrap.append(t);});
  document.querySelectorAll('#nav [data-tab]').forEach(b=>{if(b.dataset.tab===active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 };
 document.addEventListener('click',function(e){const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-conflict-backup')){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='pool-shed-local-conflict-backup-'+todayIso()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);conflictBackup=true;return;}
  if(b.hasAttribute('data-conflict-reload')){if(!conflictBackup)return toast('Download and save your local backup first.');if(!confirm('Have you saved the local backup? Loading the shared version replaces the local workspace. Review the backup separately to recover local-only changes.'))return;localStorage.removeItem('poolshed:v172:pendingSync');loadRemoteWorkspace().then(ok=>{if(ok){workspaceSyncConflict=false;conflictBackup=false;render();}else {localStorage.setItem('poolshed:v172:pendingSync','1');toast('Could not load the shared workspace. Local changes are still kept.');}});return;}
  if(b.hasAttribute('data-section-open')){openSidebarSubGroup(active,b.dataset.sectionOpen);return;}
  if(b.hasAttribute('data-review-module')){if(canAccessTab(b.dataset.reviewModule)){active=b.dataset.reviewModule;render();}return;}
  if(b.hasAttribute('data-tool-open')){psSelectedTool=b.dataset.toolOpen;render();return;}
  if(b.hasAttribute('data-tool-action')){try{psToolTransaction(b.dataset.toolAction,{id:b.dataset.toolId});toast('Tool updated.');render();}catch(err){toast(err.message);}return;}
  if(b.id==='workspaceDensity'){const mode=document.documentElement.dataset.density==='comfortable'?'compact':'comfortable';document.documentElement.dataset.density=mode;localStorage.setItem('poolshed:workspaceDensity',mode);b.textContent=mode==='comfortable'?'Compact view':'Comfortable view';}
  if(b.id==='workspaceMenu'){document.body.classList.toggle('ps-menu-open');b.setAttribute('aria-expanded',String(document.body.classList.contains('ps-menu-open')));}
  if(b.closest('#nav')){document.body.classList.remove('ps-menu-open');document.getElementById('workspaceMenu')?.setAttribute('aria-expanded','false');}
 });
 document.addEventListener('submit',function(e){const f=e.target.closest('[data-tool-form]');if(!f)return;e.preventDefault();try{const t=psToolTransaction(f.dataset.toolForm,Object.fromEntries(new FormData(f)));psSelectedTool=t.id;toast('Tool record saved.');render();}catch(err){toast(err.message);}});
 document.addEventListener('keydown',function(e){if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();document.getElementById('globalSearch')?.focus();}if(e.key==='Escape')document.body.classList.remove('ps-menu-open');});
 try{document.documentElement.dataset.density=localStorage.getItem('poolshed:workspaceDensity')||'compact';}catch{}
 const row=document.querySelector('.top-utility-row');if(row){const density=document.createElement('button');density.id='workspaceDensity';density.className='secondary';density.textContent=document.documentElement.dataset.density==='comfortable'?'Compact view':'Comfortable view';row.prepend(density);const menu=document.createElement('button');menu.id='workspaceMenu';menu.className='ps-mobile-menu secondary';menu.textContent='Menu';menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-controls','nav');row.prepend(menu);}
 document.getElementById('globalSearch')?.setAttribute('aria-label','Search records (Ctrl or Command K)');
 if(typeof render==='function')render();
})();
