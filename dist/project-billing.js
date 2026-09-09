async function psProjectInvoiceReview(jobId,phaseId){
 const j=data.jobs.find(j=>j.id===jobId),p=j?.project,ph=p?.phases.find(ph=>ph.id===phaseId);if(!ph)throw Error('Invoice stage not found');
 const recommendation=psProjectSummary(j).recommendations.find(r=>r.id===phaseId);if(!recommendation?.ready)throw Error('Confirm the accepted quote, agreed stage and completed tasks before invoicing.');
 const refs=await psFinanceRequest('lookups'),esc=v=>escapeHtml(String(v??''));
 const choices=(values,label)=>'<option value="">'+label+'</option>'+values.map(v=>'<option value="'+esc(v.id)+'">'+esc(v.name)+'</option>').join('');
 document.getElementById('psProjectInvoiceReview').innerHTML='<form id="psProjectPhaseInvoice"><h3>Review '+esc(ph.name)+' · '+money(ph.amountNet)+' net</h3><input type="hidden" name="jobId" value="'+esc(jobId)+'"><input type="hidden" name="phaseId" value="'+esc(phaseId)+'"><div class="ps-project-fields"><label>Xero customer<select name="contact" required>'+choices(refs.contacts.map(c=>({id:c.ContactID,name:c.Name})),'Choose customer')+'</select></label><label>Income account<select name="account" required>'+choices(refs.accounts.filter(a=>a.Status==='ACTIVE'&&['REVENUE','SALES','OTHERINCOME'].includes(a.Type)).map(a=>({id:a.Code,name:a.Code+' · '+a.Name})),'Choose account')+'</select></label><label>Tax treatment<select name="tax" required>'+choices(refs.taxes.filter(t=>t.Status==='ACTIVE').map(t=>({id:t.TaxType,name:t.Name})),'Choose tax')+'</select></label><label>Invoice date<input type="date" name="date" value="'+todayIso()+'" required></label><label>Payment due date<input type="date" name="due" required></label></div><label class="ps-project-check"><input type="checkbox" required> I confirm the agreed stage is billable, the customer is correct and no duplicate invoice exists.</label><p><button type="submit">Queue reviewed stage draft</button></p><p class="muted">A Xero draft will be created; approve and send it in Xero. The server checks the contract limit and existing project billing.</p></form>';
}
document.addEventListener('submit',async e=>{
 if(e.target.id!=='psProjectPhaseInvoice')return;e.preventDefault();const button=e.target.querySelector('button[type="submit"]');if(button.disabled)return;button.disabled=true;
 try{
  const v=Object.fromEntries(new FormData(e.target)),j=data.jobs.find(j=>j.id===v.jobId),ph=j?.project?.phases.find(ph=>ph.id===v.phaseId);
  if(!ph||!psProjectSummary(j).recommendations.find(r=>r.id===ph.id)?.ready)throw Error('Stage is no longer ready for invoicing.');
  if(!await saveRemoteWorkspace(true))throw Error('Sync the project successfully before queuing an invoice. Resolve any shared-workspace conflict first.');
  const response=await psFinanceRequest('queue',{source:'PROJECT:'+j.id+':'+ph.id,invoice:{Type:'ACCREC',Contact:{ContactID:v.contact},Date:v.date,DueDate:v.due,CurrencyCode:'GBP',LineItems:[{Description:j.name+' — '+ph.name,Quantity:1,UnitAmount:ph.amountNet,AccountCode:v.account,TaxType:v.tax}]}});
  ph.invoiceRequested=true;ph.financeDocumentId=response.id;j.project.audit.push({id:crypto.randomUUID(),action:'stage_invoice_queued',at:new Date().toISOString(),user:currentUser().name,details:{phase:ph.id,document:response.id}});
  if(saveAppData()===false)throw Error('The invoice is queued on the server, but local status could not be saved. Refresh accounting before retrying.');
  await psFinanceRefresh();render();toast('Stage draft queued. Xero approval is still required.');
 }catch(e){toast(e.message);button.disabled=false;}
});
// Update only financial labels, so an in-progress form is never rebuilt by polling.
setInterval(async()=>{
 if(document.hidden||active!=='jobs'||selectedSubPage('jobs')!=='Projects'||!supabaseSession?.access_token)return;
 try{const state=await psFinanceRefresh();document.querySelectorAll('[data-project-payment]').forEach(el=>{const d=state.documents?.find(d=>d.source_id==='PROJECT:'+psProjectSelected+':'+el.dataset.projectPayment);if(d)el.textContent=d.status+' · '+(d.xero_number||'Awaiting number')+' · Paid '+(d.amount_paid??'—')+' · Due '+(d.amount_due??'—')+' '+(d.currency||'')+' including VAT';});}catch{/* Current amounts remain labelled with their status; manual refresh reports errors. */}
},60000);
