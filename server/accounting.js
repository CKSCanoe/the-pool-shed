import {createCipheriv,createDecipheriv,randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
export const XERO_SCOPES=['offline_access','accounting.invoices','accounting.contacts.read','accounting.settings.read','accounting.payments.read'];
export function xeroIntegrationReadiness(env=process.env){
 const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','APP_ORIGIN','XERO_CLIENT_ID','XERO_CLIENT_SECRET','XERO_TOKEN_KEY','CRON_SECRET','XERO_WEBHOOK_KEY'];
 const missing=required.filter(k=>!String(env[k]||'').trim());
 const mode=String(env.XERO_INTEGRATION_MODE||'ready').trim().toLowerCase()==='live'?'live':'ready';
 const origin=String(env.APP_ORIGIN||'').replace(/\/$/,'');
 const tokenKeyOk=(()=>{try{return Buffer.from(env.XERO_TOKEN_KEY||'','base64').length===32}catch{return false}})();
 const appConfigured=!missing.includes('XERO_CLIENT_ID')&&!missing.includes('XERO_CLIENT_SECRET')&&!missing.includes('APP_ORIGIN')&&tokenKeyOk;
 const securityConfigured=tokenKeyOk&&!missing.includes('XERO_WEBHOOK_KEY')&&!missing.includes('CRON_SECRET');
 const platformConfigured=!missing.includes('SUPABASE_URL')&&!missing.includes('SUPABASE_SERVICE_ROLE_KEY');
 const readyToConnect=missing.length===0&&tokenKeyOk;
 return {mode,liveEnabled:mode==='live'&&readyToConnect,readyToConnect,appConfigured,securityConfigured,platformConfigured,missing:tokenKeyOk?missing:[...new Set([...missing,'XERO_TOKEN_KEY'])],scopes:[...XERO_SCOPES],redirectUri:origin?origin+'/api/finance?action=callback':'',secretsExposed:false};
}
export function requireXeroLive(env=process.env){
 const state=xeroIntegrationReadiness(env);
 if(!state.liveEnabled){const e=Error(state.readyToConnect?'Xero is Ready to Connect but live connection is locked until production acceptance.':'Xero live connection is locked because integration prerequisites are incomplete.');e.statusCode=423;e.readiness=state;throw e;}
 return state;
}

export const hash = value => createHash('sha256').update(value).digest('hex');
export function seal(value,key=process.env.XERO_TOKEN_KEY){
 const k=Buffer.from(key||'','base64');if(k.length!==32)throw Error('Token encryption key must contain 32 bytes');
 const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',k,iv);
 return Buffer.concat([iv,c.update(JSON.stringify(value)),c.final(),c.getAuthTag()]).toString('base64');
}
export function unseal(value,key=process.env.XERO_TOKEN_KEY){
 const b=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',Buffer.from(key||'','base64'),b.subarray(0,12));
 d.setAuthTag(b.subarray(-16));return JSON.parse(Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString());
}
export function validSignature(raw,signature,key){
 if(!key||typeof signature!=='string')return false;
 const a=createHmac('sha256',key).update(raw).digest(),b=Buffer.from(signature,'base64');
 return a.length===b.length&&timingSafeEqual(a,b);
}
export function validateInvoice(v){
 if(!v||!['ACCREC','ACCPAY'].includes(v.Type))throw Error('Choose sales invoice or supplier bill');
 if(!/^[a-f0-9-]{36}$/i.test(v.Contact?.ContactID||''))throw Error('Choose a Xero contact');
 for(const field of ['Date','DueDate'])if(!/^\d{4}-\d{2}-\d{2}$/.test(v[field]||'')||!Number.isFinite(Date.parse(v[field]))||new Date(v[field]).toISOString().slice(0,10)!==v[field])throw Error('Enter valid dates');
 if(v.DueDate<v.Date)throw Error('Due date must follow invoice date');
 if(!Array.isArray(v.LineItems)||!v.LineItems.length||v.LineItems.length>200)throw Error('Enter 1–200 invoice lines');
 const lines=v.LineItems.map(l=>{
  if(!String(l.Description||'').trim()||!Number.isFinite(l.Quantity)||l.Quantity<=0||!Number.isFinite(l.UnitAmount)||l.UnitAmount<0||!l.AccountCode||!l.TaxType)throw Error('Check description, quantity, price, account and tax on every line');
  return {Description:String(l.Description).slice(0,4000),Quantity:l.Quantity,UnitAmount:l.UnitAmount,AccountCode:String(l.AccountCode),TaxType:String(l.TaxType)};
 });
 if(!/^[A-Z]{3}$/.test(v.CurrencyCode||''))throw Error('Choose the invoice currency');
 return {Type:v.Type,Contact:{ContactID:v.Contact.ContactID},Date:v.Date,DueDate:v.DueDate,CurrencyCode:v.CurrencyCode,LineAmountTypes:'Exclusive',Status:'DRAFT',LineItems:lines};
}
export async function db(path,{method='GET',body,prefer,timeout=12000}={}){
 const r=await fetch(process.env.SUPABASE_URL+'/rest/v1/'+path,{method,signal:AbortSignal.timeout(timeout),headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:prefer||'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!r.ok)throw Error('Database operation failed ('+r.status+')');return r.status===204?null:await r.json();
}
export const eq=v=>encodeURIComponent(v);
export async function audit(w,actor,action,detail){return db('ps_finance_audit',{method:'POST',body:{workspace_id:w,actor,action,detail}});}
export async function tokenRequest(params){
 const r=await fetch('https://identity.xero.com/connect/token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Basic '+Buffer.from(process.env.XERO_CLIENT_ID+':'+process.env.XERO_CLIENT_SECRET).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
 if(!r.ok)throw Error('Xero authorisation needs attention ('+r.status+')');const t=await r.json();t.expires_at=Date.now()+t.expires_in*1000;return t;
}
export async function xero(c,path,{method='GET',body,key,headers={}}={}){
 // Call only while holding the workspace lease, including token refresh.
 let t=unseal(c.tokens);
 if(t.expires_at<Date.now()+90000){t=await tokenRequest({grant_type:'refresh_token',refresh_token:t.refresh_token});c.tokens=seal(t);await db('ps_finance_connections?workspace_id=eq.'+eq(c.workspace_id),{method:'PATCH',body:{tokens:c.tokens}});}
 const r=await fetch('https://api.xero.com/api.xro/2.0/'+path,{method,signal:AbortSignal.timeout(18000),headers:{Authorization:'Bearer '+t.access_token,'Xero-tenant-id':c.tenant_id,Accept:'application/json','Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{}),...headers},body:body?JSON.stringify(body):undefined});
 if(!r.ok){const e=Error('Xero request failed ('+r.status+'). Review the connection or document.');e.retryAfter=Math.max(60,Number(r.headers.get('retry-after'))||60);throw e;}return r.json();
}
export async function applyRemote(w,i){
 if(!i?.InvoiceID)throw Error('Xero returned no invoice ID');
 await db('ps_finance_documents?workspace_id=eq.'+eq(w)+'&xero_id=eq.'+eq(i.InvoiceID),{method:'PATCH',body:{status:i.Status,xero_number:i.InvoiceNumber,amount_due:i.AmountDue,amount_paid:i.AmountPaid,amount_credited:i.AmountCredited,currency:i.CurrencyCode,remote:i,updated_at:new Date().toISOString()}});
}
