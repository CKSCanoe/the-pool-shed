// Framework-neutral example for a trusted Pool Shed server route.
// IMPORTANT: authUser, permissions and workspace must come from Pool Shed's
// authenticated server-side authorities. Do not trust role/permissions sent by
// the browser.
import {
  askAzzyFromPoolShed,
  bootstrapAzzyForPoolShed,
  updateAzzyContextForPoolShed,
  markAzzyAttentionSeenForPoolShed,
  approveAzzyActionFromPoolShed
} from './pool-shed-server-runtime.js';

export async function handleAzzyPoolShedRequest({operation,body={},authUser,permissions,workspace,revision,updatedAt,executePoolShedAction}){
  const common={workspace,user:authUser,permissions,revision,updatedAt,actionExecutor:executePoolShedAction};
  if(operation==='bootstrap')return bootstrapAzzyForPoolShed(common);
  if(operation==='chat')return askAzzyFromPoolShed({...common,message:String(body.message||''),context:body.context||null,contexts:Array.isArray(body.contexts)?body.contexts:null});
  if(operation==='context')return updateAzzyContextForPoolShed(common,{action:body.action||'add',context:body.context||null,contexts:Array.isArray(body.contexts)?body.contexts:[]});
  if(operation==='attention-seen')return markAzzyAttentionSeenForPoolShed(common,Array.isArray(body.ids)?body.ids:[]);
  if(operation==='approve-action')return approveAzzyActionFromPoolShed(common,body.actionId);
  throw new Error(`Unknown Azzy operation: ${operation}`);
}
