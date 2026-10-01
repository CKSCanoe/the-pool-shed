import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const data={
  jobs:[{id:'J-REPORT',name:'Executive Pool Build',customerId:'C1',owner:'Aaron',status:'In Progress',createdAt:'2026-09-01T08:00:00Z'}],
  customers:[{id:'C1',name:'Report Client',priceList:'rrp'}],
  products:[{id:'P1',sku:'PUMP-1',name:'Pool Pump',cost:250,rrp:600}],
  quotes:[],
  salesOrders:[{id:'SO-1',projectId:'J-REPORT',customerId:'C1',status:'Open',lines:[{productId:'P1',qty:2,unitPrice:600,unitCost:250}]}],
  purchaseOrders:[{id:'PO-1',projectId:'J-REPORT',supplier:'Certikin',status:'Ordered',lines:[{productId:'P1',salesOrderId:'SO-1',qty:2,received:0,unitCost:200}]}],
  toolAssignments:[],toolAssets:[],stock:[],allocations:[],movements:[],locations:[]
};
const finance={
  documents:[
    {id:'AR-1',kind:'ACCREC',source_id:'SO-1',status:'AUTHORISED',amount_paid:800,amount_due:640,remote:{InvoiceNumber:'INV-1',SubTotal:1200,Total:1440,Date:'2026-09-20',DueDate:'2026-10-10'}},
    {id:'AP-1',kind:'ACCPAY',source_id:'PO-1',status:'AUTHORISED',amount_paid:100,amount_due:380,remote:{InvoiceNumber:'PI-44',SubTotal:400,Total:480,Date:'2026-09-22',DueDate:'2026-10-08',Contact:{Name:'Certikin'}}}
  ]
};
const ctx={
  data,
  crypto:globalThis.crypto,
  Intl,
  Date,
  console,
  currentUser:()=>({id:'u',name:'Manager'}),
  canAccessTab:()=>true,
  isAdminUser:()=>true,
  saveAppData:()=>true,
  workspaceLocalSaveFailed:false,
  psFinanceSnapshot:()=>finance,
  customer:id=>data.customers.find(c=>c.id===id),
  money:v=>'£'+Number(v||0).toFixed(2),
  psProjectCash:v=>'£'+(Number(v||0)/100).toFixed(2),
  psProjectEsc:v=>String(v??'').replace(/[&<>"]/g,''),
  escapeHtml:v=>String(v??''),
  document:{addEventListener(){},querySelector(){return null;},createElement(){return {click(){}}}},
  window:{},
  URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},
  Blob:class Blob{},
  toast:()=>{},
  render:()=>{}
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/project-engine.js','utf8'),ctx);
const job=data.jobs[0],p=ctx.psProjectModel(job);
Object.assign(p,{quoteNet:1000,quoteRef:'Q-1',quoteAccepted:true,originalCostBudget:600,targetMargin:30,minimumMargin:20,warningMargin:25,lossWarningMargin:5,remainingNet:0,targetCompletion:'2026-10-31',forecastReviewedAt:'2026-10-01T08:00:00Z'});
ctx.psProjectTransaction('labour-add',{jobId:job.id,supplier:'Dave',ref:'LAB-1',startDate:'2026-10-01',ongoing:'on',rateType:'day',rate:300,replaceRemaining:'no'},Date.parse('2026-10-01T12:00:00Z'));

const reporting=fs.readFileSync('public/project-reporting.js','utf8');
assert.doesNotThrow(()=>new vm.Script(reporting),'Project reporting module must parse');
vm.runInContext(reporting,ctx);

const model=ctx.psProjectReportModel(job,data,Date.parse('2026-10-01T12:00:00Z'));
assert.equal(model.s.revenue,120000,'Live SO net must be the report sold-value authority');
assert.equal(model.s.committed,40000,'PO must remain the committed-cost authority');
assert.equal(model.s.forecast,70000,'PO plus labour must reconcile to forecast once, without PI/payment duplication');
assert.equal(model.s.profit,50000);
assert(Math.abs(model.s.margin-41.6666666667)<0.001);
assert.equal(model.invoiceRows.length,1);
assert.equal(model.invoiceRows[0].net,120000);
assert.equal(model.invoiceRows[0].paid,80000);
assert.equal(model.purchaseInvoices.length,1);
assert.equal(model.purchaseInvoices[0].net,40000);
assert.equal(model.purchaseInvoices[0].paid,10000);
assert.equal(model.suppliers[0].ordered,40000);
assert.equal(model.suppliers[0].invoiced,40000);
assert.equal(model.customerCash,80000);
assert.equal(model.supplierCash,10000);
assert.equal(model.cashPosition,70000);
assert.equal(model.runway.scenario,true);
assert(model.runway.daysToZero!==null&&model.runway.daysToZero>=0,'Cash runway must resolve when active daily burn exists');
assert(model.costSources.reduce((n,x)=>n+x.value,0)===model.s.forecast,'Report cost composition must reconcile exactly to project forecast');

const html=ctx.psProjectReports(job,p,model.s);
for(const phrase of ['PROJECT FINANCIAL REPORT','Export PDF','Export Excel','PURCHASE INVOICES / PI','CASH RUNWAY SCENARIO','SUPPLIERS & PURCHASE ORDERS','RECONCILIATION']){
  assert(html.includes(phrase),'Report UI missing '+phrase);
}

const workspace=fs.readFileSync('public/project-workspace.js','utf8');
const parity=fs.readFileSync('public/project-design-parity.js','utf8');
const index=fs.readFileSync('public/index.html','utf8');
assert.match(workspace,/tabs=\[[^\]]*'Reports'/,'Reports must be a first-class Project tab');
assert.match(workspace,/psProjectTab==='Reports'/,'Reports tab must route to financial reporting');
assert.match(parity,/'Reports':'Reports'/,'Polished Project navigation must expose Reports');
assert.match(index,/project-reporting\.js\?v=1\.45\.3/,'Project reporting runtime must be loaded');
assert.match(index,/jspdf@2\.5\.2/,'Pinned PDF export library must be loaded');
assert.match(index,/xlsx@0\.18\.5/,'Pinned Excel export library must be loaded');
assert(!workspace.includes("download=j.id+'-project-report.html'"),'Legacy HTML project report download must be removed');

console.log('PASS Project Reports: live SO/PO/PI accounting, cash runway, reconciliation, PDF/Excel wiring and Project navigation');
