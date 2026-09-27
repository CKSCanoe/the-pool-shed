import { normalisePoolShedWorkspace } from './pool-shed-normalizer.js';

// Install inside Pool Shed after the existing canonical bridges are available.
// This bridge is deliberately read-only. Existing Pool Shed action authorities
// remain responsible for writes and approval execution.
export function installAzzyHostBridge({getCurrentUser,permissionsForUser}={}){
  if(typeof window==='undefined')throw new Error('Azzy host bridge must run in the Pool Shed browser runtime.');
  if(typeof window.__POOL_SHED_GET_DATA__!=='function')throw new Error('__POOL_SHED_GET_DATA__ is not available.');
  if(typeof window.__POOL_SHED_CAN_ACCESS__!=='function')throw new Error('__POOL_SHED_CAN_ACCESS__ is not available.');
  const access=window.__POOL_SHED_CAN_ACCESS__;
  const modulePermissions=()=>({
    projects:access('projects'),stock:access('inventory')||access('warehouse')||access('product-hub'),purchasing:access('purchasing'),customers:access('crm'),finance:access('finance')||access('accounting'),knowledge:access('automation')||access('settings')
  });
  const permissionList=()=>{const m=modulePermissions(),p=[];if(m.projects)p.push('projects.read');if(m.stock)p.push('stock.read');if(m.purchasing)p.push('purchasing.read');if(m.customers)p.push('customers.read');if(m.finance)p.push('finance.read');if(m.knowledge)p.push('knowledge.read');if(m.projects||m.stock||m.purchasing)p.push('actions.prepare');return p;};
  const currentUser=()=>typeof getCurrentUser==='function'?getCurrentUser():(window.__POOL_SHED_CURRENT_USER__?.()||window.poolShedCurrentUser||null);
  const snapshot=()=>{const raw=structuredClone(window.__POOL_SHED_GET_DATA__()||{}),u=currentUser(),users=u?[{id:u.id||u.userId,name:u.full_name||u.fullName||u.name||u.email,role:u.role||'staff',permissions:typeof permissionsForUser==='function'?permissionsForUser(u):permissionList()}]:[];return normalisePoolShedWorkspace(raw,{users,revision:raw.revision||raw._revision||1,updatedAt:raw.updatedAt||raw._updatedAt});};
  const context=()=>window.__AZZY_PAGE_CONTEXT__||null;
  window.AzzyPoolShedBridge=Object.freeze({snapshot,context,currentUser,canAccess:access,permissions:permissionList});
  window.dispatchEvent(new CustomEvent('azzy:poolshed-bridge-ready'));
  return window.AzzyPoolShedBridge;
}
