/* Server-backed finance view. Never writes remote payment data into stock or order fulfilment. */
(function(){
 let state=null,error='',busy=false,lookups=null,page=1,loadedUser=null;
 const esc=v=>escapeHtml(String(v??''));
 async function api(action,body){
  const session=typeof supabaseSession!=='undefined'?supabaseSession:null;
  if(!session?.access_token)throw Error('Sign in online to use accounting. Offline warehouse work remains available.');
  const r=await fetch('/api/finance?action='+action+'&workspace='+encodeURIComponent(WORKSPACE_ID),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  loadedUser=session.user?.id||session.access_token;
  const text=await r.text();let result;try{result=JSON.parse(text);}catch{throw Error('The accounting server is not deployed. See the accounting setup guide.');}if(!r.ok)throw Error(result.error||'Accounting request failed');return result;
 }
 function paint(){
  if(loadedUser!==(supabaseSession?.user?.id||supabaseSession?.access_token||null)){state=null;lookups=null;}
  const target=document.getElementById('psFinance');if(!target)return;
  const c=state?.connection;
  target.innerHTML='<header><h2>Accounting & Xero</h2><p class="muted">Review drafts here. Approve them in Xero. Payment balances return automatically once the scheduled sync is configured.</p></header>'+
   (error?'<p role="alert" class="ps-finance-alert">'+esc(error)+'</p>':'')+
   '<div class="action-row"><button data-finance="refresh">Refresh</button><button data-finance="connect">'+(c?'Reconnect Xero':'Connect Xero')+'</button>'+(c?'<button data-finance="tenants">Select organisation</button><button data-finance="sync">Check for updates</button>':'')+'</div>'+
   '<p><strong>'+esc(c?.tenant_name||'Not connected')+'</strong> · '+(busy?'Working…':c?.last_sync?'Last checked '+esc(new Date(c.last_sync).toLocaleString()):'No successful sync yet')+'</p>'+(c?.last_error?'<p role="alert">'+esc(c.last_error)+'</p>':'')+
   '<div id="psFinanceChoice"></div>'+
   (c?.tenant_id?'<details><summary>Create a reviewed Xero draft</summary><p>Choose a sales order, then check every line. This creates one draft for the full order. Partial invoices and corrections need accountant review in Xero.</p><form id="psFinanceDraft"><div class="field-grid"><label>Sales order<select name="source" required><option value="">Choose order</option>'+data.salesOrders.map(o=>'<option value="'+esc(o.id)+'">'+esc(o.id)+'</option>').join('')+'</select></label><label>Invoice date<input type="date" name="date" required value="'+new Date().toISOString().slice(0,10)+'"></label><label>Due date<input type="date" name="due" required></label><label>Currency<input name="currency" required pattern="[A-Z]{3}" value="GBP"></label></div><button type="button" data-finance="lookups">Load Xero contacts, accounts and tax rates</button><div id="psFinanceMappings"></div><div id="psFinanceLines" class="ps-table-region"></div><label><input type="checkbox" name="reviewed" required> I have reviewed the contact, lines, prices, currency, account and tax selections.</label><p><button type="submit">Queue draft for Xero</button></p></form></details>':'')+
   '<h3>Linked invoices and bills</h3><p class="muted">Latest 250 linked documents. Amounts are shown in each document’s currency. Financial status does not change dispatch status.</p><div class="ps-table-region"><table><thead><tr><th>Order / source</th><th>Xero invoice</th><th>Status</th><th>Paid</th><th>Credited</th><th>Due</th><th>Checked</th></tr></thead><tbody>'+((state?.documents||[]).map(d=>'<tr><td>'+esc(d.source_id)+'</td><td>'+esc(d.xero_number||'Awaiting export')+'</td><td>'+esc(d.status)+'</td><td>'+esc(d.amount_paid??'—')+' '+esc(d.currency)+'</td><td>'+esc(d.amount_credited??'—')+'</td><td>'+esc(d.amount_due??'—')+'</td><td>'+esc(new Date(d.updated_at).toLocaleString())+'</td></tr>').join('')||'<tr><td colspan="7">No linked documents yet.</td></tr>')+'</tbody></table></div>'+
   '<h3>Sync queue & exceptions</h3>'+((state?.jobs||[]).map(j=>'<p><strong>'+esc(j.state)+'</strong> · '+esc(j.last_error||'Waiting for scheduled sync')+(j.state==='review'?'<button data-reconcile="'+esc(j.document_id)+'">Find matching Xero draft</button>':'')+'</p>').join('')||'<p>No pending jobs.</p>');
 }
 function mappings(){const el=document.getElementById('psFinanceMappings');if(!el||!lookups)return;el.innerHTML='<div class="field-grid"><label>Xero contact<select name="contact" required><option value="">Choose contact</option>'+lookups.contacts.map(c=>'<option value="'+esc(c.ContactID)+'">'+esc(c.Name)+'</option>').join('')+'</select></label><label>Income account<select name="account" required><option value="">Choose account</option>'+lookups.accounts.filter(a=>a.Status==='ACTIVE'&&['REVENUE','SALES','OTHERINCOME'].includes(a.Type)).map(a=>'<option value="'+esc(a.Code)+'">'+esc(a.Code+' · '+a.Name)+'</option>').join('')+'</select></label><label>Tax treatment for all lines<select name="tax" required><option value="">Choose tax treatment</option>'+lookups.taxes.filter(t=>t.Status==='ACTIVE').map(t=>'<option value="'+esc(t.TaxType)+'">'+esc(t.Name)+'</option>').join('')+'</select></label></div><p>Contacts page '+page+' <button type="button" data-finance="nextcontacts">Next contacts</button>. For mixed tax treatment, create the invoice in Xero and arrange a reviewed link.</p>';}
 window.psFinanceRequest=api;
 window.psFinanceSnapshot=()=>loadedUser===(supabaseSession?.user?.id||supabaseSession?.access_token||null)?state:null;
 window.psFinanceRefresh=async()=>{state=await api('status');return state;};
 const baseInvoice=renderInvoiceModal;
 renderInvoiceModal=function(){baseInvoice();const modal=document.getElementById('invoiceModal');if(!invoiceConfirmOrderId||!modal)return;
  const linked=state?.documents?.find(d=>d.source_id===invoiceConfirmOrderId&&d.kind==='ACCREC');
  const panel=document.createElement('div');panel.className='notice-row';panel.innerHTML='<p>'+ (linked?'Xero: '+esc(linked.status)+' · Paid '+esc(linked.amount_paid??'—')+' · Due '+esc(linked.amount_due??'—')+' '+esc(linked.currency):'For a Xero invoice and payment tracking, use Accounting & Xero.')+'</p><button type="button" data-open-accounting>Open accounting</button>';modal.querySelector('.modal-body')?.prepend(panel);
  if(linked)modal.querySelector('button[type="submit"]')?.remove();
 };
 document.addEventListener('click',e=>{if(e.target.closest('[data-open-accounting]')){closeInvoiceModal();openSidebarSubGroup('settings','Accounting & Xero');}});
 const baseGroups=sidebarSubGroups;sidebarSubGroups=function(id){const g=baseGroups(id).slice();if(id==='settings'&&!g.includes('Accounting & Xero'))g.push('Accounting & Xero');return g;};
 const baseRender=render;render=function(){if(loadedUser!==(supabaseSession?.user?.id||supabaseSession?.access_token||null)){state=null;lookups=null;}baseRender();if(active==='settings'&&selectedSubPage('settings')==='Accounting & Xero'){const screen=document.getElementById('screen-settings');screen.querySelectorAll(':scope > :not(.ps-section-nav)').forEach(e=>e.remove());const section=document.createElement('section');section.id='psFinance';section.className='panel';section.style.gridColumn='1/-1';screen.append(section);paint();}};
 document.addEventListener('change',e=>{if(e.target.matches('#psFinanceDraft select[name="source"]')){const order=data.salesOrders.find(o=>o.id===e.target.value);document.getElementById('psFinanceLines').innerHTML=order?'<table><thead><tr><th>Item</th><th>Quantity</th><th>Net unit price</th></tr></thead><tbody>'+order.lines.map(l=>'<tr><td>'+esc(product(l.productId)?.name||l.productId)+'</td><td>'+esc(l.qty)+'</td><td>'+esc(salesOrderLinePrice(order,l))+'</td></tr>').join('')+'</tbody></table>':'';}});
 document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-finance],[data-reconcile]');if(!b||busy)return;const action=b.dataset.finance;busy=true;error='';b.disabled=true;
  try{
   if(b.dataset.reconcile)await api('reconcile',{document:b.dataset.reconcile});
   else if(action==='connect'){const r=await api('connect',{});location.assign(r.url);return;}
   else if(action==='sync')await api('sync',{});
   else if(action==='tenants'){const tenants=await api('tenants');document.getElementById('psFinanceChoice').innerHTML=tenants.map(t=>'<button data-tenant="'+esc(t.id)+'">Use '+esc(t.name)+'</button>').join('');return;}
   else if(action==='lookups'||action==='nextcontacts'){page=action==='nextcontacts'?page+1:1;lookups=await api('lookups&page='+page);mappings();return;}
   state=await api('status');
  }catch(e){error=e.message;}finally{busy=false;b.disabled=false;if(!['lookups','nextcontacts','tenants'].includes(action)||error)paint();}
 });
 document.addEventListener('click',async e=>{const b=e.target.closest('[data-tenant]');if(!b||busy)return;busy=true;try{await api('tenant',{id:b.dataset.tenant});state=await api('status');error='';}catch(e){error=e.message;}finally{busy=false;paint();}});
 document.addEventListener('submit',async e=>{
  if(e.target.id!=='psFinanceDraft')return;e.preventDefault();if(busy)return;busy=true;
  try{const v=Object.fromEntries(new FormData(e.target)),o=data.salesOrders.find(o=>o.id===v.source);if(o?.jobId&&data.jobs.find(j=>j.id===o.jobId)?.project?.billingMode==='phases')throw Error('Use the project invoice stages to avoid billing this order twice.');if(!o||!v.reviewed||!v.contact)throw Error('Choose an order, load mappings and complete the review.');
   await api('queue',{source:o.id,invoice:{Type:'ACCREC',Contact:{ContactID:v.contact},Date:v.date,DueDate:v.due,CurrencyCode:v.currency,LineItems:o.lines.map(l=>({Description:product(l.productId)?.name||l.productId,Quantity:Number(l.qty),UnitAmount:salesOrderLinePrice(o,l),AccountCode:v.account,TaxType:v.tax}))}});state=await api('status');error='';
  }catch(e){error=e.message;}finally{busy=false;paint();}
 });
 // Refresh visible financial status without touching the operational workspace or offline queue.
 setInterval(async()=>{if(document.hidden||busy||!document.getElementById('psFinance')||document.activeElement?.closest('#psFinanceDraft')||document.querySelector('#psFinanceDraft select[name="source"]')?.value)return;try{state=await api('status');error='';paint();}catch(e){error=e.message;paint();}},60000);
})();
