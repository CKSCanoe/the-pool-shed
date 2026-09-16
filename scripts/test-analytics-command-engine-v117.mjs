import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
assert(fs.existsSync('public/analytics-command-engine.js'),'Analytics Command engine must exist');
const data={
 customers:[{id:'C1',name:'White Residence'}],
 products:[{id:'P1',sku:'SKU1',name:'Pump',cost:100,rrp:200,category:'Heating'},{id:'P2',sku:'SKU2',name:'Valve',cost:20,rrp:40,category:'Pipework'}],
 salesOrders:[
  {id:'SO1',customerId:'C1',created:'2026-09-05',status:'Invoiced',lines:[{productId:'P1',qty:2,unitPrice:200,unitCost:100}]},
  {id:'SO2',customerId:'C1',created:'2026-09-10',status:'Invoiced',lines:[{productId:'P2',qty:5,unitPrice:40,unitCost:20}]}
 ],
 stock:[{productId:'P1',locationId:'L1',qty:3},{productId:'P2',locationId:'L1',qty:10}],
 suppliers:[{name:'Certikin'}],purchaseOrders:[],jobs:[{id:'J1',name:'Pool A'},{id:'J2',name:'Pool B'}],goodsNotes:[],movements:[]
};
const ctx={console,globalThis:null,window:null,Date,Math,Set,Map,Intl};ctx.globalThis=ctx;ctx.window=ctx;ctx.__POOL_SHED_GET_DATA__=()=>data;
ctx.PoolShedFinanceCommand={snapshot:()=>({metrics:{customersOverdue:23840,invoiceReady:2,xeroExceptions:1}})};
ctx.PoolShedSupplierCommand={deliveryPerformance:(name)=>({onTimePct:name==='Certikin'?81:100,qualified:10}),supplierSummary:()=>({flags:[]})};
ctx.PoolShedProjectEngine={summary:(job)=>job.id==='J1'?{margin:18,target:30,profit:120000,forecast:550000,revenue:670000}:{margin:36,target:30,profit:250000,forecast:450000,revenue:700000},health:(job,s)=>s.margin<25?{level:'At Risk'}:{level:'Healthy'}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/analytics-command-engine.js','utf8'),ctx);
const a=ctx.PoolShedAnalyticsCommand;assert(a,'PoolShedAnalyticsCommand API missing');
const snap=a.snapshot({period:'MTD',today:'2026-09-16'});
assert.equal(snap.metrics.revenue.value,600);
assert.equal(snap.metrics.grossProfit.value,300);
assert.equal(snap.metrics.grossMargin.value,50);
assert.equal(snap.metrics.overdueDebt.value,23840);
assert.equal(snap.metrics.stockValue.value,500);
assert.equal(snap.metrics.supplierOnTime.value,81);
assert.equal(snap.metrics.projectMarginRisk.value,1);
assert.equal(snap.metrics.quoteConversion.available,false,'Quote conversion must not be invented without qualified quote outcomes');
assert(snap.dataQuality.some(x=>x.metric==='quoteConversion'));
const att=a.managementAttention({period:'MTD',today:'2026-09-16'});assert(att.some(x=>x.code==='overdue-debt'));assert(att.some(x=>x.code==='supplier-performance'));assert(att.some(x=>x.code==='project-margin-risk'));
const lib=a.metricLibrary();for(const key of ['revenue','grossProfit','grossMargin','quoteConversion','overdueDebt','stockValue','supplierOnTime','projectMarginRisk'])assert(lib.some(m=>m.key===key),`missing metric ${key}`);
console.log('PASS Analytics Command governed metrics, data-quality rules and management attention');
