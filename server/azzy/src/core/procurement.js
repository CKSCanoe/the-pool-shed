import { daysLate, daysBetween } from './utils.js';

const n=v=>Number(v||0);
const free=p=>Math.max(0,n(p?.onHand)-n(p?.allocated));
const lineAllocated=l=>Math.max(0,n(l?.allocatedQty));
const lineShort=l=>Math.max(0,n(l?.qty)-lineAllocated(l));

function salesOrderDemand(db){
  const rows=[];
  for(const so of Object.values(db.salesOrders||{})){
    for(const line of so.lines||[]){
      const shortage=lineShort(line);
      if(shortage<=0)continue;
      const project=db.projects?.[so.projectId]||null;
      rows.push({salesOrderId:so.id,projectId:so.projectId||null,projectName:project?.name||null,projectDueDate:project?.dueDate||null,sku:line.sku,name:line.name||db.products?.[line.sku]?.name||line.sku,requiredQty:n(line.qty),allocatedQty:lineAllocated(line),shortageQty:shortage,status:so.status});
    }
  }
  return rows;
}

function supplierOffersForSku(db,sku){
  const product=db.products?.[sku];
  if(!product)return [];
  const key=product.equivalenceKey||null;
  return Object.values(db.supplierOffers||{}).filter(o=>o.approved!==false&&(o.poolSku===sku||(key&&o.equivalenceKey===key)));
}

function deliveredOfferCost(offer,qty=1){
  qty=Math.max(n(offer?.minQty)||1,n(qty)||1);
  const subtotal=Number((n(offer?.unitNet)*qty).toFixed(2));
  const threshold=n(offer?.freeCarriageThreshold)||Infinity;
  const carriage=subtotal>=threshold?0:n(offer?.carriageNet);
  return {qty,subtotal,carriage,totalNet:Number((subtotal+carriage).toFixed(2)),deliveredUnit:Number(((subtotal+carriage)/qty).toFixed(4))};
}

export function bestSupplierForSku(db,sku,qty=1){
  const offers=supplierOffersForSku(db,sku).map(o=>({...o,...deliveredOfferCost(o,qty)})).sort((a,b)=>a.totalNet-b.totalNet||a.leadTimeDays-b.leadTimeDays);
  return {best:offers[0]||null,offers};
}

export function buildProcurementDemand(db,{includeReorder=true,urgentOnly=false}={}){
  const committed=salesOrderDemand(db),bySku=new Map();
  for(const d of committed){const r=bySku.get(d.sku)||{sku:d.sku,name:d.name,committedShortage:0,sources:[]};r.committedShortage+=d.shortageQty;r.sources.push(d);bySku.set(d.sku,r);}
  const rows=[];
  for(const product of Object.values(db.products||{})){
    const demand=bySku.get(product.sku)||{sku:product.sku,name:product.name,committedShortage:0,sources:[]};
    const available=free(product),onOrder=n(product.onOrder),reorderLevel=n(product.reorderLevel);
    // First cover committed unallocated demand, then restore the free-stock floor where required.
    const committedGap=Math.max(0,demand.committedShortage-onOrder);
    const projectedFree=available+onOrder-demand.committedShortage;
    const reorderGap=includeReorder?Math.max(0,reorderLevel-projectedFree):0;
    const recommendedQty=Math.max(0,committedGap+reorderGap);
    if(recommendedQty<=0)continue;
    const soonest=demand.sources.map(x=>x.projectDueDate).filter(Boolean).sort()[0]||null;
    const daysToNeed=soonest?daysBetween(db.meta.today,soonest):null;
    let priority='Replenishment',score=35;
    if(demand.committedShortage>0){priority='Committed shortage';score=78;if(daysToNeed!==null&&daysToNeed<=7){priority='Blocking / near-term';score=96;}else if(daysToNeed!==null&&daysToNeed<=14){priority='Upcoming job';score=88;}}
    else if(available<=reorderLevel){priority='Below reorder level';score=58;}
    const supplier=bestSupplierForSku(db,product.sku,recommendedQty);
    rows.push({sku:product.sku,name:product.name,bin:product.bin,onHand:n(product.onHand),allocated:n(product.allocated),available,onOrder,reorderLevel,committedShortage:demand.committedShortage,reorderGap,recommendedQty,priority,priorityScore:score,daysToNeed,needBy:soonest,sources:demand.sources,bestSupplier:supplier.best,alternatives:supplier.offers.slice(1,4)});
  }
  const out=rows.sort((a,b)=>b.priorityScore-a.priorityScore||(a.daysToNeed??999)-(b.daysToNeed??999)||a.name.localeCompare(b.name));
  return urgentOnly?out.filter(x=>x.priorityScore>=78):out;
}

export function buildPickList(db,{salesOrderId=null,readyOnly=false}={}){
  const orders=salesOrderId?[db.salesOrders?.[salesOrderId]].filter(Boolean):Object.values(db.salesOrders||{}).filter(so=>!readyOnly||/ready|allocated/i.test(so.status||''));
  const rows=[];
  for(const so of orders){
    const project=db.projects?.[so.projectId];
    for(const l of so.lines||[]){
      const p=db.products?.[l.sku],needed=Math.max(0,n(l.qty)),allocated=Math.max(0,lineAllocated(l)||Math.min(needed,n(p?.allocated))),available=free(p);
      rows.push({salesOrderId:so.id,projectId:so.projectId||null,projectName:project?.name||null,status:so.status,sku:l.sku,name:l.name||p?.name||l.sku,qty:needed,allocatedQty:allocated,pickQty:Math.min(needed,allocated||available),bin:p?.bin||'No bin recorded',available,shortfall:Math.max(0,needed-(allocated||available))});
    }
  }
  rows.sort((a,b)=>String(a.bin).localeCompare(String(b.bin))||a.salesOrderId.localeCompare(b.salesOrderId));
  const shortfall=rows.reduce((s,x)=>s+x.shortfall,0);
  return {salesOrderId:salesOrderId||null,orders:[...new Set(rows.map(x=>x.salesOrderId))],rows,shortfall,printable:rows.length>0};
}

export function supplierScorecards(db){
  return Object.values(db.suppliers||{}).map(s=>{
    const perf=s.performance||{};
    const orders=n(perf.orders),onTime=n(perf.onTime),late=n(perf.late),short=n(perf.shortDeliveries),damaged=n(perf.damagedDeliveries);
    const onTimePct=orders?Number((onTime/orders*100).toFixed(1)):null;
    const issueRate=orders?Number(((late+short+damaged)/orders*100).toFixed(1)):null;
    let reliability='Not enough history';if(orders>=3){if((onTimePct??0)>=90&&issueRate<=15)reliability='Strong';else if((onTimePct??0)>=75)reliability='Watch';else reliability='Weak';}
    return {supplierId:s.id,supplier:s.name,orders,onTime,late,shortDeliveries:short,damagedDeliveries:damaged,onTimePct,issueRate,avgLeadTimeDays:perf.avgLeadTimeDays??null,reliability,creditLimit:s.creditLimit,outstandingBalance:s.outstandingBalance};
  }).sort((a,b)=>(b.onTimePct??-1)-(a.onTimePct??-1)||a.supplier.localeCompare(b.supplier));
}

export function threeWayMatch(db,billId){
  const bill=db.supplierBills?.[billId];if(!bill)return null;
  const pos=(bill.linkedPoIds||[]).map(id=>db.purchaseOrders?.[id]).filter(Boolean);
  const receipts=Object.values(db.goodsReceipts||{}).filter(r=>(bill.linkedPoIds||[]).includes(r.poId));
  const poLines=pos.flatMap(po=>(po.lines||[]).map(l=>({...l,poId:po.id})));
  const receiptLines=receipts.flatMap(r=>(r.lines||[]).map(l=>({...l,receiptId:r.id,poId:r.poId})));
  const billLines=bill.lines||[];
  const skus=[...new Set([...poLines.map(x=>x.sku),...receiptLines.map(x=>x.sku),...billLines.map(x=>x.sku)])];
  const lines=skus.map(sku=>{
    const p=poLines.filter(x=>x.sku===sku),r=receiptLines.filter(x=>x.sku===sku),b=billLines.filter(x=>x.sku===sku);
    const ordered=p.reduce((s,x)=>s+n(x.qty),0),received=r.filter(x=>x.qc!=='Rejected').reduce((s,x)=>s+n(x.qty),0),billed=b.reduce((s,x)=>s+n(x.qty),0);
    const poUnit=p.length?n(p[0].unitCost):null,billUnit=b.length?n(b[0].unitCost):null;
    const qtyMatch=billed<=received&&billed<=ordered;
    const priceMatch=poUnit===null||billUnit===null||Math.abs(poUnit-billUnit)<0.005;
    return {sku,ordered,received,billed,poUnit,billUnit,qtyMatch,priceMatch,ok:qtyMatch&&priceMatch};
  });
  const exceptions=lines.filter(x=>!x.ok);
  const poNet=poLines.reduce((s,x)=>s+n(x.qty)*n(x.unitCost),0),receivedNet=receiptLines.reduce((s,x)=>s+n(x.qty)*n(x.unitCost),0),billNet=n(bill.amountNet);
  return {billId:bill.id,invoiceNumber:bill.invoiceNumber,supplier:bill.supplier,linkedPoIds:bill.linkedPoIds||[],poNet:Number(poNet.toFixed(2)),receivedNet:Number(receivedNet.toFixed(2)),billNet,status:exceptions.length?'Review':'Matched',exceptions,lines};
}

export function cycleCountPlan(db,{limit=8}={}){
  const counts=db.stockCounts||[],today=db.meta.today;
  const movementCounts={};
  for(const e of db.events||[]){const sku=e.sku||e.productSku||null;if(sku)movementCounts[sku]=(movementCounts[sku]||0)+1;}
  return Object.values(db.products||{}).map(p=>{
    const last=counts.filter(c=>c.sku===p.sku).sort((a,b)=>String(b.countedAt).localeCompare(String(a.countedAt)))[0]||null;
    const age=last?daysBetween(String(last.countedAt).slice(0,10),today):999;
    const discrepancy=last?Math.abs(n(last.actual)-n(last.expected)):0;
    const pressure=n(p.allocated)+n(p.onOrder)+(movementCounts[p.sku]||0);
    const score=Math.min(100,Math.round(Math.min(age,90)*.65+Math.min(pressure,25)*1.2+discrepancy*10));
    return {sku:p.sku,name:p.name,bin:p.bin,lastCountedAt:last?.countedAt||null,lastExpected:last?.expected??null,lastActual:last?.actual??null,daysSinceCount:age,movementPressure:pressure,score,reason:!last?'No recorded cycle count':discrepancy?`Last count differed by ${discrepancy}`:age>30?`${age} days since last count`:'High allocation/movement pressure'};
  }).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,n(limit)||8));
}

export function exceptionInbox(db,user,{limit=20}={}){
  const rows=[];
  const has=p=>user?.permissions?.includes(p);
  if(has('purchasing.read')){
    for(const po of Object.values(db.purchaseOrders||{})){
      const missing=(po.lines||[]).reduce((s,l)=>s+Math.max(0,n(l.qty)-n(l.received)),0);if(!missing)continue;
      const late=daysLate(po.expectedDate,db.meta.today);if(late>0||!po.expectedDate)rows.push({id:`ex-po-${po.id}`,severity:late>0?92:78,kind:'purchasing',title:`${po.id} ${late>0?`${late} days late`:'has no ETA'}`,summary:`${missing} unit(s) remain outstanding with ${po.supplier}.`,record:{type:'po',id:po.id}});
    }
    for(const d of buildProcurementDemand(db,{urgentOnly:true}))rows.push({id:`ex-buy-${d.sku}`,severity:d.priorityScore,kind:'buying',title:`Order ${d.name}`,summary:`Recommended ${d.recommendedQty}; ${d.committedShortage} committed unit(s) are uncovered.`,record:{type:'product',id:d.sku}});
  }
  if(has('finance.read')){
    for(const b of Object.values(db.supplierBills||{})){const m=threeWayMatch(db,b.id);if(m&&m.status==='Review')rows.push({id:`ex-match-${b.id}`,severity:90,kind:'invoice_match',title:`Review ${b.supplier} ${b.invoiceNumber}`,summary:`Supplier invoice does not fully match PO/receipt data.`,record:{type:'bill',id:b.id}});}
  }
  if(has('stock.read'))for(const c of cycleCountPlan(db,{limit:3}))if(c.score>=60)rows.push({id:`ex-count-${c.sku}`,severity:65,kind:'cycle_count',title:`Count ${c.name}`,summary:`${c.bin}: ${c.reason}.`,record:{type:'product',id:c.sku}});
  return rows.sort((a,b)=>b.severity-a.severity).slice(0,limit);
}

export function chemicalSafety(db,sku){
  const p=db.products?.[sku];if(!p)return null;
  const docs=(p.safetyDocIds||[]).map(id=>db.safetyDocuments?.[id]).filter(Boolean);
  return {sku:p.sku,name:p.name,category:p.category||null,documents:docs,current:docs.filter(d=>d.status==='Current'),warning:docs.length?'Follow the stored COSHH assessment and product SDS. Azzy summarises recorded controls only.':'No safety document is recorded against this product.'};
}
