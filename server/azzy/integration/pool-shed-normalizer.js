// Azzy Pool Shed workspace normalizer.
// Reads the canonical Pool Shed workspace snapshot and produces the compact live model
// expected by Azzy's deterministic tools. It never mutates the source snapshot.

const arr=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[]);
const n=(...v)=>{for(const x of v){const q=Number(x);if(Number.isFinite(q))return q;}return 0;};
const txt=(...v)=>{for(const x of v)if(x!==undefined&&x!==null&&String(x).trim())return String(x).trim();return '';};
const keyBy=(rows,keyFn)=>Object.fromEntries(rows.map(x=>[keyFn(x),x]).filter(([k])=>k));
const explicitSkuOf=x=>txt(x?.sku,x?.poolSku,x?.productSku,x?.code,x?.productCode);
const skuOf=x=>txt(explicitSkuOf(x),x?.id);
const productIdOf=x=>txt(x?.productId,x?.product_id,x?.catalogueProductId,x?.catalogue_product_id);
const idOf=x=>txt(x?.id,x?.reference,x?.number,x?.code);
const lineRows=x=>arr(x?.lines||x?.items||x?.orderLines||x?.products);
const dateOnly=v=>v?String(v).slice(0,10):null;
const bool=v=>v===true||v==='true'||v===1||v==='1';
const compact=x=>Object.fromEntries(Object.entries(x).filter(([,v])=>v!==undefined&&v!==null&&v!==''));

function normaliseUsers(options={}){
  const users=arr(options.users||[]);return keyBy(users,u=>txt(u.id,u.user_id,u.userId));
}

function productMaps(data){
  const rows=arr(data.products),byId=new Map(),bySku=new Map();
  for(const raw of rows){
    const sku=skuOf(raw),id=idOf(raw);
    if(sku)bySku.set(sku,raw);
    for(const key of [id,raw?.productId,raw?.sku,raw?.code,raw?.productCode].map(txt).filter(Boolean))byId.set(key,raw);
  }
  return {rows,byId,bySku};
}

function normaliseProducts(data){
  const maps=productMaps(data),stockRows=arr(data.stock),stockBySku=new Map();
  for(const st of stockRows){
    const linked=maps.byId.get(productIdOf(st))||maps.byId.get(txt(st?.id));
    const sku=explicitSkuOf(st)||skuOf(linked);
    if(sku){
      const prior=stockBySku.get(sku)||{};
      stockBySku.set(sku,{
        ...prior,
        ...st,
        qty:n(prior.qty,prior.onHand)+n(st.qty,st.onHand,st.quantity),
        allocated:n(prior.allocated,prior.reserved)+n(st.allocated,st.reserved),
        onOrder:n(prior.onOrder)+n(st.onOrder)
      });
    }
  }
  const out={};
  for(const raw of maps.rows){
    const sku=skuOf(raw);if(!sku)continue;const st=stockBySku.get(sku)||{};
    out[sku]=compact({
      id:idOf(raw)||sku,
      sku,
      name:txt(raw.name,raw.title,raw.description,sku),
      description:txt(raw.description,raw.longDescription,raw.notes),
      barcode:txt(raw.barcode,raw.ean,raw.upc),
      category:txt(raw.category,raw.categoryName)||null,
      subcategory:txt(raw.subcategory,raw.subCategory)||null,
      parentId:txt(raw.parentId,raw.parentProductId)||null,
      parentName:txt(raw.parentName,raw.familyName)||null,
      variant:txt(raw.variant,raw.variantName,raw.size)||null,
      unit:txt(raw.unit,raw.uom,'Each'),
      status:txt(raw.status,raw.active===false?'Inactive':'Active'),
      supplierId:txt(raw.supplierId,raw.preferredSupplierId,raw.primarySupplierId),
      supplier:txt(raw.supplier,raw.supplierName),
      supplierSku:txt(raw.supplierSku,raw.supplierSKU,raw.vendorSku),
      bin:txt(st.bin,st.binCode,st.location,st.locationCode,raw.bin,raw.location,'No bin recorded'),
      onHand:n(st.qty,st.onHand,st.quantity,raw.onHand,raw.qty),
      allocated:n(st.allocated,st.reserved,raw.allocated),
      onOrder:n(st.onOrder,raw.onOrder,raw.incoming),
      reorderLevel:n(raw.reorderLevel,raw.reorderPoint,raw.minStock,raw.reorder,st.reorderLevel),
      unitCost:n(raw.unitCost,raw.cost,raw.buyPrice,raw.netCost),
      rrp:n(raw.rrp,raw.rrpPrice,raw.rrp_price),
      trade:n(raw.trade,raw.tradePrice,raw.trade_price),
      wholesale:n(raw.wholesale,raw.wholesalePrice,raw.wholesale_price),
      taxCode:txt(raw.taxCode,raw.vatCode,'20% VAT'),
      equivalenceKey:txt(raw.equivalenceKey,raw.matchKey,raw.productFamilyKey)||null,
      lastUpdated:txt(raw.updatedAt,raw.lastUpdated,raw.modifiedAt)||null,
      safetyDocIds:arr(raw.safetyDocIds||raw.safetyDocuments).map(x=>typeof x==='string'?x:idOf(x)).filter(Boolean)
    });
  }
  // Keep stock-only rows discoverable even if a legacy product record is absent.
  for(const st of stockRows){
    const linked=maps.byId.get(productIdOf(st))||maps.byId.get(txt(st?.id));
    const sku=explicitSkuOf(st)||skuOf(linked);if(!sku||out[sku])continue;
    out[sku]={id:productIdOf(st)||sku,sku,name:txt(st.name,st.productName,sku),supplierId:'',supplier:'',supplierSku:'',bin:txt(st.bin,st.location,'No bin recorded'),onHand:n(st.qty,st.onHand),allocated:n(st.allocated,st.reserved),onOrder:n(st.onOrder),reorderLevel:n(st.reorderLevel),unitCost:n(st.unitCost),rrp:0,trade:0,wholesale:0,taxCode:'20% VAT'};
  }
  return out;
}

function productResolver(data,products){
  const byAny=new Map();
  for(const raw of arr(data.products)){
    const sku=skuOf(raw),p=products[sku];if(!p)continue;
    for(const key of [idOf(raw),raw?.productId,raw?.sku,raw?.code,raw?.productCode].map(txt).filter(Boolean))byAny.set(key,p);
  }
  return line=>{
    const direct=explicitSkuOf(line);if(direct&&products[direct])return products[direct];
    const pid=productIdOf(line);if(pid&&byAny.has(pid))return byAny.get(pid);
    const id=txt(line?.id);if(id&&byAny.has(id))return byAny.get(id);
    return direct?products[direct]||null:null;
  };
}

function normaliseSuppliers(data){
  return keyBy(arr(data.suppliers).map(s=>compact({
    id:idOf(s),name:txt(s.name,s.company,s.supplierName,idOf(s)),code:txt(s.code,s.accountNumber),
    email:txt(s.ordersEmail,s.email),phone:txt(s.phone),status:txt(s.status,'Active'),
    creditLimit:n(s.creditLimit,s.credit_limit),creditUsed:n(s.creditUsed,s.outstandingBalance,s.balance),
    minimumOrder:n(s.minimumOrder),freeShippingThreshold:n(s.freeShippingThreshold,s.freeCarriageThreshold),
    shippingCost:n(s.shippingCost,s.carriageNet),leadTimeDays:n(s.leadTimeDays,s.leadTime),
    rating:n(s.rating),preferred:bool(s.preferred),performance:s.performance||null
  })),x=>x.id);
}
function normaliseCustomers(data){
  return keyBy(arr(data.customers).map(c=>{
    const firstName=txt(c.firstName,c.firstname,c.givenName),lastName=txt(c.lastName,c.lastname,c.surname,c.familyName);
    const fullName=txt(c.fullName,[firstName,lastName].filter(Boolean).join(' '),c.name,c.contactName);
    const companyName=txt(c.companyName,c.company,c.organisation,c.organization);
    const name=txt(c.name,fullName,companyName,idOf(c));
    const aliases=[...new Set([
      ...arr(c.aliases||c.alternateNames||c.aka).map(String),
      fullName,companyName,name,
      [lastName,firstName].filter(Boolean).join(' '),
      firstName,lastName
    ].map(x=>String(x||'').trim()).filter(Boolean))];
    return compact({
      id:idOf(c),code:txt(c.code,c.customerCode),name,firstName,lastName,surname:lastName,fullName:fullName||name,companyName,
      email:txt(c.email),email2:txt(c.email2,c.accountsEmail),email3:txt(c.email3),
      phone:txt(c.phone,c.telephone),mobile:txt(c.mobile),status:txt(c.status,'Active'),customerType:txt(c.customerType,c.type),
      priceList:txt(c.priceList,'rrp'),discount:n(c.discount),aliases,
      projectIds:arr(c.projectIds||c.jobIds).map(String),
      waitingOnUs:arr(c.waitingOnUs||c.actionsForUs).map(String),waitingOnCustomer:arr(c.waitingOnCustomer||c.actionsForCustomer).map(String)
    });
  }),x=>x.id);
}

function normaliseSalesOrders(data,products){
  const resolveProduct=productResolver(data,products);
  return keyBy(arr(data.salesOrders).map(o=>{
    const priceList=txt(o.priceList,'rrp');
    const lines=lineRows(o).map(l=>{
      const p=resolveProduct(l),sku=p?.sku||explicitSkuOf(l)||productIdOf(l);if(!sku)return null;
      const unitPrice=n(l.unitPrice,l.specialPrice,l.sellPrice,l.price,p?.[priceList],p?.rrp,p?.trade,p?.wholesale);
      return compact({
        productId:productIdOf(l)||p?.id||null,sku,name:txt(l.name,l.description,l.productName,p?.name,sku),
        description:txt(l.description),lineType:txt(l.lineType,'stock'),qty:n(l.qty,l.quantity),
        allocatedQty:n(l.allocatedQty,l.allocated,l.reservedQty),pickedQty:n(l.picked,l.pickedQty),
        packedQty:n(l.packed,l.packedQty),shippedQty:n(l.shipped,l.shippedQty),unitPrice,
        unitCost:n(l.unitCost,l.cost,p?.unitCost),taxCode:txt(l.taxCode,p?.taxCode,'20% VAT'),
        supplier:txt(l.supplier,p?.supplier),supplierSku:txt(l.supplierSku,p?.supplierSku)
      });
    }).filter(Boolean);
    return compact({
      id:idOf(o),projectId:txt(o.projectId,o.jobId),customerId:txt(o.customerId),status:txt(o.status,'Open'),
      source:txt(o.source),channel:txt(o.channel),quoteRef:txt(o.quoteRef),xeroRef:txt(o.xeroRef),
      priceList,tags:arr(o.tags).map(String),shipTo:o.shipTo||o.addresses?.delivery||null,carrier:txt(o.carrier),
      createdDate:dateOnly(txt(o.created,o.createdAt,o.orderDate))||null,dueDate:dateOnly(txt(o.due,o.dueDate))||null,
      totalNet:n(o.totalNet,o.netTotal,o.subtotal),totalVat:n(o.totalVat,o.vatTotal,o.vat),totalGross:n(o.totalGross,o.grossTotal,o.total),
      payments:arr(o.payments),notes:arr(o.notes||o.notifications).map(x=>typeof x==='string'?x:txt(x.message,x.text,x.note)).filter(Boolean),
      lines
    });
  }),x=>x.id);
}

function normalisePurchaseOrders(data,products){
  const resolveProduct=productResolver(data,products);
  return keyBy(arr(data.purchaseOrders).map(o=>compact({
    id:idOf(o),supplierId:txt(o.supplierId,o.vendorId),supplier:txt(o.supplier,o.supplierName,o.vendorName),
    projectId:txt(o.projectId,o.jobId),customerId:txt(o.customerId),customerName:txt(o.customerName),
    originalSalesOrderId:txt(o.originalSalesOrderId,o.salesOrderId)||null,source:txt(o.source),
    status:txt(o.status,'Draft'),reviewStatus:txt(o.reviewStatus),supplierEmailStatus:txt(o.supplierEmailStatus),
    supplierReference:txt(o.supplierReference,o.supplierRef),parcelNote:txt(o.parcelNote),reviewNotes:txt(o.reviewNotes),
    orderedDate:dateOnly(txt(o.orderedDate,o.orderDate,o.sentAt,o.createdAt,o.created,lineRows(o)[0]?.orderedDate))||null,
    expectedDate:dateOnly(txt(o.expectedDate,o.eta,o.confirmedEta,o.due,o.dueDate))||null,
    paymentStatus:txt(o.paymentStatus,o.paymentState,o.paid===true?'Paid':''),
    totalNet:n(o.totalNet,o.netTotal,o.subtotal),
    lines:lineRows(o).map(l=>{
      const p=resolveProduct(l),sku=p?.sku||explicitSkuOf(l)||productIdOf(l);if(!sku)return null;
      return compact({
        productId:productIdOf(l)||p?.id||null,sku,name:txt(l.name,l.description,l.productName,p?.name,sku),
        qty:n(l.qty,l.quantity),received:n(l.received,l.receivedQty,l.qtyReceived),unitCost:n(l.unitCost,l.cost,l.buyPrice,p?.unitCost),
        supplierSku:txt(l.supplierSku,p?.supplierSku),salesOrderId:txt(l.salesOrderId,o.originalSalesOrderId)||null,
        orderedDate:dateOnly(txt(l.orderedDate,o.orderedDate,o.orderDate))||null,dueDate:dateOnly(txt(l.dueDate,o.due,o.expectedDate))||null,
        leadTimeDays:n(l.leadTimeDays),chaseStatus:txt(l.chaseStatus),nextChaseDate:dateOnly(txt(l.nextChaseDate))||null,
        salesOrderAllocations:arr(l.salesOrderAllocations).map(x=>({salesOrderId:txt(x.salesOrderId),qty:n(x.qty),date:dateOnly(txt(x.date,x.at))||null}))
      });
    }).filter(Boolean)
  })),x=>x.id);
}

function normaliseProjects(data,salesOrders,purchaseOrders){
  const jobs=arr(data.jobs||data.projects);const out={};
  for(const j of jobs){
    const id=idOf(j);if(!id)continue;const project=j.project&&typeof j.project==='object'?j.project:{};
    const soIds=Object.values(salesOrders).filter(x=>x.projectId===id).map(x=>x.id),poIds=Object.values(purchaseOrders).filter(x=>x.projectId===id).map(x=>x.id);
    const labour=arr(project.labour).map(l=>compact({id:txt(l.id),person:txt(l.supplier,l.employee,l.name),reference:txt(l.ref,l.reference),startDate:dateOnly(txt(l.startDate))||null,endDate:dateOnly(txt(l.endDate))||null,ongoing:!!l.ongoing,rateType:txt(l.rateType),rate:n(l.rate),notes:txt(l.notes),variationId:txt(l.variationId)}));
    out[id]={id,name:txt(j.name,j.title,j.projectName,j.reference,id),customerId:txt(j.customerId),status:txt(j.status,'Active'),stage:txt(j.stage,j.phase,'Active'),progress:n(j.progress,j.percentComplete,j.completionPct),dueDate:dateOnly(txt(j.dueDate,j.targetDate,j.nextKeyDate,project.targetCompletion))||null,targetMarginPct:n(j.targetMarginPct,j.targetMargin,project.targetMargin,j.marginTarget),quotedNet:n(j.quotedNet,j.quoteNet,project.quoteNet,j.sellValue,j.value),committedCost:n(j.committedCost,j.committed),actualCost:n(j.actualCost,j.actual),forecastCost:n(j.forecastCost,j.forecast),salesOrderIds:[...new Set([...arr(j.salesOrderIds).map(String),...soIds])],poIds:[...new Set([...arr(j.poIds||j.purchaseOrderIds).map(String),...poIds])],hireIds:arr(j.hireIds).map(String),extraIds:arr(j.extraIds).map(String),labour,notes:arr(j.notes).map(x=>typeof x==='string'?x:txt(x.text,x.body)).filter(Boolean),owner:txt(j.owner,j.ownerName,j.assignedTo)};
  }
  return out;
}

function normaliseSupplierOffers(data,products,suppliers){
  const raw=arr(data.supplierProducts||data.supplierOffers||data.productSupplierPrices),resolveProduct=productResolver(data,products),supplierByName=new Map(Object.values(suppliers).map(s=>[s.name.toLowerCase(),s]));const out={};
  for(const o of raw){
    const p=resolveProduct(o),sku=txt(o.poolSku,o.sku,o.productSku,p?.sku),supplierName=txt(o.supplier,o.supplierName),supplier=suppliers[txt(o.supplierId)]||supplierByName.get(supplierName.toLowerCase())||null;
    const id=idOf(o)||`OFFER-${raw.indexOf(o)+1}`;
    out[id]=compact({
      id,productId:productIdOf(o)||p?.id||null,poolSku:sku||null,equivalenceKey:txt(o.equivalenceKey,p?.equivalenceKey)||null,
      matchType:txt(o.matchType,'exact'),productFamily:txt(o.productFamily,p?.parentName,p?.category,p?.name),
      productName:txt(o.productName,o.name,p?.name,sku),searchText:txt(o.searchText,o.aliases,p?.name,sku),
      supplierId:txt(o.supplierId,supplier?.id),supplier:txt(supplierName,supplier?.name),supplierSku:txt(o.supplierSku,o.vendorSku,p?.supplierSku),
      packLitres:n(o.packLitres,o.packSizeLitres)||null,packQty:n(o.packQty,o.packSize)||null,
      concentrationPct:n(o.concentrationPct,o.strengthPct)||null,unitNet:n(o.unitNet,o.netPrice,o.cost),
      carriageNet:n(o.carriageNet,o.deliveryCost,supplier?.shippingCost),freeCarriageThreshold:n(o.freeCarriageThreshold,supplier?.freeShippingThreshold)||null,
      minQty:n(o.minQty,o.minimumOrderQty)||1,leadTimeDays:n(o.leadTimeDays,o.leadTime,supplier?.leadTimeDays)||null,
      availability:txt(o.availability,o.stockStatus,o.available===true?'Available':o.available===false?'Unavailable':'Unknown'),
      lastUpdated:dateOnly(txt(o.lastUpdated,o.updatedAt,o.priceDate))||null,previousNet:n(o.previousNet)||null,
      previousDate:dateOnly(txt(o.previousDate))||null,notes:txt(o.notes),approved:o.approved!==false&&o.available!==false
    });
  }
  return out;
}

function normaliseHires(data){return keyBy(arr(data.hires||data.projectHires||data.toolsOnHire).map(h=>({id:idOf(h),projectId:txt(h.projectId,h.jobId),description:txt(h.description,h.name,idOf(h)),supplier:txt(h.supplier,h.supplierName),dailyRate:n(h.dailyRate,h.dayRate),accruedDays:n(h.accruedDays,h.days),accruedCost:n(h.accruedCost,h.costToDate),purchaseEquivalent:n(h.purchaseEquivalent,h.purchasePrice),active:h.active!==false&&!/off.?hire|returned|closed/i.test(txt(h.status))})),x=>x.id);}
function normaliseExtras(data){return keyBy(arr(data.extras||data.projectExtras).map(x=>({id:idOf(x),projectId:txt(x.projectId,x.jobId),description:txt(x.description,x.name,idOf(x)),cost:n(x.cost,x.costNet),sellPrice:n(x.sellPrice,x.price),approved:bool(x.approved)||/approved/i.test(txt(x.status))})),x=>x.id);}

function normaliseBills(data,products){
  const resolveProduct=productResolver(data,products);
  return keyBy(arr(data.supplierBills||data.bills).map(b=>({id:idOf(b),supplierId:txt(b.supplierId),supplier:txt(b.supplier,b.supplierName),invoiceNumber:txt(b.invoiceNumber,b.reference,idOf(b)),projectId:txt(b.projectId,b.jobId),amountNet:n(b.amountNet,b.net,b.netTotal),vat:n(b.vat,b.vatAmount),dueDate:dateOnly(txt(b.dueDate))||null,status:txt(b.status,'Unpaid'),linkedPoIds:arr(b.linkedPoIds||b.purchaseOrderIds).map(String),lines:lineRows(b).map(l=>{const p=resolveProduct(l),sku=p?.sku||explicitSkuOf(l)||productIdOf(l);return sku?{sku,qty:n(l.qty,l.quantity),unitCost:n(l.unitCost,l.cost)}:null;}).filter(Boolean)})),x=>x.id);
}
function normaliseInvoices(data){return keyBy(arr(data.customerInvoices||data.invoices).map(i=>({id:idOf(i),projectId:txt(i.projectId,i.jobId),customerId:txt(i.customerId),amountNet:n(i.amountNet,i.net,i.netTotal),dueDate:dateOnly(txt(i.dueDate))||null,status:txt(i.status,'Draft'),expectedPaymentDate:dateOnly(txt(i.expectedPaymentDate,i.expectedDate))||null})),x=>x.id);}

function normaliseReceipts(data,products){
  const resolveProduct=productResolver(data,products),rows=arr(data.goodsReceipts||data.receiptEvents);
  const lineOf=l=>{const p=resolveProduct(l),sku=p?.sku||explicitSkuOf(l)||productIdOf(l);return sku?{sku,qty:n(l.qty,l.quantity,l.receivedQty),unitCost:n(l.unitCost,l.cost),qc:txt(l.qc,l.qcDecision,'Accepted')}:null;};
  return keyBy(rows.map((r,idx)=>({id:idOf(r)||`RECEIPT-${idx+1}`,poId:txt(r.poId,r.purchaseOrderId),supplierId:txt(r.supplierId),receivedAt:txt(r.receivedAt,r.createdAt,r.at),lines:(lineRows(r).length?lineRows(r).map(lineOf):[lineOf(r)]).filter(Boolean)})),x=>x.id);
}

function normaliseGoodsNotes(data,products){
  const resolveProduct=productResolver(data,products);
  return keyBy(arr(data.goodsNotes||data.deliveryNotes||data.shipments).map((g,idx)=>({id:idOf(g)||`GN-${idx+1}`,salesOrderId:txt(g.salesOrderId,g.orderId),status:txt(g.status),createdAt:txt(g.createdAt,g.created,g.date),carrier:txt(g.carrier),tracking:txt(g.tracking,g.trackingNumber),lines:lineRows(g).map(l=>{const p=resolveProduct(l),sku=p?.sku||explicitSkuOf(l)||productIdOf(l);return sku?{sku,name:txt(l.name,p?.name,sku),qty:n(l.qty,l.quantity),picked:n(l.picked,l.pickedQty),packed:n(l.packed,l.packedQty),shipped:n(l.shipped,l.shippedQty,l.qty)}:null;}).filter(Boolean)})),x=>x.id);
}
function normaliseSalesCredits(data,products){
  const resolveProduct=productResolver(data,products);
  return keyBy(arr(data.salesCredits||data.credits).map((c,idx)=>({id:idOf(c)||`SC-${idx+1}`,originalSalesOrderId:txt(c.originalSalesOrderId,c.salesOrderId),status:txt(c.status,'Draft'),reason:txt(c.reason,c.notes),createdAt:txt(c.createdAt,c.created,c.date),totalNet:n(c.totalNet,c.netTotal),lines:lineRows(c).map(l=>{const p=resolveProduct(l),sku=p?.sku||explicitSkuOf(l)||productIdOf(l);return sku?{sku,name:txt(l.name,l.description,p?.name,sku),qty:n(l.qty,l.quantity),received:n(l.received,l.receivedQty),unitPrice:n(l.unitPrice,l.price),condition:txt(l.condition)}:null;}).filter(Boolean)})),x=>x.id);
}
function normaliseQuotes(data){
  return keyBy(arr(data.quotes||data.estimates).map((q,idx)=>compact({id:idOf(q)||`QUOTE-${idx+1}`,customerId:txt(q.customerId),projectId:txt(q.projectId,q.jobId),salesOrderId:txt(q.salesOrderId),title:txt(q.title,q.name,q.reference,idOf(q)),status:txt(q.status,'Draft'),version:n(q.version)||1,totalNet:n(q.totalNet,q.netTotal,q.subtotal),vat:n(q.vat,q.vatTotal),totalGross:n(q.totalGross,q.grossTotal,q.total),createdAt:txt(q.createdAt,q.created),acceptedAt:txt(q.acceptedAt,q.signedAt),validUntil:dateOnly(txt(q.validUntil,q.expiryDate))||null})),x=>x.id);
}
function normaliseLocations(data){return keyBy(arr(data.locations).map(l=>({id:idOf(l),name:txt(l.name,l.label,idOf(l)),type:txt(l.type,l.locationType),active:l.active!==false})),x=>x.id);}
function normaliseStockMovements(data,products){
  const resolveProduct=productResolver(data,products);
  return arr(data.movements||data.stockMovements||data.inventoryMovements).map((m,idx)=>{
    const p=resolveProduct(m),sku=p?.sku||explicitSkuOf(m)||productIdOf(m);
    return compact({
      id:idOf(m)||`MOVE-${idx+1}`,productId:productIdOf(m)||p?.id||null,sku:sku||null,productName:txt(m.productName,m.name,p?.name,sku),
      type:txt(m.type,m.movementType,'Movement'),qty:n(m.qty,m.quantity),date:dateOnly(txt(m.date,m.at,m.createdAt,m.timestamp))||null,
      at:txt(m.at,m.createdAt,m.timestamp,m.date),from:txt(m.from,m.fromLocation,m.fromLocationId),to:txt(m.to,m.toLocation,m.toLocationId),
      fromLocationId:txt(m.fromLocationId),toLocationId:txt(m.toLocationId),locationId:txt(m.locationId),
      reference:txt(m.ref,m.reference),user:txt(m.user,m.createdBy,m.operator),note:txt(m.note,m.reason,m.description),jobId:txt(m.jobId,m.projectId),
      salesOrderId:txt(m.salesOrderId),purchaseOrderId:txt(m.purchaseOrderId,m.poId)
    });
  });
}
function cadenceDays(value,days){
  const direct=n(days);if(direct>0)return direct;
  const v=String(value||'').toLowerCase().trim();
  if(!v)return 30;
  if(/week/.test(v)&&/fort|two|2/.test(v))return 14;
  if(/week/.test(v))return 7;
  if(/fortnight/.test(v))return 14;
  if(/quarter/.test(v))return 91;
  if(/annual|year/.test(v))return 365;
  if(/bi.?month|two month|2 month/.test(v))return 61;
  if(/month/.test(v))return 30;
  const parsed=Number(v);return Number.isFinite(parsed)&&parsed>0?parsed:30;
}
function normaliseSalesOrderSubscriptions(data,products){
  const resolveProduct=productResolver(data,products);
  const rows=arr(data.salesOrderSubscriptions||data.recurringSalesOrders||data.subscriptions);
  return keyBy(rows.map((s,idx)=>compact({
    id:idOf(s)||`SUB-${String(idx+1).padStart(4,'0')}`,customerId:txt(s.customerId),name:txt(s.name,s.title,`Sales Order Subscription ${idx+1}`),
    status:txt(s.status,s.active===false?'Paused':'Active'),cadenceDays:cadenceDays(s.frequency||s.cadence,s.cadenceDays||s.intervalDays),
    frequency:txt(s.frequency,s.cadence),startDate:dateOnly(txt(s.startDate,s.createdAt))||null,nextOrderDate:dateOnly(txt(s.nextOrderDate,s.nextDate,s.nextRunDate))||null,
    endDate:dateOnly(txt(s.endDate))||null,priceList:txt(s.priceList,'rrp'),autoCreate:s.autoCreate===true,approvalRequired:s.approvalRequired!==false,
    lastGeneratedAt:txt(s.lastGeneratedAt,s.lastRunAt),lastSalesOrderId:txt(s.lastSalesOrderId),notes:txt(s.notes,s.note),
    lines:lineRows(s).map(l=>{const p=resolveProduct(l),sku=p?.sku||explicitSkuOf(l)||productIdOf(l);return sku?compact({productId:productIdOf(l)||p?.id||null,sku,name:txt(l.name,l.description,p?.name,sku),qty:Math.max(1,n(l.qty,l.quantity)||1),unitPrice:n(l.unitPrice,l.price),taxCode:txt(l.taxCode,p?.taxCode,'20% VAT')}):null;}).filter(Boolean)
  })),x=>x.id);
}
function normaliseSafety(data){return keyBy(arr(data.safetyDocuments||data.productSafetyDocuments).map(d=>({id:idOf(d),sku:skuOf(d),title:txt(d.title,d.name,idOf(d)),revisionDate:dateOnly(txt(d.revisionDate,d.updatedAt))||null,documentType:txt(d.documentType,d.type,'SDS'),status:txt(d.status,'Current'),controls:arr(d.controls).map(String),notes:txt(d.notes)})),x=>x.id);}
function normaliseKnowledge(data){return arr(data.knowledge||data.knowledgeLibrary||data.approvedKnowledge).map((k,i)=>({id:idOf(k)||`KB-${i+1}`,title:txt(k.title,k.name,'Knowledge'),tags:arr(k.tags).map(String),text:txt(k.text,k.body,k.content)})).filter(k=>k.text);}
function normaliseEvents(data){return arr(data.auditEvents||data.events||data.activity||data.receiptEvents).map((e,i)=>({id:idOf(e)||`EVT-${i+1}`,at:txt(e.at,e.createdAt,e.timestamp,new Date().toISOString()),type:txt(e.type,e.eventType,'activity'),entityType:txt(e.entityType,e.recordType,e.type,'record'),entityId:txt(e.entityId,e.recordId,e.id),projectId:txt(e.projectId,e.jobId)||null,sku:explicitSkuOf(e)||null,summary:txt(e.summary,e.message,e.description,e.type)}));}

export function normalisePoolShedWorkspace(data={},options={}){
  const products=normaliseProducts(data),suppliers=normaliseSuppliers(data),customers=normaliseCustomers(data);
  const salesOrders=normaliseSalesOrders(data,products),purchaseOrders=normalisePurchaseOrders(data,products),projects=normaliseProjects(data,salesOrders,purchaseOrders);
  return {
    meta:{mode:'pool-shed-live',revision:n(options.revision,data.revision)||1,updatedAt:txt(options.updatedAt,data.updatedAt,new Date().toISOString()),today:dateOnly(options.today||new Date().toISOString())},
    users:normaliseUsers(options),projects,purchaseOrders,products,salesOrders,
    hires:normaliseHires(data),extras:normaliseExtras(data),customers,suppliers,
    supplierBills:normaliseBills(data,products),customerInvoices:normaliseInvoices(data),
    supplierOffers:normaliseSupplierOffers(data,products,suppliers),goodsReceipts:normaliseReceipts(data,products),
    goodsNotes:normaliseGoodsNotes(data,products),salesCredits:normaliseSalesCredits(data,products),quotes:normaliseQuotes(data),
    salesOrderSubscriptions:normaliseSalesOrderSubscriptions(data,products),
    locations:normaliseLocations(data),stockMovements:normaliseStockMovements(data,products),
    safetyDocuments:normaliseSafety(data),stockCounts:arr(data.stockCounts||data.stockTakes),
    knowledge:normaliseKnowledge(data),events:normaliseEvents(data)
  };
}
