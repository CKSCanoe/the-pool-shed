import { memory } from './azzy/src/core/memory.js';

const mode=()=>String(process.env.AZZY_MEMORY_MODE||'file').toLowerCase();
const enc=v=>encodeURIComponent(String(v??''));
function apiKey(){return process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'';}
function authHeader(req){
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  if(service)return `Bearer ${service}`;
  const value=String(req?.headers?.authorization||'');
  return value.startsWith('Bearer ')?value:'';
}
function configured(){return Boolean(process.env.SUPABASE_URL&&apiKey()&&mode()==='external');}
async function request(req,path,options={}){
  const auth=authHeader(req);if(!auth)throw Object.assign(new Error('Azzy memory requires an authenticated Pool Shed request.'),{statusCode:401});
  const headers={apikey:apiKey(),Authorization:auth,Accept:'application/json',...(options.headers||{})};
  const r=await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`,{...options,headers,signal:AbortSignal.timeout(10000)});
  if(!r.ok){const detail=(await r.text().catch(()=>'' )).slice(0,500);throw Object.assign(new Error(`Azzy memory service failed (${r.status}). ${detail}`.trim()),{statusCode:r.status===401||r.status===403?r.status:502});}
  return r.status===204?null:await r.json();
}

export function azzyMemoryMode(){return configured()?'supabase':'file';}

export async function hydrateAzzyMemory(req,{workspaceId,user}={}){
  if(!configured())return {mode:'file',loaded:false};
  const rows=await request(req,`ps_azzy_memory?workspace_id=eq.${enc(workspaceId)}&user_id=eq.${enc(user.id)}&select=state,updated_at&limit=1`);
  memory.replaceUserState(user.id,rows?.[0]?.state||{});
  return {mode:'supabase',loaded:Boolean(rows?.[0]),updatedAt:rows?.[0]?.updated_at||null};
}

export async function persistAzzyMemory(req,{workspaceId,user}={}){
  if(!configured())return {mode:'file',saved:false};
  const state=memory.exportUserState(user.id);
  await request(req,'ps_azzy_memory?on_conflict=workspace_id,user_id',{
    method:'POST',
    headers:{'content-type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify([{workspace_id:workspaceId,user_id:user.id,state,updated_at:new Date().toISOString()}])
  });
  return {mode:'supabase',saved:true};
}
