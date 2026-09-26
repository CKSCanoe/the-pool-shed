import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {convertSnapshot} from '../server/quote.js';

const data={
 customers:[{id:'C1',name:'White household',address:'Pool House'}],
 products:[{id:'P1',sku:'LAND-1',name:'Landscaping package',supplier:'Landscapes Ltd',supplierSku:'LL-1',cost:600,rrp:1200}],
 quotes:[],quoteSettings:{minimumMargin:20},
 jobs:[{id:'J1',name:'White pool project',customerId:'C1',status:'In Progress',project:{version:3,quoteNet:10000,quoteRef:'Q-ORIGINAL v1',quoteAccepted:true,originalCostBudget:5000,targetMargin:35,minimumMargin:25,warningMargin:30,lossWarningMargin:5,remainingNet:1000,billingMode:'phases',invoiceExposureThresholdPct:40,invoiceExposureThresholdNet:0,quoteLinks:[{quoteId:'Q-ORIGINAL',version:1,role:'Original',status:'Accepted',sellNet:10000,costNet:5000,approvalRef:'Accepted Q-ORIGINAL v1',acceptedAt:'2026-09-20T10:00:00Z'}],variations:[],costs:[],correspondence:[],phases:[],tasks:[],documents:[],materialPlan:[],stockEvents:[],audit:[],forecastReviewedAt:'2026-09-26T10:00:00Z'}}],
 salesOrders:[],purchaseOrders:[],stock:[],allocations:[],movements:[],toolAssignments:[],locations:[]
};
const ctx={console,crypto:webcrypto,TextEncoder,TextDecoder,Date,Math,Intl,URLSearchParams,navigator:{onLine:false},sessionStorage:{setItem(){},getItem(){return null}},data,__POOL_SHED_GET_DATA__:()=>data,__POOL_SHED_SAVE_APP_DATA__:()=>true,__POOL_SHED_CURRENT_USER__:()=>({id:'U1',name:'Aaron'}),__POOL_SHED_WORKSPACE_ID__:()=> 'pool-bros-main',currentUser:()=>({id:'U1',name:'Aaron'}),isAdminUser:()=>true,canAccessTab:()=>true,saveAppData:()=>true,workspaceLocalSaveFailed:false};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/project-engine.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('public/quote-studio-engine.js','utf8'),ctx);
const pe=ctx.PoolShedProjectEngine,qs=ctx.PoolShedQuoteStudio,job=data.jobs[0];

let summary=pe.summary(job,data,Date.parse('2026-09-26T12:00:00Z'));
assert.equal(summary.quote,1000000);assert.equal(summary.approvedExtra,0);assert.equal(summary.revenue,1000000);

const extra=qs.createQuote({customerId:'C1',projectId:'J1',projectQuoteType:'extra',projectName:'Landscaping extra',projectType:'Landscaping'});
assert.deepEqual(JSON.parse(JSON.stringify(extra.projectLink)),{projectId:'J1',type:'extra'});
assert.equal(extra.handoverPolicy.createProjectOnAcceptance,false);assert.equal(extra.handoverPolicy.xeroRequestMode,'none');
const section=extra.sections[0],option=qs.addProductOption(extra.id,section.id,'P1');section.options.forEach(o=>o.selected=o.id===option.id);
const version=await qs.buildVersion(extra);extra.versions.push(version);extra.currentVersion=extra.publishedVersion=version.number;extra.status='Published';
summary=pe.summary(job,data,Date.parse('2026-09-26T12:00:00Z'));
assert.equal(summary.revenue,1000000,'Pending extra must not increase agreed revenue');assert.equal(summary.pendingExtraCount,1);assert.equal(summary.quoteRows.find(r=>r.quoteId===extra.id).status,'Pending');

const acceptedAt='2026-09-26T13:00:00Z';
const conversion=qs.convertAccepted(extra.id,version.number,{id:'A-EXTRA',at:acceptedAt,signer:'Client'});
assert.equal(data.jobs.length,1,'Extra acceptance must reuse the existing Project');assert.equal(conversion.projectId,'J1');assert(conversion.salesOrderId);assert(conversion.variationId);
const linkedSO=data.salesOrders.find(o=>o.id===conversion.salesOrderId);assert.equal(linkedSO.jobId,'J1');assert.equal(linkedSO.variationId,conversion.variationId);assert.equal(linkedSO.lines[0].unitPrice,1200);assert.equal(linkedSO.lines[0].unitCost,600);
summary=pe.summary(job,data,Date.parse('2026-09-26T14:00:00Z'));
assert.equal(summary.quote,1000000,'Original accepted contract stays unchanged');assert.equal(summary.approvedExtra,120000);assert.equal(summary.totalSellingValue,1120000);assert.equal(summary.acceptedExtraCount,1);assert.equal(summary.pendingExtraCount,0);assert.equal(job.project.variations.length,1);assert.equal(job.project.quoteLinks.filter(x=>x.role==='Extra').length,1);assert(job.project.correspondence.some(x=>x.type==='Customer quote accepted'&&x.sourceQuoteId===extra.id));
const again=qs.convertAccepted(extra.id,version.number,{id:'A-EXTRA',at:acceptedAt,signer:'Client'});assert.equal(again.salesOrderId,conversion.salesOrderId);assert.equal(data.salesOrders.length,1);assert.equal(job.project.variations.length,1,'Duplicate conversion must not duplicate project revenue');

const rejected=qs.createQuote({customerId:'C1',projectId:'J1',projectQuoteType:'extra',projectName:'Lighting extra'});rejected.status='Declined';
summary=pe.summary(job,data,Date.parse('2026-09-26T14:00:00Z'));assert.equal(summary.rejectedExtraCount,1);assert.equal(summary.totalSellingValue,1120000,'Rejected extras must not change agreed revenue');

const publication={id:'11111111-1111-1111-1111-111111111111',quote_id:'Q-SERVER-EXTRA',version_number:1,version_hash:'h',created_at:'2026-09-26T12:30:00Z',published_by:'22222222-2222-2222-2222-222222222222',public_payload:{quoteId:'Q-SERVER-EXTRA',projectName:'Server landscaping extra',projectType:'Landscaping',vatRate:20,depositPercent:0,termsVersion:'4.3',sections:[{id:'S1',rule:'single',required:true,options:[{id:'O1',selected:true}]}]},commercial_payload:{workflow:'project',projectLink:{projectId:'J1',type:'extra'},handoverPolicy:{createProjectOnAcceptance:false,createSalesOrderOnAcceptance:true,allocateStockOnAcceptance:true,createDraftPurchaseOrders:true,xeroRequestMode:'none',requirePaymentBeforePORelease:false},customerId:'C1',operationalOptions:[{sectionId:'S1',optionId:'O1',rule:'single',lines:[{id:'L1',productId:'P1',sku:'LAND-1',description:'Server landscaping',qty:1,unitPrice:1500,unitCost:700,supplier:'Landscapes Ltd',supplierSku:'LL-1'}]}]},customer_state:{selections:{S1:['O1']}}};
const serverBase={customers:structuredClone(data.customers),products:structuredClone(data.products),quotes:[{id:'Q-SERVER-EXTRA',customerId:'C1',projectName:'Server landscaping extra',projectLink:{projectId:'J1',type:'extra'},status:'Sent',versions:[],deliveries:[],approvals:[],engagement:{events:[]},audit:[]}],jobs:[structuredClone(data.jobs[0])],salesOrders:[],purchaseOrders:[],stock:[],allocations:[],movements:[]};
const serverAcceptance={id:'A-SERVER',accepted_at:'2026-09-26T15:00:00Z',signer:'Client',terms_version:'4.3',selections:{S1:['O1']},evidence:{customerConfirmation:{name:'Client'}}};
const server=convertSnapshot(serverBase,{publication,acceptance:serverAcceptance});assert.equal(server.snapshot.jobs.length,1);assert.equal(server.conversion.projectId,'J1');assert(server.conversion.variationId);assert.equal(server.conversion.deposit.mode,'none');assert.equal(server.snapshot.jobs[0].project.variations.filter(v=>v.quoteId==='Q-SERVER-EXTRA').length,1);assert.equal(server.snapshot.salesOrders[0].variationId,server.conversion.variationId);assert.equal(server.snapshot.salesOrders[0].unitPrice,undefined);assert(server.snapshot.jobs[0].project.correspondence.some(x=>x.kind==='Customer Acceptance'&&x.quoteId==='Q-SERVER-EXTRA'));
const serverAgain=convertSnapshot(server.snapshot,{publication,acceptance:serverAcceptance});assert.equal(serverAgain.alreadyConverted,true);assert.equal(serverAgain.snapshot.salesOrders.length,1);assert.equal(serverAgain.snapshot.jobs[0].project.variations.filter(v=>v.quoteId==='Q-SERVER-EXTRA').length,1);

const workspace=fs.readFileSync('public/project-workspace.js','utf8'),quoteWorkspace=fs.readFileSync('public/quote-studio-workspace.js','utf8');
for(const label of ['Original contract value','Approved extras','Total selling value','Actual costs','Committed costs','Remaining forecast costs','Projected profit','Projected margin','Project quotes & extras'])assert(workspace.includes(label),label+' dashboard/UI label missing');
assert(quoteWorkspace.includes('newExtraQuoteForProject'));assert(quoteWorkspace.includes('Sending an email does not approve it'));
console.log('PASS linked project extras: pending/rejected isolation, immutable original contract, accepted revenue handover, approval evidence, SO pricing, idempotency and server parity');
