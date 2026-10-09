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
async function audit(body){
  const currentRows=await db('workspace_snapshots?workspace_id=eq.'+eq(WORKSPACE_ID)+'&select=data,updated_at,updated_by&limit=1');
  const currentRow=currentRows[0];
  if(!currentRow||!currentRow.data)throw Object.assign(new Error('Current shared master unavailable'),{statusCode:409});
  const revisions=await db('ps_workspace_revisions?workspace_id=eq.'+eq(WORKSPACE_ID)+'&select=id,data,updated_at,updated_by&order=updated_at.desc&limit=80');
  const profiles=await db('user_profiles?select=id,email,full_name,role,active');
  const profileMap=new Map(profiles.map(p=>[String(p.id),p]));
  const current=currentRow.data;
  const currentOrders=arr(current.salesOrders);
  const currentIds=new Set(currentOrders.map(orderId));
  const missingMap=new Map();
  for(const rev of revisions){
    for(const o of arr(rev.data&&rev.data.salesOrders)){
      const id=orderId(o); if(!id||currentIds.has(id)||missingMap.has(id))continue;
      missingMap.set(id,{...orderSummary(rev.data,o),lastSeenRevision:rev.updated_at,lastSeenRevisionId:rev.id,updatedBy:rev.updated_by||''});
    }
  }
  const date=String(body.date||'').slice(0,10);
  const statusChanges=[];
  const ascending=revisions.slice().sort((a,b)=>String(a.updated_at).localeCompare(String(b.updated_at)));
  for(let i=1;i<ascending.length;i++){
    const prev=ascending[i-1],next=ascending[i];
    if(date && isoDay(next.updated_at)!==date)continue;
    const pm=new Map(arr(prev.data&&prev.data.salesOrders).map(o=>[orderId(o),o]));
    for(const n of arr(next.data&&next.data.salesOrders)){
      const id=orderId(n),p=pm.get(id); if(!p)continue;
      if(String(p.status||'')===String(n.status||''))continue;
      const prof=profileMap.get(String(next.updated_by||''))||{};
      statusChanges.push({at:next.updated_at,orderId:id,customer:customerName(next.data,n),from:String(p.status||''),to:String(n.status||''),updatedById:next.updated_by||'',updatedBy:prof.full_name||prof.email||next.updated_by||'Unknown'});
    }
  }
  const q=String(body.query||'').trim().toLowerCase();
  const currentMatches=q?currentOrders.filter(o=>matchOrder(current,o,q)).map(o=>orderSummary(current,o)):[];
  const historyMatches=[];
  if(q){
    const seen=new Set();
    for(const rev of revisions){
      for(const o of arr(rev.data&&rev.data.salesOrders)){
        if(!matchOrder(rev.data,o,q))continue;
        const key=rev.id+'|'+orderId(o); if(seen.has(key))continue;seen.add(key);
        historyMatches.push({...orderSummary(rev.data,o),revisionAt:rev.updated_at,revisionId:rev.id,revisionUpdatedBy:rev.updated_by||''});
      }
    }
  }
  const revisionCounts=revisions.slice(0,20).map(r=>({at:r.updated_at,count:arr(r.data&&r.data.salesOrders).length,updatedBy:r.updated_by||''}));
  return {ok:true,current:{updatedAt:currentRow.updated_at,updatedBy:currentRow.updated_by||'',salesOrderCount:currentOrders.length},currentMatches,historyMatches:historyMatches.slice(0,80),missingOrders:Array.from(missingMap.values()).slice(0,100),statusChanges,revisionCounts};
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    if(req.method!=='POST')return send(res,405,{error:'POST required'});
    if(!appOriginAllowed(req,process.env))return send(res,403,{error:'Invalid origin'});
    await admin(req);
    const body=typeof req.body==='object'&&req.body?req.body:{};
    return send(res,200,await audit(body));
  }catch(error){return send(res,error.statusCode||500,{error:error.message||'Workspace audit failed'});}
}
