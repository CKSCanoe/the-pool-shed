import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
assert(fs.existsSync('public/production-readiness-engine.js'),'Production Readiness engine must exist');
const data={
 salesOrders:[{id:'SO-1',status:'Complete',customerId:'C1'}],
 goodsNotes:[{id:'GN-1',salesOrderId:'SO-1',shipped:true,status:'Shipped'}],
 purchaseOrders:[{id:'PO-1',supplier:'Certikin',status:'Part Received',promisedDate:'2026-09-10',lines:[{productId:'P1',qty:10,received:8,unitCost:20}],supplierInvoiceRef:'BILL-1',invoiceMatchStatus:'Mismatch'}],
 jobs:[{id:'J-1',name:'Pool Build',status:'Commercial Review'}],
 salesCredits:[{id:'CR-1',originalSalesOrderId:'SO-1',returnStatus:'Awaiting Goods-In',status:'Authorised'}],
 stock:[{productId:'P1',locationId:'L1',qty:-1,allocated:0}],
 automationLogs:[{id:'AUTOLOG-1',status:'Failed',ruleId:'AUTO-1',message:'Notification failed'}],
 financeCommand:{customerDocuments:[],supplierBills:[{id:'BILL-1',sourceId:'PO-1',status:'BLOCK PAYMENT',amountDue:200}]},
 auditLog:[]
};
const ctx={console,Date,Math,Set,Map,Intl,globalThis:null,window:null};ctx.globalThis=ctx;ctx.window=ctx;ctx.__POOL_SHED_GET_DATA__=()=>data;
ctx.PoolShedFinanceCommand={snapshot:()=>({metrics:{invoiceReady:1,xeroExceptions:0,customersOverdue:100,supplierBillsOverdue:0}}),threeWayRows:()=>[{poId:'PO-1',status:'BLOCK PAYMENT',supplier:'Certikin',billNumber:'BILL-1'}]};
ctx.PoolShedSupplierCommand={smartFlags:()=>[{type:'short-receipt',severity:'warning',title:'PO-1 received short',poId:'PO-1',tab:'Late & Backorders'}]};
ctx.PoolShedProjectEngine={closeout:(job)=>job.id==='J-1'?['Unresolved variation']:[]};
ctx.PoolShedAnalyticsCommand={canFullExport:(u)=>String(u?.role).toLowerCase()==='admin'};
ctx.PoolShedAutomationCommand={summary:()=>({active:3,approvals:1})};
ctx.PoolShedAssistantEngine={profile:()=>({answerPolicy:'Pool Shed only'})};
ctx.PoolShedSettingsPermissions={securitySummary:()=>({approvalGaps:0,inactiveAdmins:0,fullExportUsers:1}),can:()=>true};
ctx.PoolShedProductHub={};ctx.PoolShedInventoryControl={};ctx.PoolShedFulfilmentControl={};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/production-readiness-engine.js','utf8'),ctx);
const r=ctx.PoolShedProductionReadiness;assert(r,'PoolShedProductionReadiness missing');
const snap=r.inspect({today:'2026-09-16'});
assert.equal(snap.version,'1.20.0');
assert.equal(snap.systemChecks.filter(x=>x.state==='pass').length,snap.systemChecks.length,'all required authority engines should be recognised');
assert.equal(snap.journeys.length,7,'seven critical acceptance journeys required');
for(const id of ['order-to-cash','procure-to-pay','project-commercial','returns-credits','engineer-stock','automation-assistant','reporting-export'])assert(snap.journeys.some(j=>j.id===id),`missing journey ${id}`);
const codes=snap.issues.map(x=>x.code);
for(const code of ['invoice-missing-after-ship','supplier-short-late','three-way-blocked','project-closeout','return-awaiting-qc','negative-stock','automation-failure'])assert(codes.includes(code),`missing issue ${code}`);
assert(snap.blockers.some(x=>x.code==='negative-stock'),'negative stock must be a production-readiness blocker');
assert(snap.attention.some(x=>x.code==='invoice-missing-after-ship'),'shipped not invoiced is operational attention');
assert.equal(r.routeForIssue(snap.issues.find(x=>x.code==='three-way-blocked')).page,'Three-Way Match');
assert.equal(snap.answerPolicy,'Pool Shed only');
console.log('PASS v1.20 Production Readiness engine journeys, blockers, attention and source authority');
