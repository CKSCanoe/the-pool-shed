import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

function load(file,ctx){ctx.globalThis=ctx;ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});return ctx;}

const automationData={automationCommand:{rules:[{id:'AUTO-1',name:'QA automation',status:'Draft',authority:'Automatic',nodes:[{type:'Trigger',config:{}},{type:'Notify',config:{}}]}],runs:[],approvals:[],suggestions:[],scheduledJobs:[],alerts:[]}};
const automationAudit=[];
const aCtx=load('public/automation-command-engine.js',{console,Date,Math,JSON,Array,Object,String,Number,RegExp,__POOL_SHED_GET_DATA__:()=>automationData,__POOL_SHED_CURRENT_USER__:()=>({id:'U-1',name:'Aaron',role:'Admin'}),PoolShedSettingsPermissions:{can:()=>true},PoolShedAudit:{record:e=>{automationAudit.push(e);return {id:'AUD-1',...e};}},saveAppData(){}});
const activation=aCtx.PoolShedAutomationCommand.activateRule('AUTO-1',{simulationPassed:true});
assert.equal(activation.ok,true);
assert.equal(automationAudit.length,1,'Automation activation must create one canonical audit event');
assert.equal(automationAudit[0].action,'Automation activated');
assert.equal(automationAudit[0].record.id,'AUTO-1');
assert.equal(automationAudit[0].module,'automation');

const analyticsData={analyticsCommand:{exportHistory:[],savedReports:[],metricAlerts:[]}};
const analyticsAudit=[];
const anCtx=load('public/analytics-command-engine.js',{console,Date,Math,JSON,Array,Object,String,Number,RegExp,Map,Set,__POOL_SHED_GET_DATA__:()=>analyticsData,PoolShedAudit:{record:e=>{analyticsAudit.push(e);return {id:'AUD-2',...e};}},saveAppData(){}});
anCtx.PoolShedAnalyticsCommand.recordExport({dataset:'All System Data',format:'JSON',recordCount:27,user:{id:'U-1',name:'Aaron',role:'Admin'},scope:'Full system export'});
assert.equal(analyticsAudit.length,1,'Full system export history must also create one canonical audit event');
assert.equal(analyticsAudit[0].action,'Data export created');
assert.equal(analyticsAudit[0].module,'analytics');
assert.equal(analyticsAudit[0].record.id,'All System Data');
assert.equal(analyticsAudit[0].metadata.recordCount,27);

console.log('PASS v1.26 high-risk Automation activation and Analytics export canonical audit hooks');
