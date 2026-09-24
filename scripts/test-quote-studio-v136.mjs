import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {convertSnapshot} from '../server/quote.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const ws=read('public/quote-studio-workspace.js');
const eng=read('public/quote-studio-engine.js');
const portal=read('public/quote-customer-portal.js');
const api=read('api/quote.js');
const server=read('server/quote.js');
const css=read('public/quote-studio.css');
const portalCss=read('public/quote-customer-portal.css');
const systemCss=read('public/assets/css/system/59-quote-studio.css');

assert.match(ws,/qs-studio-root/,'Quote detail must use the dedicated studio root');
assert.match(ws,/qs-stage-rail/,'Quote Studio must use its own stage rail');
assert.match(ws,/exit-quote-studio/,'Quote Studio must provide an explicit Pool Shed exit');
assert.match(ws,/BUILD PROPOSAL/);
assert.match(ws,/CUSTOMER & OPERATIONS/);
assert.match(css,/body:has\(#screen-quotes:not\(\.hidden\)\) \.sidebar/,'Quote Studio must own the full application surface');
assert.match(css,/grid-template-columns:240px minmax\(0,1fr\) 304px/,'Visual builder should retain premium three-column proportions');
assert.equal(css,systemCss,'System CSS authority must match public Quote Studio CSS');

assert.match(eng,/schema:5/,'Customer proposal schema must include confirmed contact prefill and v1.38 presentation/payment data');
assert.match(eng,/customerAddress\(c\)/);
assert.match(eng,/email:c\.email/);
assert.match(portal,/pcCustomerEmail/);
assert.match(portal,/pcCustomerLine1/);
assert.match(portal,/pcCustomerPostcode/);
assert.match(portal,/contact=\{name:signer/);
assert.match(portalCss,/pc-confirm-grid/);
assert.match(api,/customerConfirmation:contact/,'Acceptance evidence must store sanitised customer confirmation');
assert.match(api,/Confirm the customer property address and postcode/);
assert.match(server,/confirmedCustomer\(acceptance\)/);
assert.match(server,/lastConfirmedSource=quoteId\+' v'\+versionNumber/);
assert.match(server,/customerConfirmation:clone/);

const snapshot={
  quotes:[],jobs:[],salesOrders:[],purchaseOrders:[],allocations:[],movements:[],
  customers:[{
    id:'C-1',name:'Old Name',companyName:'',email:'old@example.com',phone:'',
    addresses:{primary:{line1:'Old Road',postcode:'AA1 1AA',country:'United Kingdom'}}
  }],
  products:[{id:'P-1',sku:'PB-PUMP',name:'Premium Pump',supplier:'Supplier A',supplierSku:'SUP-1',cost:400,leadTimeDays:5}],
  stock:[{productId:'P-1',locationId:'L-WH-MAIN',qty:1,allocated:0}]
};
const publication={
  id:'00000000-0000-0000-0000-000000000001',
  quote_id:'Q-2026-9999',
  version_number:1,
  version_hash:'hash',
  created_at:new Date().toISOString(),
  published_by:'staff',
  customer_state:{},
  public_payload:{
    projectName:'White Residence',
    projectType:'Pool Refurbishment',
    workflow:'project',
    validUntil:'2026-12-31',
    vatRate:20,
    depositPercent:50,
    sections:[],
    customer:{name:'Old Name'}
  },
  commercial_payload:{
    customerId:'C-1',
    workflow:'project',
    handoverPolicy:{
      createProjectOnAcceptance:true,
      createSalesOrderOnAcceptance:true,
      allocateStockOnAcceptance:true,
      createDraftPurchaseOrders:true,
      xeroRequestMode:'deposit',
      requirePaymentBeforePORelease:true
    },
    operationalLines:[{
      id:'QL-1',productId:'P-1',sku:'PB-PUMP',supplierSku:'SUP-1',supplier:'Supplier A',
      description:'Premium Pump',qty:2,unitPrice:1000,unitCost:400,lineType:'product'
    }]
  }
};
const acceptance={
  id:'A-1',accepted_at:new Date().toISOString(),signer:'Matthew White',
  terms_version:'4.3',selections:{},
  evidence:{customerConfirmation:{
    name:'Matthew White',email:'matthew@example.com',phone:'07123 456789',
    address:{line1:'1 Pool Lane',line2:'',city:'Hereford',county:'Herefordshire',postcode:'HR1 1AA',country:'United Kingdom'}
  }}
};
const result=convertSnapshot(snapshot,{publication,acceptance});
const customer=result.snapshot.customers.find(x=>x.id==='C-1');
assert.equal(customer.name,'Matthew White');
assert.equal(customer.email,'matthew@example.com');
assert.equal(customer.addresses.delivery.postcode,'HR1 1AA');
assert.match(customer.deliveryAddress,/1 Pool Lane/);

assert.equal(result.conversion.workflow,'project');
assert.ok(result.conversion.projectId,'Project Proposal should create a Project');
assert.ok(result.conversion.salesOrderId,'Accepted proposal should create a Sales Order');
const so=result.snapshot.salesOrders.find(x=>x.id===result.conversion.salesOrderId);
assert.equal(so.customerId,'C-1');
assert.match(so.shipTo,/HR1 1AA/);
assert.equal(so.lines[0].productId,'P-1');
assert.equal(so.lines[0].allocated,1,'Existing stock should be allocated automatically');
assert.equal(result.snapshot.purchaseOrders.length,1,'Shortage should create a draft PO');
assert.equal(result.snapshot.purchaseOrders[0].lines[0].qty,1,'Only the shortage should be purchased');
const job=result.snapshot.jobs.find(x=>x.id===result.conversion.projectId);
assert.equal(job.customerId,'C-1');
assert.equal(job.project.materialPlan[0].productId,'P-1');

console.log('Pool Shed v1.38 Elite Quote Studio + acceptance automation: PASS');
