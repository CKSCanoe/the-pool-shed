import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
assert(fs.existsSync('public/assistant-engine.js'),'Smart Assistant engine must exist');
const data={
 products:[{id:'P1',sku:'PB-BV-150',name:'1.5 inch Double Union Ball Valve',barcode:'501234',supplierSku:'CER-88472',brand:'Certikin',category:'Pipework',description:'Grey plant room valve',cost:18.42,rrp:34.99},{id:'P2',sku:'PB-BV-200',name:'2 inch Double Union Ball Valve',barcode:'501235',supplierSku:'CER-88473',brand:'Certikin',category:'Pipework'}],
 stock:[{productId:'P1',locationId:'L1',qty:12},{productId:'P1',locationId:'L2',qty:2}],locations:[{id:'L1',name:'Leominster Warehouse'},{id:'L2',name:'Dave Van'}],allocations:[{productId:'P1',qty:6,orderId:'SO1'}],
 customers:[{id:'C1',name:'White Residence',email:'white@example.test'}],salesOrders:[{id:'SO1',customerId:'C1',status:'Allocated',lines:[{productId:'P1',qty:6}]}],
 purchaseOrders:[{id:'PO-2099',supplier:'Certikin',status:'Part Received',due:'2026-09-12',lines:[{productId:'P1',qty:22,received:18}]}],
 jobs:[{id:'J1',name:'Bromyard Pool',customerId:'C1'}],movements:[{id:'M1',productId:'P1',type:'Goods In',qty:18,ref:'PO-2099'}],
 purchaseReturns:[{id:'RET-1',purchaseOrderId:'PO-2099',supplier:'Certikin',status:'Awaiting credit',reason:'Wrong item'}],notifications:[{id:'N1',type:'Stock',message:'Valve stock needs review',status:'Needs review'}],assistantSettings:{name:'Azzy',aliases:[{term:'DU valve',targetType:'product',targetId:'P1'}]},assistantKnowledge:[{id:'K1',title:'Book in supplier delivery',keywords:['goods in','book in delivery','supplier delivery'],body:'Open Warehouse → Goods In. Select the PO. Enter the delivery reference. Record each line as Accepted, Damaged, Wrong Item or Short. Confirm Goods-In only after the physical delivery has been checked.',steps:['Open Warehouse → Goods In','Select the Purchase Order','Enter the supplier delivery reference','Record Accepted, Damaged, Wrong Item or Short quantities','Confirm Goods-In'],status:'Approved'}]
};
const ctx={console,globalThis:null,window:null,Date,Math,Set,Map,Intl};ctx.globalThis=ctx;ctx.window=ctx;ctx.__POOL_SHED_GET_DATA__=()=>data;ctx.__POOL_SHED_CAN_ACCESS__=(module)=>module!=='accounting';ctx.__POOL_SHED_CURRENT_USER__=()=>({id:'u1',name:'Aaron',role:'Admin'});vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/assistant-engine.js','utf8'),ctx);
const a=ctx.PoolShedAssistantEngine;assert(a,'PoolShedAssistantEngine API missing');
let r=a.search('PB-BV-150');assert.equal(r.results[0].id,'P1');assert.equal(r.results[0].type,'product');assert(r.results[0].score>=100,'exact SKU should rank highest');
r=a.search('DU valve');assert.equal(r.results[0].id,'P1','approved alias must resolve product');
r=a.search('grey valve plant room');assert.equal(r.results[0].id,'P1','descriptive search should find likely product');
r=a.search('RET-1');assert(r.results.some(x=>x.id==='RET-1'),'Find Anything must include operational return/history records');
const att=a.answer('What needs my attention today?',{today:'2026-09-16'});assert(att.text.includes('PO-2099'));assert(att.sources.some(s=>s.id==='PO-2099'));assert(att.sources.some(s=>s.id==='N1'));
const ans=a.answer('Do we have any PB-BV-150?');assert(ans.text.includes('PB-BV-150'));assert(ans.text.includes('14'),'must include on-hand quantity');assert(ans.text.includes('8'),'must include available quantity after allocation');assert(ans.sources.some(s=>s.type==='product'&&s.id==='P1'));assert(ans.sources.some(s=>s.type==='stock'));
const how=a.answer('How do I book in a supplier delivery?');assert(how.text.includes('Warehouse'));assert(how.text.includes('Short'));assert(how.steps.length>=4);assert(how.sources.some(s=>s.type==='knowledge'&&s.id==='K1'));
const why=a.answer('Why is PO-2099 late?',{today:'2026-09-16'});assert(why.text.includes('22'));assert(why.text.includes('18'));assert(why.text.includes('4'));assert(why.text.toLowerCase().includes('late'));assert(why.sources.some(s=>s.id==='PO-2099'));
const missing=a.answer('What is the courier tracking for PO-2099?');assert.equal(missing.status,'knowledge-gap');assert(missing.text.toLowerCase().includes('not held'));assert(missing.nextActions.length>0,'knowledge gap should give next in-system action');
const profile=a.profile();assert.equal(profile.name,'Azzy');a.saveProfile({name:'Poolie',avatar:'data:image/png;base64,AAAA'});assert.equal(a.profile().name,'Poolie');
console.log('PASS Smart Assistant Pool Shed-only retrieval, provenance, item finding, training answers and actionable knowledge gaps');
