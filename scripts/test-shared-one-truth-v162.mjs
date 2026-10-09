import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');

assert.match(src,/workspaceBaseSnapshot/,'shared workspace must keep a server-base snapshot for merging');
assert.match(src,/workspaceMergeValue/,'shared workspace must have three-way merge support');
assert.match(src,/multi-user-save-conflict/,'simultaneous saves must retain a recovery point');
assert.match(src,/Pool Shed merged both users’ changes/,'simultaneous saves must merge instead of silently dropping one user');
assert.match(src,/Pool Shed caught an unsaved workspace mutation during render/,'render safety net must persist missed data mutations');
assert.match(src,/flushSharedWorkspaceSave\(label\)/,'important changes need immediate shared-save confirmation');

const handlerStart=src.indexOf('        document.querySelectorAll("[data-order-field]")');
const handlerEnd=src.indexOf('        document.querySelectorAll("[data-apply-order-customer]")',handlerStart);
assert(handlerStart>0&&handlerEnd>handlerStart,'Sales Order field handler not found');
const statusHandler=src.slice(handlerStart,handlerEnd);
assert.match(statusHandler,/saveAppData\(\)/,'Sales Order status changes must save locally');
assert.match(statusHandler,/flushSharedWorkspaceSave\(label\)/,'Sales Order status changes must confirm the shared save');
assert.match(statusHandler,/statusUpdatedBy/,'Sales Order status changes must record who made the change');
assert.match(statusHandler,/statusUpdatedAt/,'Sales Order status changes must record when it changed');

const bulkStart=src.indexOf('        if (action === "status") {');
const bulkEnd=src.indexOf('        if (action === "delete") {',bulkStart);
assert(bulkStart>0&&bulkEnd>bulkStart,'bulk Sales Order status handler not found');
const bulk=src.slice(bulkStart,bulkEnd);
assert.match(bulk,/flushSharedWorkspaceSave/,'bulk status changes must confirm the shared save');
assert.match(bulk,/statusUpdatedBy/,'bulk status changes must retain the user');

const helperStart=src.indexOf('      function workspaceJsonEqual(');
const helperEnd=src.indexOf('      function loadUsers()',helperStart);
assert(helperStart>0&&helperEnd>helperStart,'workspace merge helpers not found');
const ctx={JSON,Map,Set,console,clone:v=>JSON.parse(JSON.stringify(v))};
vm.createContext(ctx);
vm.runInContext(src.slice(helperStart,helperEnd),ctx);

const base={
  salesOrders:[
    {id:'SO-1',status:'New Order',customerId:'C1',lines:[{productId:'P1',qty:1}]},
    {id:'SO-2',status:'New Order',customerId:'C2',lines:[{productId:'P2',qty:1}]}
  ],
  products:[{id:'P1',sku:'P1',stock:10},{id:'P2',sku:'P2',stock:5}],
  customers:[{id:'C1',name:'A'},{id:'C2',name:'B'}]
};
const local=JSON.parse(JSON.stringify(base));
local.salesOrders[0].status='On Hold';
local.salesOrders[0].statusUpdatedBy='Rachel';
local.salesOrders[0].statusUpdatedAt='2026-10-08T15:00:00Z';
local.salesOrders.push({id:'SO-3',status:'Needs Review',customerId:'C3',lines:[]});
const remote=JSON.parse(JSON.stringify(base));
remote.salesOrders[1].status='Ready To Pick';
remote.products[1].stock=8;
remote.customers.push({id:'C3',name:'C'});

const conflicts=[];
const merged=ctx.workspaceMergeValue(base,local,remote,'',conflicts);
assert.equal(merged.salesOrders.find(o=>o.id==='SO-1').status,'On Hold','Rachel/local status change must survive another user saving first');
assert.equal(merged.salesOrders.find(o=>o.id==='SO-2').status,'Ready To Pick','other user Sales Order status must also survive');
assert.equal(merged.products.find(p=>p.id==='P2').stock,8,'remote stock change must survive unrelated local edit');
assert(merged.salesOrders.some(o=>o.id==='SO-3'),'local newly-created Sales Order must survive');
assert(merged.customers.some(c=>c.id==='C3'),'remote newly-created customer must survive');

// If both people edit the exact same field from the same base, the user whose
// save is being retried is the later local intent and wins, while Recovery still
// preserves the pre-merge browser copy.
const localSame=JSON.parse(JSON.stringify(base));
const remoteSame=JSON.parse(JSON.stringify(base));
localSame.salesOrders[0].status='Completed';
remoteSame.salesOrders[0].status='Invoiced';
const sameConflicts=[];
const mergedSame=ctx.workspaceMergeValue(base,localSame,remoteSame,'',sameConflicts);
assert.equal(mergedSame.salesOrders[0].status,'Completed','later local field edit should win a same-field collision');
assert(sameConflicts.length>0,'same-field collision must be recorded as a merge conflict');

console.log('PASS single shared truth: status changes save immediately, concurrent users merge, and missed mutations are auto-persisted');