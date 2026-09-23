import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.match(pkg.version,/^1\.(?:32\.[1-9]\d*|3[3-9]\.\d+)$/);
const index=fs.readFileSync('public/index.html','utf8');
const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const permissions=fs.readFileSync('public/settings-permissions-engine.js','utf8');
const workspace=fs.readFileSync('public/quote-studio-workspace.js','utf8');
const engineSource=fs.readFileSync('public/quote-studio-engine.js','utf8');
const sw=fs.readFileSync('public/service-worker.js','utf8');
const vercel=fs.readFileSync('vercel.json','utf8');
assert.match(index,/id="screen-quotes"/);
assert.doesNotMatch(index,/quote-studio\.css/,'Quote Studio CSS must be part of the single app.css runtime bundle');
assert.match(fs.readFileSync('scripts/build-css.mjs','utf8'),/59-quote-studio\.css/);
assert.match(index,/quote-studio-engine\.js\?v=1\.34\.0/);
assert.match(index,/quote-studio-workspace\.js\?v=1\.34\.0/);
assert.match(legacy,/quotes:\s*\[\]/);
assert.match(legacy,/id:\s*"quotes",\s*label:\s*"Quotes"/);
assert.match(legacy,/renderQuoteStudioWorkspace/);
assert.match(legacy,/__POOL_SHED_SAVE_APP_DATA__/);
assert.match(permissions,/quotes/);
assert.match(workspace,/Options & Packages/);
assert.match(workspace,/Pool Layout/);
assert.match(workspace,/Engagement/);
assert.match(workspace,/Handover/);
assert.match(sw,/pool-shed-v1\.34\.0-elite-quote-builder/);
assert.match(sw,/isCustomerProposal/);
assert.match(vercel,/"api\/quote\.js"/);

const data={
 customers:[{id:'C1',name:'Test Client',address:'Test House'}],
 products:[
  {id:'P1',sku:'PB-PUMP-1',name:'Premium Pump',supplier:'Supplier A',supplierSku:'SUP-P1',cost:500,rrp:1200},
  {id:'P2',sku:'PB-FILTER-1',name:'Premium Filter',supplier:'Supplier B',supplierSku:'SUP-F1',cost:400,rrp:900},
  {id:'B1',sku:'PB-PLANT-BUNDLE',name:'Premium Plant Room',supplier:'Pool Bros',cost:0,rrp:3200,bundleItems:[{productId:'P1',qty:1},{productId:'P2',qty:1}]}
 ],quotes:[],quoteTemplates:[],quoteSettings:{minimumMargin:20},jobs:[],salesOrders:[],purchaseOrders:[],stock:[],allocations:[],movements:[]
};
const context={console,crypto:webcrypto,TextEncoder,TextDecoder,Date,Math,Intl,URLSearchParams,navigator:{onLine:false},sessionStorage:{setItem(){},getItem(){return null}},__POOL_SHED_GET_DATA__:()=>data,__POOL_SHED_SAVE_APP_DATA__:()=>true,__POOL_SHED_CURRENT_USER__:()=>({id:'U1',name:'Aaron'}),__POOL_SHED_WORKSPACE_ID__:()=> 'pool-bros-main'};
vm.createContext(context);vm.runInContext(engineSource,context);
const qs=context.PoolShedQuoteStudio;assert(qs,'Quote Studio engine must initialise');assert.equal(qs.VERSION,'1.34.0');
const q=qs.createQuote({customerId:'C1',projectName:'Test Pool',projectType:'Pool Build',workflow:'project'}),section=q.sections[0];
assert.equal(q.workflow,'project');assert.equal(q.handoverPolicy.createProjectOnAcceptance,true);assert.equal(q.handoverPolicy.xeroRequestMode,'deposit');
qs.addProductOption(q.id,section.id,'P1');
const bundle=qs.addProductOption(q.id,section.id,'B1');
section.options.forEach(o=>o.selected=o.id===bundle.id);
const publicSnap=qs.customerSnapshot(q),publicText=JSON.stringify(publicSnap);
for(const forbidden of ['costSnapshot','supplierSnapshot','supplierSkuSnapshot','componentSnapshot','unitCost','purchaseOrders','commercialSnapshot'])assert(!publicText.includes(forbidden),'public proposal leaked '+forbidden);
assert.equal(publicSnap.customer.name,'Test Client');
const matrix=qs.operationalOptions(q);assert.equal(matrix.length,2,'all offered options must retain operational mapping');
const bundleMap=matrix.find(x=>x.optionId===bundle.id);assert(bundleMap);assert.equal(bundleMap.lines.filter(x=>x.bundleRole==='component').length,2,'bundle must explode into component SKUs internally');
const version=await qs.buildVersion(q);assert.equal(version.number,1);assert(version.hash);assert.equal(version.commercialSnapshot.operationalOptions.length,2);assert(!JSON.stringify(version.publicSnapshot).includes('Supplier A'));
console.log('PASS v1.34.0 Quote Studio native wiring, one-state engine, safe public snapshot and SKU/bundle operational mapping');
