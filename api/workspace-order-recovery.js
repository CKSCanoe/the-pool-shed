import {db,eq} from '../server/accounting.js';
import {supabaseServerKey} from '../server/supabase-keys.js';
import {appOriginAllowed} from '../server/origin-policy.js';

const WORKSPACE_ID='pool-bros-main';
const send=(res,status,value)=>res.status(status).json(value);
const arr=v=>Array.isArray(v)?v:[];

async function authenticatedAdmin(req){
  const authorization=String(req.headers.authorization||'');
  if(!authorization.startsWith('Bearer '))throw Object.assign(new Error('Sign in first'),{statusCode:401});
  const key=supabaseServerKey(process.env);
  if(!process.env.SUPABASE_URL||!key)throw Object.assign(new Error('Shared workspace backend is not configured'),{statusCode:503});
  const response=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Object.assign(new Error('Sign in first'),{statusCode:401});
  const user=await response.json();
  const profiles=await db('user_profiles?id=eq.'+eq(user.id)+'&select=id,email,full_name,role,active');
  const profile=profiles[0];
  if(!profile||profile.active!==true||profile.role!=='Admin')throw Object.assign(new Error('Admin access is required'),{statusCode:403});
  return user;
}
function orderId(order){return String(order&&((order.id||order.orderNumber))||'')}
function customerFor(data,order){return arr(data&&data.customers).find(c=>String(c.id)===String(order&&order.customerId))||{}}
function customerName(data,order){const c=customerFor(data,order);return String(c.name||c.company||c.fullName||c.email||'Unknown customer')}
function lineKey(line){
  if(!line||typeof line!=='object')return '';
  if(line.productId)return 'product:'+String(line.productId);
  return ['line',line.lineType||'',line.description||'',line.unitPrice??'',line.specialPrice??'',line.unitCost??'',line.taxCode||''].join('|').toLowerCase();
}
function lineLabel(data,line){
  const p=arr(data&&data.products).find(x=>String(x.id)===String(line&&line.productId));
  if(p)return [p.name||p.parentName,p.variantValue,p.sku||p.code].filter(Boolean).join(' · ');
  return String((line&&line.description)||(line&&line.productId)||'Sales line');
}
function matches(data,order,q){
  const c=customerFor(data,order);
  return [orderId(order),order&&order.reference,order&&order.customerPo,customerName(data,order),c.email,c.phone].filter(Boolean).join(' ').toLowerCase().includes(q);
}
async function scan(query){
  const q=String(query||'').trim().toLowerCase();
  if(!q)throw Object.assign(new Error('Enter a customer or Sales Order'),{statusCode:400});
  const revisions=await db('ps_workspace_revisions?workspace_id=eq.'+eq(WORKSPACE_ID)+'&select=id,data,updated_at&order=updated_at.desc&limit=50');
  const versions=[];
  for(const rev of revisions){
    const data=rev.data&&typeof rev.data==='object'?rev.data:{};
    for(const order of arr(data.salesOrders)){
      if(!matches(data,order,q))continue;
      const lines=arr(order.lines);
      versions.push({
        revisionId:rev.id,updatedAt:rev.updated_at,orderId:orderId(order),customerName:customerName(data,order),
        lineCount:lines.length,units:lines.reduce((n,l)=>n+Number(l.qty||0),0),
        labels:lines.map(l=>lineLabel(data,l)).slice(0,20)
      });
    }
  }
  return versions.slice(0,40);
}
async function restore(user,revisionId,targetOrderId){
  const revisions=await db('ps_workspace_revisions?id=eq.'+eq(revisionId)+'&workspace_id=eq.'+eq(WORKSPACE_ID)+'&select=id,data,updated_at&limit=1');
  const sourceRow=revisions[0];
  if(!sourceRow||!sourceRow.data)throw Object.assign(new Error('Recovery revision was not found'),{statusCode:404});
  const currentRows=await db('workspace_snapshots?workspace_id=eq.'+eq(WORKSPACE_ID)+'&select=data,updated_at,updated_by&limit=1');
  const currentRow=currentRows[0];
  if(!currentRow||!currentRow.data)throw Object.assign(new Error('Current shared master is unavailable'),{statusCode:409});
  const source=JSON.parse(JSON.stringify(sourceRow.data));
  const snapshot=JSON.parse(JSON.stringify(currentRow.data));
  const sourceOrder=arr(source.salesOrders).find(o=>orderId(o)===String(targetOrderId));
  const currentOrder=arr(snapshot.salesOrders).find(o=>orderId(o)===String(targetOrderId));
  if(!sourceOrder)throw Object.assign(new Error('That Sales Order was not present in the selected revision'),{statusCode:404});
  if(!currentOrder)throw Object.assign(new Error('That Sales Order is no longer present in the current shared master'),{statusCode:409});
  currentOrder.lines=arr(currentOrder.lines);
  const keys=new Set(currentOrder.lines.map(lineKey));
  const missing=arr(sourceOrder.lines).filter(l=>!keys.has(lineKey(l)));
  if(!missing.length)return {ok:true,restored:0,orderId:targetOrderId,labels:[],updatedAt:currentRow.updated_at};
  missing.forEach(line=>currentOrder.lines.push(JSON.parse(JSON.stringify(line))));
  currentOrder.updatedAt=new Date().toISOString();
  await db('ps_workspace_revisions',{method:'POST',prefer:'return=minimal',body:{workspace_id:WORKSPACE_ID,data:currentRow.data,updated_by:currentRow.updated_by||null,updated_at:currentRow.updated_at}});
  const stamp=new Date().toISOString();
  const updated=await db('workspace_snapshots?workspace_id=eq.'+eq(WORKSPACE_ID)+'&updated_at=eq.'+eq(currentRow.updated_at),{
    method:'PATCH',prefer:'return=representation',
    body:{data:snapshot,updated_by:user.id,updated_at:stamp}
  });
  if(!updated.length)throw Object.assign(new Error('Another user saved first. Search again and retry so their changes are preserved.'),{statusCode:409});
  return {ok:true,restored:missing.length,orderId:targetOrderId,labels:missing.map(l=>lineLabel(snapshot,l)),updatedAt:updated[0].updated_at||stamp};
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    if(req.method!=='POST')return send(res,405,{error:'POST required'});
    if(!appOriginAllowed(req,process.env))return send(res,403,{error:'Invalid origin'});
    const user=await authenticatedAdmin(req);
    const url=new URL(req.url,process.env.APP_ORIGIN||'http://localhost');
    const action=String(url.searchParams.get('action')||'scan');
    if(action==='scan')return send(res,200,{ok:true,versions:await scan(url.searchParams.get('query')||'')});
    if(action==='restore'){
      const body=typeof req.body==='object'&&req.body?req.body:{};
      if(!body.revisionId||!body.orderId)return send(res,400,{error:'revisionId and orderId are required'});
      return send(res,200,await restore(user,body.revisionId,body.orderId));
    }
    return send(res,400,{error:'Unknown action'});
  }catch(error){return send(res,error.statusCode||500,{error:error.message||'Sales Order recovery failed'});}
}
