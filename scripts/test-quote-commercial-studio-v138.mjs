import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pkg=JSON.parse(read('package.json'));
const engineSource=read('public/quote-studio-engine.js');
const ws=read('public/quote-studio-workspace.js');
const portal=read('public/quote-customer-portal.js');
const css=read('public/quote-studio.css');
const systemCss=read('public/assets/css/system/59-quote-studio.css');

assert.equal(pkg.version,'1.38.0');
assert.equal(css,systemCss,'Quote Studio CSS must retain one maintained authority');
assert.match(ws,/Back to Pool Shed/,'Every Quote Studio page needs a visible route home');
assert.match(ws,/qsCommercialForm/,'Each quote needs its own Commercial Studio form');
assert.match(ws,/Apply target margin to selected prices/);
assert.match(ws,/depositAmountOverride/);
assert.match(ws,/qsThemeForm/,'Each quote needs bespoke proposal styling');
assert.match(ws,/QUOTE STUDIO CONTROL CENTRE/);
for(const name of ['canvasOption','engagementView','versionsView','handoverView','sendDialog']) assert.match(ws,new RegExp('function\\s+'+name+'\\s*\\('),'Quote Studio must retain '+name+' renderer');

assert.match(css,/\.qs-return-bar/);
assert.match(css,/\.qs-commercial-hero/);
assert.match(css,/\.qs-settings-hero/);
assert.match(portal,/poolShedQuotePreview:v138/,'Staff preview must use cross-tab short-lived preview storage');
assert.match(portal,/showBreakdown===false/,'Customer payment breakdown must obey per-quote visibility');

const storage=new Map();
const data={
  quotes:[],quoteTemplates:[],quoteSettings:{},products:[],stock:[],
  customers:[{id:'C-1',name:'Commercial Studio Client',email:'client@example.com'}]
};
const context={
  console,Date,Math,JSON,Number,String,Boolean,Array,Object,Map,Set,Promise,
  TextEncoder,crypto:webcrypto,navigator:{onLine:false},
  localStorage:{setItem:(k,v)=>storage.set(k,String(v)),getItem:k=>storage.get(k)||null,removeItem:k=>storage.delete(k)},
  __POOL_SHED_GET_DATA__:()=>data,
  __POOL_SHED_SAVE_APP_DATA__:()=>true,
  __POOL_SHED_CURRENT_USER__:()=>({id:'U-1',name:'Pool Bros Admin'}),
  __POOL_SHED_WORKSPACE_ID__:()=> 'pool-bros-main',
  fetch:async()=>{throw new Error('Network should not be required by this test')}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(engineSource,context,{filename:'quote-studio-engine.js'});
const e=context.PoolShedQuoteStudio;
assert.ok(e,'Quote Studio engine must initialise');

const q=e.createQuote({customerId:'C-1',projectName:'Bespoke Commercial Test',workflow:'project'});
const section=q.sections[0];
e.addCustomOption(q.id,section.id,{title:'Pool works',qty:1,unitPrice:1000,costSnapshot:600,selected:true});
let t=e.totals(q);
assert.equal(t.net,1000);
assert.equal(t.cost,600);
assert.equal(t.margin,40);

q.commercial.targetMargin=50;
q.commercial.minimumMargin=45;
q.commercial.depositMode='fixed';
q.commercial.depositAmountOverride=300;
q.commercial.installationPercent=30;
q.commercial.showCustomerBreakdown=false;
t=e.totals(q);
assert.equal(t.gross,1200);
assert.equal(t.deposit,300,'Fixed per-quote deposit must override percentage deposit');
assert.equal(t.depositEffectivePercent,25);
assert.equal(e.approvalState(q).required,true,'Per-quote minimum margin must trigger approval');

const target=e.targetPricing(q,t);
assert.equal(target.targetNet,1200,'50% margin on £600 cost should target £1,200 net sell');
assert.equal(target.targetProfit,600);

const snap=e.customerSnapshot(q);
assert.equal(snap.investment.deposit,300);
assert.equal(snap.payment.showBreakdown,false);
assert.equal(snap.investment.paymentMilestones.length,0,'Hidden customer payment breakdown must remain hidden');
const publicText=JSON.stringify(snap);
assert.ok(!publicText.includes('costSnapshot'),'Customer snapshot must not expose costs');
assert.ok(!publicText.includes('minimumMargin'),'Customer snapshot must not expose margin controls');

const v=await e.buildVersion(q);
assert.equal(v.commercialSnapshot.depositPercent,25);
assert.equal(v.commercialSnapshot.commercialProfile.depositMode,'fixed');
assert.equal(v.commercialSnapshot.commercialProfile.depositAmountOverride,300);

q.commercial.minimumMargin=25;
e.applyTargetMargin(q.id);
t=e.totals(q);
assert.ok(Math.abs(t.margin-50)<0.01,'Applying target margin must update selected sell prices to the requested margin');

const saved=e.savePreview(q);
assert.ok(saved);
const preview=JSON.parse(storage.get('poolShedQuotePreview:v138'));
assert.ok(preview.expiresAt>preview.createdAt,'Staff preview payload must be explicitly short-lived');
assert.equal(preview.proposal.quoteId,q.id);

console.log('Pool Shed v1.38 Commercial Studio authority: PASS');
