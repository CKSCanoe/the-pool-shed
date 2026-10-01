import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const data={
  jobs:[{id:'J',name:'Pool build',owner:'Aaron',customerId:'C',status:'In Progress'}],
  customers:[{id:'C',name:'Client',priceList:'rrp'}],
  salesOrders:[
    {id:'SO-ORIGINAL',projectId:'J',customerId:'C',status:'Open',lines:[{productId:'P',qty:2,unitPrice:600,unitCost:250,allocated:0,picked:0,packed:0}]}
  ],
  purchaseOrders:[
    {id:'PO-1',status:'Ordered',lines:[{productId:'P',salesOrderId:'SO-ORIGINAL',qty:2,received:0,unitCost:200}]}
  ],
  products:[
    {id:'P',sku:'P',name:'Pump',rrp:600,cost:250},
    {id:'EX',sku:'EX',name:'Extra work',rrp:250,cost:0}
  ],
  toolAssignments:[],toolAssets:[],stock:[],allocations:[],movements:[]
};

const c={
  data,
  crypto:globalThis.crypto,
  currentUser:()=>({id:'u',name:'Manager'}),
  canAccessTab:()=>true,
  isAdminUser:()=>true,
  saveAppData:()=>true,
  workspaceLocalSaveFailed:false
};
vm.createContext(c);
vm.runInContext(fs.readFileSync('public/project-engine.js','utf8'),c);

const job=data.jobs[0],p=c.psProjectModel(job);
Object.assign(p,{
  quoteNet:1000,
  quoteRef:'Q-FALLBACK',
  quoteAccepted:true,
  targetMargin:30,
  minimumMargin:20,
  warningMargin:25,
  lossWarningMargin:5,
  remainingNet:0,
  forecastReviewedAt:'2026-09-30T12:00:00Z'
});

const summary=(date='2026-09-30T12:00:00Z')=>c.psProjectSummary(job,data,Date.parse(date));

let s=summary();
assert.equal(s.revenueSource,'sales-orders');
assert.equal(s.originalOrderRevenue,120000);
assert.equal(s.originalSellingValue,120000);
assert.equal(s.revenue,120000,'Live linked Sales Order value must supersede the manual quote fallback');
assert.equal(s.committed,40000,'Ordered PO must feed committed project cost');
assert.equal(s.forecast,40000,'PO coverage must replace the Sales Order material estimate rather than double count it');
assert.equal(s.profit,80000);
assert(Math.abs(s.margin-66.6666666667)<0.001);

c.psProjectTransaction('labour-add',{jobId:'J',supplier:'Dave',ref:'DAVE-30SEP',startDate:'2026-09-30',endDate:'2026-09-30',rateType:'day',rate:300,replaceRemaining:'no'});
s=summary();
assert.equal(s.labourAccrued,30000);
assert.equal(s.forecast,70000,'Labour must add to PO-backed project cost');
assert.equal(s.profit,50000);
assert(Math.abs(s.margin-41.6666666667)<0.001);

p.variations.push({id:'V1',title:'Landscaping extra',sellNet:200,costNet:0,status:'Approved'});
s=summary();
assert.equal(s.approvedExtra,20000);
assert.equal(s.revenue,140000,'Approved extra without an SO uses its approved value as fallback');

data.salesOrders.push({id:'SO-EXTRA',projectId:'J',variationId:'V1',customerId:'C',status:'Open',lines:[{productId:'EX',qty:1,unitPrice:250,unitCost:0,allocated:0,picked:0,packed:0}]});
s=summary();
assert.equal(s.approvedExtra,25000,'Extra Sales Order value must replace, not add to, the approved-extra fallback value');
assert.equal(s.revenue,145000);

data.salesOrders.find(o=>o.id==='SO-EXTRA').status='Cancelled';
s=summary();
assert.equal(s.approvedExtra,20000,'Cancelled extra SO falls back to the approved extra value');
assert.equal(s.revenue,140000);

data.salesOrders.find(o=>o.id==='SO-ORIGINAL').status='Cancelled';
s=summary();
assert.equal(s.revenueSource,'quote-fallback');
assert.equal(s.originalSellingValue,100000);
assert.equal(s.revenue,120000,'With no active original SO, legacy accepted quote remains a safe fallback');

const projectUi=fs.readFileSync('public/project-workspace.js','utf8');
assert.match(projectUi,/Where the money goes/);
assert.match(projectUi,/Live from Sales Orders and Purchase Orders/,'money view identifies its live source records');
assert.match(projectUi,/data-open-so/,'money view links back to Sales Orders');
assert.match(projectUi,/data-open-po/,'money view links back to Purchase Orders');
console.log('PASS live SO project value, PO commitments, labour cost, extra SO replacement and quote fallback');
