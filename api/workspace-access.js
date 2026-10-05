import {db,eq} from '../server/accounting.js';
import {supabaseServerKey} from '../server/supabase-keys.js';
import {appOriginAllowed} from '../server/origin-policy.js';

const send=(res,status,value)=>res.status(status).json(value);
const STAFF_ROLES=new Set(['Admin','Management','Accounts','Sales','Purchasing','Warehouse','Engineer','Office']);

async function authenticatedUser(req){
  const authorization=String(req.headers.authorization||'');
  if(!authorization.startsWith('Bearer '))throw Object.assign(new Error('Sign in first'),{statusCode:401});
  const key=supabaseServerKey(process.env);
  if(!process.env.SUPABASE_URL||!key)throw Object.assign(new Error('Shared workspace backend is not configured'),{statusCode:503});
  const response=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{
    headers:{apikey:key,Authorization:authorization},
    signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)throw Object.assign(new Error('Sign in first'),{statusCode:401});
  return response.json();
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  try{
    if(req.method!=='POST')return send(res,405,{error:'POST required'});
    if(!appOriginAllowed(req,process.env))return send(res,403,{error:'Invalid origin'});
    const url=new URL(req.url,process.env.APP_ORIGIN||'http://localhost');
    const workspaceId=String(url.searchParams.get('workspace')||'pool-bros-main');
    if(workspaceId!=='pool-bros-main')return send(res,403,{error:'Workspace access denied'});
    const user=await authenticatedUser(req);
    const profiles=await db('user_profiles?id=eq.'+eq(user.id)+'&select=id,email,role,active');
    const profile=profiles[0];
    if(!profile||profile.active!==true)return send(res,403,{error:'Your Pool Shed account is not active'});
    if(!STAFF_ROLES.has(profile.role))return send(res,403,{error:'Your Pool Shed role is not recognised'});
    const workspaceRole=profile.role==='Admin'?'admin':'operator';
    const members=await db('ps_workspace_members?workspace_id=eq.'+eq(workspaceId)+'&user_id=eq.'+eq(user.id)+'&select=role');
    if(!members.length){
      await db('ps_workspace_members',{method:'POST',prefer:'resolution=merge-duplicates,return=representation',body:{workspace_id:workspaceId,user_id:user.id,role:workspaceRole}});
    }else if(members[0].role!==workspaceRole){
      await db('ps_workspace_members?workspace_id=eq.'+eq(workspaceId)+'&user_id=eq.'+eq(user.id),{method:'PATCH',body:{role:workspaceRole}});
    }
    return send(res,200,{ok:true,workspaceId,role:workspaceRole,userId:user.id});
  }catch(error){
    return send(res,error.statusCode||500,{error:error.message||'Could not verify shared workspace access'});
  }
}
