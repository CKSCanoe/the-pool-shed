import {db,eq} from '../server/accounting.js';
import {supabaseServerKey} from '../server/supabase-keys.js';
import {appOriginAllowed} from '../server/origin-policy.js';

const W='pool-bros-main';
const arr=v=>Array.isArray(v)?v:[];
const oid=o=>String(o&&(o.id||o.orderNumber)||'');
const send=(res,status,value)=>res.status(status).json(value);

async function admin(req){
  const authorization=String(req.headers.authorization||'');
  if(!authorization.startsWith('Bearer '))throw Object.assign(Error('Sign in first'),{statusCode:401});
  const key=supabaseServerKey(process.env);
  if(!process.env.SUPABASE_URL||!key)throw Object.assign(Error('Shared workspace backend is not configured'),{statusCode:503});
  const r=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Object.assign(Error('Sign in first'),{statusCode:401});
  const user=await r.json();
  const profiles=await db('user_profiles?id=eq.'+eq(user.id)+'&select=id,email,full_name,role,active',{timeout:10000});
  const profile=profiles[0];
  if(!profile||profile.active!==true||profile.role!=='Admin')throw Object.assign(Error('Admin access is required'),{statusCode:403});
  return user;
}
function customerMap(customers){
  const m=new Map();
  arr(customers).forEach(c=>m.set(String(c.id),c));
  return m;
}
function cname(c){return String(c&&(c.name||c.companyName||c.fullName||c.email)||'')}
function snapshotOrders(row){
  const customers=arr(row.customers);
  const cmap=customerMap(customers);
  const orders=arr(row.salesOrders);
  return orders.map(o=>({
    raw:o,
    id:oid(o),
    customer:cname(cmap.get(String(o.customerId)))||String(o.customerName||''),
    status:String(o.status||''),
    lines:arr(o.lines).length,
    units:arr(o.lines).reduce((n,l)=>n+Number(l.qty||0),0),
    updatedAt:o.updatedAt||o.updated||''
  }));
}
function localDateLondon(iso){
  try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));}
  catch{return String(iso||'').slice(0,10);}
}
function authorName(id,profiles){
  const p=profiles.find(x=>String(x.id)===String(id));
  return p?(p.full_name||p.email||p.id):String(id||'Unknown');
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    if(req.method!=='POST')return send(res,405,{error:'POST required'});
    if(!appOriginAllowed(req,process.env))return send(res,403,{error:'Invalid origin'});
    await admin(req);
    const q=String(req.query?.q||req.body?.q||'Sam Williams').trim().toLowerCase();
    const date=String(req.query?.date||req.body?.date||'2026-10-08');
    const [currentRows,revisions,profiles]=await Promise.all([
      db('workspace_snapshots?workspace_id=eq.'+eq(W)+'&select=updated_at,updated_by,salesOrders:data->salesOrders,customers:data->customers&limit=1',{timeout:15000}),
      db('ps_workspace_revisions?workspace_id=eq.'+eq(W)+'&select=id,updated_at,updated_by,salesOrders:data->salesOrders,customers:data->customers&order=updated_at.asc&limit=250',{timeout:20000}),
      db('user_profiles?select=id,email,full_name,role,active',{timeout:10000})
    ]);
    const current=currentRows[0]||{};
    const timeline=arr(revisions).map(r=>({...r,isCurrent:false})).concat([{...current,id:'CURRENT',isCurrent:true}])
      .filter(r=>r.updated_at).sort((a,b)=>String(a.updated_at).localeCompare(String(b.updated_at)));
    const versions=timeline.map(r=>{
      const orders=snapshotOrders(r);
      return {
        id:r.id,updatedAt:r.updated_at,updatedBy:r.updated_by,author:authorName(r.updated_by,profiles),
        localDate:localDateLondon(r.updated_at),isCurrent:r.isCurrent,orders
      };
    });
    const currentV=versions.find(v=>v.isCurrent)||versions[versions.length-1]||{orders:[]};
    const currentIds=new Set(currentV.orders.map(o=>o.id));
    const byId=new Map();
    versions.forEach(v=>v.orders.forEach(o=>{
      const a=byId.get(o.id)||[];a.push({...o,versionAt:v.updatedAt,author:v.author,isCurrent:v.isCurrent});byId.set(o.id,a);
    }));
    const missingOrders=[];
    byId.forEach((list,id)=>{
      if(!id||currentIds.has(id))return;
      const last=list[list.length-1];
      missingOrders.push({...last,occurrences:list.length});
    });
    missingOrders.sort((a,b)=>String(b.versionAt).localeCompare(String(a.versionAt)));

    const searchMatches=[];
    versions.forEach(v=>v.orders.forEach(o=>{
      if([o.id,o.customer].join(' ').toLowerCase().includes(q))searchMatches.push({...o,versionAt:v.updatedAt,author:v.author,isCurrent:v.isCurrent});
    }));

    const rachelProfiles=profiles.filter(p=>/rachel/i.test(String(p.full_name||'')+' '+String(p.email||'')));
    const rachelIds=new Set(rachelProfiles.map(p=>String(p.id)));
    const rachelChanges=[];
    versions.forEach((v,i)=>{
      if(v.localDate!==date||!rachelIds.has(String(v.updatedBy)))return;
      const prev=versions[i-1];
      const prevMap=new Map((prev?.orders||[]).map(o=>[o.id,o]));
      const curMap=new Map(v.orders.map(o=>[o.id,o]));
      const ids=new Set([...prevMap.keys(),...curMap.keys()]);
      ids.forEach(id=>{
        const a=prevMap.get(id),b=curMap.get(id);
        if(a&&b&&a.status!==b.status)rachelChanges.push({orderId:id,customer:b.customer,before:a.status,after:b.status,savedAt:v.updatedAt,author:v.author});
        else if(!a&&b)rachelChanges.push({orderId:id,customer:b.customer,before:'(not present)',after:b.status,savedAt:v.updatedAt,author:v.author,type:'created'});
        else if(a&&!b)rachelChanges.push({orderId:id,customer:a.customer,before:a.status,after:'(removed)',savedAt:v.updatedAt,author:v.author,type:'removed'});
      });
    });

    const orderCounts=versions.map(v=>({updatedAt:v.updatedAt,author:v.author,count:v.orders.length,isCurrent:v.isCurrent}));
    const maxCount=orderCounts.reduce((m,x)=>Math.max(m,x.count),0);
    const currentSummary={updatedAt:currentV.updatedAt,author:currentV.author,count:currentV.orders.length,orders:currentV.orders.map(({raw,...o})=>o)};
    return send(res,200,{
      ok:true,query:q,date,current:currentSummary,maxHistoricalOrderCount:maxCount,
      missingOrders,searchMatches,rachelProfiles:rachelProfiles.map(p=>({id:p.id,name:p.full_name,email:p.email})),
      rachelChanges,orderCounts:orderCounts.slice(-30),revisionCount:versions.length-1
    });
  }catch(error){return send(res,error.statusCode||500,{error:error.message||'Workspace Sales audit failed'});}
}