import fs from 'node:fs';import assert from 'node:assert/strict';
assert(fs.existsSync('public/fulfilment-workspace.js'),'Fulfilment Command workspace must exist');
const s=fs.readFileSync('public/fulfilment-workspace.js','utf8');
for(const token of ['Fulfilment Command','Overview','Goods Notes','Pick Queue','Pack Bench','Dispatch','Collections','Delivery Exceptions','History','Ready to Pick','Due Today','Awaiting Pack','Ready to Ship','Blocked','Shipped Today','Outbound work queue','Needs attention','data-ff-search','data-ff-filter','data-ff-action','data-ff-section','goodsNoteWorkspace','legacyBindFulfilment','PoolShedFulfilmentControl'])assert(s.includes(token),`workspace missing ${token}`);
for(const action of ['print-queue','batch-pick','new-shipment','open','pack','ship','notify','hold','release','open-order','split'])assert(s.includes(`case '${action}'`)||s.includes(`case \"${action}\"`),`missing handler for ${action}`);
assert(s.includes("sidebarSubGroups=function(id){if(id==='fulfilment')"),'Fulfilment sidebar must be owned by command workspace');
assert(s.includes('renderFulfilment=function()'),'workspace must override legacy renderFulfilment');
console.log('PASS Fulfilment Command workspace structure and action coverage');
