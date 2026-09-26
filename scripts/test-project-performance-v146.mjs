import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';

const count=800,data={jobs:[{id:'J',name:'Performance project',customerId:'C',project:{version:3,quoteNet:500000,quoteRef:'Q1 v1',quoteAccepted:true,targetMargin:30,minimumMargin:20,warningMargin:25,lossWarningMargin:5,remainingNet:10000,forecastReviewedAt:new Date().toISOString(),quoteLinks:[],variations:[],costs:[],phases:[],tasks:[],documents:[],materialPlan:[],stockEvents:[],audit:[]}}],salesOrders:[],purchaseOrders:[],products:[{id:'P',cost:10,name:'Part'}],toolAssignments:[],locations:[],stock:[],allocations:[],movements:[],quotes:[]};
for(let i=0;i<count;i++){
 const so='SO'+i,po='PO'+i,v='V'+i;
 data.salesOrders.push({id:so,jobId:'J',variationId:v,status:'Open',lines:[{productId:'P',qty:1,unitCost:10}]});
 data.purchaseOrders.push({id:po,jobId:'J',status:'Ordered',lines:[{salesOrderId:so,productId:'P',qty:1,received:i%2,unitCost:10}]});
 data.jobs[0].project.variations.push({id:v,status:'Approved',sellNet:20,costNet:10});
 data.jobs[0].project.costs.push({id:'C'+i,state:'Actual',net:10,poId:po,orderId:so,variationId:v,coverageNet:10});
}
const ctx={data,crypto:globalThis.crypto,isAdminUser:()=>true,canAccessTab:()=>true,currentUser:()=>({name:'Performance test'}),saveAppData:()=>true,workspaceLocalSaveFailed:false};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/project-engine.js','utf8'),ctx);
for(let i=0;i<3;i++)ctx.psProjectSummary(data.jobs[0],data);
const started=performance.now();let summary;for(let i=0;i<8;i++)summary=ctx.psProjectSummary(data.jobs[0],data);const average=(performance.now()-started)/8;
assert.equal(summary.approvedExtra,count*20*100);assert.equal(summary.actual,count*10*100);assert(average<150,'Project summary average '+average.toFixed(1)+'ms exceeds 150ms regression budget for '+count+' connected orders/POs/extras');
console.log('PASS project financial summary performance: '+average.toFixed(1)+'ms average for '+count+' connected orders/POs/extras');
