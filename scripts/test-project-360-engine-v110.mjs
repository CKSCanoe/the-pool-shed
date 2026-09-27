import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const data={
  jobs:[{id:'PRJ-1',name:'Pool refurbishment',customerId:'C1',status:'In Progress',locationId:'L-JOB-1'}],
  customers:[{id:'C1',name:'Customer'}],
  products:[
    {id:'PIPE',sku:'PIPE-15',name:'1.5in pipe',cost:10,rrp:20},
    {id:'PUMP',sku:'PUMP-1',name:'Pump',cost:500,rrp:800}
  ],
  stock:[
    {productId:'PIPE',locationId:'L-JOB-1',qty:8,allocated:0},
    {productId:'PUMP',locationId:'L-MAIN',qty:1,allocated:0}
  ],
  locations:[
    {id:'L-JOB-1',name:'Pool refurbishment Job Bin',type:'Job Bin',jobId:'PRJ-1'},
    {id:'L-MAIN',name:'Main Warehouse',type:'Warehouse'}
  ],
  allocations:[{id:'A1',jobId:'PRJ-1',productId:'PIPE',qty:4,fromLocationId:'L-MAIN',status:'Allocated'}],
  salesOrders:[],
  purchaseOrders:[{id:'PO-1',jobId:'PRJ-1',status:'Sent',supplier:'CPC',lines:[{productId:'PIPE',jobId:'PRJ-1',qty:10,received:4,unitCost:12}]}],
  movements:[],
  toolAssignments:[]
};

function available(row){return Number(row.qty||0)-Number(row.allocated||0);}
function removeStock(productId,locationId,qty){
  const row=data.stock.find(r=>r.productId===productId&&r.locationId===locationId);
  if(!row||available(row)<qty)return false;
  row.qty-=qty;return true;
}
function addMovement(type,productId,qty,from,to,ref,user,note){data.movements.push({id:'M'+(data.movements.length+1),type,productId,qty,from,to,ref,user,note,date:'2026-09-15'});}

const c={
  data,crypto:globalThis.crypto,currentUser:()=>({id:'u',name:'Manager'}),canAccessTab:()=>true,isAdminUser:()=>true,
  saveAppData:()=>true,workspaceLocalSaveFailed:false,psToolCost:()=>0,available,removeStock,addMovement
};
vm.createContext(c);
vm.runInContext(fs.readFileSync('public/project-engine.js','utf8'),c);
const job=data.jobs[0];
const apply=(action,v={})=>c.psProjectTransaction(action,{jobId:job.id,...v});

apply('settings',{quoteNet:1000,quoteRef:'Q-1',quoteAccepted:true,targetMargin:40,minimumMargin:30,lossWarningMargin:5,remainingNet:100,invoiceExposureThresholdPct:40,invoiceExposureThresholdNet:0});
apply('material-plan',{productId:'PIPE',plannedQty:6,budgetUnitCost:9,note:'Plant room pipework'});
let summary=c.psProjectSummary(job,data,Date.parse('2026-09-15T12:00:00Z'));
assert.equal(job.project.minimumMargin,30);
assert.equal(job.project.invoiceExposureThresholdPct,40);
assert.equal(job.project.materialPlan.length,1);
assert.equal(typeof c.psProjectStockSummary,'function');
const stock=c.psProjectStockSummary(job,data);
const pipe=stock.lines.find(x=>x.productId==='PIPE');
assert.equal(pipe.planned,6);
assert.equal(pipe.allocated,4);
assert.equal(pipe.inbound,6);
assert.equal(pipe.jobBin,8);
assert.equal(pipe.budgetCost,5400);
assert.equal(pipe.forecastMaterialCost>=7200,true);
assert.equal(pipe.costVariance>0,true);
assert(summary.materialVariance>0);
assert(summary.alerts.some(a=>/material/i.test(a.text)));

// Risk threshold is separate from near-loss threshold.
apply('cost',{supplier:'Subcontractor',ref:'SUB-1',net:650,state:'Committed'});
summary=c.psProjectSummary(job,data,Date.parse('2026-09-15T12:00:00Z'));
assert(summary.margin<30);
assert.equal(c.psProjectHealth(job,summary).level,'At Risk');
assert(summary.alerts.some(a=>/minimum/i.test(a.text)));

// Project Use must use shared physical-stock mutation and movement history.
const beforeQty=data.stock.find(r=>r.productId==='PIPE'&&r.locationId==='L-JOB-1').qty;
apply('stock-use',{productId:'PIPE',qty:2,reason:'Installed in plant room'});
assert.equal(data.stock.find(r=>r.productId==='PIPE'&&r.locationId==='L-JOB-1').qty,beforeQty-2);
assert(data.movements.some(m=>m.type==='Project Use'&&m.ref==='PRJ-1'&&m.qty===2));
const usedStock=c.psProjectStockSummary(job,data).lines.find(x=>x.productId==='PIPE');
assert.equal(usedStock.used,2);

// Damage must also deduct free Job Bin stock and remain visible in project stock history.
apply('stock-damage',{productId:'PIPE',qty:1,reason:'Cracked fitting on site'});
assert(data.movements.some(m=>m.type==='Project Damage / Loss'&&m.ref==='PRJ-1'&&m.qty===1));
assert.equal(c.psProjectStockSummary(job,data).lines.find(x=>x.productId==='PIPE').damagedLost,1);

// Invoice exposure is advisory and does not create an invoice automatically.
job.project.phases=[{id:'PH1',name:'Deposit',amountNet:100,agreement:'Terms',ready:true,invoiceRequested:true}];
summary=c.psProjectSummary(job,data,Date.parse('2026-09-15T12:00:00Z'));
assert(summary.invoiceExposure);
assert(summary.invoiceExposure.costExposure>=summary.actual);
assert(summary.invoiceExposure.thresholdTriggered===true);
assert(summary.alerts.some(a=>/invoice review/i.test(a.text)));
assert.equal(data.notifications?.length||0,0);

console.log('Project 360 engine: margin thresholds, material planning, live stock, inbound, project-use/damage movements and invoice exposure passed.');
