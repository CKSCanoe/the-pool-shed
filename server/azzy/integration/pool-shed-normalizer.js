// Azzy Pool Shed workspace normalizer.
// Reads the canonical Pool Shed workspace snapshot and produces the compact model
// expected by Azzy's deterministic tools. It never mutates the source snapshot.

const arr=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[]);
const n=(...v)=>{for(const x of v){const q=Number(x);if(Number.isFinite(q))return q;}return 0;};
const txt=(...v)=>{for(const x of v)if(x!==undefined&&x!==null&&String(x).trim())return String(x).trim();return '';};
const keyBy=(rows,keyFn)=>Object.fromEntries(rows.map(x=>[keyFn(x),x]).filter(([k])=>k));
const skuOf=x=>txt(x?.sku,x?.poolSku,x?.productSku,x?.code,x?.productCode,x?.id);
const idOf=x=>txt(x?.id,x?.reference,x?.number,x?.code);
const lineRows=x=>arr(x?.lines||x?.items||x?.orderLines||x?.products);
const dateOnly=v=>v?String(v).slice(0,10):null;
const bool=v=>v===true||v==='true'||v===1||v==='1';

function normaliseUsers(options={}){
  const users=arr(options.users||[]);return keyBy(users,u=>txt(u.id,u.user_id,u.userId));
}
function normaliseProducts(data){
  const stockRows=arr(data.stock),stockBySku=new Map();
  for(const s of stockRows){const sku=skuOf(s);if(sku)stockBySku.set(sku,s);}
  const out={};
  for(const raw of arr(data.products)){
    const sku=skuOf(raw);if(!sku)continue;const st=stockBySku.get(sku)||{};
    out[sku]={
      sku,
      name:txt(raw.name,raw.title,raw.description,sku),
      supplierId:txt(raw.supplierId,raw.preferredSupplierId,raw.primarySupplierId),
      supplierSku:txt(raw.supplierSku,raw.supplierSKU,raw.vendorSku),
      bin:txt(st.bin,st.binCode,st.location,st.locationCode,raw.bin,raw.location,'No bin recorded'),
      onHand:n(st.qty,st.onHand,st.quantity,raw.onHand,raw.qty),
      allocated:n(st.allocated,st.reserved,raw.allocated),
      onOrder:n(st.onOrder,raw.onOrder,raw.incoming),
      reorderLevel:n(raw.reorderLevel,raw.reorderPoint,raw.minStock,st.reorderLevel),
      unitCost:n(raw.unitCost,raw.cost,raw.buyPrice,raw.netCost),
      equivalenceKey:txt(raw.equivalenceKey,raw.matchKey,raw.productFamilyKey)||null,
      category:txt(raw.category,raw.categoryName)||null,
      safetyDocIds:arr(raw.safetyDocIds||raw.safetyDocuments).map(x=>typeof x==='string'?x:idOf(x)).filter(Boolean)
    };
  }
  // Keep stock-only rows discoverable even if a legacy product record is absent.
  for(const st of stockRows){const sku=skuOf(st);if(!sku||out[sku])continue;out[sku]={sku,name:txt(st.name,st.productName,sku),supplierId:'',supplierSku:'',bin:txt(st.bin,st.location,'No bin recorded'),onHand:n(st.qty,st.onHand),allocated:n(st.allocated,st.reserved),onOrder:n(st.onOrder),reorderLevel:n(st.reorderLevel),unitCost:n(st.unitCost)};}
  return out;
}
function normaliseSuppliers(data){return keyBy(arr(data.suppliers).map(s=>({id:idOf(s),name:txt(s.name,s.company,s.supplierName,idOf(s)),creditLimit:n(s.creditLimit,s.credit_limit),outstandingBalance:n(s.outstandingBalance,s.balance),performance:s.performance||null})),x=>x.id);}
function normaliseCustomers(data){return keyBy(arr(data.customers).map(c=>({id:idOf(c),name:txt(c.name,c.company,c.fullName,idOf(c)),projectIds:arr(c.projectIds||c.jobIds).map(String),waitingOnUs:arr(c.waitingOnUs||c.actionsForUs).map(String),waitingOnCustomer:arr(c.waitingOnCustomer||c.actionsForCustomer).map(String)})),x=>x.id);}
function normaliseSalesOrders(data){
  return keyBy(arr(data.salesOrders).map(o=>({id:idOf(o),projectId:txt(o.projectId,o.jobId),customerId:txt(o.customerId),status:txt(o.status,'Open'),totalNet:n(o.totalNet,o.netTotal,o.subtotal),lines:lineRows(o).map(l=>({sku:skuOf(l),name:txt(l.name,l.description,l.productName,skuOf(l)),qty:n(l.qty,l.quantity),allocatedQty:n(l.allocatedQty,l.allocated,l.reservedQty),unitPrice:n(l.unitPrice,l.sellPrice,l.price)})).filter(l=>l.sku)})),x=>x.id);
}
function normalisePurchaseOrders(data){
  return keyBy(arr(data.purchaseOrders).map(o=>({id:idOf(o),supplierId:txt(o.supplierId,o.vendorId),supplier:txt(o.supplier,o.supplierName,o.vendorName),projectId:txt(o.projectId,o.jobId),status:txt(o.status,'Draft'),orderedDate:dateOnly(txt(o.orderedDate,o.orderDate,o.createdAt)),expectedDate:dateOnly(txt(o.expectedDate,o.eta,o.confirmedEta))||null,lines:lineRows(o).map(l=>({sku:skuOf(l),name:txt(l.name,l.description,l.productName,skuOf(l)),qty:n(l.qty,l.quantity),received:n(l.received,l.receivedQty,l.qtyReceived),unitCost:n(l.unitCost,l.cost,l.buyPrice)})).filter(l=>l.sku)})),x=>x.id);
}
function normaliseProjects(data,salesOrders,purchaseOrders){
  const jobs=arr(data.jobs||data.projects);const out={};
  for(const j of jobs){const id=idOf(j);if(!id)continue;const soIds=Object.values(salesOrders).filter(x=>x.projectId===id).map(x=>x.id),poIds=Object.values(purchaseOrders).filter(x=>x.projectId===id).map(x=>x.id);out[id]={id,name:txt(j.name,j.title,j.projectName,j.reference,id),customerId:txt(j.customerId),status:txt(j.status,'Active'),stage:txt(j.stage,j.phase,'Active'),progress:n(j.progress,j.percentComplete,j.completionPct),dueDate:dateOnly(txt(j.dueDate,j.targetDate,j.nextKeyDate))||null,targetMarginPct:n(j.targetMarginPct,j.targetMargin,j.marginTarget),quotedNet:n(j.quotedNet,j.quoteNet,j.sellValue,j.value),committedCost:n(j.committedCost,j.committed),actualCost:n(j.actualCost,j.actual),forecastCost:n(j.forecastCost,j.forecast),salesOrderIds:[...new Set([...arr(j.salesOrderIds).map(String),...soIds])],poIds:[...new Set([...arr(j.poIds||j.purchaseOrderIds).map(String),...poIds])],hireIds:arr(j.hireIds).map(String),extraIds:arr(j.extraIds).map(String),notes:arr(j.notes).map(x=>typeof x==='string'?x:txt(x.text,x.body)).filter(Boolean),owner:txt(j.owner,j.ownerName,j.assignedTo)};}
  return out;
}
function normaliseSupplierOffers(data,products,suppliers){
  const raw=arr(data.supplierProducts||data.supplierOffers||data.productSupplierPrices);const out={};
  for(const o of raw){const id=idOf(o)||`OFFER-${raw.indexOf(o)+1}`,sku=txt(o.poolSku,o.sku,o.productSku),p=products[sku]||{};out[id]={id,poolSku:sku||null,equivalenceKey:txt(o.equivalenceKey,p.equivalenceKey)||null,matchType:txt(o.matchType,'exact'),productFamily:txt(o.productFamily,p.category,p.name),productName:txt(o.productName,o.name,p.name,sku),searchText:txt(o.searchText,o.aliases,p.name),supplierId:txt(o.supplierId),supplier:txt(o.supplier,o.supplierName,suppliers[txt(o.supplierId)]?.name),supplierSku:txt(o.supplierSku,o.vendorSku),packLitres:n(o.packLitres,o.packSizeLitres)||null,concentrationPct:n(o.concentrationPct,o.strengthPct)||null,unitNet:n(o.unitNet,o.netPrice,o.cost),carriageNet:n(o.carriageNet,o.deliveryCost),freeCarriageThreshold:n(o.freeCarriageThreshold)||null,minQty:n(o.minQty,o.minimumOrderQty)||1,leadTimeDays:n(o.leadTimeDays,o.leadTime)||null,availability:txt(o.availability,o.stockStatus,'Unknown'),lastUpdated:dateOnly(txt(o.lastUpdated,o.updatedAt,o.priceDate))||null,previousNet:n(o.previousNet)||null,previousDate:dateOnly(txt(o.previousDate))||null,approved:o.approved!==false};}
  return out;
}
function normaliseHires(data){return keyBy(arr(data.hires||data.projectHires||data.toolsOnHire).map(h=>({id:idOf(h),projectId:txt(h.projectId,h.jobId),description:txt(h.description,h.name,idOf(h)),supplier:txt(h.supplier,h.supplierName),dailyRate:n(h.dailyRate,h.dayRate),accruedDays:n(h.accruedDays,h.days),accruedCost:n(h.accruedCost,h.costToDate),purchaseEquivalent:n(h.purchaseEquivalent,h.purchasePrice),active:h.active!==false&&!/off.?hire|returned|closed/i.test(txt(h.status))})),x=>x.id);}
function normaliseExtras(data){return keyBy(arr(data.extras||data.projectExtras).map(x=>({id:idOf(x),projectId:txt(x.projectId,x.jobId),description:txt(x.description,x.name,idOf(x)),cost:n(x.cost,x.costNet),sellPrice:n(x.sellPrice,x.price),approved:bool(x.approved)||/approved/i.test(txt(x.status))})),x=>x.id);}
function normaliseBills(data){return keyBy(arr(data.supplierBills||data.bills).map(b=>({id:idOf(b),supplierId:txt(b.supplierId),supplier:txt(b.supplier,b.supplierName),invoiceNumber:txt(b.invoiceNumber,b.reference,idOf(b)),projectId:txt(b.projectId,b.jobId),amountNet:n(b.amountNet,b.net,b.netTotal),vat:n(b.vat,b.vatAmount),dueDate:dateOnly(txt(b.dueDate))||null,status:txt(b.status,'Unpaid'),linkedPoIds:arr(b.linkedPoIds||b.purchaseOrderIds).map(String),lines:lineRows(b).map(l=>({sku:skuOf(l),qty:n(l.qty,l.quantity),unitCost:n(l.unitCost,l.cost)})).filter(l=>l.sku)})),x=>x.id);}
function normaliseInvoices(data){return keyBy(arr(data.customerInvoices||data.invoices).map(i=>({id:idOf(i),projectId:txt(i.projectId,i.jobId),customerId:txt(i.customerId),amountNet:n(i.amountNet,i.net,i.netTotal),dueDate:dateOnly(txt(i.dueDate))||null,status:txt(i.status,'Draft'),expectedPaymentDate:dateOnly(txt(i.expectedPaymentDate,i.expectedDate))||null})),x=>x.id);}
function normaliseReceipts(data){
  const rows=arr(data.goodsReceipts||data.receiptEvents);return keyBy(rows.map((r,idx)=>({id:idOf(r)||`RECEIPT-${idx+1}`,poId:txt(r.poId,r.purchaseOrderId),supplierId:txt(r.supplierId),receivedAt:txt(r.receivedAt,r.createdAt,r.at),lines:lineRows(r).length?lineRows(r).map(l=>({sku:skuOf(l),qty:n(l.qty,l.quantity,l.receivedQty),unitCost:n(l.unitCost,l.cost),qc:txt(l.qc,l.qcDecision,'Accepted')})).filter(l=>l.sku):[{sku:skuOf(r),qty:n(r.qty,r.quantity,r.receivedQty),unitCost:n(r.unitCost,r.cost),qc:txt(r.qc,r.qcDecision,'Accepted')}].filter(l=>l.sku)})),x=>x.id);
}
function normaliseSafety(data){return keyBy(arr(data.safetyDocuments||data.productSafetyDocuments).map(d=>({id:idOf(d),sku:skuOf(d),title:txt(d.title,d.name,idOf(d)),revisionDate:dateOnly(txt(d.revisionDate,d.updatedAt))||null,documentType:txt(d.documentType,d.type,'SDS'),status:txt(d.status,'Current'),controls:arr(d.controls).map(String),notes:txt(d.notes)})),x=>x.id);}
function normaliseKnowledge(data){return arr(data.knowledge||data.knowledgeLibrary||data.approvedKnowledge).map((k,i)=>({id:idOf(k)||`KB-${i+1}`,title:txt(k.title,k.name,'Knowledge'),tags:arr(k.tags).map(String),text:txt(k.text,k.body,k.content)})).filter(k=>k.text);}
function normaliseEvents(data){return arr(data.auditEvents||data.events||data.activity||data.receiptEvents).map((e,i)=>({id:idOf(e)||`EVT-${i+1}`,at:txt(e.at,e.createdAt,e.timestamp,new Date().toISOString()),type:txt(e.type,e.eventType,'activity'),entityType:txt(e.entityType,e.recordType,e.type,'record'),entityId:txt(e.entityId,e.recordId,e.id),projectId:txt(e.projectId,e.jobId)||null,sku:skuOf(e)||null,summary:txt(e.summary,e.message,e.description,e.type)}));}

export function normalisePoolShedWorkspace(data={},options={}){
  const products=normaliseProducts(data),suppliers=normaliseSuppliers(data),customers=normaliseCustomers(data),salesOrders=normaliseSalesOrders(data),purchaseOrders=normalisePurchaseOrders(data),projects=normaliseProjects(data,salesOrders,purchaseOrders);
  return {
    meta:{mode:'pool-shed-live',revision:n(options.revision,data.revision)||1,updatedAt:txt(options.updatedAt,data.updatedAt,new Date().toISOString()),today:dateOnly(options.today||new Date().toISOString())},
    users:normaliseUsers(options),projects,purchaseOrders,products,salesOrders,
    hires:normaliseHires(data),extras:normaliseExtras(data),customers,suppliers,
    supplierBills:normaliseBills(data),customerInvoices:normaliseInvoices(data),
    supplierOffers:normaliseSupplierOffers(data,products,suppliers),goodsReceipts:normaliseReceipts(data),
    safetyDocuments:normaliseSafety(data),stockCounts:arr(data.stockCounts||data.stockTakes),
    knowledge:normaliseKnowledge(data),events:normaliseEvents(data)
  };
}
