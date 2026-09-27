import vm from 'node:vm';import fs from 'node:fs';import assert from 'node:assert/strict';
const data={jobs:[{id:'J',name:'Pool',customerId:'C'}],salesOrders:[{id:'SO',customerId:'C',lines:[{productId:'P',qty:10,shipped:2}]}],purchaseOrders:[],products:[{id:'P',cost:10}],toolAssignments:[]};
const c={data,crypto:globalThis.crypto,currentUser:()=>({id:'u',name:'Manager'}),canAccessTab:()=>true,isAdminUser:()=>true,saveAppData:()=>true,workspaceLocalSaveFailed:false,psToolCost:()=>20};vm.createContext(c);vm.runInContext(fs.readFileSync('public/project-engine.js','utf8'),c);
const apply=(a,v={})=>c.psProjectTransaction(a,{jobId:'J',...v}),summary=()=>c.psProjectSummary(c.data.jobs[0]);
apply('settings',{quoteNet:1000,quoteRef:'Q1',quoteAccepted:true,targetMargin:30,lossWarningMargin:5,remainingNet:0});apply('link',{orderId:'SO'});assert.equal(summary().revenue,100000);assert.equal(summary().forecast,10000);assert.equal(summary().margin,90);
assert.throws(()=>apply('settings',{quoteNet:2000,quoteRef:'Q2',targetMargin:30,lossWarningMargin:5,remainingNet:0}));
c.data.purchaseOrders.push({id:'PO',jobId:'J',status:'Sent',lines:[{productId:'P',salesOrderId:'SO',qty:10,received:4,unitCost:10}]});assert.equal(summary().forecast,10000);assert.equal(summary().estimatedReceived,4000);assert.equal(summary().committed,6000);
apply('cost',{supplier:'Supplier',ref:'INV1',net:45,state:'Actual',poId:'PO',coverageNet:40});assert.equal(summary().forecast,10500);assert.equal(summary().actual,4500);assert.equal(summary().estimatedReceived,0);assert.equal(summary().committed,6000);
assert.throws(()=>apply('cost',{supplier:'supplier',ref:'inv1',net:45,state:'Actual'}));
apply('variation',{title:'Extra',sellNet:200,costNet:50});assert.equal(summary().revenue,100000);let id=c.data.jobs[0].project.variations[0].id;apply('approve-extra',{id,approvalRef:'Email 1'});assert.equal(summary().revenue,120000);assert.equal(summary().forecast,15500);
apply('cost',{supplier:'Engineer',ref:'TS1',net:20,state:'Actual',variationId:id});assert.equal(summary().forecast,15500);
apply('phase',{name:'Deposit',amountNet:200,agreement:'Accepted payment terms'});const phase=c.data.jobs[0].project.phases[0];apply('task',{title:'Confirm scope',owner:'Manager',phaseId:phase.id});assert.throws(()=>apply('ready-phase',{id:phase.id}));apply('done-task',{id:c.data.jobs[0].project.tasks[0].id});apply('ready-phase',{id:phase.id});assert(summary().recommendations[0].ready);
assert.throws(()=>apply('phase',{name:'Too much',amountNet:1001,agreement:'Terms'}));
apply('cost',{supplier:'Subcontractor',ref:'SUB1',net:1100,state:'Committed'});assert(summary().profit<0);assert(summary().alerts.some(a=>a.severity==='bad'));
const before=JSON.stringify(c.data);c.saveAppData=()=>false;assert.throws(()=>apply('cost',{supplier:'A',ref:'FAIL',net:1}));assert.equal(JSON.stringify(c.data),before);
console.log('Project engine: margin, locked quote, revenue deduplication, PO/bill replacement, extras approval, duplicate expenses, stage dependencies/cap, loss alerts and save rollback passed.');

c.saveAppData=()=>true;const baseline=summary().forecast;c.data.salesOrders.push({id:'OTHER-SO',jobId:'OTHER-J',lines:[]});c.data.purchaseOrders[0].lines.push({productId:'P',salesOrderId:'OTHER-SO',qty:100,received:0,unitCost:10});assert.equal(summary().forecast,baseline);console.log('Cross-project PO line ownership does not duplicate costs.');
