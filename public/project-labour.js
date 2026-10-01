(function(global){
'use strict';

function esc(v){return typeof global.psProjectEsc==='function'?global.psProjectEsc(v):String(v==null?'':v);}
function cash(v){return typeof global.money==='function'?global.money(v):'£'+Number(v||0).toFixed(2);}
function today(){return typeof global.psProjectUKDate==='function'?global.psProjectUKDate():new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function options(rows,empty){return typeof global.psProjectOptions==='function'?global.psProjectOptions(rows,empty):'<option value="">'+esc(empty)+'</option>';}
function input(label,name,value,type,extra){return typeof global.psProjectInput==='function'?global.psProjectInput(label,name,value,type,extra):'<label>'+esc(label)+'<input name="'+esc(name)+'" value="'+esc(value||'')+'" type="'+esc(type||'text')+'" '+(extra||'')+'></label>';}
function form(job,action,body,button){return typeof global.psProjectForm==='function'?global.psProjectForm(job,action,body,button):'<form data-project-form="'+action+'"><input type="hidden" name="jobId" value="'+esc(job.id)+'">'+body+'<button type="submit">'+esc(button)+'</button></form>';}
function table(headers,rows,empty){return typeof global.psProjectTable==='function'?global.psProjectTable(headers,rows,empty):'<table><tbody>'+rows+'</tbody></table>';}

function selectedOptions(rows,current,empty){
 const selected=String(current||'');
 return '<option value="" '+(!selected?'selected':'')+'>'+esc(empty)+'</option>'+(rows||[]).map(r=>'<option value="'+esc(r.id)+'" '+(String(r.id)===selected?'selected':'')+'>'+esc(r.name||r.title||r.id)+'</option>').join('');
}
function labourEditDialog(job,row){
 const p=job.project||{},approved=(p.variations||[]).filter(v=>v.status==='Approved');
 let dialog=document.getElementById('psProjectLabourEdit');if(dialog)dialog.remove();
 dialog=document.createElement('dialog');dialog.id='psProjectLabourEdit';dialog.className='project-email-dialog';document.body.appendChild(dialog);
 const scope='<label>Allocate labour to<select name="variationId">'+selectedOptions(approved,row.variationId,'Original project scope')+'</select></label><label>Remaining allowance<select name="replaceRemaining"><option value="no" '+(!row.replaceRemaining?'selected':'')+'>Keep allowance separate</option><option value="yes" '+(row.replaceRemaining?'selected':'')+'>This labour is already included in the remaining allowance</option></select></label>';
 const fields='<input type="hidden" name="id" value="'+esc(row.id)+'">'+input('Employee / team member','supplier',row.supplier||'','text','required')+input('Labour reference','ref',row.ref||'','text','required')+input('Start date','startDate',row.startDate||today(),'date','required')+input('End date','endDate',row.endDate||'','date')+'<label>Rate type<select name="rateType" required><option value="day" '+(row.rateType==='day'?'selected':'')+'>Day rate</option><option value="half-day" '+(row.rateType==='half-day'?'selected':'')+'>Half-day rate</option></select></label>'+input('Rate price (£)','rate',row.rate||'','number','min="0.01" step="0.01" required')+'<label class="ps-project-check"><input type="checkbox" name="ongoing" '+(row.ongoing?'checked':'')+'> Ongoing · keep adding this labour rate each working day until the period is ended</label>'+input('Work carried out','notes',row.notes||'')+scope;
 dialog.innerHTML='<form method="dialog"><button class="secondary">Close</button></form><h2>Edit labour period</h2><p>Correct the dates, rate, person, reference or allocation. Saving recalculates the live project cost immediately. Weekends remain excluded from labour accrual.</p>'+form(job,'labour-edit',fields,'Save labour changes');
 dialog.showModal();
}

function labourCard(job,p,s){
 const approved=(p.variations||[]).filter(v=>v.status==='Approved');
 const scope='<label>Allocate labour to<select name="variationId">'+options(approved,'Original project scope')+'</select></label><label>Remaining allowance<select name="replaceRemaining"><option value="no">Keep allowance separate</option><option value="yes">This labour is already included in the remaining allowance</option></select></label>';
 const rows=(p.labour||[]).slice().reverse().map(l=>{
   const charge=global.psProjectLabourCharge(l),label=l.rateType==='half-day'?'Half-day rate':'Day rate',now=today(),status=charge.activeToday?'On this job today':l.ongoing?'Ongoing · not started yet':l.endDate&&l.endDate<now?'Finished':'Scheduled';
   return '<tr><td><strong>'+esc(l.supplier)+'</strong><small>'+esc(l.ref)+'</small></td><td>'+esc(l.startDate)+' → '+esc(l.ongoing?'Ongoing':l.endDate)+'</td><td>'+esc(label)+'<small>'+cash(l.rate)+' each '+(l.rateType==='half-day'?'half day':'day')+'</small></td><td>'+cash(charge.accrued)+'<small>'+charge.units+' '+charge.unitLabel+'</small></td><td>'+cash(charge.forecast)+'</td><td>'+esc(status)+'</td><td><button class="secondary" data-project-labour-edit="'+esc(l.id)+'" data-project-id="'+esc(job.id)+'">Edit</button> '+(l.ongoing?'<button class="secondary" data-project-labour-stop="'+esc(l.id)+'" data-project-id="'+esc(job.id)+'">End labour</button>':'')+'</td></tr>';
 }).join('');
 const register='<section class="project-360-card"><header><div><h3>Labour on this project</h3><p>Each row is one continuous stint. If somebody leaves and comes back later, end the first period and add another row.</p></div><div class="project-360-card-total"><span>Labour forecast</span><strong>'+((typeof global.psProjectCash==='function')?global.psProjectCash(s.labourForecast||0):cash((s.labourForecast||0)/100))+'</strong></div></header>'+table(['Person / reference','Start → end','Rate','Cost to date','Forecast','Status',''],rows,'No dated labour periods recorded yet.')+'</section>';
 const add='<section class="project-360-card"><header><div><h3>Record labour</h3><p>Track labour by day rate or half-day rate. Ongoing labour keeps adding cost each day until you end that period.</p></div></header>'+form(job,'labour-add',input('Employee / team member','supplier','','text','required')+input('Labour reference','ref','','text','required')+input('Start date','startDate',today(),'date','required')+input('End date','endDate','','date')+'<label>Rate type<select name="rateType" required><option value="day">Day rate</option><option value="half-day">Half-day rate</option></select></label>'+input('Rate price (£)','rate','','number','min="0.01" step="0.01" required')+'<label class="ps-project-check"><input type="checkbox" name="ongoing"> Ongoing · keep adding this labour rate each day until the period is ended</label>'+input('Work carried out','notes','')+scope,'Add labour period')+'<div class="project-360-rule"><b>Start and end dates are inclusive.</b><span>If ongoing is not ticked, an end date is required. Active labour is surfaced in the daily Notifications inbox so it can be checked and stopped when the person leaves the job.</span></div></section>';
 return add+register;
}

function installCostingOverride(){
 if(typeof global.psProjectCosting!=='function'||global.psProjectCosting.__labourV146)return;
 const original=global.psProjectCosting;
 const wrapped=function(job,p,s){
   const html=original(job,p,s);
   return html.replace(/<section class="project-360-card"><header><div><h3>Record labour<\/h3>[\s\S]*?<\/section>/,labourCard(job,p,s));
 };
 wrapped.__labourV146=true;
 global.psProjectCosting=wrapped;
}

function seedDailyAlerts(){
 const command=global.PoolShedNotificationsCommand;
 if(!command||typeof command.create!=='function')return;
 const appData=typeof global.__POOL_SHED_GET_DATA__==='function'?global.__POOL_SHED_GET_DATA__():global.data;if(!appData)return;
 const d=today();
 (appData.jobs||[]).forEach(job=>{
   const p=job&&job.project||{};
   (p.labour||[]).forEach((l,index)=>{
     const charge=typeof global.psProjectLabourCharge==='function'?global.psProjectLabourCharge(l):null;
     if(!charge||!charge.activeToday)return;
     const rate=Number(l.rate||0),unit=l.rateType==='half-day'?'half day':'day',person=String(l.supplier||'Labour');
     command.create({category:'Projects',title:'Labour check today',message:person+' is marked on '+String(job.name||job.id)+' today'+(rate?' at £'+rate.toFixed(2)+' per '+unit:'')+'. Confirm they are still on this job and end the labour period if they have left.',severity:'warning',sourceModule:'jobs',sourceType:'project-labour',sourceId:String(job.id),route:{module:'jobs',recordType:'project',recordId:String(job.id),label:'Open Project'},dedupeKey:'project-labour:'+String(job.id)+':'+String(l.id||index)+':'+d});
   });
 });
}

function installTransactionHook(){
 if(typeof global.psProjectTransaction!=='function'||global.psProjectTransaction.__labourV146)return;
 const original=global.psProjectTransaction;
 const wrapped=function(action,v){
   const result=original(action,v);
   if(['labour-add','labour-edit','labour-stop'].includes(action))queueMicrotask(seedDailyAlerts);
   return result;
 };
 wrapped.__labourV146=true;
 global.psProjectTransaction=wrapped;
}

document.addEventListener('click',e=>{
 const b=e.target.closest&&e.target.closest('[data-project-labour-edit]');
 if(!b)return;
 e.preventDefault();e.stopImmediatePropagation();
 try{
   const appData=typeof global.__POOL_SHED_GET_DATA__==='function'?global.__POOL_SHED_GET_DATA__():global.data;
   const job=(appData?.jobs||[]).find(j=>String(j.id)===String(b.dataset.projectId)),row=(job?.project?.labour||[]).find(l=>String(l.id)===String(b.dataset.projectLabourEdit));
   if(!job||!row)throw Error('Labour period not found.');
   labourEditDialog(job,row);
 }catch(error){if(typeof global.toast==='function')global.toast(error.message);else throw error;}
},true);

document.addEventListener('click',e=>{
 const b=e.target.closest&&e.target.closest('[data-project-labour-stop]');
 if(!b)return;
 e.preventDefault();e.stopImmediatePropagation();
 try{
   const endDate=global.prompt('Final working date (YYYY-MM-DD)',today());
   if(endDate===null)return;
   global.psProjectTransaction('labour-stop',{jobId:b.dataset.projectId,id:b.dataset.projectLabourStop,endDate});
   if(typeof global.render==='function')global.render();
 }catch(error){if(typeof global.toast==='function')global.toast(error.message);else throw error;}
},true);

installCostingOverride();
installTransactionHook();
queueMicrotask(seedDailyAlerts);
global.addEventListener&&global.addEventListener('load',seedDailyAlerts,{once:true});
global.PoolShedProjectLabour={seedDailyAlerts,labourCard};
})(globalThis);
