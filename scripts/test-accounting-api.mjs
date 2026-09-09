import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes,createHmac} from 'node:crypto';
import handler from '../api/finance.js';
import {seal} from '../server/accounting.js';
Object.assign(process.env,{SUPABASE_URL:'https://database.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-test',XERO_CLIENT_ID:'test',XERO_CLIENT_SECRET:'test',XERO_TOKEN_KEY:randomBytes(32).toString('base64'),APP_ORIGIN:'https://app.invalid',CRON_SECRET:'cron-test',XERO_WEBHOOK_KEY:'webhook-test'});
let role='accountant',creates=0,ambiguous=false,oauth=null;
const doc={id:'11111111-1111-1111-1111-111111111111',workspace_id:'pool-bros-main',source_id:'SO-1',kind:'ACCREC',payload:{Type:'ACCREC',Contact:{ContactID:'22222222-2222-2222-2222-222222222222'}},xero_id:null};
const job={id:doc.id,document_id:doc.id,state:'pending',attempts:0};
const connection={workspace_id:doc.workspace_id,tenant_id:'tenant',tokens:seal({access_token:'test',expires_at:Date.now()+3600000})};
global.fetch=async(url,options={})=>{
 const u=new URL(url),body=options.body?(typeof options.body==='string'?JSON.parse(options.body):Object.fromEntries(options.body)):null;
 let value=[];
 if(u.hostname==='identity.xero.com')value={access_token:'new-test',refresh_token:'new-refresh',expires_in:1800};
 else if(u.pathname.endsWith('ps_finance_oauth')){if(options.method==='POST'){oauth=body;value=[body];}else if(options.method==='DELETE'){value=oauth?[oauth]:[];oauth=null;}}
 else if(u.pathname==='/auth/v1/user')value={id:'actor'};
 else if(u.pathname.endsWith('ps_finance_members'))value=role?[{role}]:[];
 else if(u.pathname.endsWith('ps_finance_lock'))value=true;
 else if(u.pathname.endsWith('ps_finance_connections'))value=[connection];
 else if(u.pathname.endsWith('ps_finance_jobs')){
  if(options.method==='PATCH')Object.assign(job,body);
  value=job.state==='pending'?[job]:[];
 }else if(u.pathname.endsWith('ps_finance_documents')){
  if(options.method==='PATCH')Object.assign(doc,body);
  value=u.searchParams.get('xero_id')==='not.is.null'&&!doc.xero_id?[]:[doc];
 }else if(u.hostname==='api.xero.com'){
  if(u.pathname==='/connections')value=[{tenantId:'tenant',tenantName:'Demo'}];
  else if(options.method==='POST'){creates++;if(ambiguous)throw Error('Connection lost after remote acceptance');value={Invoices:[{InvoiceID:'33333333-3333-3333-3333-333333333333',Status:'DRAFT',AmountPaid:0,AmountDue:24,Type:'ACCREC',Contact:doc.payload.Contact}]};}
  else value={Invoices:u.pathname.endsWith('/Invoices')?[]:[{InvoiceID:doc.xero_id,Status:'PAID',AmountPaid:24,AmountDue:0}]};
 }
 return {ok:true,status:200,json:async()=>value,headers:new Headers()};
};
async function call(action,{method='POST',body={},authorization='Bearer user',origin='https://app.invalid',signature,cookie}={}){
 const raw=JSON.stringify(body),req=Readable.from([Buffer.from(raw)]);Object.assign(req,{url:'/api/finance?action='+action,method,headers:{authorization,origin,cookie,...(signature?{'x-xero-signature':signature}:{})}});
 const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.body=v;return this;},end(){}};await handler(req,res);return res;
}
assert.equal((await call('sync',{origin:'https://evil.invalid'})).code,403);
role=null;assert.equal((await call('sync')).code,400);role='viewer';assert.equal((await call('sync')).code,400);role='accountant';
assert.equal((await call('webhook',{body:{events:[]},signature:'bad'})).code,401);
const signature=createHmac('sha256','webhook-test').update(JSON.stringify({events:[]})).digest('base64');assert.equal((await call('webhook',{body:{events:[]},signature})).code,200);
assert.equal((await call('sync')).code,200);assert.equal(creates,1);assert.equal(doc.status,'PAID');assert.equal(doc.amount_due,0);
await call('sync');assert.equal(creates,1);
// A lost response after submission must stop, even after the worker is invoked again.
doc.xero_id=null;job.state='pending';job.attempts=0;ambiguous=true;
await call('sync');assert.equal(job.state,'review');assert.equal(creates,2);await call('sync');assert.equal(creates,2);
role='admin';const start=await call('connect');assert.equal(start.code,200);assert(start.headers['Set-Cookie'].includes('HttpOnly; Secure; SameSite=Lax'));const state=new URL(start.body.url).searchParams.get('state');assert(state);assert(!JSON.stringify(start.body).includes('client_secret'));
const callback=await call('callback&state='+state+'&code=test',{method:'GET',cookie:'ps_xero_state='+state});assert.equal(callback.statusCode,303);assert.equal(callback.headers.Location,'https://app.invalid/?finance=connected');
assert.equal((await call('callback&state='+state+'&code=test',{method:'GET',cookie:'ps_xero_state='+state})).code,400);
assert.equal((await call('cron',{method:'GET',authorization:'Bearer wrong'})).code,401);
console.log('API: origin/role controls, signed webhook, draft export, returning paid status, repeat sync and ambiguous-create protection passed.');
