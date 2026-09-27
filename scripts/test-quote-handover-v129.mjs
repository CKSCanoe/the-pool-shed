import fs from 'node:fs';
import assert from 'node:assert/strict';
import {convertSnapshot,acceptedLines,acceptedTotals} from '../server/quote.js';
const base={
 customers:[{id:'C1',name:'Client',address:'Site'}],
 products:[
  {id:'P1',sku:'PB-P1',name:'Pump',supplier:'Supplier A',supplierSku:'A-P1',cost:400,leadTimeDays:7},
  {id:'P2',sku:'PB-P2',name:'Filter',supplier:'Supplier B',supplierSku:'B-P2',cost:300,leadTimeDays:14}
 ],
 quotes:[{id:'Q-2026-0001',customerId:'C1',projectName:'Client Pool',status:'Sent',versions:[],deliveries:[],approvals:[],engagement:{events:[]},audit:[]}],
 jobs:[{id:'J-OLD',name:'Existing Job'}],salesOrders:[{id:'SO-OLD',status:'New Order'}],purchaseOrders:[{id:'PO-OLD',status:'Draft'}],
 stock:[{productId:'P1',locationId:'MAIN',qty:1,allocated:0},{productId:'P2',locationId:'MAIN',qty:0,allocated:0}],allocations:[],movements:[],receiptEvents:[],putawayTransfers:[]
};
const pub={id:'11111111-1111-1111-1111-111111111111',quote_id:'Q-2026-0001',version_number:1,version_hash:'hash',created_at:new Date().toISOString(),published_by:'22222222-2222-2222-2222-222222222222',
 public_payload:{quoteId:'Q-2026-0001',projectName:'Client Pool',projectType:'Pool Build',vatRate:20,depositPercent:50,validUntil:'2026-10-18',sections:[{id:'S1',title:'Plant',rule:'single',required:true,options:[{id:'O1',selected:false},{id:'O2',selected:true}]}]},
 commercial_payload:{customerId:'C1',ownerName:'Aaron',minimumMargin:25,operationalOptions:[
  {sectionId:'S1',optionId:'O1',rule:'single',lines:[{id:'L1',quoteOptionId:'O1',productId:'P1',sku:'PB-P1',description:'Pump only',qty:1,unitPrice:1000,unitCost:400,supplier:'Supplier A',supplierSku:'A-P1'}]},
  {sectionId:'S1',optionId:'O2',rule:'single',lines:[{id:'L2',quoteOptionId:'O2',productId:'P1',sku:'PB-P1',description:'Pump',qty:1,unitPrice:1200,unitCost:400,supplier:'Supplier A',supplierSku:'A-P1'},{id:'L3',quoteOptionId:'O2',productId:'P2',sku:'PB-P2',description:'Filter',qty:1,unitPrice:900,unitCost:300,supplier:'Supplier B',supplierSku:'B-P2'}]}]},
 customer_state:{selections:{S1:['O2']}}
};
const acceptance={id:'33333333-3333-3333-3333-333333333333',accepted_at:new Date().toISOString(),signer:'Client Name',terms_version:'4.3',selections:{S1:['O2']}};
const selected=acceptedLines(pub.public_payload,pub.commercial_payload,pub.customer_state);assert.equal(selected.length,2);assert(!selected.some(x=>x.quoteOptionId==='O1'));
const totals=acceptedTotals(pub.public_payload,selected);assert.equal(totals.net,2100);assert.equal(totals.gross,2520);assert.equal(totals.deposit,1260);
const result=convertSnapshot(base,{publication:pub,acceptance});const out=result.snapshot;
assert.equal(out.jobs.length,2);assert.equal(out.salesOrders.length,2);assert.equal(out.purchaseOrders.length,2,'only Filter shortage should create one new supplier PO alongside existing PO');
assert.deepEqual(base.stock,[{productId:'P1',locationId:'MAIN',qty:1,allocated:0},{productId:'P2',locationId:'MAIN',qty:0,allocated:0}],'source snapshot must remain untouched');
const newJob=out.jobs.find(x=>x.id!== 'J-OLD'),newSO=out.salesOrders.find(x=>x.id!=='SO-OLD'),newPO=out.purchaseOrders.find(x=>x.id!=='PO-OLD');
assert(newJob&&newSO&&newPO);assert.equal(newSO.lines.length,2);assert.equal(newSO.lines.find(x=>x.productId==='P1').allocated,1);assert.equal(newSO.lines.find(x=>x.productId==='P2').allocated,0);assert.equal(out.stock.find(x=>x.productId==='P1').allocated,1);assert(out.stock.every(x=>Number(x.allocated)<=Number(x.qty)),'allocation may never exceed stock');
assert.equal(newPO.status,'Draft - Review');assert.equal(newPO.depositGate,'Awaiting payment');assert.match(newPO.supplierEmailStatus,/Blocked/);assert.equal(newPO.supplier,'Supplier B');
assert.equal(result.conversion.deposit.status,'Ready for Xero');assert.equal(result.conversion.acceptedTotals.deposit,1260);
const twice=convertSnapshot(out,{publication:pub,acceptance});assert.equal(twice.alreadyConverted,true);assert.equal(twice.snapshot.jobs.length,out.jobs.length);assert.equal(twice.snapshot.salesOrders.length,out.salesOrders.length);assert.equal(twice.snapshot.purchaseOrders.length,out.purchaseOrders.length);

const sql=fs.readFileSync('database/007-quote-studio.sql','utf8');
assert.match(sql,/ps_quote_history_guard/);assert.match(sql,/Published quote versions are immutable/);assert.match(sql,/Accepted quote evidence is immutable/);assert.match(sql,/ps_quote_workspace_save/);assert.match(sql,/Invalid stock balance or reservation/);assert.match(sql,/Permanent receipt and transfer history cannot be changed or removed/);assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/updated_at is distinct from expected/);
console.log('PASS v1.29.0 accepted-choice handover, Project/SO/SKU allocation, deposit-gated draft POs, idempotency and database immutability guards');
