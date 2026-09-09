/* Read-only guidance; never changes statuses, sends invoices or moves stock. */
function psMarginMeter(s) {
 const margin=s.margin, value=margin===null?0:Math.max(0,Math.min(100,margin));
 return '<section class="ps-margin-meter"><strong>'+(margin===null?'Set an agreed quote to monitor margin':margin.toFixed(1)+'% forecast margin')+'</strong><span>Target '+s.target+'%</span><div class="ps-margin-track" role="img" aria-label="Forecast margin '+(margin===null?'unavailable':margin.toFixed(1)+' percent')+', target '+s.target+' percent"><i style="width:'+value+'%;background:'+(margin!==null&&margin<s.target?'#B36A05':'#218653')+'"></i><b style="left:'+Math.max(0,Math.min(100,s.target))+'%"></b></div><small>0% is break-even. Forecast cost headroom at target: '+money(s.headroom/100)+'.</small></section>';
}
(function(){
 const esc=v=>escapeHtml(String(v??''));
 function dailyReview(){
  const today=todayIso(),rows=[];
  const lastActivity=new Map();
  data.notifications.forEach(n=>{const date=Date.parse(n.date);if(n.salesOrderId&&Number.isFinite(date))lastActivity.set(n.salesOrderId,Math.max(lastActivity.get(n.salesOrderId)||0,date));});
  if(canAccessTab('salesorders'))data.salesOrders.filter(o=>!['Cancelled','Canceled','Invoiced','Completed'].includes(o.status)).forEach(o=>{
   if(o.due&&o.due<today)rows.push({id:o.id,type:'order',text:'Order due date has passed — review status, delivery and billing.'});
   const dates=[o.updatedAt,o.created,lastActivity.has(o.id)?new Date(lastActivity.get(o.id)).toISOString():null].filter(Boolean).map(d=>Date.parse(d)).filter(Number.isFinite);
   if(dates.length&&Math.max(...dates)<Date.now()-30*86400000)rows.push({id:o.id,type:'order',text:'No dated activity found in 30 days — check whether this order is still active.'});
   if(!o.customerId||!o.due)rows.push({id:o.id,type:'order',text:'Customer or due date is missing.'});
  });
  if(canAccessTab('jobs'))data.jobs.filter(j=>j.project&&!['Cancelled','Completed','Invoiced'].includes(j.status)).forEach(j=>{
   const s=psProjectSummary(j);s.alerts.forEach(a=>rows.push({id:j.id,type:'project',text:a.text}));
   j.project.phases.filter(p=>p.ready&&!p.invoiceRequested).forEach(p=>rows.push({id:j.id,type:'project',text:'Billing stage ready for review: '+p.name}));
  });
  return rows;
 }
 window.psDashboardDailyReview = dailyReview;
 function reviewMarkup(){
  const rows=dailyReview();
  return '<section class="panel" style="grid-column:1/-1"><h2>Today’s review</h2><p class="muted">Checks recorded information for missing details, overdue work and margin risks. Status changes and invoices always need review.</p>'+(rows.length?'<div class="ps-daily-list">'+rows.map(r=>'<article><div><strong>'+esc(r.id)+'</strong><p>'+esc(r.text)+'</p></div><button class="secondary" data-business-open="'+esc(r.id)+'" data-business-type="'+r.type+'">Review</button></article>').join('')+'</div>':'<p>No issues found by these checks.</p>')+'<p class="muted">Supplier payment deadlines require supplier bills and current accounting data; a purchase-order delivery date is not a payment deadline.</p></section>';
 }
 const training=trainingSettingsPanel;
 trainingSettingsPanel=function(){return training()+'<div class="tool-card-grid"><article class="tool-card"><h3>Daily review and order status</h3><ol><li>Open Today’s review on the dashboard.</li><li>Check overdue orders, missing details and dormant orders against the customer’s instructions.</li><li>Use the actual allocate, pick, pack and ship actions to record progress. A status label alone is not proof of stock movement.</li><li>Review ready invoice stages and current accounting balances before billing.</li></ol></article><article class="tool-card"><h3>Project costs and margin</h3><ol><li>Set the agreed quote and the target margin; the default is 30%.</li><li>Link sales orders and their purchasing to the project.</li><li>Record expenses, labour and supplier invoices. Match costs to the correct PO to avoid counting them twice.</li><li>Review remaining costs and the margin bar regularly. Approve extras before adding them to contract revenue.</li><li>Agree billing stages and complete their required tasks before invoice review.</li></ol></article><article class="tool-card"><h3>Connections and payments</h3><p>Settings contains Accounting &amp; Xero and the administrator’s Operations Review. Xero balances need a configured connection and scheduled sync. Project documents remain on this device until shared upload succeeds. An invoice draft is not proof of payment or delivery.</p></article></div>';};
 const groupBase=sidebarSubGroups;sidebarSubGroups=function(id){const g=groupBase(id).slice();if(id==='crm'&&canAccessTab('purchase'))g.push('Suppliers');return g;};
 const openBase=openSidebarSubGroup;openSidebarSubGroup=function(id,group){if(id==='crm'&&group==='Suppliers')return openBase('purchase','Suppliers');return openBase.apply(this,arguments);};
 document.addEventListener('click',async e=>{const b=e.target.closest('[data-dashboard-ai]');if(!b)return;const target=document.getElementById('psDashboardAIResult');b.disabled=true;try{if(!supabaseSession?.access_token)throw Error('Sign in to the shared workspace to request AI review.');if(!await saveRemoteWorkspace(true))throw Error('Sync the workspace before requesting AI review.');const response=await fetch('/api/project-review',{method:'POST',headers:{Authorization:'Bearer '+supabaseSession.access_token,'Content-Type':'application/json'},body:JSON.stringify({workspace:WORKSPACE_ID,scope:'dashboard'})});const result=await response.json();if(!response.ok)throw Error(result.error||'AI review unavailable');target.textContent=result.review+'\nBased on shared information saved '+result.asOf;}catch(error){target.textContent=error.message;}finally{b.disabled=false;}});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-business-open]');if(!b)return;if(b.dataset.businessType==='project'){psProjectSelected=b.dataset.businessOpen;psProjectTab='Overview';openSidebarSubGroup('jobs','Projects');}else{selectedSalesOrderId=b.dataset.businessOpen;salesOrderView='detail';openSidebarSubGroup('salesorders','Sales Orders');}});
})();
