import {db,eq} from '../server/accounting.js';
import {supabaseServerKey} from '../server/supabase-keys.js';
import {appOriginAllowed} from '../server/origin-policy.js';

const send=(res,status,value)=>res.status(status).json(value);
const WORKSPACE_ID='pool-bros-main';
const STAFF_ROLES=new Set(['Admin','Management','Accounts','Sales','Purchasing','Warehouse','Engineer','Office']);
const REQUIRED_ARRAYS=['jobs','salesOrders','purchaseOrders','customers','products','suppliers','stock','receiptEvents','putawayTransfers'];
const workspaceRoleFor=role=>role==='Admin'?'admin':'operator';
const arr=value=>Array.isArray(value)?value:[];

function counts(data){
  data=data&&typeof data==='object'?data:{};
  return {
    projects:arr(data.jobs).length||arr(data.projects).length,
    salesOrders:arr(data.salesOrders).length,
    purchaseOrders:arr(data.purchaseOrders).length,
    customers:arr(data.customers).length,
    products:arr(data.products).length,
    suppliers:arr(data.suppliers).length,
    stockRows:arr(data.stock).length,
    receipts:arr(data.receiptEvents).length,
    putawayTransfers:arr(data.putawayTransfers).length
  };
}

async function authenticatedAdmin(req){
  const authorization=String(req.headers.authorization||'');
  if(!authorization.startsWith('Bearer '))throw Object.assign(new Error('Sign in first'),{statusCode:401});
  const key=supabaseServerKey(process.env);
  if(!process.env.SUPABASE_URL||!key)throw Object.assign(new Error('Shared workspace backend is not configured'),{statusCode:503});
  const response=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{
    headers:{apikey:key,Authorization:authorization},
    signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)throw Object.assign(new Error('Sign in first'),{statusCode:401});
  const user=await response.json();
  const profiles=await db('user_profiles?id=eq.'+eq(user.id)+'&select=id,email,full_name,role,active');
  const profile=profiles[0];
  if(!profile||profile.active!==true||profile.role!=='Admin')throw Object.assign(new Error('Admin access is required for the shared workspace audit'),{statusCode:403});
  return {user,profile};
}

async function repairMemberships(){
  const profiles=await db('user_profiles?select=id,email,full_name,role,active&order=email.asc');
  const active=profiles.filter(profile=>profile.active===true&&STAFF_ROLES.has(profile.role));
  if(active.length){
    await db('ps_workspace_members',{
      method:'POST',
      prefer:'resolution=merge-duplicates,return=representation',
      body:active.map(profile=>({workspace_id:WORKSPACE_ID,user_id:profile.id,role:workspaceRoleFor(profile.role)}))
    });
  }
  const activeIds=new Set(active.map(profile=>String(profile.id)));
  const members=await db('ps_workspace_members?workspace_id=eq.'+eq(WORKSPACE_ID)+'&select=user_id,role');
  const stale=members.filter(member=>!activeIds.has(String(member.user_id)));
  for(const member of stale){
    await db('ps_workspace_members?workspace_id=eq.'+eq(WORKSPACE_ID)+'&user_id=eq.'+eq(member.user_id),{method:'DELETE',prefer:'return=minimal'});
  }
  return {active:active.length,removed:stale.length};
}

async function status(){
  const [profiles,members,snapshots,revisions]=await Promise.all([
    db('user_profiles?select=id,email,full_name,role,active&order=email.asc'),
    db('ps_workspace_members?workspace_id=eq.'+eq(WORKSPACE_ID)+'&select=user_id,role'),
    db('workspace_snapshots?workspace_id=eq.'+eq(WORKSPACE_ID)+'&select=data,updated_at,updated_by&limit=1'),
    db('ps_workspace_revisions?workspace_id=eq.'+eq(WORKSPACE_ID)+'&select=id,updated_at,updated_by&order=updated_at.desc&limit=25')
  ]);
  const memberMap=new Map(members.map(member=>[String(member.user_id),member.role]));
  const team=profiles.map(profile=>({
    name:profile.full_name||profile.email||'User',
    email:profile.email||'',
    role:profile.role,
    active:profile.active===true,
    workspaceRole:memberMap.get(String(profile.id))||'',
    connected:profile.active===true?memberMap.has(String(profile.id)):false
  }));
  const activeTeam=team.filter(user=>user.active);
  const snapshot=snapshots[0]||null;
  const snapshotData=snapshot&&snapshot.data&&typeof snapshot.data==='object'?snapshot.data:null;
  const missingArrays=snapshotData?REQUIRED_ARRAYS.filter(key=>!Array.isArray(snapshotData[key])):REQUIRED_ARRAYS.slice();
  return {
    ok:true,
    workspaceId:WORKSPACE_ID,
    master:{
      exists:!!snapshotData,
      updatedAt:snapshot?.updated_at||null,
      updatedBy:snapshot?.updated_by||null,
      counts:counts(snapshotData||{}),
      requiredArraysOk:missingArrays.length===0,
      missingArrays
    },
    team:{
      active:activeTeam.length,
      connected:activeTeam.filter(user=>user.connected).length,
      allActiveConnected:activeTeam.length>0&&activeTeam.every(user=>user.connected),
      users:team
    },
    revisions:{
      recentCount:revisions.length,
      latest:revisions[0]?.updated_at||null
    }
  };
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  try{
    if(req.method!=='POST')return send(res,405,{error:'POST required'});
    if(!appOriginAllowed(req,process.env))return send(res,403,{error:'Invalid origin'});
    await authenticatedAdmin(req);
    const url=new URL(req.url,process.env.APP_ORIGIN||'http://localhost');
    const action=String(url.searchParams.get('action')||'status');
    if(action==='repair-members')await repairMemberships();
    else if(action!=='status')return send(res,400,{error:'Unknown workspace health action'});
    return send(res,200,await status());
  }catch(error){
    return send(res,error.statusCode||500,{error:error.message||'Shared workspace audit failed'});
  }
}
