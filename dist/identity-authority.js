(function(global){
'use strict';
const ROLE_IDS=['Admin','Management','Accounts','Sales','Purchasing','Warehouse','Engineer','Office'];
const ROLE_LABELS={Admin:'Admin',Management:'Management',Accounts:'Accounts',Sales:'Sales',Purchasing:'Purchasing',Warehouse:'Warehouse',Engineer:'Engineer',Office:'Office'};
function rawUsers(){try{return typeof global.__POOL_SHED_ALL_USERS__==='function'?(global.__POOL_SHED_ALL_USERS__()||[]):[];}catch(_){return [];}}
function rawCurrent(){try{return typeof global.__POOL_SHED_CURRENT_USER__==='function'?global.__POOL_SHED_CURRENT_USER__():rawUsers()[0]||null;}catch(_){return rawUsers()[0]||null;}}
function diagnostic(input,normalized,context){
  const original=String(input==null?'':input).trim();
  if(!original||original==='User'||ROLE_IDS.includes(original))return;
  const event={type:'unknown-business-role',input:original,normalized:normalized||'Office',context:context||'identity-normalization',occurredAt:new Date().toISOString()};
  try{if(typeof global.__POOL_SHED_IDENTITY_DIAGNOSTIC__==='function')global.__POOL_SHED_IDENTITY_DIAGNOSTIC__(event);else if(global.PoolShedAudit&&typeof global.PoolShedAudit.record==='function')global.PoolShedAudit.record({action:'Unknown business role normalized',category:'Security',severity:'warning',module:'settings',record:{type:'user-role',id:original,label:original},before:{role:original},after:{role:'Office'},reason:'Unknown business role normalized to Office',metadata:{context:event.context},source:'system'});}catch(_){}
}
function normalizeRole(role,options){const original=String(role==null?'':role).trim();if(original==='User')return 'Office';if(ROLE_IDS.includes(original))return original;if(options&&options.diagnose)diagnostic(original,'Office',options.context);return 'Office';}
function isCanonicalRole(role){return ROLE_IDS.includes(String(role==null?'':role).trim());}
function normalizeUser(user,options){if(!user||typeof user!=='object')return user;const role=normalizeRole(user.role,Object.assign({},options,{diagnose:!!(options&&options.diagnose)}));return Object.assign({},user,{role});}
function normalizeUsers(users,options){return Array.isArray(users)?users.map(u=>normalizeUser(u,options)):[];}
function currentUser(){return normalizeUser(rawCurrent(),{diagnose:true,context:'current-user'});}
function roles(){return ROLE_IDS.map(id=>({id,label:ROLE_LABELS[id]}));}
function isAdmin(user){const u=user||rawCurrent()||{};return normalizeRole(u.role)==='Admin';}
global.PoolShedIdentity={roles,normalizeRole,isCanonicalRole,normalizeUser,normalizeUsers,currentUser,isAdmin};
})(typeof globalThis!=='undefined'?globalThis:window);
