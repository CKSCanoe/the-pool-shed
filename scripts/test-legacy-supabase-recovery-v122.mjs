import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

assert(fs.existsSync('public/legacy-recovery-engine.js'),'legacy recovery engine must exist');
const ctx={console,globalThis:null,window:null,Date,Math,Set,Map,Intl};
ctx.globalThis=ctx;ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/legacy-recovery-engine.js','utf8'),ctx);
const r=ctx.PoolShedLegacyRecovery;
assert(r,'PoolShedLegacyRecovery API missing');

const bundle={
 suppliers:[{id:'s1',code:'CERT',name:'Certikin Ltd',contact:'Rob',email:'sales@example.com',phone:'01234',address:'Supplier House',account_number:'ACC-1',payment_terms_days:30,credit_limit:5000,vat_number:'GB123',active:true,created_at:'2025-12-01T10:00:00Z'}],
 products:[{id:'p1',sku:'PB-001',supplier_sku:'SUP-001',name:'Legacy Pump',category:'Pumps',supplier_name:'Certikin',barcode:'123',unit:'each',track_batch:true,track_serial:false,warranty_period:'2 years',internal_notes:'legacy note',reorder_level:2,cost_price:100,rrp_price:220,trade_price:180,wholesale_price:160,created_at:'2026-01-01T10:00:00Z'}],
 customers:[{id:'c1',name:'Old Customer',email:'old@example.com',phone:'01234',price_list:'trade',created_at:'2026-01-02T10:00:00Z'}],
 customer_addresses:[{id:'a1',customer_id:'c1',address_type:'primary',address_line_1:'1 High Street',address_line_2:'',town_city:'Hereford',county:'Herefordshire',postcode:'HR1 1AA',country:'United Kingdom'}],
 locations:[{id:'l1',name:'Legacy Warehouse',location_type:'warehouse',owner_name:'Warehouse',barcode:'LOC1',active:true}],
 projects:[{id:'j1',customer_id:'c1',name:'Pool Refurb',status:'open',site_location_id:'l1',created_at:'2026-01-03T10:00:00Z'}],
 purchase_orders:[{id:'po1',po_number:'PO-001',supplier_name:'Certikin',project_id:'j1',status:'part_received',due_date:'2026-02-01',created_at:'2026-01-04T10:00:00Z'}],
 purchase_order_items:[{id:'pol1',purchase_order_id:'po1',product_id:'p1',qty_ordered:5,qty_received:2,unit_cost:95}],
 sales_orders:[{id:'so1',sales_order_number:'SO-001',customer_id:'c1',project_id:'j1',price_list:'trade',channel:'Manual',ship_to:'Site',carrier:'Pool Bros Van',ship_from_location_id:'l1',due_date:'2026-02-02',status:'ready_to_pick',created_at:'2026-01-05T10:00:00Z'}],
 sales_order_items:[{id:'sol1',sales_order_id:'so1',product_id:'p1',qty_required:2,qty_picked:1,qty_packed:0,unit_sell_price:180,special_price:false,price_note:''}],
 goods_out_notes:[{id:'gn1',goods_note_number:'GN-001',sales_order_id:'so1',template_name:'packing_note',printed_at:'2026-01-06T10:00:00Z',picked_at:null,packed_at:null,shipped_at:null,priority:false,shipping_method:'Van',courier_name:'',tracking_reference:'',boxes:1,weight_text:'',stock_deducted:false,created_at:'2026-01-06T10:00:00Z'}],
 goods_out_note_items:[{id:'gni1',goods_out_note_id:'gn1',sales_order_item_id:'sol1',product_id:'p1',qty_required:2,qty_picked:1,qty_packed:0,qty_shipped:0}],
 notification_events:[{id:'n1',goods_out_note_id:'gn1',sales_order_id:'so1',customer_id:'c1',trigger_name:'Pick',channel:'email',subject:'Picked',status:'sent',payload:{ok:true},created_at:'2026-01-06T11:00:00Z'}],
 stock_balances:[{product_id:'p1',location_id:'l1',qty_on_hand:7,qty_allocated:2}],
 location_restock_rules:[{id:'rr1',product_id:'p1',location_id:'l1',minimum_qty:2,maximum_qty:10,restock_to_qty:8,priority:'critical',active:true,created_at:'2026-01-01T10:00:00Z'}],
 stock_allocations:[{id:'al1',sales_order_id:'so1',project_id:'j1',product_id:'p1',from_location_id:'l1',qty:2,status:'allocated',created_at:'2026-01-05T11:00:00Z'}],
 stock_movements:[{id:'m1',product_id:'p1',qty:5,movement_type:'goods_in',from_location_id:null,to_location_id:'l1',customer_id:null,project_id:'j1',purchase_order_id:'po1',sales_order_id:null,reference:'PO-001',created_by:'Aaron',created_at:'2026-01-04T12:00:00Z'}],
 supplier_bills:[{id:'bill1',supplier_name:'Certikin',bill_number:'B001',bill_date:'2026-01-07',due_date:'2026-02-07',po_ref:'PO-001',net:100,vat:20,gross:120,paid:0,status:'Open',created_at:'2026-01-07T10:00:00Z'}],
 product_import_batches:[{id:'ib1',source_filename:'certikin.csv',rows_total:100,rows_created:100,rows_updated:0,rows_skipped:0,warning_count:0,import_status:'completed',created_at:'2026-01-01T09:00:00Z'}]
};

const snap=r.fromSupabaseTables(bundle);
assert.equal(snap.products.length,1); assert.equal(snap.products[0].supplierSku,'SUP-001'); assert.equal(snap.products[0].cost,100);
assert.equal(snap.customers.length,1); assert.equal(snap.customers[0].addresses.primary.postcode,'HR1 1AA');
assert.equal(snap.jobs.length,1); assert.equal(snap.jobs[0].customerId,'c1'); assert.equal(snap.jobs[0].locationId,'l1');
assert.equal(snap.purchaseOrders.length,1); assert.equal(snap.purchaseOrders[0].lines[0].received,2);
assert.equal(snap.salesOrders.length,1); assert.equal(snap.salesOrders[0].lines[0].qty,2); assert.equal(snap.salesOrders[0].orderNumber,'SO-001');
assert.equal(snap.goodsNotes.length,1); assert.equal(snap.goodsNotes[0].lines[0].picked,1);
assert.equal(snap.stock.length,1); assert.equal(snap.stock[0].qty,7); assert.equal(snap.stock[0].allocated,2);
assert.equal(snap.restockRules.length,1); assert.equal(snap.restockRules[0].restockTo,8);
assert.equal(snap.allocations.length,1); assert.equal(snap.movements.length,1);
assert.equal(snap.notifications.length,1);
assert(snap.suppliers.some(s=>s.name==='Certikin'),'supplier must be reconstructed from product/PO/bill evidence');
assert(snap.suppliers.some(s=>s.id==='s1'&&s.name==='Certikin Ltd'&&s.email==='sales@example.com'),'direct normalized supplier records must preserve supplier identity and contact data');
assert.equal(snap.supplierBills.length,1,'legacy supplier bills should be preserved');
assert.equal(snap.productImportBatches.length,1,'legacy import audit history should be preserved');
assert(r.businessCount(snap)>=8,'reconstructed source must be scored as meaningful business data');
assert.equal(r.isCanonicalEmpty({products:[],customers:[],jobs:[],salesOrders:[],purchaseOrders:[],stock:[],suppliers:[],locations:[{id:'seed'}]}),true,'seed-only workspace should be considered empty');
assert.equal(r.isCanonicalEmpty({products:[{id:'p'}],customers:[],jobs:[],salesOrders:[],purchaseOrders:[],stock:[]}),false,'workspace with real business data must not be considered empty');
assert.equal(r.shouldAutoRecover({current:{products:[],customers:[],jobs:[],salesOrders:[],purchaseOrders:[],stock:[]},source:snap,history:[]}),true,'empty canonical workspace with meaningful legacy data should auto recover');
assert.equal(r.shouldAutoRecover({current:{products:[{id:'current'}]},source:snap,history:[]}),false,'populated canonical workspace must never be auto-overwritten');
assert.equal(r.shouldAutoRecover({current:{products:[],customers:[],jobs:[],salesOrders:[],purchaseOrders:[],stock:[]},source:snap,history:[{version:'1.22.0'}]}),false,'already migrated workspace must not auto recover twice');
console.log('PASS v1.22 normalized Supabase recovery mapping and safe auto-recovery rules');
