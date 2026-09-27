import { daysLate, gbp } from './utils.js';
import { hasPermission } from './permissions.js';

const aliases={stock:'product',product:'product',po:'po',project:'project',sales_order:'sales_order',salesorder:'sales_order',customer:'customer',supplier:'supplier',bill:'bill',invoice:'invoice',hire:'hire',extra:'extra',supplier_price:'supplier_price'};
export const normaliseRecordType=t=>aliases[String(t||'').toLowerCase()]||String(t||'').toLowerCase();

function allowed(user,type){
  type=normaliseRecordType(type);
  const permission={project:'projects.read',po:'purchasing.read',product:'stock.read',sales_order:'projects.read',customer:'customers.read',supplier:'purchasing.read',bill:'finance.read',invoice:'finance.read',hire:'finance.read',extra:'finance.read',supplier_price:'purchasing.read'}[type];
  return permission?hasPermission(user,permission):false;
}

function entity(db,type,id){
  type=normaliseRecordType(type);
  const map={project:db.projects,po:db.purchaseOrders,product:db.products,sales_order:db.salesOrders,customer:db.customers,supplier:db.suppliers,bill:db.supplierBills,invoice:db.customerInvoices,hire:db.hires,extra:db.extras,supplier_price:db.supplierOffers};
  return map[type]?.[id]||null;
}

function recordHref(db,type,id,{focus=null}={}){
  type=normaliseRecordType(type); const x=entity(db,type,id);
  if(type==='project')return `/projects/${encodeURIComponent(id)}${focus?`?focus=${encodeURIComponent(focus)}`:''}`;
  if(type==='po')return `/purchase-orders/${encodeURIComponent(id)}${focus?`?focus=${encodeURIComponent(focus)}`:''}`;
  if(type==='product')return `/products/${encodeURIComponent(id)}${focus?`?focus=${encodeURIComponent(focus)}`:''}`;
  if(type==='sales_order')return `/sales-orders/${encodeURIComponent(id)}${focus?`?focus=${encodeURIComponent(focus)}`:''}`;
  if(type==='customer')return `/customers/${encodeURIComponent(id)}`;
  if(type==='supplier')return `/suppliers/${encodeURIComponent(id)}`;
  if(type==='bill')return `/finance/bills/${encodeURIComponent(id)}`;
  if(type==='invoice')return `/finance/invoices/${encodeURIComponent(id)}`;
  if(type==='supplier_price')return `/supplier-prices/${encodeURIComponent(id)}`;
  if(type==='hire')return `/hires/${encodeURIComponent(id)}`;
  if(type==='extra')return `/project-extras/${encodeURIComponent(id)}`;
  return '#';
}

function recordLabel(db,type,id){
  type=normaliseRecordType(type); const x=entity(db,type,id);
  if(!x)return id;
  return ({project:x.name,po:x.id,product:x.name,sales_order:x.id,customer:x.name,supplier:x.name,bill:`${x.supplier} ${x.invoiceNumber}`,invoice:x.id,hire:x.description,extra:x.description,supplier_price:`${x.productName} · ${x.supplier}`})[type]||id;
}

function makeLink(db,user,type,id,focus=null){
  type=normaliseRecordType(type); if(!allowed(user,type)||!entity(db,type,id))return null;
  return {type,id,label:recordLabel(db,type,id),href:recordHref(db,type,id,{focus})};
}

export function recordLinksForAnswer(db,user,answer='',evidence=[],context=null){
  const found=new Map();
  const add=(type,id,focus=null)=>{const l=makeLink(db,user,type,id,focus);if(l)found.set(`${l.type}:${l.id}`,l);};
  const text=String(answer||''); const lowerText=text.toLowerCase();
  for(const ev of evidence||[]){
    const type=normaliseRecordType(ev.entityType),id=ev.entityId,label=recordLabel(db,type,id);
    if(lowerText.includes(String(id||'').toLowerCase())||(label&&lowerText.includes(String(label).toLowerCase())))add(type,id,ev.path||null);
    if(ev.entityType==='po'&&String(ev.path||'').startsWith('line:')){
      const sku=String(ev.path).slice(5),productLabel=recordLabel(db,'product',sku);
      if(lowerText.includes(sku.toLowerCase())||(productLabel&&lowerText.includes(String(productLabel).toLowerCase()))||lowerText.includes(String(ev.label||'').toLowerCase()))add('product',sku);
    }
  }
  const collections=[['project',db.projects],['po',db.purchaseOrders],['product',db.products],['sales_order',db.salesOrders],['customer',db.customers],['supplier',db.suppliers],['bill',db.supplierBills],['invoice',db.customerInvoices],['hire',db.hires],['extra',db.extras],['supplier_price',db.supplierOffers]];
  for(const [type,items] of collections){
    if(!allowed(user,type))continue;
    for(const [id,x] of Object.entries(items||{})){
      const names=[id];
      if(type==='project')names.push(x.name);
      if(type==='product')names.push(x.name);
      if(type==='customer'||type==='supplier')names.push(x.name);
      if(type==='bill')names.push(x.invoiceNumber);
      if(type==='hire'||type==='extra')names.push(x.description);
      if(type==='supplier_price')names.push(x.productName,x.supplierSku);
      if(names.some(v=>v&&text.toLowerCase().includes(String(v).toLowerCase())))add(type,id);
    }
  }
  if(context?.type&&context?.id){
    const t=normaliseRecordType(context.type);
    const label=recordLabel(db,t,context.id);
    if(text.includes(context.id)||label&&text.toLowerCase().includes(String(label).toLowerCase()))add(t,context.id);
  }
  return [...found.values()].slice(0,8);
}

function related(db,user,items=[]){return items.map(([t,id,label])=>{const l=makeLink(db,user,t,id);return l?{...l,label:label||l.label}:null;}).filter(Boolean);}

export function recordView(db,user,type,id){
  type=normaliseRecordType(type); if(!allowed(user,type))return {ok:false,status:403,error:'This record sits outside your Pool Shed access.'};
  const x=entity(db,type,id); if(!x)return {ok:false,status:404,error:'Record not found.'};
  let title=recordLabel(db,type,id),subtitle=id,status=x.status||null,fields=[],links=[],issue=null;
  if(type==='project'){
    fields=[['Stage',x.stage],['Progress',`${x.progress}%`],['Due',x.dueDate],['Owner',x.owner]];
    if(hasPermission(user,'finance.read'))fields.push(['Quoted net',gbp(x.quotedNet)],['Forecast cost',gbp(x.forecastCost)]);
    links=related(db,user,[...(x.salesOrderIds||[]).map(v=>['sales_order',v]),...(x.poIds||[]).map(v=>['po',v]),['customer',x.customerId]]);
  }else if(type==='po'){
    const late=daysLate(x.expectedDate,db.meta.today),missing=x.lines.filter(l=>l.received<l.qty);
    subtitle=`${x.id} · ${x.supplier}`; fields=[['Status',x.status],['Ordered',x.orderedDate],['ETA',x.expectedDate||'No confirmed ETA'],['Outstanding',missing.reduce((n,l)=>n+(l.qty-l.received),0)]];
    issue=missing.length?(late?`${late} days late with ${missing.reduce((n,l)=>n+(l.qty-l.received),0)} unit(s) still outstanding.`:!x.expectedDate?'Outstanding items have no confirmed ETA.':null):null;
    links=related(db,user,[['project',x.projectId],['supplier',x.supplierId],...x.lines.map(l=>['product',l.sku,l.name])]);
  }else if(type==='product'){
    const available=Math.max(0,x.onHand-x.allocated); subtitle=x.sku;fields=[['Bin',x.bin],['On hand',x.onHand],['Allocated',x.allocated],['Available',available],['On order',x.onOrder],['Unit cost',gbp(x.unitCost)]];links=related(db,user,[['supplier',x.supplierId]]);
  }else if(type==='sales_order'){
    const lines=x.lines||[];subtitle=x.id;fields=[['Status',x.status],['Project',x.projectId],['Lines',lines.length]];if(hasPermission(user,'finance.read'))fields.push(['Net total',gbp(x.totalNet)]);if(lines.length&&hasPermission(user,'stock.read')){const short=lines.reduce((n,l)=>{const p=db.products[l.sku],free=p?Math.max(0,p.onHand-p.allocated):0;return n+Math.max(0,l.qty-free);},0);fields.push(['Recorded stock shortfall',short]);if(x.status==='Ready to pick'&&short>0)issue=`This sales order is marked ready to pick, but ${short} unit(s) are not free in stock.`;}links=related(db,user,[['project',x.projectId],...lines.map(l=>['product',l.sku,l.name])]);
  }else if(type==='bill'){
    subtitle=`${x.supplier} · ${x.invoiceNumber}`;fields=[['Status',x.status],['Due',x.dueDate],['Net',gbp(x.amountNet)],['VAT',gbp(x.vat)],['Gross',gbp(x.amountNet+x.vat)]];links=related(db,user,[['project',x.projectId],['supplier',x.supplierId],...(x.linkedPoIds||[]).map(v=>['po',v])]);
  }else if(type==='invoice'){
    subtitle=x.id;fields=[['Status',x.status],['Due',x.dueDate],['Net',gbp(x.amountNet)],['Expected payment',x.expectedPaymentDate||'Not recorded']];links=related(db,user,[['project',x.projectId],['customer',x.customerId]]);
  }else if(type==='customer'){
    fields=[['Waiting on us',(x.waitingOnUs||[]).join('; ')||'Nothing recorded'],['Waiting on customer',(x.waitingOnCustomer||[]).join('; ')||'Nothing recorded']];links=related(db,user,(x.projectIds||[]).map(v=>['project',v]));
  }else if(type==='supplier'){
    fields=[['Credit limit',gbp(x.creditLimit)],['Outstanding balance',gbp(x.outstandingBalance)]];
  }else if(type==='hire'){
    subtitle=x.id;fields=[['Supplier',x.supplier],['Daily rate',gbp(x.dailyRate)],['Days on hire',x.accruedDays],['Accrued',gbp(x.accruedCost)],['Active',x.active?'Yes':'No']];links=related(db,user,[['project',x.projectId]]);
  }else if(type==='extra'){
    subtitle=x.id;fields=[['Cost',gbp(x.cost)],['Sell price',gbp(x.sellPrice)],['Approved',x.approved?'Yes':'No']];links=related(db,user,[['project',x.projectId]]);
  }else if(type==='supplier_price'){
    subtitle=`${x.supplier} · ${x.supplierSku}`;fields=[['Pack',`${x.packLitres} L`],['Strength',`${x.concentrationPct}%`],['Net price',gbp(x.unitNet)],['Updated',x.lastUpdated],['Availability',x.availability]];links=related(db,user,[['supplier',x.supplierId]]);
  }
  return {ok:true,type,id,title,subtitle,status,fields,links,issue};
}
