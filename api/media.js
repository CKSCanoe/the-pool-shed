import {db,eq,audit} from '../server/accounting.js';
import {uploadBusinessMedia,listBusinessMedia,signBusinessMedia,signFinanceMedia,archiveBusinessMedia,parseMediaRef} from '../server/business-media.js';
import {supabaseServerKey} from '../server/supabase-keys.js';
import {appOriginAllowed} from '../server/origin-policy.js';
export const config={api:{bodyParser:false},maxDuration:60};
const send=(res,status,value)=>res.status(status).json(value);
async function rawBuffer(req,max=26214400){let chunks=[],n=0;for await(const b of req){n+=b.length;if(n>max)throw Object.assign(Error('Request too large'),{statusCode:413});chunks.push(b)}return Buffer.concat(chunks)}
async function identity(req,w,write=false){const auth=req.headers.authorization||'';if(!auth.startsWith('Bearer '))throw Object.assign(Error('Sign in first'),{statusCode:401});const key=supabaseServerKey(process.env);if(!key)throw Object.assign(Error('Secure media backend is not configured'),{statusCode:503});const r=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:key,Authorization:auth},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Object.assign(Error('Sign in first'),{statusCode:401});const u=await r.json(),members=await db('ps_workspace_members?workspace_id=eq.'+eq(w)+'&user_id=eq.'+eq(u.id));if(!members.length||(write&&!['admin','operator'].includes(members[0].role)))throw Object.assign(Error('Media access denied'),{statusCode:403});return {...u,workspaceRole:members[0].role}}
const validOrigin=req=>appOriginAllowed(req,process.env);
// v1.51: supplier invoices and receipts are finance documents: Admin, Management and Accounts only.
const FINANCE_ROLES=new Set(['Admin','Management','Manager','Accounts']);
async function requireFinance(u){const [p]=await db('user_profiles?id=eq.'+eq(u.id)+'&select=role,active');if(!p||p.active===false||!FINANCE_ROLES.has(p.role))throw Object.assign(Error('Supplier invoices and receipts are for Admin, Management and Accounts'),{statusCode:403});return p}
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');const origin=process.env.APP_ORIGIN||'http://localhost',url=new URL(req.url,origin),action=url.searchParams.get('action')||'',w=url.searchParams.get('workspace')||'pool-bros-main';try{if(!process.env.SUPABASE_URL||!supabaseServerKey(process.env))throw Object.assign(Error('Secure media backend is not configured'),{statusCode:503});
 if(action==='product-upload'||action==='customer-upload'){
  if(req.method!=='POST')return send(res,405,{error:'POST required'});if(!validOrigin(req))return send(res,403,{error:'Invalid origin'});const u=await identity(req,w,true),domain=action.startsWith('product')?'product':'customer',entityId=String(url.searchParams.get(domain==='product'?'productId':'customerId')||'').trim();if(!entityId)throw Object.assign(Error((domain==='product'?'Product':'Customer')+' ID is required'),{statusCode:400});const kind=String(url.searchParams.get('kind')||(domain==='product'?'other':'document')),mime=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase(),name=decodeURIComponent(String(req.headers['x-file-name']||'file')).slice(0,180),title=decodeURIComponent(String(req.headers['x-media-title']||'')).slice(0,180),altText=decodeURIComponent(String(req.headers['x-media-alt']||'')).slice(0,240),notes=decodeURIComponent(String(req.headers['x-media-notes']||'')).slice(0,1000),siteKey=decodeURIComponent(String(req.headers['x-site-key']||'')).slice(0,120),buffer=await rawBuffer(req);const media=await uploadBusinessMedia({domain,workspaceId:w,entityId,userId:u.id,kind,fileName:name,mimeType:mime,buffer,title,altText,notes,siteKey});await audit(w,u.id,domain+'_media_uploaded',{entityId,mediaId:media.id,kind,mimeType:mime,size:buffer.length});return send(res,201,{media});
 }
 if(action==='product-list'||action==='customer-list'){
  if(req.method!=='GET')return send(res,405,{error:'GET required'});await identity(req,w,false);const domain=action.startsWith('product')?'product':'customer',entityId=String(url.searchParams.get(domain==='product'?'productId':'customerId')||'').trim();if(!entityId)throw Object.assign(Error('Entity ID is required'),{statusCode:400});const media=await listBusinessMedia({domain,workspaceId:w,entityId});return send(res,200,{media});
 }
 if(action==='finance-upload'){
  if(req.method!=='POST')return send(res,405,{error:'POST required'});if(!validOrigin(req))return send(res,403,{error:'Invalid origin'});
  const u=await identity(req,w,true);await requireFinance(u);
  const supplierKey=String(url.searchParams.get('supplierKey')||'').trim();if(!supplierKey)throw Object.assign(Error('Supplier is required'),{statusCode:400});
  const kind=String(url.searchParams.get('kind')||'supplier_invoice'),mime=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase(),name=String(url.searchParams.get('name')||'invoice');
  const buffer=await rawBuffer(req);
  const media=await uploadBusinessMedia({domain:'finance',workspaceId:w,entityId:supplierKey,userId:u.id,kind,fileName:name,mimeType:mime,buffer,title:String(url.searchParams.get('title')||'')});
  await audit(w,u.id,'finance_media_uploaded',{supplierKey,mediaId:media.id,kind,mimeType:mime,size:buffer.length});
  return send(res,200,{ref:media.ref,name:media.name,previewUrl:media.previewUrl});
 }
 if(action==='finance-sign'){
  if(req.method!=='GET')return send(res,405,{error:'GET required'});const u=await identity(req,w,false);await requireFinance(u);
  const refs=String(url.searchParams.get('refs')||'').split(',').map(decodeURIComponent).filter(Boolean).slice(0,100);
  return send(res,200,{urls:await signFinanceMedia(w,refs,600)});
 }
 if(action==='sign'){
  if(req.method!=='GET')return send(res,405,{error:'GET required'});await identity(req,w,false);const refs=String(url.searchParams.get('refs')||'').split(',').map(decodeURIComponent).filter(Boolean).slice(0,150),urls=await signBusinessMedia(w,refs,3600);return send(res,200,{urls});
 }
 if(action==='archive'){
  if(req.method!=='POST')return send(res,405,{error:'POST required'});if(!validOrigin(req))return send(res,403,{error:'Invalid origin'});const u=await identity(req,w,true),ref=String(url.searchParams.get('ref')||''),parsed=parseMediaRef(ref);if(!parsed)throw Object.assign(Error('Invalid media reference'),{statusCode:400});if(parsed.domain==='finance')await requireFinance(u);await archiveBusinessMedia({domain:parsed.domain,workspaceId:w,id:parsed.id});await audit(w,u.id,parsed.domain+'_media_archived',{mediaId:parsed.id});return send(res,200,{archived:true,ref});
 }
 return send(res,404,{error:'Unknown media action'});
 }catch(e){return send(res,e.statusCode||500,{error:e.message||'Secure media operation failed'})}}
