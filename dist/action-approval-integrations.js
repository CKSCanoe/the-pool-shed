(function(global){
'use strict';
function data(){try{return global.__POOL_SHED_GET_DATA__?global.__POOL_SHED_GET_DATA__():(global.data||{});}catch(_){return global.data||{};}}
function current(){try{return global.PoolShedIdentity&&global.PoolShedIdentity.currentUser?global.PoolShedIdentity.currentUser():(global.__POOL_SHED_CURRENT_USER__?global.__POOL_SHED_CURRENT_USER__():{});}catch(_){return {};}}
function arr(v){return Array.isArray(v)?v:[];}
function text(v){return String(v==null?'':v);}
function stockTake(locationId){return arr(data().stockTakes).find(st=>text(st.locationId)===text(locationId))||null;}
function productCost(productId){const p=arr(data().products).find(x=>text(x.id)===text(productId));const n=Number(p&&p.cost||0);return Number.isFinite(n)?n:0;}
function variance(stocktake){return arr(stocktake&&stocktake.lines).reduce((out,line)=>{const diff=Number(line.countedQty||0)-Number(line.systemQty||0);if(diff!==0){out.rows+=1;out.value+=Math.abs(diff)*productCost(line.productId);}return out;},{rows:0,value:0});}
function fingerprint(st){if(!st)return '';return JSON.stringify({ref:text(st.ref||st.id),locationId:text(st.locationId),status:text(st.status),submittedAt:text(st.submittedAt),lines:arr(st.lines).map(l=>({productId:text(l.productId),systemQty:Number(l.systemQty||0),countedQty:Number(l.countedQty||0),reason:text(l.reason)}))});}
function callback(locationId,decision,approval){if(typeof global.__POOL_SHED_APPLY_STOCKTAKE_DECISION__!=='function')return {ok:false,reason:'Inventory stock take decision handler unavailable'};const u=current();return global.__POOL_SHED_APPLY_STOCKTAKE_DECISION__(locationId,decision,{note:text(approval&&approval.decision&&approval.decision.note),decidedBy:text(u.id),decidedByName:text(u.name||u.full_name||u.email||u.id||'Management'),approvalId:text(approval&&approval.id)});}
function register(){const api=global.PoolShedApprovalAuthority;if(!api||typeof api.registerCommand!=='function')return false;return api.registerCommand('approveStocktake',{
  getSource:(approval)=>{const payload=approval&&approval.command&&approval.command.payload||{};return stockTake(payload.locationId)||arr(data().stockTakes).find(st=>text(st.ref||st.id)===text(approval&&approval.source&&approval.source.id))||null;},
  fingerprint:(source)=>fingerprint(source),
  execute:(approval,source)=>{if(!source)return {ok:false,reason:'Stock take not found'};if(text(source.status)!=='Submitted')return {ok:false,reason:'Stock take is no longer submitted'};return callback(source.locationId,'approve',approval);},
  reject:(approval,source)=>{if(!source)return {ok:false,reason:'Stock take not found'};if(text(source.status)!=='Submitted')return {ok:false,reason:'Stock take is no longer submitted'};return callback(source.locationId,'reject',approval);}
});}
function pendingFor(st){const api=global.PoolShedApprovalAuthority;if(!api||typeof api.state!=='function'||!st)return null;const key='stocktake:'+text(st.ref||st.id||st.locationId)+':approval';return arr(api.state().approvals).find(a=>a.dedupeKey===key&&a.status==='pending')||null;}
function requestStocktakeApproval(locationId){const st=stockTake(locationId);if(!st)return {ok:false,reason:'Stock take not found'};if(text(st.status)!=='Submitted')return {ok:false,reason:'Stock take must be submitted before approval'};const api=global.PoolShedApprovalAuthority;if(!api||typeof api.request!=='function')return {ok:false,reason:'Approval Authority unavailable'};const v=variance(st),ref=text(st.ref||st.id||st.locationId);return api.request({dedupeKey:'stocktake:'+ref+':approval',type:'stock_variance',title:'Approve stock take variance',summary:v.rows+' variance line'+(v.rows===1?'':'s')+' require review.',ownerRole:'Management',requiredPermission:'locations.approve',requiredLimit:v.value,value:v.value,currency:'GBP',reason:'Review submitted stock take before Inventory can post physical stock variances.',source:{module:'locations',type:'stocktake',id:ref,route:'#/inventory'},command:{name:'approveStocktake',payload:{locationId:text(locationId),ref}}});}
function decideStocktakeApproval(locationId,decision,options){const st=stockTake(locationId);if(!st)return {ok:false,reason:'Stock take not found'};const api=global.PoolShedApprovalAuthority;if(!api)return {ok:false,reason:'Approval Authority unavailable'};let approval=pendingFor(st);if(!approval){const created=requestStocktakeApproval(locationId);if(!created.ok)return created;approval=created.approval;}
  const note=text(options&&options.note);
  if(decision==='approve')return api.approve(approval.id,{note});
  if(decision==='reject')return api.reject(approval.id,{note});
  if(decision==='recount'){
    const withdrawn=api.withdraw(approval.id,{note:note||'Recount requested'});if(!withdrawn.ok)return withdrawn;
    return callback(locationId,'recount',{id:approval.id,decision:{note:note||'Variance needs recount.'}});
  }
  return {ok:false,reason:'Unsupported stock take decision'};
}
register();
global.PoolShedActionApprovalIntegrations={requestStocktakeApproval,decideStocktakeApproval,register,pendingFor};
})(typeof globalThis!=='undefined'?globalThis:window);
