import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {convertSnapshot,acceptedLines,acceptedTotals} from '../server/quote.js';

const source=fs.readFileSync('public/quote-studio-engine.js','utf8');
const data={customers:[{id:'C1',name:'Light Refurb Client',address:'Pool House'}],products:[
{id:'P1',sku:'PB-PUMP-1',name:'Pool Pump',supplier:'Supplier A',supplierSku:'A1',cost:400,rrp:1200},
{id:'P2',sku:'PB-FILTER-1',name:'Filter',supplier:'Supplier B',supplierSku:'B1',cost:300,rrp:900}
],quotes:[],quoteSettings:{minimumMargin:20},jobs:[],salesOrders:[],purchaseOrders:[],stock:[{productId:'P1',locationId:'MAIN',qty:1,allocated:0},{productId:'P2',locationId:'MAIN',qty:0,allocated:0}],allocations:[],movements:[]};
const ctx={console,crypto:webcrypto,TextEncoder,TextDecoder,Date,Math,Intl,URLSearchParams,navigator:{onLine:false},sessionStorage:{setItem(){},getItem(){return null}},__POOL_SHED_GET_DATA__:()=>data,__POOL_SHED_SAVE_APP_DATA__:()=>true,__POOL_SHED_CURRENT_USER__:()=>({id:'U1',name:'Aaron'}),__POOL_SHED_WORKSPACE_ID__:()=> 'pool-bros-main'};
vm.createContext(ctx);vm.runInContext(source,ctx);const qs=ctx.PoolShedQuoteStudio;

// Quick Quote defaults: direct to SO, no Project, full Xero payment request.
const quick=qs.createQuote({customerId:'C1',projectName:'Light refurbishment',projectType:'Light Refurbishment / Repair',workflow:'quick'});
assert.equal(quick.workflow,'quick');assert.equal(quick.handoverPolicy.createProjectOnAcceptance,false);assert.equal(quick.handoverPolicy.createSalesOrderOnAcceptance,true);assert.equal(quick.handoverPolicy.xeroRequestMode,'full');
const qsec=quick.sections[0];const qo=qs.addProductOption(quick.id,qsec.id,'P1');qsec.options.forEach(o=>o.selected=o.id===qo.id);
const qver=await qs.buildVersion(quick);quick.versions.push(qver);quick.currentVersion=quick.publishedVersion=qver.number;
const publicText=JSON.stringify(qver.publicSnapshot);assert(!publicText.includes('handoverPolicy'));assert(!publicText.includes('workflow'));assert.equal(qver.publicSnapshot.payment.mode,'full');
const qconv=qs.convertAccepted(quick.id,qver.number,{signer:'Client'});assert.equal(qconv.workflow,'quick');assert.equal(qconv.projectId,'');assert(qconv.salesOrderId);assert.equal(qconv.deposit.mode,'full');assert.equal(qconv.deposit.status,'Ready to queue');
assert.equal(data.jobs.length,0,'quick quote must not create Project by default');assert.equal(data.salesOrders.length,1);

// Quick Quote optional Project toggle works without changing workflow type.
const quickProject=qs.createQuote({customerId:'C1',projectName:'Liner replacement',projectType:'Light Refurbishment / Repair',workflow:'quick',createProjectOnAcceptance:'yes',xeroRequestMode:'deposit'});
const qps=quickProject.sections[0];const qpo=qs.addProductOption(quickProject.id,qps.id,'P2');qps.options.forEach(o=>o.selected=o.id===qpo.id);
const qpver=await qs.buildVersion(quickProject);quickProject.versions.push(qpver);quickProject.currentVersion=quickProject.publishedVersion=qpver.number;
const qpconv=qs.convertAccepted(quickProject.id,qpver.number,{signer:'Client'});assert.equal(qpconv.workflow,'quick');assert(qpconv.projectId);assert(qpconv.salesOrderId);assert.equal(qpconv.deposit.mode,'deposit');

// Server conversion must obey frozen workflow, not mutable live quote state.
const base={customers:[{id:'C1',name:'Client',address:'Site'}],products:data.products,quotes:[{id:'Q-SRV',customerId:'C1',projectName:'Server Quick',status:'Sent',workflow:'project',versions:[],deliveries:[],approvals:[],engagement:{events:[]},audit:[]}],jobs:[{id:'J-OLD',name:'Existing'}],salesOrders:[{id:'SO-OLD'}],purchaseOrders:[{id:'PO-OLD'}],stock:[{productId:'P1',locationId:'MAIN',qty:1,allocated:0},{productId:'P2',locationId:'MAIN',qty:0,allocated:0}],allocations:[],movements:[],receiptEvents:[],putawayTransfers:[]};
const pub={id:'11111111-1111-1111-1111-111111111111',quote_id:'Q-SRV',version_number:1,version_hash:'h',created_at:new Date().toISOString(),published_by:'22222222-2222-2222-2222-222222222222',public_payload:{quoteId:'Q-SRV',projectName:'Server Quick',projectType:'Light Refurb',vatRate:20,depositPercent:50,termsVersion:'4.3',sections:[{id:'S1',rule:'single',required:true,options:[{id:'O1',selected:true}]}]},commercial_payload:{workflow:'quick',handoverPolicy:{createProjectOnAcceptance:false,createSalesOrderOnAcceptance:true,allocateStockOnAcceptance:true,createDraftPurchaseOrders:true,xeroRequestMode:'full',requirePaymentBeforePORelease:true},customerId:'C1',operationalOptions:[{sectionId:'S1',optionId:'O1',rule:'single',lines:[{id:'L1',productId:'P1',sku:'PB-PUMP-1',description:'Pump',qty:1,unitPrice:1200,unitCost:400,supplier:'Supplier A',supplierSku:'A1'},{id:'L2',productId:'P2',sku:'PB-FILTER-1',description:'Filter',qty:1,unitPrice:900,unitCost:300,supplier:'Supplier B',supplierSku:'B1'}]}]},customer_state:{selections:{S1:['O1']}}};
const acceptance={id:'A1',accepted_at:new Date().toISOString(),signer:'Client',terms_version:'4.3',selections:{S1:['O1']}};
const out=convertSnapshot(base,{publication:pub,acceptance});assert.equal(out.conversion.workflow,'quick');assert.equal(out.conversion.projectId,'');assert(out.conversion.salesOrderId);assert.equal(out.snapshot.jobs.length,1,'server quick conversion must not create Project');assert.equal(out.snapshot.salesOrders.length,2);assert.equal(out.conversion.deposit.mode,'full');assert.equal(out.conversion.deposit.amount,2520);assert.equal(out.snapshot.purchaseOrders.length,2);assert.equal(out.snapshot.purchaseOrders.find(x=>x.id!=='PO-OLD').depositGate,'Awaiting payment');
const again=convertSnapshot(out.snapshot,{publication:pub,acceptance});assert.equal(again.alreadyConverted,true);assert.equal(again.snapshot.salesOrders.length,out.snapshot.salesOrders.length);
console.log('PASS v1.31.0 Quick Quote direct-to-SO, optional Project, frozen workflow authority, payment modes, stock/PO handover and idempotency');
