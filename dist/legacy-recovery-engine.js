(function(global){
'use strict';
const VERSION='1.22.0';
function arr(v){return Array.isArray(v)?v:[];}
function clone(v){try{return JSON.parse(JSON.stringify(v));}catch(_){return v;}}
function text(v){return String(v==null?'':v).trim();}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function yes(v){return v===true||v===1||v==='1'||String(v).toLowerCase()==='true';}
function title(v){return text(v).split('_').filter(Boolean).map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' ');}
function locationType(v){const map={warehouse:'Warehouse',shelf:'Warehouse Bin',engineer_van:'Engineer Van',job_bin:'Job Bin',customer_site:'Customer Site'};return map[text(v).toLowerCase()]||title(v)||'Recovered Location';}
function poStatus(v){const map={draft:'Draft',sent:'Ordered',part_received:'Part Received',received:'Received',cancelled:'Cancelled'};return map[text(v).toLowerCase()]||title(v)||'Draft';}
function soStatus(v){const map={draft:'New Order',pending_parts:'Pending Parts',allocated:'Ready To Pick',ready_to_pick:'Ready To Pick',picking:'Picking',packed:'Ready To Ship',shipped:'Shipped',completed:'Completed',cancelled:'Cancelled'};return map[text(v).toLowerCase()]||title(v)||'New Order';}
function projectStatus(v){const map={open:'In Progress',active:'In Progress',planning:'Planning',approved:'Approved',procurement:'Procurement',complete:'Completed',completed:'Completed',closed:'Completed',cancelled:'Completed'};return map[text(v).toLowerCase()]||title(v)||'Planning';}
function movementType(v){const map={goods_in:'Goods In',goods_out:'Goods Out',transfer:'Transfer',allocation:'Allocation',unallocation:'Unallocation',engineer_sale:'Engineer Sale',used_on_job:'Project Use',return:'Return',adjustment:'Adjustment'};return map[text(v).toLowerCase()]||title(v)||'Adjustment';}
function address(row,phone){return {line1:text(row&&row.address_line_1),line2:text(row&&row.address_line_2),city:text(row&&row.town_city),county:text(row&&row.county),postcode:text(row&&row.postcode),country:text(row&&row.country)||'United Kingdom',phone:text(phone)};}
function byParent(rows,key){const out=new Map();arr(rows).forEach(row=>{const id=row&&row[key];if(id==null)return;const k=String(id);if(!out.has(k))out.set(k,[]);out.get(k).push(row);});return out;}
function supplierId(name){return 'LEGACY-SUP-'+text(name).toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48);}
function latestTimestamp(bundle){let latest='';Object.values(bundle||{}).forEach(rows=>arr(rows).forEach(row=>{for(const k of ['updated_at','created_at','completed_at','shipped_at','packed_at','picked_at','printed_at']){const v=text(row&&row[k]);if(v&&v>latest)latest=v;}}));return latest;}

function fromSupabaseTables(bundle){
  bundle=bundle||{};
  const addresses=byParent(bundle.customer_addresses,'customer_id');
  const poItems=byParent(bundle.purchase_order_items,'purchase_order_id');
  const soItems=byParent(bundle.sales_order_items,'sales_order_id');
  const gnItems=byParent(bundle.goods_out_note_items,'goods_out_note_id');

  const products=arr(bundle.products).map(p=>({
    id:String(p.id),sku:text(p.sku)||String(p.id),supplierSku:text(p.supplier_sku),name:text(p.name)||'Recovered product',category:text(p.category)||'Uncategorised',supplier:text(p.supplier_name)||'Not assigned',barcode:text(p.barcode),unit:text(p.unit)||'Each',trackBatch:yes(p.track_batch),trackSerial:yes(p.track_serial),warranty:text(p.warranty_period),notes:text(p.internal_notes),reorder:num(p.reorder_level),cost:num(p.cost_price),rrp:num(p.rrp_price),trade:num(p.trade_price),wholesale:num(p.wholesale_price),createdAt:text(p.created_at),source:'Legacy Supabase'
  }));

  const customers=arr(bundle.customers).map(c=>{
    const rows=addresses.get(String(c.id))||[];
    function pick(type){return rows.find(x=>text(x.address_type).toLowerCase()===type)||rows.find(x=>yes(x.is_default))||rows[0]||{};}
    const primary=address(pick('primary'),c.phone),billing=address(pick('billing'),c.phone),delivery=address(pick('delivery'),c.phone);
    return {id:String(c.id),code:String(c.id),name:text(c.name)||'Recovered customer',companyName:text(c.name)||'Recovered customer',email:text(c.email),phone:text(c.phone),mobile:'',priceList:text(c.price_list)||'rrp',status:'Active',tags:['Recovered legacy record'],addresses:{primary,billing,delivery},customFields:{},createdAt:text(c.created_at),source:'Legacy Supabase'};
  });

  const locations=arr(bundle.locations).map(l=>({id:String(l.id),name:text(l.name)||String(l.id),type:locationType(l.location_type),owner:text(l.owner_name),barcode:text(l.barcode),active:l.active!==false,createdAt:text(l.created_at),source:'Legacy Supabase'}));
  const jobs=arr(bundle.projects).map(j=>({id:String(j.id),customerId:j.customer_id?String(j.customer_id):'',name:text(j.name)||'Recovered project',status:projectStatus(j.status),locationId:j.site_location_id?String(j.site_location_id):'',createdAt:text(j.created_at),source:'Legacy Supabase'}));

  const purchaseOrders=arr(bundle.purchase_orders).map(po=>({
    id:String(po.id),poNumber:text(po.po_number),supplier:text(po.supplier_name),supplierName:text(po.supplier_name),jobId:po.project_id?String(po.project_id):'',status:poStatus(po.status),due:text(po.due_date),created:text(po.created_at),createdAt:text(po.created_at),source:'Legacy Supabase',lines:(poItems.get(String(po.id))||[]).map(line=>({id:String(line.id),productId:String(line.product_id),qty:num(line.qty_ordered),received:num(line.qty_received),unitCost:num(line.unit_cost),jobId:po.project_id?String(po.project_id):''}))
  }));

  const salesOrders=arr(bundle.sales_orders).map(so=>({
    id:String(so.id),orderNumber:text(so.sales_order_number),customerId:so.customer_id?String(so.customer_id):'',jobId:so.project_id?String(so.project_id):'',priceList:text(so.price_list)||'rrp',priceOverrideReason:text(so.price_override_reason),channel:text(so.channel)||'Legacy',source:'Legacy Supabase',shipTo:text(so.ship_to),shippingMethod:text(so.carrier),shipFromLocationId:so.ship_from_location_id?String(so.ship_from_location_id):'',due:text(so.due_date),status:soStatus(so.status),created:text(so.created_at),createdAt:text(so.created_at),lines:(soItems.get(String(so.id))||[]).map(line=>({id:String(line.id),productId:String(line.product_id),qty:num(line.qty_required),allocated:0,picked:num(line.qty_picked),packed:num(line.qty_packed),price:num(line.unit_sell_price),unitPrice:num(line.unit_sell_price),specialPrice:yes(line.special_price),priceNote:text(line.price_note)}))
  }));

  const goodsNotes=arr(bundle.goods_out_notes).map(note=>({
    id:String(note.id),goodsNoteNumber:text(note.goods_note_number),salesOrderId:note.sales_order_id?String(note.sales_order_id):'',template:text(note.template_name)||'packing_note',printed:!!note.printed_at,picked:!!note.picked_at,packed:!!note.packed_at,shipped:!!note.shipped_at,printedAt:text(note.printed_at),pickedAt:text(note.picked_at),packedAt:text(note.packed_at),shippedAt:text(note.shipped_at),priority:yes(note.priority),shippingMethod:text(note.shipping_method),courier:text(note.courier_name),trackingRef:text(note.tracking_reference),boxes:Math.max(1,num(note.boxes)||1),weight:text(note.weight_text),stockDeducted:yes(note.stock_deducted),createdAt:text(note.created_at),source:'Legacy Supabase',lines:(gnItems.get(String(note.id))||[]).map(line=>({id:String(line.id),salesOrderLineId:line.sales_order_item_id?String(line.sales_order_item_id):'',productId:String(line.product_id),qty:num(line.qty_required),picked:num(line.qty_picked),packed:num(line.qty_packed),shipped:num(line.qty_shipped)}))
  }));

  const notifications=arr(bundle.notification_events).map(n=>({id:String(n.id),goodsNoteId:n.goods_out_note_id?String(n.goods_out_note_id):'',salesOrderId:n.sales_order_id?String(n.sales_order_id):'',customerId:n.customer_id?String(n.customer_id):'',trigger:text(n.trigger_name),channel:text(n.channel)||'email',subject:text(n.subject),status:text(n.status),payload:clone(n.payload||{}),createdAt:text(n.created_at),source:'Legacy Supabase'}));
  const stock=arr(bundle.stock_balances).map(s=>({productId:String(s.product_id),locationId:String(s.location_id),qty:num(s.qty_on_hand),allocated:num(s.qty_allocated)}));
  const restockRules=arr(bundle.location_restock_rules).filter(x=>x.active!==false).map(r=>({id:String(r.id),productId:String(r.product_id),locationId:String(r.location_id),min:num(r.minimum_qty),max:num(r.maximum_qty),restockTo:num(r.restock_to_qty),priority:title(r.priority)||'Normal',active:r.active!==false,createdAt:text(r.created_at)}));
  const allocations=arr(bundle.stock_allocations).map(a=>({id:String(a.id),salesOrderId:a.sales_order_id?String(a.sales_order_id):'',jobId:a.project_id?String(a.project_id):'',productId:String(a.product_id),fromLocationId:String(a.from_location_id),qty:num(a.qty),status:title(a.status)||'Allocated',createdAt:text(a.created_at)}));
  const movements=arr(bundle.stock_movements).map(m=>({id:String(m.id),productId:String(m.product_id),qty:num(m.qty),type:movementType(m.movement_type),fromLocationId:m.from_location_id?String(m.from_location_id):'',toLocationId:m.to_location_id?String(m.to_location_id):'',customerId:m.customer_id?String(m.customer_id):'',jobId:m.project_id?String(m.project_id):'',purchaseOrderId:m.purchase_order_id?String(m.purchase_order_id):'',salesOrderId:m.sales_order_id?String(m.sales_order_id):'',ref:text(m.reference),user:text(m.created_by),createdAt:text(m.created_at)}));
  const supplierBills=arr(bundle.supplier_bills).map(b=>({id:String(b.id),supplierId:text(b.supplier_id),supplier:text(b.supplier_name),supplierName:text(b.supplier_name),billNumber:text(b.bill_number),billDate:text(b.bill_date),dueDate:text(b.due_date),poRef:text(b.po_ref),net:num(b.net),vat:num(b.vat),gross:num(b.gross),paid:num(b.paid),status:text(b.status),xeroBillId:text(b.xero_bill_id),xeroSyncStatus:text(b.xero_sync_status),createdAt:text(b.created_at),updatedAt:text(b.updated_at),source:'Legacy Supabase'}));
  const productImportBatches=arr(bundle.product_import_batches).map(x=>({id:String(x.id),sourceFilename:text(x.source_filename),rowsTotal:num(x.rows_total),rowsCreated:num(x.rows_created),rowsUpdated:num(x.rows_updated),rowsSkipped:num(x.rows_skipped),warningCount:num(x.warning_count),status:text(x.import_status),offlineDeviceId:text(x.offline_device_id),payload:clone(x.import_payload||{}),createdAt:text(x.created_at),completedAt:text(x.completed_at),source:'Legacy Supabase'}));

  const suppliers=arr(bundle.suppliers).map(s=>({
    id:String(s.id||supplierId(s.name||s.code||'supplier')),code:text(s.code)||text(s.supplier_code),name:text(s.name)||text(s.supplier_name)||'Recovered supplier',status:s.active===false?'Inactive':(text(s.status)||'Active'),contact:text(s.contact)||text(s.contact_name),email:text(s.email),phone:text(s.phone),ordersEmail:text(s.orders_email)||text(s.ordersEmail)||text(s.email),accountsEmail:text(s.accounts_email)||text(s.accountsEmail),returnsEmail:text(s.returns_email)||text(s.returnsEmail),hqAddress:text(s.hq_address)||text(s.address),shippingAddress:text(s.shipping_address),accountNumber:text(s.account_number)||text(s.accountNumber),terms:text(s.terms)||(num(s.payment_terms_days)?'Net '+num(s.payment_terms_days):''),creditLimit:num(s.credit_limit!=null?s.credit_limit:s.creditLimit),minimumOrder:num(s.minimum_order),freeShippingThreshold:num(s.free_shipping_threshold),shippingMethod:text(s.shipping_method),shippingCost:num(s.shipping_cost),orderCutoff:text(s.order_cutoff),leadTimeDays:num(s.lead_time_days),website:text(s.website),preferred:yes(s.preferred),rating:num(s.rating),notes:text(s.notes),vatNumber:text(s.vat_number)||text(s.vatNumber),currency:text(s.currency)||'GBP',xeroContactId:text(s.xero_contact_id)||text(s.xeroContactId),createdAt:text(s.created_at),source:'Legacy Supabase'
  }));
  const seen=new Set(suppliers.map(s=>text(s.name).toLowerCase()).filter(Boolean));
  function addSupplier(name){name=text(name);const k=name.toLowerCase();if(!name||k==='not assigned'||seen.has(k))return;seen.add(k);suppliers.push({id:supplierId(name),name,status:'Active',source:'Legacy Supabase'});}
  products.forEach(p=>addSupplier(p.supplier));purchaseOrders.forEach(po=>addSupplier(po.supplier));supplierBills.forEach(b=>addSupplier(b.supplier));

  return {suppliers,products,customers,locations,jobs,purchaseOrders,salesOrders,goodsNotes,notifications,stock,restockRules,allocations,movements,supplierBills,productImportBatches,sales:[],recoveryMeta:{version:VERSION,source:'normalized-supabase',updatedAt:latestTimestamp(bundle)}};
}

const BUSINESS_KEYS=['suppliers','products','customers','jobs','salesOrders','purchaseOrders','stock','allocations','movements','goodsNotes','engineerRequests','salesCredits','sales','supplierBills','productImportBatches'];
function businessCount(snapshot){return BUSINESS_KEYS.reduce((n,k)=>n+arr(snapshot&&snapshot[k]).length,0);}
function isCanonicalEmpty(current){return ['suppliers','products','customers','jobs','salesOrders','purchaseOrders','stock','allocations','movements','goodsNotes','engineerRequests','salesCredits','sales'].every(k=>arr(current&&current[k]).length===0);}
function shouldAutoRecover(input){input=input||{};const history=arr(input.history||(input.current&&input.current.legacyMigrationHistory));return isCanonicalEmpty(input.current)&&businessCount(input.source)>0&&history.length===0;}
function bestSource(sources){return arr(sources).filter(s=>s&&s.data&&businessCount(s.data)>0).sort((a,b)=>{const diff=businessCount(b.data)-businessCount(a.data);if(diff)return diff;return text(b.updatedAt).localeCompare(text(a.updatedAt));})[0]||null;}
async function autoRecover(){
  const current=typeof global.__POOL_SHED_GET_DATA__==='function'?global.__POOL_SHED_GET_DATA__():null;
  if(!current||typeof current!=='object')return {ok:false,reason:'canonical-unavailable'};
  if(typeof global.__POOL_SHED_IS_ADMIN__==='function'&&!global.__POOL_SHED_IS_ADMIN__())return {ok:false,reason:'admin-required'};
  if(!isCanonicalEmpty(current))return {ok:false,reason:'canonical-has-data'};
  if(arr(current.legacyMigrationHistory).length)return {ok:false,reason:'migration-already-recorded'};
  const migration=global.PoolShedLegacyMigration;
  if(!migration||typeof migration.discover!=='function'||typeof migration.apply!=='function')return {ok:false,reason:'migration-engine-unavailable'};
  const source=bestSource(await migration.discover());
  if(!source)return {ok:false,reason:'no-legacy-data'};
  if(!shouldAutoRecover({current,source:source.data,history:current.legacyMigrationHistory}))return {ok:false,reason:'safety-gate'};
  const result=migration.apply(source.data,{source:'Automatic recovery · '+(source.label||source.source||'legacy data')});
  return Object.assign({sourceId:source.id||'',sourceLabel:source.label||'',recoveredCount:businessCount(source.data)},result||{});
}

global.PoolShedLegacyRecovery={version:VERSION,fromSupabaseTables,businessCount,isCanonicalEmpty,shouldAutoRecover,bestSource};
global.PoolShedLegacyAutoRecovery=autoRecover;
})(typeof globalThis!=='undefined'?globalThis:window);
