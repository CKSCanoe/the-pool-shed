/* Pool Shed v1.98.0 — project stage invoices on the Pool Shed ledger (blueprint step 7).
   "Raise invoice" on a ready stage opens the same invoice form Accounts uses, posts a numbered invoice (INV-…) on the
   ledger and marks the stage. The server refuses a second invoice for a stage that is still billed, and never bills
   more than the accepted quote plus approved extras. Stages queued to Xero before this release keep their status. */
async function psProjectInvoiceReview(jobId,phaseId){
 const j=data.jobs.find(j=>j.id===jobId),p=j?.project,ph=p?.phases.find(ph=>ph.id===phaseId);if(!ph)throw Error('Invoice stage not found');
 const recommendation=psProjectSummary(j).recommendations.find(r=>r.id===phaseId);if(!recommendation?.ready)throw Error('Confirm the accepted quote, agreed stage and completed tasks before invoicing.');
 if(!window.PoolShedSalesUI||typeof window.PoolShedSalesUI.inlineStage!=='function')throw Error('Invoicing is still loading. Try again in a moment.');
 if(!await saveRemoteWorkspace(true))throw Error('Sync the project successfully before invoicing. Resolve any shared-workspace conflict first.');
 window.PoolShedSalesUI.inlineStage(jobId,phaseId);
}
// Ledger position for the open project: each stage's invoice, what is paid and what is still owed.
const psProjectLedger={job:null,at:0,data:null,busy:false};
async function psProjectLedgerLoad(jobId,force){
 if(psProjectLedger.busy||!jobId||!(typeof canAccessTab==='function'&&canAccessTab('accounting')))return null;
 if(!force&&psProjectLedger.job===jobId&&Date.now()-psProjectLedger.at<60000)return psProjectLedger.data;
 const db=typeof window.__POOL_SHED_DB__==='function'?window.__POOL_SHED_DB__():null;if(!db||typeof db.rpc!=='function')return null;
 psProjectLedger.busy=true;
 try{const w=typeof window.__POOL_SHED_WORKSPACE_ID__==='function'?window.__POOL_SHED_WORKSPACE_ID__():'pool-bros-main',r=await db.rpc('ps_job_billing',{w,job_id:jobId});if(r.error)throw r.error;Object.assign(psProjectLedger,{job:jobId,at:Date.now(),data:r.data});}
 catch{Object.assign(psProjectLedger,{job:jobId,at:Date.now(),data:null});}
 finally{psProjectLedger.busy=false;}
 return psProjectLedger.data;
}
function psProjectLedgerPaint(){
 const b=psProjectLedger.data;if(!b||psProjectLedger.job!==psProjectSelected)return;
 const cash=n=>'£'+Number(n||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}),docs=b.documents||[];
 document.querySelectorAll('[data-project-payment]').forEach(el=>{
  const mine=docs.filter(d=>d.phase_id===el.dataset.projectPayment&&d.doc_type==='sales_invoice');
  if(!mine.length)return;const open=mine.reduce((n,d)=>n+Number(d.open||0),0);
  el.textContent=mine.map(d=>d.doc_number).join(', ')+' · '+(open>0?cash(open)+' still owed':'paid or credited');
 });
 const box=document.getElementById('psProjectLedgerSummary');if(!box)return;
 const paid=Math.max(0,Number(b.billed_gross||0)-Number(b.open_gross||0));
 box.innerHTML='<div class="project-360-exposure"><span>Agreed (before VAT)</span><strong>'+cash(b.contract_net)+'</strong><span>Invoiced (before VAT)</span><strong>'+cash(b.billed_net)+'</strong><span>Paid</span><strong>'+cash(paid)+'</strong><span>Still owed</span><strong>'+cash(b.open_gross)+'</strong></div>'+
  (docs.length?'<ul class="ps-ledger-docs">'+docs.map(d=>'<li><strong>'+escapeHtml(d.doc_number)+'</strong> '+escapeHtml(String(d.date||''))+' · '+escapeHtml(d.description||d.kind||'')+' · '+cash(d.gross)+(d.doc_type==='sales_invoice'?(Number(d.open)>0?' · '+cash(d.open)+' owed':' · paid'):'')+'</li>').join('')+'</ul>':'<p class="muted">No invoices on the ledger for this project yet.</p>');
}
// Repaint after each screen draw; reload the ledger after an invoice is posted (the form's modal closes).
(function(){
 if(typeof render!=='function')return;const original=render;
 render=function(){const out=original.apply(this,arguments);try{if(active==='jobs'&&selectedSubPage('jobs')==='Projects'&&psProjectSelected){psProjectLedgerPaint();psProjectLedgerLoad(psProjectSelected,false).then(psProjectLedgerPaint);}}catch{}return out;};
 window.render=render;
 document.addEventListener('click',e=>{const t=e.target&&e.target.closest&&e.target.closest('[data-si-action="close-modal"],[data-project-finance-refresh]');if(t&&psProjectSelected)setTimeout(()=>psProjectLedgerLoad(psProjectSelected,true).then(psProjectLedgerPaint),300);});
})();

// v1.71: a stage (such as the deposit) can be set as a % of the agreed value: 50% when the supplier needs it, 30% otherwise.
document.addEventListener('input',e=>{const pct=e.target&&e.target.closest&&e.target.closest('[data-project-phase-pct]');if(!pct)return;const f=pct.form,agreed=Number(pct.dataset.projectPhasePct||0),p=Number(pct.value||0);
 if(!f||!(agreed>0)||!(p>0))return;const amt=f.querySelector('[name="amountNet"]');if(amt)amt.value=(Math.round(agreed*p)/100).toFixed(2);const nm=f.querySelector('[name="name"]');if(nm&&!nm.value)nm.value=p+'% deposit';});
