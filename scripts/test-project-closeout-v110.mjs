import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const data={
 jobs:[{id:'P1',name:'Project',customerId:'C',status:'Commercial Review',locationId:'L-JOB'}],
 products:[{id:'A',name:'Valve',sku:'A',cost:10}],
 locations:[{id:'L-JOB',name:'Project Job Bin',type:'Job Bin',jobId:'P1'}],
 stock:[{productId:'A',locationId:'L-JOB',qty:2,allocated:0}],allocations:[],salesOrders:[],movements:[],
 purchaseOrders:[{id:'PO1',jobId:'P1',status:'Sent',lines:[{productId:'A',jobId:'P1',qty:3,received:1,unitCost:10}]}],
 engineerRequests:[{id:'ER1',jobId:'P1',status:'PO Raised',lines:[{productId:'A',qty:1}]}],
 toolAssignments:[{toolId:'T1',jobId:'P1',startedAt:'2026-09-10',dailyRate:1,ownership:'Owned'}]
};
const c={data,crypto:globalThis.crypto,currentUser:()=>({name:'Manager'}),canAccessTab:()=>true,isAdminUser:()=>true,saveAppData:()=>true,workspaceLocalSaveFailed:false,psToolCost:()=>0};
vm.createContext(c);vm.runInContext(fs.readFileSync('public/project-engine.js','utf8'),c);
const job=data.jobs[0],p=c.psProjectModel(job);Object.assign(p,{quoteNet:1000,quoteAccepted:true,quoteRef:'Q1',targetMargin:40,minimumMargin:30,lossWarningMargin:5,remainingNet:0,forecastReviewedAt:'2026-09-01T00:00:00Z'});p.variations=[{id:'V1',title:'Extra',sellNet:100,costNet:20,status:'Proposed'}];p.phases=[{id:'PH1',name:'Final',amountNet:1000,agreement:'Completion',ready:true,invoiceRequested:false}];
let blockers=c.psProjectCloseoutBlockers(job,data,{documents:[]},Date.parse('2026-09-15T12:00:00Z'));
for(const code of ['JOB_BIN_STOCK','OPEN_PO','OPEN_ENGINEER_REQUEST','OUTSTANDING_TOOL','PROPOSED_VARIATION','BILLING_INCOMPLETE'])assert(blockers.some(b=>b.code===code),`Expected ${code} blocker`);
// Clear operational blockers and make billing reconciled.
data.stock[0].qty=0;data.purchaseOrders[0].lines[0].received=3;data.engineerRequests[0].status='Completed';data.toolAssignments[0].returnedAt='2026-09-15';p.variations[0].status='Rejected';p.phases[0].invoiceRequested=true;
blockers=c.psProjectCloseoutBlockers(job,data,{documents:[{source_id:'PROJECT:P1:PH1',status:'AUTHORISED'}]},Date.parse('2026-09-15T12:00:00Z'));
assert.equal(blockers.length,0,JSON.stringify(blockers));
// A critical loss must be reviewed recently before closure.
p.costs=[{id:'C1',supplier:'X',ref:'INV',net:1200,state:'Actual'}];p.forecastReviewedAt='2026-09-01T00:00:00Z';
blockers=c.psProjectCloseoutBlockers(job,data,{documents:[{source_id:'PROJECT:P1:PH1',status:'AUTHORISED'}]},Date.parse('2026-09-15T12:00:00Z'));
assert(blockers.some(b=>b.code==='COMMERCIAL_REVIEW'));
p.forecastReviewedAt='2026-09-15T10:00:00Z';
blockers=c.psProjectCloseoutBlockers(job,data,{documents:[{source_id:'PROJECT:P1:PH1',status:'AUTHORISED'}]},Date.parse('2026-09-15T12:00:00Z'));
assert(!blockers.some(b=>b.code==='COMMERCIAL_REVIEW'));
console.log('Project close-out: stock, PO, request, tool, variation, billing and critical commercial review gates passed.');
