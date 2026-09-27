import fs from 'node:fs';
import assert from 'node:assert/strict';
import {normalisePoolShedWorkspace} from '../server/azzy/integration/pool-shed-normalizer.js';
import {deriveAzzyPermissions} from '../server/azzy-pool-shed.js';

const client=fs.readFileSync('public/azzy-live.js','utf8');
const legacy=fs.readFileSync('public/automation-command-workspace.js','utf8');
const index=fs.readFileSync('public/index.html','utf8');
const api=fs.readFileSync('api/azzy.js','utf8');
const server=fs.readFileSync('server/azzy-pool-shed.js','utf8');
const memory=fs.readFileSync('server/azzy/src/core/memory.js','utf8');
const serviceWorker=fs.readFileSync('public/service-worker.js','utf8');

assert.match(index,/azzy-live\.css\?v=1\.45\.1/,'live Azzy stylesheet must be loaded');
assert.ok(index.indexOf('automation-command-workspace.js')<index.indexOf('azzy-live.js'),'live Azzy must load after the legacy automation workspace');
assert.match(legacy,/if\(global\.PoolShedAzzyLive\)\{document\.getElementById\('azzyFloating'\)\?\.remove\(\);return;\}/,'legacy launcher must be disabled when live Azzy is mounted');
assert.match(legacy,/PoolShedAzzyLive\.open/,'existing Automation Command assistant entry points must route to live Azzy');
assert.match(client,/__POOL_SHED_AUTH_TOKEN__/,'client must use the existing Pool Shed authenticated session token');
assert.doesNotMatch(client,/permissions\s*:/,'client must not submit browser-derived permissions');
assert.doesNotMatch(client,/workspace\s*:/,'client must not submit a browser workspace snapshot');
assert.match(api,/loadAzzyPoolShedContext\(req\)/,'API must derive trusted Pool Shed context for every operation');
assert.match(api,/approve-action'\)return send\(res,423/,'action approval endpoint must remain locked during Preview');
assert.match(server,/const WORKSPACE_ID=process\.env\.POOL_SHED_WORKSPACE_ID\|\|'pool-bros-main'/,'server must use configured/canonical workspace, not a browser workspace id');
assert.match(memory,/os\.tmpdir\(\)/,'serverless memory writes must target temporary storage');
assert.match(serviceWorker,/azzy-live\.js\?v=1\.45\.1/,'live Azzy client must be available to the offline asset cache');
assert.match(serviceWorker,/azzy-live-64\.png/,'Azzy mascot must be available to the offline asset cache');

const workspace={
  products:[{id:'P-1',sku:'PIPE-15',name:'1.5 inch pressure pipe',cost:2.4,supplier:'Acme'}],
  locations:[{id:'L-A',name:'A1'}],
  stock:[{productId:'P-1',locationId:'L-A',qty:10,allocated:3}],
  restockRules:[{productId:'P-1',min:4}],
  salesOrders:[{id:'SO-1',jobId:'JOB-1',customerId:'C-1',status:'Open',lines:[{productId:'P-1',qty:8,allocated:2}]}],
  purchaseOrders:[{id:'PO-1',jobId:'JOB-1',supplier:'Acme',status:'Ordered',due:'2026-10-05',lines:[{productId:'P-1',qty:7,received:2,unitCost:2.3}]}],
  suppliers:[{id:'SUP-1',name:'Acme'}],
  customers:[{id:'C-1',name:'Test Customer'}],
  supplierProducts:[{id:'SP-1',productId:'P-1',supplier:'Acme',supplierSku:'AC-15',cost:2.2,leadTimeDays:3}],
  jobs:[{id:'JOB-1',name:'Test Pool',customerId:'C-1',status:'Active'}],
  assistantKnowledge:[{id:'KB-1',title:'Goods In',status:'Approved',content:'Book goods in against the purchase order.'}],
  auditLog:[{id:'EV-1',at:'2026-09-27T12:00:00Z',type:'stock-adjusted',productId:'P-1',message:'Stock corrected'}]
};
const db=normalisePoolShedWorkspace(workspace,{users:[{id:'u1',name:'Manager',role:'Management',permissions:['projects.read','stock.read','purchasing.read','customers.read','knowledge.read']}],revision:12});
assert.equal(db.products['PIPE-15'].onHand,10,'stock rows keyed by Pool Shed productId must resolve to SKU');
assert.equal(db.products['PIPE-15'].allocated,3,'allocated stock must be retained');
assert.equal(db.products['PIPE-15'].onOrder,5,'open PO outstanding quantity must feed product on-order stock');
assert.equal(db.products['PIPE-15'].bin,'A1','stock location must resolve to its Pool Shed location label');
assert.equal(db.salesOrders['SO-1'].lines[0].sku,'PIPE-15','sales-order productId must resolve to SKU');
assert.equal(db.purchaseOrders['PO-1'].lines[0].sku,'PIPE-15','purchase-order productId must resolve to SKU');
assert.equal(db.purchaseOrders['PO-1'].expectedDate,'2026-10-05','Pool Shed PO due date must map to Azzy expected date');
assert.equal(db.supplierOffers['SP-1'].poolSku,'PIPE-15','supplier-product equivalence must retain canonical Pool Shed SKU');
assert.equal(db.supplierOffers['SP-1'].supplierId,'SUP-1','supplier name must resolve to the canonical supplier id');
assert.equal(db.knowledge[0].id,'KB-1','approved Pool Shed assistant knowledge must be exposed to Azzy');
assert.ok(db.events.some(x=>x.id==='EV-1'),'Pool Shed audit log events must be exposed as Azzy events');

const admin={id:'a',role:'Admin',permissions:{}};
const sales={id:'s',role:'Sales',permissions:{}};
const purchasing={id:'p',role:'Purchasing',permissions:{}};
const adminPermissions=deriveAzzyPermissions({},admin);
assert.deepEqual(adminPermissions,['projects.read','stock.read','purchasing.read','customers.read','knowledge.read','finance.read']);
assert.ok(!adminPermissions.includes('actions.prepare')&&!adminPermissions.includes('actions.approve'),'Preview must not grant Azzy write/action permissions even to Admin');
assert.ok(!deriveAzzyPermissions({},sales).includes('finance.read'),'coarse Azzy finance permission must not leak supplier bills/costs to Sales');
assert.ok(!deriveAzzyPermissions({},purchasing).includes('finance.read'),'coarse Azzy finance permission must not expose customer finance fields to Purchasing');
const restricted={securityControl:{userOverrides:{s:{crm:{view:false}}}}};
assert.ok(!deriveAzzyPermissions(restricted,sales).includes('customers.read'),'explicit Pool Shed user denies must flow through to Azzy');

console.log('PASS v1.45.1 live Azzy integration: authenticated server boundary, read-only Preview, route handoff, Pool Shed schema normalization and permission gating');
