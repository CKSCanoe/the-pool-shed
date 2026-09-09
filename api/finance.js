import {randomUUID,randomBytes} from 'node:crypto';
import {hash,seal,unseal,validSignature,validateInvoice,db,eq,audit,tokenRequest,xero,applyRemote} from '../server/accounting.js';
export const config={api:{bodyParser:false},maxDuration:60};
const scopes='offline_access accounting.invoices accounting.contacts.read accounting.settings.read accounting.payments.read';
const configured=()=>['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','XERO_CLIENT_ID','XERO_CLIENT_SECRET','XERO_TOKEN_KEY','APP_ORIGIN','CRON_SECRET','XERO_WEBHOOK_KEY'].every(k=>process.env[k]);
const send=(res,status,value)=>res.status(status).json(value);
async function rawBody(req){let chunks=[],n=0;for await(const b of req){n+=b.length;if(n>256000)throw Error('Request too large');chunks.push(b);}return Buffer.concat(chunks);}
async function identity(req,w,write=false){
 const authorization=req.headers.authorization||'';if(!authorization.startsWith('Bearer '))throw Error('Sign in to continue');
 const r=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:authorization},signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Sign in to continue');const u=await r.json();
 const members=await db('ps_finance_members?workspace_id=eq.'+eq(w)+'&user_id=eq.'+eq(u.id));
 if(!members.length||(write&&!['accountant','admin'].includes(members[0].role)))throw Error('Finance access has not been granted');return {...u,financeRole:members[0].role};
}
async function withConnection(w,fn){
 const lease=randomUUID();if(!await db('rpc/ps_finance_lock',{method:'POST',body:{w,token:lease}}))throw Error('Synchronisation is busy. Try again shortly.');
 try{const [c]=await db('ps_finance_connections?workspace_id=eq.'+eq(w));return await fn(c);}
 finally{await db('ps_finance_connections?workspace_id=eq.'+eq(w)+'&lease_id=eq.'+lease,{method:'PATCH',body:{lease_until:null,lease_id:null}});}
}
async function worker(w){return withConnection(w,async c=>{
 if(!c.tenant_id)return {connected:false};
 const jobs=await db('ps_finance_jobs?workspace_id=eq.'+eq(w)+'&state=eq.pending&next_attempt=lte.'+eq(new Date().toISOString())+'&order=created_at&limit=1');
 for(const job of jobs){
  let uncertain=job.attempts>0,mapped=false;
  try{
   const [d]=await db('ps_finance_documents?id=eq.'+job.document_id);let remote;mapped=!!d.xero_id;
   if(d.xero_id){remote=(await xero(c,'Invoices/'+d.xero_id)).Invoices?.[0];}
   else {
    // Never automatically resend an ambiguous create. Review/reconciliation protects against expired provider idempotency caches.
    if(job.attempts>0)throw Error('Previous submission needs reconciliation before another create is allowed');
    const existing=(await xero(c,'Invoices?where='+eq('Reference=="PS-'+d.id+'"'))).Invoices||[];
    if(existing.length>1)throw Error('Multiple matching Xero documents: accountant review required');
    if(existing.length===1){remote=existing[0];if(remote.Type!==d.kind||remote.Contact?.ContactID!==d.payload.Contact.ContactID)throw Error('Reference matches different invoice details; accountant review required');}
    else {
     await db('ps_finance_jobs?id=eq.'+job.id,{method:'PATCH',body:{attempts:1}});
     uncertain=true;
     const result=await xero(c,'Invoices',{method:'POST',key:d.id,body:{Invoices:[{...d.payload,Reference:'PS-'+d.id}]}});
     remote=result.Invoices?.[0];if(!remote?.InvoiceID||remote.HasErrors)throw Error('Xero did not accept the draft; review required');
    }
    await db('ps_finance_documents?id=eq.'+d.id,{method:'PATCH',body:{xero_id:remote.InvoiceID}});mapped=true;
   }
   await applyRemote(w,remote);
   await db('ps_finance_jobs?id=eq.'+job.id,{method:'PATCH',body:{state:'done',last_error:null}});
   await audit(w,'xero-worker','draft_synchronised',{document:d.id,xeroId:remote.InvoiceID});
  }catch(e){const failures=(job.failures||0)+1;const retry=(!uncertain||mapped)&&failures<6;await db('ps_finance_jobs?id=eq.'+job.id,{method:'PATCH',body:{state:retry?'pending':'review',failures,next_attempt:new Date(Date.now()+Math.max(e.retryAfter||0,60*Math.pow(2,failures))*1000).toISOString(),last_error:e.message}});}
 }
 // Cycle through linked records, including paid ones (payments can be reversed).
 const documents=await db('ps_finance_documents?workspace_id=eq.'+eq(w)+'&xero_id=not.is.null&order=checked_at.asc.nullsfirst&limit=3');
 for(const d of documents){const i=(await xero(c,'Invoices/'+d.xero_id)).Invoices?.[0];if(JSON.stringify(d.remote)!==JSON.stringify(i))await audit(w,'xero-worker','invoice_refreshed',{document:d.id,status:i.Status,paid:i.AmountPaid,due:i.AmountDue});await applyRemote(w,i);await db('ps_finance_documents?id=eq.'+d.id,{method:'PATCH',body:{checked_at:new Date().toISOString()}});}
 await db('ps_finance_connections?workspace_id=eq.'+eq(w),{method:'PATCH',body:{last_sync:new Date().toISOString(),last_error:null}});
 return {processed:jobs.length,checked:documents.length};
});}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const url=new URL(req.url,process.env.APP_ORIGIN||'http://localhost'),action=url.searchParams.get('action')||'status';
 if(!configured())return send(res,503,{error:'Accounting is not configured. Follow ACCOUNTING-SETUP.md on the server.'});
 try{
  if(action==='webhook'){
   if(req.method!=='POST')return send(res,405,{error:'POST required'});
   const raw=await rawBody(req);if(!validSignature(raw,req.headers['x-xero-signature'],process.env.XERO_WEBHOOK_KEY))return send(res,401,{error:'Invalid signature'});
   const payload=JSON.parse(raw);if(!Array.isArray(payload.events))return send(res,400,{error:'Invalid event envelope'});
   await db('rpc/ps_finance_webhook',{method:'POST',timeout:3000,body:{d:hash(raw),envelope:payload}});
   return send(res,200,{accepted:true});
  }
  if(action==='callback'){
   const state=url.searchParams.get('state')||'',cookie=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('ps_xero_state='))?.slice(14);
   if(!state||cookie!==state)throw Error('Authorisation session expired. Start again.');
   const rows=await db('ps_finance_oauth?state_hash=eq.'+hash(state)+'&expires_at=gt.'+eq(new Date().toISOString()),{method:'DELETE'});
   if(rows.length!==1)throw Error('Authorisation session expired. Start again.');const s=rows[0];
   const membership=await db('ps_finance_members?workspace_id=eq.'+eq(s.workspace_id)+'&user_id=eq.'+eq(s.user_id));if(membership[0]?.role!=='admin')throw Error('Finance administrator access is required');
   const tokens=await tokenRequest({grant_type:'authorization_code',code:url.searchParams.get('code')||'',redirect_uri:process.env.APP_ORIGIN+'/api/finance?action=callback'});
   const existing=await db('ps_finance_connections?workspace_id=eq.'+eq(s.workspace_id));
   if(existing.length)await withConnection(s.workspace_id,async c=>{
    const r=await fetch('https://api.xero.com/connections',{headers:{Authorization:'Bearer '+tokens.access_token},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Could not verify organisation');const tenants=await r.json();
    if(c.tenant_id&&!tenants.some(t=>t.tenantId===c.tenant_id))throw Error('Reconnect the previously linked Xero organisation');
    await db('ps_finance_connections?workspace_id=eq.'+eq(s.workspace_id),{method:'PATCH',body:{tokens:seal(tokens),last_error:null}});
   });else await db('ps_finance_connections',{method:'POST',body:{workspace_id:s.workspace_id,tokens:seal(tokens)}});
   await audit(s.workspace_id,s.user_id,'xero_authorised',{});
   res.setHeader('Set-Cookie','ps_xero_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/finance; Max-Age=0');res.statusCode=303;res.setHeader('Location',process.env.APP_ORIGIN+'/?finance=connected');return res.end();
  }
  if(action==='cron'){
   if(req.headers.authorization!=='Bearer '+process.env.CRON_SECRET)return send(res,401,{error:'Unauthorised'});
   // One workspace per invocation; configure a schedule per deployment.
   const w=process.env.FINANCE_WORKSPACE_ID||'pool-bros-main';
   try{return send(res,200,await worker(w));}catch(e){await db('ps_finance_connections?workspace_id=eq.'+eq(w),{method:'PATCH',body:{last_error:e.message}});throw e;}
  }
  const write=req.method==='POST';if(!['GET','POST'].includes(req.method))return send(res,405,{error:'Unsupported method'});
  if(write&&req.headers.origin!==process.env.APP_ORIGIN)return send(res,403,{error:'Invalid origin'});
  const w=url.searchParams.get('workspace')||'pool-bros-main',u=await identity(req,w,write);
  const body=write?JSON.parse((await rawBody(req)).toString()||'{}'):{};
  if(action==='status'&&!write){
   const [connections,documents,jobs]=await Promise.all([db('ps_finance_connections?workspace_id=eq.'+eq(w)+'&select=tenant_id,tenant_name,last_sync,last_error'),db('ps_finance_documents?workspace_id=eq.'+eq(w)+'&select=id,source_id,kind,xero_id,xero_number,status,amount_due,amount_paid,amount_credited,currency,updated_at&order=created_at.desc&limit=250'),db('ps_finance_jobs?workspace_id=eq.'+eq(w)+'&state=neq.done&select=id,document_id,state,last_error&limit=250')]);
   return send(res,200,{connection:connections[0]||null,documents,jobs,role:u.financeRole});
  }
  if(action==='connect'&&write){
   if(u.financeRole!=='admin')throw Error('A finance administrator must connect Xero');
   const state=randomBytes(32).toString('hex');await db('ps_finance_oauth',{method:'POST',body:{state_hash:hash(state),workspace_id:w,user_id:u.id,expires_at:new Date(Date.now()+600000).toISOString()}});
   res.setHeader('Set-Cookie','ps_xero_state='+state+'; HttpOnly; Secure; SameSite=Lax; Path=/api/finance; Max-Age=600');
   return send(res,200,{url:'https://login.xero.com/identity/connect/authorize?'+new URLSearchParams({response_type:'code',client_id:process.env.XERO_CLIENT_ID,redirect_uri:process.env.APP_ORIGIN+'/api/finance?action=callback',scope:scopes,state})});
  }
  if(action==='tenants'&&!write)return send(res,200,await withConnection(w,async c=>{const t=unseal(c.tokens);const r=await fetch('https://api.xero.com/connections',{headers:{Authorization:'Bearer '+t.access_token},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Reconnect Xero');return (await r.json()).map(t=>({id:t.tenantId,name:t.tenantName}));}));
  if(action==='tenant'&&write){
   if(u.financeRole!=='admin')throw Error('A finance administrator must select the organisation');
   return send(res,200,await withConnection(w,async c=>{
    if(c.tenant_id&&c.tenant_id!==body.id)throw Error('Changing an active accounting organisation requires a migration');
    const t=unseal(c.tokens),r=await fetch('https://api.xero.com/connections',{headers:{Authorization:'Bearer '+t.access_token},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Reconnect Xero');const tenant=(await r.json()).find(t=>t.tenantId===body.id);if(!tenant)throw Error('Choose an authorised organisation');
    await db('ps_finance_connections?workspace_id=eq.'+eq(w),{method:'PATCH',body:{tenant_id:tenant.tenantId,tenant_name:tenant.tenantName}});await audit(w,u.id,'organisation_selected',{tenant:tenant.tenantId});return {connected:true};
   }));
  }
  if(action==='lookups'&&!write)return send(res,200,await withConnection(w,async c=>{
   if(!c.tenant_id)throw Error('Select your Xero organisation first');
   const page=Number(url.searchParams.get('page')||1);if(!Number.isInteger(page)||page<1||page>10000)throw Error('Invalid page');
   const contacts=await xero(c,'Contacts?page='+page+'&pageSize=100');const accounts=await xero(c,'Accounts');const taxes=await xero(c,'TaxRates');
   return {contacts:contacts.Contacts,accounts:accounts.Accounts,taxes:taxes.TaxRates,page};
  }));
  if(action==='queue'&&write){
   const invoice=validateInvoice(body.invoice),source=String(body.source||'').trim();if(!source||source.length>200)throw Error('Enter the linked order reference');
   const [c]=await db('ps_finance_connections?workspace_id=eq.'+eq(w));if(!c?.tenant_id)throw Error('Connect and select Xero first');
   const id=await db('rpc/ps_finance_enqueue',{method:'POST',body:{w,actor:u.id,doc:randomUUID(),source,kind_value:invoice.Type,invoice}});return send(res,200,{id});
  }
  if(action==='reconcile'&&write)return send(res,200,await withConnection(w,async c=>{
   const [d]=await db('ps_finance_documents?workspace_id=eq.'+eq(w)+'&id=eq.'+eq(body.document));if(!d)throw Error('Document not found');
   const matches=(await xero(c,'Invoices?where='+eq('Reference=="PS-'+d.id+'"'))).Invoices||[];
   if(matches.length!==1)throw Error('No unique matching invoice found. Accountant review is required; no new invoice was sent.');
   if(matches[0].Type!==d.kind||matches[0].Contact?.ContactID!==d.payload.Contact.ContactID)throw Error('The matching invoice has different details. Accountant review required.');
   await db('ps_finance_documents?id=eq.'+d.id,{method:'PATCH',body:{xero_id:matches[0].InvoiceID}});await applyRemote(w,matches[0]);
   await db('ps_finance_jobs?document_id=eq.'+d.id,{method:'PATCH',body:{state:'done',last_error:null}});await audit(w,u.id,'document_reconciled',{document:d.id,xeroId:matches[0].InvoiceID});return {linked:true};
  }));
  if(action==='sync'&&write)return send(res,200,await worker(w));
  return send(res,404,{error:'Unknown accounting action'});
 }catch(e){return send(res,400,{error:e.message||'Accounting operation failed'});}
}
