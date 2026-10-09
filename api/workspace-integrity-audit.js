import {db,eq} from '../server/accounting.js';
import {supabaseServerKey} from '../server/supabase-keys.js';
import {appOriginAllowed} from '../server/origin-policy.js';

const WORKSPACE_ID='pool-bros-main';
const arr=v=>Array.isArray(v)?v:[];
const send=(res,status,value)=>res.status(status).json(value);
const clone=v=>JSON.parse(JSON.stringify(v));

async function admin(req){
  const authorization=String(req.headers.authorization||'');
  if(!authorization.startsWith('Bearer '))throw Object.assign(new Error('Sign in first'),{statusCode:401});
  const key=supabaseServerKey(process.env);
  const response=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization}});
  if(!response.ok)throw Object.assign(new Error('Sign in first'),{statusCode:401});
  const user=await response.json();
  const profiles=await db('user_profiles?id=eq.'+eq(user.id)+'&select=id,email,full_name,role,active');
  const profile=profiles[0];
  if(!profile||profile.active!==true||profile.role!=='Admin')throw Object.assign(new Error('Admin access is required'),{statusCode:403});
  return user;
}
function orderId(o){return String(o&&((o.id||o.orderNumber))||'')}
function customerMap(data){return new Map(arr(data&&data.customers).map(c=>[String(c.id),c]))}
function customerName(data,o){const c=customerMap(data).get(String(o&&o.customerId))||{};return String(c.name||c.companyName||c.company||c.fullName||c.email||o.customerName||'Unknown customer')}
function orderSummary(data,o){return {id:orderId(o),customer:customerName(data,o),status:String(o.status||''),lineCount:arr(o.lines).length,units:arr(o.lines).reduce((n,l)=>n+Number(l.qty||0),0),updatedAt:o.updatedAt||o.updated||'',statusUpdatedAt:o.statusUpdatedAt||'',statusUpdatedBy:o.statusUpdatedBy||''}}
function matchOrder(data,o,q){q=String(q||'').toLowerCase();const c=customerMap(data).get(String(o&&o.customerId))||{};return [orderId(o),customerName(data,o),o.reference,o.customerPo,c.email,c.phone,c.mobile].filter(Boolean).join(' ').toLowerCase().includes(q)}
function isoDay(v){return String(v||'').slice(0,10)}
async function revisionData(id){
  const rows=await db('ps_workspace_revisions?id=eq.'+eq(id)+'&workspace_id=eq.'+eq(WORKSPACE_ID)+'&select=id,data,updated_at,updated_by&limit=1');
  return rows[0]||null;
}
async function audit(body){
  const currentRows=await db('workspace_snapshots?workspace_id=eq.'+eq(WORKSPACE_ID)+'&select=data,updated_at,updated_by&limit=1',{timeout:60000});
  const currentRow=currentRows[0];
  if(!currentRow||!currentRow.data)throw Object.assign(new Error('Current shared master unavailable'),{statusCode:409});
  const meta=await db('ps_workspace_revisions?workspace_id=eq.'+eq(WORKSPACE_ID)+'&select=id,updated_at,updated_by&order=updated_at.desc&limit=40');
  const profiles=await db('user_profiles?select=id,email,full_name,role,active');
  const profileMap=new Map(profiles.map(p=>[String(p.id),p]));
  const current=currentRow.data,currentOrders=arr(current.salesOrders),currentIds=new Set(currentOrders.map(orderId));
  const q=String(body.query||'').trim().toLowerCase();
  const currentMatches=q?currentOrders.filter(o=>matchOrder(current,o,q)).map(o=>orderSummary(current,o)):[];
  const historyMatches=[],missingMap=new Map(),loaded=[];
  for(const m of meta.slice(0,12)){
    const rev=await revisionData(m.id); if(!rev||!rev.data)continue; loaded.push(rev);
    if(q){
      for(const o of arr(rev.data.salesOrders)){
        if(!matchOrder(rev.data,o,q))continue;
        historyMatches.push({...orderSummary(rev.data,o),revisionAt:rev.updated_at,revisionId:rev.id,revisionUpdatedBy:rev.updated_by||''});
      }
    }
    for(const o of arr(rev.data.salesOrders)){
      const id=orderId(o); if(!id||currentIds.has(id)||missingMap.has(id))continue;
      missingMap.set(id,{...orderSummary(rev.data,o),lastSeenRevision:rev.updated_at,lastSeenRevisionId:rev.id,updatedBy:rev.updated_by||''});
    }
    if(historyMatches.length>=8 && loaded.length>=4)break;
  }
  const date=String(body.date||'').slice(0,10);
  const statusChanges=[];
  const dayMeta=meta.filter(m=>!date||isoDay(m.updated_at)===date).slice().sort((a,b)=>String(a.updated_at).localeCompare(String(b.updated_at)));
  const rachIds=new Set(profiles.filter(p=>/\brach|rachel/i.test(String(p.full_name||'')+' '+String(p.email||''))).map(p=>String(p.id)));
  const candidates=dayMeta.filter(m=>!rachIds.size||rachIds.has(String(m.updated_by||''))).slice(-8);
  for(const m of candidates){
    const idx=meta.findIndex(x=>String(x.id)===String(m.id));
    const newerMeta=idx>0?meta[idx-1]:null;
    const before=await revisionData(m.id);
    let after=null;
    if(newerMeta)after=await revisionData(newerMeta.id);
    else after={data:current,updated_at:currentRow.updated_at,updated_by:currentRow.updated_by};
    if(!before||!before.data||!after||!after.data)continue;
    const bm=new Map(arr(before.data.salesOrders).map(o=>[orderId(o),o]));
    for(const n of arr(after.data.salesOrders)){
      const id=orderId(n),p=bm.get(id); if(!p)continue;
      if(String(p.status||'')===String(n.status||''))continue;
      const prof=profileMap.get(String(after.updated_by||''))||profileMap.get(String(m.updated_by||''))||{};
      statusChanges.push({at:after.updated_at,orderId:id,customer:customerName(after.data,n),from:String(p.status||''),to:String(n.status||''),updatedById:after.updated_by||m.updated_by||'',updatedBy:prof.full_name||prof.email||after.updated_by||m.updated_by||'Unknown'});
    }
  }
  return {ok:true,current:{updatedAt:currentRow.updated_at,updatedBy:currentRow.updated_by||'',salesOrderCount:currentOrders.length},profiles:profiles.map(p=>({id:p.id,name:p.full_name,email:p.email})),currentMatches,historyMatches:historyMatches.slice(0,40),missingOrders:Array.from(missingMap.values()).slice(0,50),statusChanges,revisionCounts:meta.slice(0,20).map(r=>({at:r.updated_at,updatedBy:r.updated_by||''}))};
}
async function restoreMissingOrder(user,body){
  const incoming=body&&body.order&&typeof body.order==='object'?clone(body.order):null;
  const incomingCustomer=body&&body.customer&&typeof body.customer==='object'?clone(body.customer):null;
  if(!incoming||!orderId(incoming))throw Object.assign(new Error('A Sales Order is required'),{statusCode:400});
  const currentRows=await db('workspace_snapshots?workspace_id=eq.'+eq(WORKSPACE_ID)+'&select=data,updated_at,updated_by&limit=1');
  const row=currentRows[0];
  if(!row||!row.data)throw Object.assign(new Error('Current shared master unavailable'),{statusCode:409});
  const snapshot=clone(row.data);
  snapshot.salesOrders=arr(snapshot.salesOrders);
  snapshot.customers=arr(snapshot.customers);
  const id=orderId(incoming);
  const existing=snapshot.salesOrders.find(o=>orderId(o)===id);
  if(existing)return {ok:true,restored:false,reason:'already-present',order:orderSummary(snapshot,existing),updatedAt:row.updated_at};
  if(incomingCustomer&&incomingCustomer.id&&!snapshot.customers.some(c=>String(c.id)===String(incomingCustomer.id)))snapshot.customers.push(incomingCustomer);
  incoming.recoveredAt=new Date().toISOString();
  incoming.recoverySource=String(body.recoverySource||'browser-recovery');
  snapshot.salesOrders.push(incoming);
  const stamp=new Date().toISOString();
  const updated=await db('workspace_snapshots?workspace_id=eq.'+eq(WORKSPACE_ID)+'&updated_at=eq.'+eq(row.updated_at),{method:'PATCH',prefer:'return=representation',body:{data:snapshot,updated_by:user.id,updated_at:stamp},timeout:60000});
  if(!updated.length)throw Object.assign(new Error('Another user saved first. Retry so their changes are preserved.'),{statusCode:409});
  return {ok:true,restored:true,order:orderSummary(snapshot,incoming),updatedAt:updated[0].updated_at||stamp};
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    if(req.method!=='POST')return send(res,405,{error:'POST required'});
    if(!appOriginAllowed(req,process.env))return send(res,403,{error:'Invalid origin'});
    const user=await admin(req);
    const body=typeof req.body==='object'&&req.body?req.body:{};
    const action=String(body.action||'audit');
    if(action==='restore-missing-order')return send(res,200,await restoreMissingOrder(user,body));
    return send(res,200,await audit(body));
  }catch(error){return send(res,error.statusCode||500,{error:error.message||'Workspace audit failed'});}
}
