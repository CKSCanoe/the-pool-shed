import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const actionFile='public/action-authority.js';
const approvalFile='public/approval-authority.js';
const integrationFile='public/action-approval-integrations.js';
const legacyFile='public/assets/js/01-legacy-01.js';

assert.ok(fs.existsSync(integrationFile),'Action/Approval integration module missing');

const data={
  actionAuthority:{actions:[],approvals:[],sourceState:{},metricsState:{},version:1},
  notifications:[],
  stockTakes:[{
    id:'ST-1',ref:'ST-001',locationId:'L-MAIN',status:'Submitted',submittedAt:'2026-09-18 09:00',countedBy:'Dave',
    lines:[
      {productId:'P-1',systemQty:10,countedQty:8,reason:'Missing'},
      {productId:'P-2',systemQty:5,countedQty:6,reason:'Correct count'}
    ]
  }],
  products:[{id:'P-1',cost:25},{id:'P-2',cost:40}]
};
const user={id:'u-mgr',name:'Manager',role:'Management'};
const audits=[];const notifications=[];let saves=0;const decisions=[];
const ctx={console,Date,Math,JSON,Set,Map,Intl,globalThis:null,window:null,crypto:{randomUUID:()=>String(Math.random()).slice(2)}};
ctx.globalThis=ctx;ctx.window=ctx;
ctx.__POOL_SHED_GET_DATA__=()=>data;
ctx.__POOL_SHED_CURRENT_USER__=()=>user;
ctx.saveAppData=()=>saves++;
ctx.PoolShedIdentity={normalizeRole:r=>r,currentUser:()=>user};
ctx.PoolShedSettingsPermissions={
  can:(module,op,u)=>{const r=(u||user).role;if(r==='Admin')return true;if(op==='view')return true;if(op==='approve')return ['Admin','Management'].includes(r);return true;},
  approvalRoute:(key,amount,u)=>({allowed:['Admin','Management'].includes((u||user).role),limit:5000,requiredRole:'Management'})
};
ctx.PoolShedAudit={record:e=>{audits.push(e);return e;}};
ctx.PoolShedNotificationsCommand={create:e=>{notifications.push(e);return {ok:true};}};
ctx.__POOL_SHED_APPLY_STOCKTAKE_DECISION__=(locationId,decision,meta)=>{
  const st=data.stockTakes.find(x=>x.locationId===locationId);
  if(!st)return {ok:false,reason:'Stock take not found'};
  decisions.push({locationId,decision,meta});
  if(decision==='approve'){
    st.status='Approved';st.approvedBy=meta.decidedByName||'Manager';st.approvedAt='2026-09-18 10:00';
    return {ok:true,stockTake:st};
  }
  if(decision==='reject'){
    st.status='Rejected';st.adminNote=meta.note||'';
    return {ok:true,stockTake:st};
  }
  return {ok:false,reason:'Unsupported decision'};
};
vm.createContext(ctx);
for(const f of [actionFile,approvalFile,integrationFile]) vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});

const integrations=ctx.PoolShedActionApprovalIntegrations;
const approvals=ctx.PoolShedApprovalAuthority;
assert.ok(integrations,'integration API missing');
assert.equal(typeof integrations.requestStocktakeApproval,'function');
assert.equal(typeof integrations.decideStocktakeApproval,'function');

const requested=integrations.requestStocktakeApproval('L-MAIN');
assert.equal(requested.ok,true);
assert.equal(requested.approval.type,'stock_variance');
assert.equal(requested.approval.dedupeKey,'stocktake:ST-001:approval');
assert.equal(requested.approval.value,90,'variance value must use absolute quantity difference x product cost');
assert.equal(requested.approval.source.module,'locations');
assert.equal(requested.approval.source.type,'stocktake');
assert.equal(requested.approval.command.name,'approveStocktake');
assert.ok(requested.approval.createdActionId,'approval should create linked My Work action');

const approved=integrations.decideStocktakeApproval('L-MAIN','approve',{note:'Variance checked'});
assert.equal(approved.ok,true);
assert.equal(data.stockTakes[0].status,'Approved');
assert.equal(decisions.at(-1).decision,'approve');
assert.equal(requested.approval.status,'approved');

// A fresh submitted stock take can be rejected through the same authority and must update Inventory state.
data.stockTakes[0]={...data.stockTakes[0],id:'ST-2',ref:'ST-002',status:'Submitted',submittedAt:'2026-09-18 11:00',approvedBy:'',approvedAt:'',adminNote:''};
const requested2=integrations.requestStocktakeApproval('L-MAIN');
assert.equal(requested2.ok,true);
const rejected=integrations.decideStocktakeApproval('L-MAIN','reject',{note:'Count again before write-off'});
assert.equal(rejected.ok,true);
assert.equal(data.stockTakes[0].status,'Rejected');
assert.equal(data.stockTakes[0].adminNote,'Count again before write-off');
assert.equal(decisions.at(-1).decision,'reject');
assert.equal(requested2.approval.status,'rejected');

const legacy=fs.readFileSync(legacyFile,'utf8');
assert.match(legacy,/PoolShedActionApprovalIntegrations\.requestStocktakeApproval\(locationId\)/,'Stock take submission must request canonical approval');
assert.match(legacy,/PoolShedActionApprovalIntegrations\.decideStocktakeApproval\(locationId,\s*decision/,'Stock take approve\/reject must route through Approval Authority');
assert.match(legacy,/__POOL_SHED_APPLY_STOCKTAKE_DECISION__/,'Inventory must expose its own decision callback for controlled approval execution');
assert.ok(audits.some(e=>e.action==='Approval requested'));
assert.ok(audits.some(e=>e.action==='Approval approved'));
assert.ok(audits.some(e=>e.action==='Approval rejected'));
assert.ok(saves>0);
console.log('PASS v1.27 stock take submission and approval decisions use Approval Authority while Inventory remains mutation owner');
