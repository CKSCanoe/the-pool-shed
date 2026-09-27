// Azzy Pool Shed workspace normalizer.
// Reads the canonical Pool Shed workspace snapshot and produces the compact model
// expected by Azzy's deterministic tools. It never mutates the source snapshot.

const arr=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[]);
const n=(...v)=>{for(const x of v){const q=Number(x);if(Number.isFinite(q))return q;}return 0;};
const txt=(...v)=>{for(const x of v)if(x!==undefined&&x!==null&&String(x).trim())return String(x).trim();return '';};
const keyBy=(rows,keyFn)=>Object.fromEntries(rows.map(x=>[keyFn(x),x]).filter(([k])=>k));
const idOf=x=>txt(x?.id,x?.reference,x?.number,x?.code);
const lineRows=x=>arr(x?.lines||x?.items||x?.orderLines||x?.products);
const dateOnly=v=>v?String(v).slice(0,10):null;
const bool=v=>v===true||v==='true'||v===1||v==='1';

function productRefs(data){
  const byId=new Map(),bySku=new Map();
  for(const p of arr(data.products)){
    const id=txt(p?.id),sku=txt(p?.sku,p?.poolSku,p?.productSku,p?.code,p?.productCode,id);
    if(id)byId.set(id,p);if(sku)bySku.set(sku,p);
  }
  return {byId,bySku};
}
function skuOf(x,refs){
  const direct=txt(x?.sku,x?.poolSku,x?.productSku,x?.productCode);
  if(direct)return direct;
  const productId=txt(x?.productId,x?.product_id);
  if(productId){const p=refs?.byId?.get(productId);return txt(p?.sku,p?.code,p?.id,productId);}
  const id=txt(x?.id);
  const p=id&&refs?.byId?.get(id);return txt(p?.sku,p?.code,id);
}
function productName(x,refs,sku){
  const productId=txt(x?.productId,x?.product_id),p=(productId&&refs?.byId?.get(productId))||refs?.bySku?.get(sku);
  return txt(x?.name,x?.description,x?.productName,p?.name,p?.title,sku);
}
function locationMap(data){return new Map(arr(data.locations).map(x=>[txt(x?.id),txt(x?.name,x?.code,x?.id)]).filter(([id])=>id));}
function supplierMaps(data){
  const byName=new Map(),byId=new Map();
  for(const raw of arr(data.suppliers)){
    const name=txt(raw?.name,raw?.company,raw?.supplierName),id=idOf(raw)||name;
    if(name)byName.set(name,{raw,id});if(id)byId.set(id,{raw,id});
  }
  return {byName,byId};
}
function supplierIdFor(value,maps){const v=txt(value);return maps.byId.get(v)?.id||maps.byName.get(v)?.id||v;}

function normaliseUsers(options={}){
  const users=arr(options.users||[]);return keyBy(users,u=>txt(u.id,u.user_id,u.userId));
}
function normaliseProducts(data,refs){
  const locations=locationMap(data),rules=arr(data.restockRules),stockAgg=new Map();
  for(const s of arr(data.stock)){
    const sku=skuOf(s,refs);if(!sku)continue;
    const row=stockAgg.get(sku)||{qty:0,allocated:0,onOrder:0,bestFree:-Infinity,bin:''};
    const qty=n(s.qty,s.onHand,s.quantity),allocated=n(s.allocated,s.reserved),free=qty-allocated;
    row.qty+=qty;row.allocated+=allocated;row.onOrder+=n(s.onOrder,s.incoming);
    if(free>row.bestFree){row.bestFree=free;row.bin=txt(s.bin,s.binCode,s.location,s.locationCode,locations.get(txt(s.locationId)),s.locationId);}
    stockAgg.set(sku,row);
  }
  const out={};
  for(const raw of arr(data.products)){
    const sku=skuOf(raw,refs);if(!sku)continue;const st=stockAgg.get(sku)||{};
    const matchingRules=rules.filter(r=>skuOf(r,refs)===sku),reorderFromRules=matchingRules.reduce((m,r)=>Math.max(m,n(r.min,r.reorderLevel)),0);
    out[sku]={
      sku,
      name:txt(raw.name,raw.title,raw.description,sku),
      supplierId:txt(raw.supplierId,raw.preferredSupplierId,raw.primarySupplierId,raw.supplier),
      supplierSku:txt(raw.supplierSku,raw.supplierSKU,raw.vendorSku),
      bin:txt(st.bin,raw.bin,raw.location,'No bin recorded'),
      onHand:n(st.qty,raw.onHand,raw.qty),
      allocated:n(st.allocated,raw.allocated),
      onOrder:n(st.onOrder,raw.onOrder,raw.incoming),
      reorderLevel:n(raw.reorderLevel,raw.reorderPoint,raw.minStock,raw.reorder,reorderFromRules),
      unitCost:n(raw.unitCost,raw.cost,raw.buyPrice,raw.netCost),
      equivalenceKey:txt(raw.equivalenceKey,raw.matchKey,raw.productFamilyKey)||null,
      category:txt(raw.category,raw.categoryName)||null,
      safetyDocIds:arr(raw.safetyDocIds||raw.safetyDocuments).map(x=>typeof x==='string'?x:idOf(x)).filter(Boolean)
    };
  }
  for(const [sku,st] of stockAgg){if(out[sku])continue;out[sku]={sku,name:productName({},refs,sku),supplierId:'',supplierSku:'',bin:txt(st.bin,'No bin recorded'),onHand:n(st.qty),allocated:n(st.allocated),onOrder:n(st.onOrder),reorderLevel:0,unitCost:0};}
  return out;
}
function normaliseSuppliers(data){return keyBy(arr(data.suppliers).map(s=>{const name=txt(s.name,s.company,s.supplierName,idOf(s)),id=idOf(s)||name;return {id,name,creditLimit:n(s.creditLimit,s.credit_limit),outstandingBalance:n(s.outstandingBalance,s.creditUsed,s.balance),performance:s.performance||null};}),x=>x.id);}
function normaliseCustomers(data){return keyBy(arr(data.customers).map(c=>({id:idOf(c),name:txt(c.name,c.company,c.fullName,idOf(c)),projectIds:arr(c.projectIds||c.jobIds).map(String),waitingOnUs:arr(c.waitingOnUs||c.actionsForUs).map(String),waitingOnCustomer:arr(c.waitingOnCustomer||c.actionsForCustomer).map(String)})),x=>x.id);}
function normaliseSalesOrders(data,refs){
  return keyBy(arr(data.salesOrders).map(o=>({id:idOf(o),projectId:txt(o.projectId,o.jobId),customerId:txt(o.customerId),status:txt(o.status,'Open'),totalNet:n(o.totalNet,o.netTotal,o.subtotal,o.total),lines:lineRows(o).map(l=>{const sku=skuOf(l,refs);return {sku,name:productName(l,refs,sku),qty:n(l.qty,l.quantity),allocatedQty:n(l.allocatedQty,l.allocated,l.reservedQty),unitPrice:n(l.unitPrice,l.sellPrice,l.price,l.rrp)};}).filter(l=>l.sku)})),x=>x.id);
}
function normalisePurchaseOrders(data,refs,supplierMapsValue){
  return keyBy(arr(data.purchaseOrders).map(o=>{const supplier=txt(o.supplier,o.supplierName,o.vendorName),supplierId=supplierIdFor(txt(o.supplierId,o.vendorId,supplier),supplierMapsValue);return {id:idOf(o),supplierId,supplier,projectId:txt(o.projectId,o.jobId),status:txt(o.status,'Draft'),orderedDate:dateOnly(txt(o.orderedDate,o.orderDate,o.createdAt,o.created)),expectedDate:dateOnly(txt(o.expectedDate,o.eta,o.confirmedEta,o.due,o.dueDate))||null,lines:lineRows(o).map(l=>{const sku=skuOf(l,refs);return {sku,name:productName(l,refs,sku),qty:n(l.qty,l.quantity),received:n(l.received,l.receivedQty,l.qtyReceived),unitCost:n(l.unitCost,l.cost,l.buyPrice,refs?.bySku?.get(sku)?.cost)};}).filter(l=>l.sku)};}),x=>x.id);
}
function applyIncomingStock(products,purchaseOrders){
  const incoming={};
  for(const po of Object.values(purchaseOrders)){
    if(/received|cancelled|canceled|closed/i.test(po.status))continue;
    for(const line of po.lines||[])incoming[line.sku]=(incoming[line.sku]||0)+Math.max(0,n(line.qty)-n(line.received));
  }
  for(const [sku,qty] of Object.entries(incoming))if(products[sku])products[sku].onOrder=Math.max(n(products[sku].onOrder),qty);
}
function normaliseProjects(data,salesOrders,purchaseOrders){
  const jobs=arr(data.jobs||data.projects);const out={};
  for(const j of jobs){const id=idOf(j);if(!id)continue;const p=j.project||{},soIds=Object.values(salesOrders).filter(x=>x.projectId===id).map(x=>x.id),poIds=Object.values(purchaseOrders).filter(x=>x.projectId===id).map(x=>x.id);out[id]={id,name:txt(j.name,j.title,j.projectName,j.reference,id),customerId:txt(j.customerId),status:txt(j.status,'Active'),stage:txt(j.stage,j.phase,p.stage,'Active'),progress:n(j.progress,j.percentComplete,j.completionPct,p.progress),dueDate:dateOnly(txt(j.dueDate,j.targetDate,j.nextKeyDate,p.targetCompletion))||null,targetMarginPct:n(j.targetMarginPct,j.targetMargin,j.marginTarget,p.targetMargin),quotedNet:n(j.quotedNet,j.quoteNet,j.sellValue,j.value,p.quoteNet),committedCost:n(j.committedCost,j.committed,p.committedCost),actualCost:n(j.actualCost,j.actual,p.actualCost),forecastCost:n(j.forecastCost,j.forecast,p.forecastCost),salesOrderIds:[...new Set([...arr(j.salesOrderIds).map(String),...soIds])],poIds:[...new Set([...arr(j.poIds||j.purchaseOrderIds).map(String),...poIds])],hireIds:arr(j.hireIds).map(String),extraIds:arr(j.extraIds).map(String),notes:arr(j.notes||p.notes).map(x=>typeof x==='string'?x:txt(x.text,x.body)).filter(Boolean),owner:txt(j.owner,j.ownerName,j.assignedTo,j.createdBy)};}
  return out;
}
function normaliseSupplierOffers(data,products,suppliers,refs,supplierMapsValue){
  const raw=arr(data.supplierProducts||data.supplierOffers||data.productSupplierPrices);const out={};
  for(const [idx,o] of raw.entries()){
    const id=idOf(o)||`OFFER-${idx+1}`,sku=skuOf(o,refs),p=products[sku]||{},supplier=txt(o.supplier,o.supplierName),supplierId=supplierIdFor(txt(o.supplierId,supplier),supplierMapsValue);
    out[id]={id,poolSku:sku||null,equivalenceKey:txt(o.equivalenceKey,p.equivalenceKey)||null,matchType:txt(o.matchType,'exact'),productFamily:txt(o.productFamily,p.category,p.name),productName:txt(o.productName,o.name,p.name,sku),searchText:txt(o.searchText,o.aliases,p.name,o.notes),supplierId,supplier:txt(supplier,suppliers[supplierId]?.name),supplierSku:txt(o.supplierSku,o.vendorSku),packLitres:n(o.packLitres,o.packSizeLitres)||null,concentrationPct:n(o.concentrationPct,o.strengthPct)||null,unitNet:n(o.unitNet,o.netPrice,o.cost),carriageNet:n(o.carriageNet,o.deliveryCost),freeCarriageThreshold:n(o.freeCarriageThreshold,supplierMapsValue.byId.get(supplierId)?.raw?.freeShippingThreshold)||null,minQty:n(o.minQty,o.minimumOrderQty)||1,leadTimeDays:n(o.leadTimeDays,o.leadTime,supplierMapsValue.byId.get(supplierId)?.raw?.leadTimeDays)||null,availability:o.available===false?'Unavailable':txt(o.availability,o.stockStatus,'Available'),lastUpdated:dateOnly(txt(o.lastUpdated,o.updatedAt,o.priceDate))||null,previousNet:n(o.previousNet)||null,previousDate:dateOnly(txt(o.previousDate))||null,approved:o.approved!==false&&o.available!==false};
  }
  return out;
}
function normaliseHires(data){return keyBy(arr(data.hires||data.projectHires||data.toolsOnHire||data.toolAssignments).map(h=>({id:idOf(h),projectId:txt(h.projectId,h.jobId),description:txt(h.description,h.name,h.toolName,h.reference,idOf(h)),supplier:txt(h.supplier,h.supplierName),dailyRate:n(h.dailyRate,h.dayRate),accruedDays:n(h.accruedDays,h.days),accruedCost:n(h.accruedCost,h.costToDate),purchaseEquivalent:n(h.purchaseEquivalent,h.purchasePrice),active:h.active!==false&&!/off.?hire|returned|closed|complete/i.test(txt(h.status))})),x=>x.id);}
function normaliseExtras(data){return keyBy(arr(data.extras||data.projectExtras).map(x=>({id:idOf(x),projectId:txt(x.projectId,x.jobId),description:txt(x.description,x.name,idOf(x)),cost:n(x.cost,x.costNet),sellPrice:n(x.sellPrice,x.price,x.sellNet),approved:bool(x.approved)||/approved/i.test(txt(x.status))})),x=>x.id);}
function financeRows(data,key){return [...arr(data[key]),...arr(data.financeCommand?.[key])];}
function normaliseBills(data,refs,supplierMapsValue){return keyBy(financeRows(data,'supplierBills').map(b=>{const supplier=txt(b.supplier,b.supplierName),supplierId=supplierIdFor(txt(b.supplierId,supplier),supplierMapsValue);return {id:idOf(b),supplierId,supplier,invoiceNumber:txt(b.invoiceNumber,b.billNumber,b.reference,b.xeroNumber,idOf(b)),projectId:txt(b.projectId,b.jobId),amountNet:n(b.amountNet,b.net,b.netTotal,b.amount),vat:n(b.vat,b.vatAmount),dueDate:dateOnly(txt(b.dueDate))||null,status:txt(b.status,'Unpaid'),linkedPoIds:arr(b.linkedPoIds||b.purchaseOrderIds||(b.poId?[b.poId]:[])).map(String),lines:lineRows(b).map(l=>{const sku=skuOf(l,refs);return {sku,qty:n(l.qty,l.quantity),unitCost:n(l.unitCost,l.cost)};}).filter(l=>l.sku)};}),x=>x.id);}
function normaliseInvoices(data){return keyBy(financeRows(data,'customerInvoices').map(i=>({id:idOf(i),projectId:txt(i.projectId,i.jobId),customerId:txt(i.customerId),amountNet:n(i.amountNet,i.net,i.netTotal,i.amount),dueDate:dateOnly(txt(i.dueDate))||null,status:txt(i.status,'Draft'),expectedPaymentDate:dateOnly(txt(i.expectedPaymentDate,i.expectedDate))||null})),x=>x.id);}
function normaliseReceipts(data,refs,supplierMapsValue){
  const rows=arr(data.goodsReceipts||data.receiptEvents);return keyBy(rows.map((r,idx)=>({id:idOf(r)||`RECEIPT-${idx+1}`,poId:txt(r.poId,r.purchaseOrderId),supplierId:supplierIdFor(txt(r.supplierId,r.supplier),supplierMapsValue),receivedAt:txt(r.receivedAt,r.createdAt,r.at,r.date),lines:lineRows(r).length?lineRows(r).map(l=>{const sku=skuOf(l,refs);return {sku,qty:n(l.qty,l.quantity,l.receivedQty),unitCost:n(l.unitCost,l.cost),qc:txt(l.qc,l.qcDecision,'Accepted')};}).filter(l=>l.sku):[{sku:skuOf(r,refs),qty:n(r.qty,r.quantity,r.receivedQty),unitCost:n(r.unitCost,r.cost),qc:txt(r.qc,r.qcDecision,'Accepted')}].filter(l=>l.sku)})),x=>x.id);
}
function normaliseSafety(data,refs){return keyBy(arr(data.safetyDocuments||data.productSafetyDocuments).map(d=>({id:idOf(d),sku:skuOf(d,refs),title:txt(d.title,d.name,idOf(d)),revisionDate:dateOnly(txt(d.revisionDate,d.updatedAt))||null,documentType:txt(d.documentType,d.type,'SDS'),status:txt(d.status,'Current'),controls:arr(d.controls).map(String),notes:txt(d.notes)})),x=>x.id);}
function normaliseKnowledge(data){return arr(data.knowledge||data.knowledgeLibrary||data.approvedKnowledge||data.assistantKnowledge).filter(k=>String(k?.status||'Approved')==='Approved').map((k,i)=>({id:idOf(k)||`KB-${i+1}`,title:txt(k.title,k.name,'Knowledge'),tags:arr(k.tags||k.keywords).map(String),text:txt(k.text,k.body,k.content)})).filter(k=>k.text);}
function normaliseEvents(data,refs){return arr(data.auditEvents||data.events||data.activity||data.auditLog||data.receiptEvents).map((e,i)=>({id:idOf(e)||`EVT-${i+1}`,at:txt(e.at,e.createdAt,e.timestamp,e.date,new Date().toISOString()),type:txt(e.type,e.eventType,e.action,'activity'),entityType:txt(e.entityType,e.recordType,e.module,e.type,'record'),entityId:txt(e.entityId,e.recordId,e.product,e.reference,e.id),projectId:txt(e.projectId,e.jobId)||null,sku:skuOf(e,refs)||null,summary:txt(e.summary,e.message,e.description,e.reason,e.action,e.type)}));}

export function normalisePoolShedWorkspace(data={},options={}){
  const refs=productRefs(data),supplierMapsValue=supplierMaps(data),products=normaliseProducts(data,refs),suppliers=normaliseSuppliers(data),customers=normaliseCustomers(data),salesOrders=normaliseSalesOrders(data,refs),purchaseOrders=normalisePurchaseOrders(data,refs,supplierMapsValue),projects=normaliseProjects(data,salesOrders,purchaseOrders);applyIncomingStock(products,purchaseOrders);
  for(const product of Object.values(products)){if(product.supplierId)product.supplierId=supplierIdFor(product.supplierId,supplierMapsValue);}
  return {
    meta:{mode:'pool-shed-live',revision:n(options.revision,data.revision)||1,updatedAt:txt(options.updatedAt,data.updatedAt,new Date().toISOString()),today:dateOnly(options.today||new Date().toISOString())},
    users:normaliseUsers(options),projects,purchaseOrders,products,salesOrders,
    hires:normaliseHires(data),extras:normaliseExtras(data),customers,suppliers,
    supplierBills:normaliseBills(data,refs,supplierMapsValue),customerInvoices:normaliseInvoices(data),
    supplierOffers:normaliseSupplierOffers(data,products,suppliers,refs,supplierMapsValue),goodsReceipts:normaliseReceipts(data,refs,supplierMapsValue),
    safetyDocuments:normaliseSafety(data,refs),stockCounts:arr(data.stockCounts||data.stockTakes),
    knowledge:normaliseKnowledge(data),events:normaliseEvents(data,refs)
  };
}
