import {db,eq} from '../server/accounting.js';
import {supabasePublicKey,supabaseServerKey} from '../server/supabase-keys.js';
import {appOriginAllowed} from '../server/origin-policy.js';

const send=(res,status,value)=>res.status(status).json(value);
const WORKSPACE_ID='pool-bros-main';
const REQUIRED_ARRAYS=['jobs','salesOrders','purchaseOrders','customers','products','suppliers','stock','receiptEvents','putawayTransfers'];
const STAFF_ROLES=new Set(['Admin','Management','Accounts','Sales','Purchasing','Warehouse','Engineer','Office']);
const workspaceRoleFor=role=>role==='Admin'?'admin':'operator';

function requestBody(req){
  if(req.body&&typeof req.body==='object')return req.body;
  if(typeof req.body==='string'){try{return JSON.parse(req.body)}catch{return {}}}
  return {};
}
function counts(d){
  const a=k=>Array.isArray(d?.[k])?d[k].length:0;
  return {projects:a('jobs')||a('projects'),salesOrders:a('salesOrders'),purchaseOrders:a('purchaseOrders'),customers:a('customers'),products:a('products'),suppliers:a('suppliers')};
}
function mergeImmutableLedger(current,recovered,key){
  const out=[],seen=new Set();
  for(const row of [...(Array.isArray(current?.[key])?current[key]:[]),...(Array.isArray(recovered?.[key])?recovered[key]:[])]){
    const marker=row&&row.id!=null?'id:'+String(row.id):'json:'+JSON.stringify(row);
    if(seen.has(marker))continue;
    seen.add(marker);out.push(row);
  }
  return out;
}
async function authenticatedAdmin(req){
  const authorization=String(req.headers.authorization||'');
  if(!authorization.startsWith('Bearer '))throw Object.assign(new Error('Sign in first'),{statusCode:401});
  const key=supabaseServerKey(process.env);
  if(!process.env.SUPABASE_URL||!key)throw Object.assign(new Error('Recovery backend is not configured'),{statusCode:503});
  const response=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Object.assign(new Error('Sign in first'),{statusCode:401});
  const user=await response.json();
  const profiles=await db('user_profiles?id=eq.'+eq(user.id)+'&select=id,role,active');
  const profile=profiles[0];
  if(!profile||profile.active!==true||profile.role!=='Admin')throw Object.assign(new Error('Admin access is required to publish a recovered workspace'),{statusCode:403});
  return {user,authorization};
}
async function syncActiveStaffMemberships(){
  const profiles=await db('user_profiles?select=id,role,active');
  const active=profiles.filter(profile=>profile.active===true&&STAFF_ROLES.has(profile.role));
  if(active.length){
    await db('ps_workspace_members',{method:'POST',prefer:'resolution=merge-duplicates,return=representation',body:active.map(profile=>({workspace_id:WORKSPACE_ID,user_id:profile.id,role:workspaceRoleFor(profile.role)}))});
  }
  const activeIds=new Set(active.map(profile=>String(profile.id)));
  const members=await db('ps_workspace_members?workspace_id=eq.'+eq(WORKSPACE_ID)+'&select=user_id,role');
  const stale=members.filter(member=>!activeIds.has(String(member.user_id)));
  for(const member of stale){
    await db('ps_workspace_members?workspace_id=eq.'+eq(WORKSPACE_ID)+'&user_id=eq.'+eq(member.user_id),{method:'DELETE',prefer:'return=minimal'});
  }
  return {active:active.length,removed:stale.length};
}
async function secureSave(authorization,expected,snapshot){
  const apiKey=supabasePublicKey(process.env)||supabaseServerKey(process.env);
  const response=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/ps_workspace_save',{
    method:'POST',
    headers:{apikey:apiKey,Authorization:authorization,'Content-Type':'application/json'},
    body:JSON.stringify({w:WORKSPACE_ID,expected:expected||null,snapshot}),
    signal:AbortSignal.timeout(20000)
  });
  const raw=await response.text();
  if(!response.ok)throw Object.assign(new Error('Secure workspace publish failed. Nothing was replaced. '+raw.slice(0,240)),{statusCode:409});
  const value=raw?JSON.parse(raw):null;
  if(!value)throw Object.assign(new Error('The shared workspace changed while recovery was being published. Nothing was replaced.'),{statusCode:409});
  return value;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  try{
    if(req.method!=='POST')return send(res,405,{error:'POST required'});
    if(!appOriginAllowed(req,process.env))return send(res,403,{error:'Invalid origin'});
    const {user,authorization}=await authenticatedAdmin(req);
    const body=requestBody(req),recovered=body.snapshot;
    if(!recovered||typeof recovered!=='object'||Array.isArray(recovered))return send(res,400,{error:'Recovered workspace is required'});
    for(const key of REQUIRED_ARRAYS)if(!Array.isArray(recovered[key]))return send(res,400,{error:'Recovered workspace is missing '+key});
    const before=await db('workspace_snapshots?workspace_id=eq.'+eq(WORKSPACE_ID)+'&select=data,updated_at,updated_by&limit=1');
    const current=before[0]||null;
    const merged=structuredClone(recovered);
    merged.receiptEvents=mergeImmutableLedger(current?.data,recovered,'receiptEvents');
    merged.putawayTransfers=mergeImmutableLedger(current?.data,recovered,'putawayTransfers');
    await db('ps_workspace_members',{method:'POST',prefer:'resolution=merge-duplicates,return=representation',body:{workspace_id:WORKSPACE_ID,user_id:user.id,role:'admin'}});
    const teamSync=await syncActiveStaffMemberships();
    const result=await secureSave(authorization,current?.updated_at||null,merged);
    return send(res,200,{ok:true,workspaceId:WORKSPACE_ID,updatedAt:result.updated_at||null,before:counts(current?.data||{}),after:counts(merged),preservedLedger:{receiptEvents:merged.receiptEvents.length,putawayTransfers:merged.putawayTransfers.length},teamSync});
  }catch(error){
    return send(res,error.statusCode||500,{error:error.message||'Could not publish recovered workspace'});
  }
}
