import { normalisePoolShedWorkspace } from './pool-shed-normalizer.js';
import { withRuntimeData } from '../src/data/runtime-data.js';
import { runAgent, bootstrap, updateWorkingContexts, markAttentionSeen, approveAction } from '../src/core/agent.js';

function requiredUser(user,permissions){
  if(!user?.id&&!user?.userId)throw new Error('A server-authenticated Pool Shed user is required.');
  return {
    id:String(user.id||user.userId),
    name:user.full_name||user.fullName||user.name||user.email||String(user.id||user.userId),
    role:user.role||'staff',
    permissions:[...new Set((permissions||user.permissions||[]).map(String))]
  };
}

export function buildAzzyPoolShedSnapshot({workspace,user,permissions,revision,updatedAt,today}={}){
  const safeUser=requiredUser(user,permissions);
  return normalisePoolShedWorkspace(workspace||{},{users:[safeUser],revision,updatedAt,today});
}

export function withPoolShedRuntime({workspace,user,permissions,revision,updatedAt,today,actionExecutor}={},fn){
  const db=buildAzzyPoolShedSnapshot({workspace,user,permissions,revision,updatedAt,today});
  return withRuntimeData(db,fn,{actionExecutor});
}

export async function askAzzyFromPoolShed({workspace,user,permissions,message,context=null,contexts=null,revision,updatedAt,today,actionExecutor}={}){
  const safeUser=requiredUser(user,permissions);
  return withPoolShedRuntime({workspace,user:safeUser,permissions:safeUser.permissions,revision,updatedAt,today,actionExecutor},()=>runAgent({userId:safeUser.id,message,context,contexts}));
}

export async function bootstrapAzzyForPoolShed({workspace,user,permissions,revision,updatedAt,today,actionExecutor}={}){
  const safeUser=requiredUser(user,permissions);
  return withPoolShedRuntime({workspace,user:safeUser,permissions:safeUser.permissions,revision,updatedAt,today,actionExecutor},()=>bootstrap(safeUser.id));
}

export function updateAzzyContextForPoolShed(opts={},payload={}){
  const safeUser=requiredUser(opts.user,opts.permissions);
  return withPoolShedRuntime({...opts,user:safeUser,permissions:safeUser.permissions},()=>updateWorkingContexts(safeUser.id,payload));
}

export function markAzzyAttentionSeenForPoolShed(opts={},ids=[]){
  const safeUser=requiredUser(opts.user,opts.permissions);
  return withPoolShedRuntime({...opts,user:safeUser,permissions:safeUser.permissions},()=>markAttentionSeen(safeUser.id,ids));
}

export async function approveAzzyActionFromPoolShed(opts={},actionId){
  const safeUser=requiredUser(opts.user,opts.permissions);
  return withPoolShedRuntime({...opts,user:safeUser,permissions:safeUser.permissions},()=>approveAction(safeUser.id,actionId));
}
