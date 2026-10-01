/* Pool Shed Project Financial Reports.
 * One reporting model feeds the live Project report, PDF and Excel exports.
 * Operational ledgers remain authoritative: SO/quotes for revenue, PO/PI for purchasing,
 * project ledger for direct cost, labour/tool registers for time-based cost, Xero-backed
 * finance documents for invoiced/paid/outstanding cash.
 */
let psProjectReportChartMode='profit';

function psProjectReportArray(v){return Array.isArray(v)?v:[];}
function psProjectReportNum(v){v=Number(v);return Number.isFinite(v)?v:0;}
function psProjectReportRound(v){return Math.round((psProjectReportNum(v)+Number.EPSILON)*100)/100;}
function psProjectReportPence(v){return Math.round(psProjectReportNum(v)*100);}
function psProjectReportIso(value){
 if(!value)return '';
 const text=String(value),match=text.match(/\/Date\((\d+)/);
 if(match)return new Date(Number(match[1])).toISOString().slice(0,10);
 if(/^\d{4}-\d{2}-\d{2}/.test(text))return text.slice(0,10);
 const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):'';
}
function psProjectReportDateLabel(value){
 const iso=psProjectReportIso(value);if(!iso)return 'Not set';
 return new Date(iso+'T12:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Europe/London'});
}
function psProjectReportDocGrossPence(doc){
 const remote=doc?.remote||{};
 if(Number.isFinite(Number(remote.Total)))return psProjectReportPence(remote.Total);
 return psProjectReportPence(psProjectReportNum(doc?.amount_due)+psProjectReportNum(doc?.amount_paid)+psProjectReportNum(doc?.amount_credited));
}
function psProjectReportDocNetInfo(doc){
 const remote=doc?.remote||{},payload=doc?.payload||{};
 if(Number.isFinite(Number(remote.SubTotal)))return {value:psProjectReportPence(remote.SubTotal),exact:true};
 const lines=psProjectReportArray(remote.LineItems).length?remote.LineItems:psProjectReportArray(payload.LineItems);
 if(lines.length){
  let found=false,total=0;
  lines.forEach(line=>{
   let amount=line?.LineAmount;
   if(!Number.isFinite(Number(amount))&&Number.isFinite(Number(line?.Quantity))&&Number.isFinite(Number(line?.UnitAmount)))amount=Number(line.Quantity)*Number(line.UnitAmount);
   if(Number.isFinite(Number(amount))){found=true;total+=Number(amount);}
  });
  if(found)return {value:psProjectReportPence(total),exact:true};
 }
 return {value:psProjectReportDocGrossPence(doc),exact:false};
}
function psProjectReportDocNumber(doc){return String(doc?.xero_number||doc?.remote?.InvoiceNumber||doc?.remote?.Reference||doc?.id||'Awaiting number');}
function psProjectReportDocStatus(doc){return String(doc?.status||doc?.remote?.Status||'Unknown');}
function psProjectReportProductName(line,source){
 const product=psProjectReportArray(source.products).find(p=>String(p.id)===String(line?.productId));
 return String(line?.variant||line?.description||line?.name||line?.title||product?.name||line?.productName||line?.productId||'Custom item');
}
function psProjectReportProductSku(line,source){
 const product=psProjectReportArray(source.products).find(p=>String(p.id)===String(line?.productId));
 return String(line?.sku||product?.sku||line?.productId||'CUSTOM');
}
function psProjectReportOrderNetPence(order,source){
 try{return typeof psProjectSalesOrderNet==='function'?psProjectSalesOrderNet(order,source):0;}catch{return 0;}
}
function psProjectReportOriginal(job,p,s,source){
 const originalLink=psProjectReportArray(p.quoteLinks).find(x=>x.role==='Original');
 const quoteId=String(originalLink?.quoteId||p.quoteRef||'').split(/\s+v\d+$/i)[0];
 const quote=psProjectReportArray(source.quotes).find(q=>String(q.id)===quoteId);
 let quoteTotals={net:0,cost:0};
 try{if(quote&&typeof psProjectQuoteSnapshotTotals==='function')quoteTotals=psProjectQuoteSnapshotTotals(quote);}catch{}
 const revenue=Number(s.quote||0)||psProjectReportPence(quoteTotals.net||p.quoteNet||0);
 const explicitCost=psProjectReportNum(p.originalCostBudget)||psProjectReportNum(quoteTotals.cost);
 const costKnown=explicitCost>0;
 const cost=psProjectReportPence(explicitCost);
 const profit=costKnown?revenue-cost:null;
 const margin=costKnown&&revenue>0?100*profit/revenue:null;
 return {revenue,cost,costKnown,profit,margin,quoteId:quoteId||String(p.quoteRef||'')};
}
function psProjectReportFinance(job,s){
 const finance=typeof psFinanceSnapshot==='function'?(psFinanceSnapshot()||{}):{};
 const docs=psProjectReportArray(finance.documents),orderIds=new Set(psProjectReportArray(s.orders).map(o=>String(o.id))),poIds=new Set(psProjectReportArray(s.poRows).map(r=>String(r.po.id)));
 const projectPrefix='PROJECT:'+job.id+':';
 const receivables=docs.filter(d=>d?.kind==='ACCREC'&&(orderIds.has(String(d.source_id))||String(d.source_id||'').startsWith(projectPrefix)));
 const payables=docs.filter(d=>d?.kind==='ACCPAY'&&poIds.has(String(d.source_id)));
 return {finance,receivables,payables};
}
function psProjectReportSnapshotRow(job,s,reason,at){
 return {
  at:new Date(at||Date.now()).toISOString(),reason:reason||'Project report refreshed',
  revenue:Number(s.revenue||0),actual:Number(s.actual||0),committed:Number(s.committedCosts||0),
  forecast:Number(s.forecast||0),profit:Number(s.profit||0),margin:s.margin===null?null:Number(s.margin)
 };
}
function psProjectReportSnapshotSignature(row){
 return [row.revenue,row.actual,row.committed,row.forecast,row.profit,row.margin===null?'':row.margin.toFixed(4)].join('|');
}
function psProjectReportRecordSnapshot(job,s,reason,at){
 const p=psProjectModel(job);p.reportSnapshots=psProjectReportArray(p.reportSnapshots);
 const row=psProjectReportSnapshotRow(job,s,reason,at),last=p.reportSnapshots[p.reportSnapshots.length-1];
 if(last&&psProjectReportSnapshotSignature(last)===psProjectReportSnapshotSignature(row))return false;
 p.reportSnapshots.push(row);if(p.reportSnapshots.length>180)p.reportSnapshots=p.reportSnapshots.slice(-180);
 try{if(typeof saveAppData==='function')saveAppData();}catch{}
 return true;
}
function psProjectReportModel(job,source=data,now=Date.now()){
 const p=psProjectModel(job),s=psProjectSummary(job,source,now),original=psProjectReportOriginal(job,p,s,source),finance=psProjectReportFinance(job,s);
 const receivableBySource=new Map(finance.receivables.map(d=>[String(d.source_id),d])),payableBySource=new Map(finance.payables.map(d=>[String(d.source_id),d]));
 const invoiceRows=finance.receivables.map(doc=>{
  const net=psProjectReportDocNetInfo(doc),gross=psProjectReportDocGrossPence(doc);
  return {id:String(doc.id||''),reference:psProjectReportDocNumber(doc),sourceId:String(doc.source_id||''),date:psProjectReportIso(doc.remote?.DateString||doc.remote?.Date||doc.issue_date||doc.created_at),dueDate:psProjectReportIso(doc.remote?.DueDateString||doc.remote?.DueDate||doc.due_date),net:net.value,gross,paid:psProjectReportPence(doc.amount_paid),outstanding:psProjectReportPence(doc.amount_due),status:psProjectReportDocStatus(doc),exactNet:net.exact};
 });
 const purchaseInvoices=finance.payables.map(doc=>{
  const po=psProjectReportArray(s.poRows).find(r=>String(r.po.id)===String(doc.source_id))?.po;
  const net=psProjectReportDocNetInfo(doc),gross=psProjectReportDocGrossPence(doc);
  return {id:String(doc.id||''),reference:psProjectReportDocNumber(doc),poId:String(doc.source_id||''),supplier:String(po?.supplier||doc.remote?.Contact?.Name||'Supplier'),date:psProjectReportIso(doc.remote?.DateString||doc.remote?.Date||doc.issue_date||doc.created_at),dueDate:psProjectReportIso(doc.remote?.DueDateString||doc.remote?.DueDate||doc.due_date),net:net.value,gross,vat:Math.max(0,gross-net.value),paid:psProjectReportPence(doc.amount_paid),outstanding:psProjectReportPence(doc.amount_due),status:psProjectReportDocStatus(doc),exactNet:net.exact};
 });
 const financePayableSources=new Set(finance.payables.map(d=>String(d.source_id||'')));
 psProjectReportArray(s.poRows).forEach(row=>{
  const po=row.po;if(financePayableSources.has(String(po.id)))return;
  const grossValue=psProjectReportNum(po.supplierInvoiceTotal||po.invoiceTotal||0),reference=String(po.supplierInvoiceRef||po.invoiceRef||'').trim();
  if(!grossValue&&!reference)return;
  const gross=psProjectReportPence(grossValue),net=Number(row.total||gross);
  purchaseInvoices.push({id:'PO-FALLBACK-'+po.id,reference:reference||('PI for '+po.id),poId:String(po.id),supplier:String(po.supplier||'Supplier'),date:psProjectReportIso(po.supplierInvoiceDate||po.invoiceDate||po.date),dueDate:psProjectReportIso(po.paymentDue||po.due),net,gross,vat:Math.max(0,gross-net),paid:psProjectReportArray(po.payments).reduce((n,pay)=>n+psProjectReportPence(pay.amount),0),outstanding:Math.max(0,gross-psProjectReportArray(po.payments).reduce((n,pay)=>n+psProjectReportPence(pay.amount),0)),status:'Recorded on PO',exactNet:false});
 });
 const salesOrders=psProjectReportArray(s.orders).map(order=>{
  const doc=receivableBySource.get(String(order.id)),net=psProjectReportOrderNetPence(order,source),fallbackPaid=psProjectReportArray(order.payments).reduce((n,pay)=>n+psProjectReportPence(pay.amount),0);
  return {id:String(order.id),status:String(order.status||'Open'),quoteRef:String(order.quoteRef||''),scope:order.variationId?'Extra':'Original',net,paid:doc?psProjectReportPence(doc.amount_paid):fallbackPaid,invoiced:doc?psProjectReportDocNetInfo(doc).value:0,outstanding:doc?psProjectReportPence(doc.amount_due):0};
 });
 const poRows=psProjectReportArray(s.poRows).map(row=>{
  const po=row.po,doc=payableBySource.get(String(po.id)),bill=doc?psProjectReportDocNetInfo(doc):{value:0,exact:true},fallbackPaid=psProjectReportArray(po.payments).reduce((n,pay)=>n+psProjectReportPence(pay.amount),0);
  return {id:String(po.id),supplier:String(po.supplier||'Supplier'),status:String(po.status||'Draft'),date:psProjectReportIso(po.date||po.orderDate||po.createdAt),due:psProjectReportIso(po.due||po.eta||po.expectedDate),ordered:Number(row.total||0),received:Number(row.received||0),open:Number(row.open||0),invoiced:doc?bill.value:(psProjectReportNum(po.supplierInvoiceTotal||po.invoiceTotal)?psProjectReportPence(po.supplierInvoiceTotal||po.invoiceTotal):0),paid:doc?psProjectReportPence(doc.amount_paid):fallbackPaid,outstanding:doc?psProjectReportPence(doc.amount_due):Math.max(0,psProjectReportPence(po.supplierInvoiceTotal||po.invoiceTotal||0)-fallbackPaid),billReference:doc?psProjectReportDocNumber(doc):String(po.supplierInvoiceRef||po.invoiceRef||''),exactNet:doc?bill.exact:!psProjectReportNum(po.supplierInvoiceTotal||po.invoiceTotal),lines:psProjectReportArray(row.lines).map(line=>{const unit=psProjectReportNum(line.unitCost??line.cost??source.products?.find(x=>x.id===line.productId)?.cost);return {name:psProjectReportProductName(line,source),sku:psProjectReportProductSku(line,source),qty:psProjectReportNum(line.qty),received:psProjectReportNum(line.received),unitCost:unit,lineCost:psProjectReportPence(psProjectReportNum(line.qty)*unit)};})};
 });
 const supplierMap=new Map();poRows.forEach(row=>{const key=row.supplier,current=supplierMap.get(key)||{supplier:key,ordered:0,received:0,open:0,invoiced:0,paid:0,outstanding:0,pos:[]};current.ordered+=row.ordered;current.received+=row.received;current.open+=row.open;current.invoiced+=row.invoiced;current.paid+=row.paid;current.outstanding+=row.outstanding;current.pos.push(row);supplierMap.set(key,current);});
 const suppliers=[...supplierMap.values()].sort((a,b)=>b.ordered-a.ordered);
 const customerCash=invoiceRows.reduce((n,r)=>n+r.paid,0)+salesOrders.filter(o=>!receivableBySource.has(o.id)).reduce((n,o)=>n+o.paid,0);
 const supplierCash=purchaseInvoices.reduce((n,r)=>n+r.paid,0)+poRows.filter(o=>!payableBySource.has(o.id)).reduce((n,o)=>n+o.paid,0);
 const directActual=psProjectReportArray(p.costs).filter(c=>!c.voidedAt&&c.state==='Actual'&&!c.poId).reduce((n,c)=>n+psProjectReportPence(c.net),0);
 const cashPosition=customerCash-supplierCash-directActual;
 const today=psProjectUKDate(now),target=psProjectReportIso(p.targetCompletion);
 let horizonDays=30;if(target&&target>today)horizonDays=Math.max(7,Math.min(365,Math.ceil((Date.parse(target+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000)));
 const activeLabour=psProjectReportArray(p.labour).filter(a=>a.ongoing&&String(a.startDate||'')<=today),labourDaily=activeLabour.reduce((n,a)=>n+psProjectReportPence(a.rate||0),0);
 const activeHire=psProjectReportArray(source.toolAssignments).filter(a=>String(a.jobId)===String(job.id)&&a.chargeModel==='calendar-day'&&!a.lastChargeDate),hireDaily=activeHire.reduce((n,a)=>n+psProjectReportPence(a.dailyRate||0),0);
 const futureKnown=Math.max(0,Number(s.forecast||0)-Number(s.actual||0)-Number(s.tools||0)-Number(s.labourFuture||0));
 const spreadDaily=Math.round(futureKnown/horizonDays),dailyBurn=Math.max(0,labourDaily+hireDaily+spreadDaily);
 const daysToZero=cashPosition>0&&dailyBurn>0?Math.max(0,Math.floor(cashPosition/dailyBurn)):cashPosition<=0?0:null;
 const zeroDate=daysToZero===null?'':new Date(Date.parse(today+'T12:00:00Z')+daysToZero*86400000).toISOString().slice(0,10);
 const nextCustomerDue=invoiceRows.filter(r=>r.outstanding>0&&r.dueDate).sort((a,b)=>a.dueDate.localeCompare(b.dueDate))[0]||null;
 const runway={cashPosition,dailyBurn,daysToZero,zeroDate,nextCustomerDue,horizonDays,customerCash,supplierCash,directActual,activeLabour:activeLabour.length,activeHire:activeHire.length,scenario:true};
 const costSources=[
  {name:'Actual recorded costs',value:Number(s.actual||0),kind:'actual'},
  {name:'Received PO estimates',value:Number(s.estimatedReceived||0),kind:'committed'},
  {name:'Outstanding commitments',value:Number(s.committed||0),kind:'committed'},
  {name:'Remaining forecast',value:Number(s.uncommitted||0),kind:'forecast'},
  {name:'Tools and hire',value:Number(s.tools||0),kind:'forecast'},
  {name:'Future labour',value:Number(s.labourFuture||0),kind:'forecast'}
 ].filter(x=>x.value>0);
 const labour=psProjectReportArray(p.labour).map(a=>{const c=psProjectLabourCharge(a,now),rateType=String(a.rateType||'day');return {id:String(a.id||''),person:String(a.supplier||a.employee||'Team').trim().replace(/\\s+/g,' '),reference:String(a.ref||''),start:String(a.startDate||''),end:a.ongoing?'Ongoing':String(a.endDate||''),rate:psProjectReportPence(a.rate||0),rateType,units:c.units,forecastUnits:c.forecastUnits,dayEquivalent:c.units*(rateType==='half-day'?0.5:1),forecastDayEquivalent:c.forecastUnits*(rateType==='half-day'?0.5:1),accrued:psProjectReportPence(c.accrued),forecast:psProjectReportPence(c.forecast),ongoing:!!a.ongoing};});
 const labourPeopleMap=new Map();
 labour.forEach(row=>{
  const key=(row.person||'Team').trim().replace(/\\s+/g,' ').toLocaleLowerCase('en-GB'),existing=labourPeopleMap.get(key)||{person:row.person||'Team',entries:0,firstStart:'',lastEnd:'',ongoing:false,fullDays:0,halfDays:0,forecastFullDays:0,forecastHalfDays:0,equivalentDays:0,forecastEquivalentDays:0,accrued:0,forecast:0,remainingForecast:0,references:[]};
  existing.entries++;
  if(!existing.firstStart||row.start<existing.firstStart)existing.firstStart=row.start;
  if(row.ongoing)existing.ongoing=true;
  if(row.end&&row.end!=='Ongoing'&&(!existing.lastEnd||row.end>existing.lastEnd))existing.lastEnd=row.end;
  if(row.rateType==='half-day'){existing.halfDays+=row.units;existing.forecastHalfDays+=row.forecastUnits;}
  else{existing.fullDays+=row.units;existing.forecastFullDays+=row.forecastUnits;}
  existing.equivalentDays+=row.dayEquivalent;existing.forecastEquivalentDays+=row.forecastDayEquivalent;
  existing.accrued+=row.accrued;existing.forecast+=row.forecast;existing.remainingForecast+=Math.max(0,row.forecast-row.accrued);
  if(row.reference&&!existing.references.includes(row.reference))existing.references.push(row.reference);
  labourPeopleMap.set(key,existing);
 });
 const labourByPerson=[...labourPeopleMap.values()].sort((a,b)=>b.accrued-a.accrued||a.person.localeCompare(b.person));
 const tools=psProjectReportArray(source.toolAssignments).filter(a=>String(a.jobId)===String(job.id)).map(a=>{const tool=psProjectReportArray(source.toolAssets).find(t=>String(t.id)===String(a.toolId)),c=psProjectToolCharge(a,now);return {id:String(a.id||''),name:String(tool?.name||a.name||a.toolId||'Equipment'),supplier:String(a.supplier||tool?.supplier||''),reference:String(a.reference||''),start:String(a.startDate||psProjectReportIso(a.startedAt)),end:String(a.lastChargeDate||a.returnedAt||a.offHireAt||''),dailyRate:psProjectReportPence(a.dailyRate||0),purchaseNet:psProjectReportPence(a.purchaseNet||0),accrued:psProjectReportPence(c.accrued),forecast:psProjectReportPence(c.forecast),running:!!c.running,mode:a.chargeModel==='purchase'?'Purchase':'Hire'};});
 const checks=[];
 if(s.missingCosts)checks.push({severity:'bad',text:s.missingCosts+' material line'+(s.missingCosts===1?' has':'s have')+' missing or zero cost.'});
 const receivedNoBill=poRows.filter(r=>r.received>0&&!r.invoiced);if(receivedNoBill.length)checks.push({severity:'warn',text:receivedNoBill.length+' received PO'+(receivedNoBill.length===1?' has':'s have')+' no linked supplier invoice/PI yet.'});
 const inexact=[...invoiceRows,...purchaseInvoices].filter(r=>!r.exactNet);if(inexact.length)checks.push({severity:'warn',text:inexact.length+' finance document'+(inexact.length===1?' uses':'s use')+' gross fallback because an exact net subtotal is unavailable.'});
 const noRate=psProjectReportArray(p.labour).filter(a=>!psProjectReportNum(a.rate));if(noRate.length)checks.push({severity:'bad',text:noRate.length+' labour period'+(noRate.length===1?' is':'s are')+' missing a cost rate.'});
 const noCategory=psProjectReportArray(p.costs).filter(c=>!c.voidedAt&&!String(c.category||'').trim());if(noCategory.length)checks.push({severity:'warn',text:noCategory.length+' project cost'+(noCategory.length===1?' needs':'s need')+' a category.'});
 const customerOutstanding=invoiceRows.reduce((n,r)=>n+r.outstanding,0);if(customerOutstanding>0)checks.push({severity:'warn',text:psProjectCash(customerOutstanding)+' customer cash is outstanding on linked invoices.'});
 if(!checks.length)checks.push({severity:'good',text:'No current reporting data-quality exceptions were found.'});
 p.reportSnapshots=psProjectReportArray(p.reportSnapshots);
 const current=psProjectReportSnapshotRow(job,s,'Current',now);
 const snapshots=p.reportSnapshots.slice(-24),timeline=snapshots.length?snapshots.slice():[];
 if(!timeline.length&&original.profit!==null)timeline.push({at:p.quoteAcceptedAt||p.acceptedAt||job.createdAt||new Date(now-86400000).toISOString(),reason:'Original plan',revenue:original.revenue,forecast:original.cost,profit:original.profit,margin:original.margin});
 if(!timeline.length||psProjectReportSnapshotSignature(timeline[timeline.length-1])!==psProjectReportSnapshotSignature(current))timeline.push(current);
 const previous=timeline.length>1?timeline[timeline.length-2]:null;
 const transactionLedger=[];
 salesOrders.forEach(o=>transactionLedger.push({date:'',type:'Sales Order',reference:o.id,party:customer(job.customerId)?.name||'',description:o.scope+' scope',revenue:o.net,cost:0,committed:0,paid:o.paid,outstanding:o.outstanding,status:o.status}));
 invoiceRows.forEach(r=>transactionLedger.push({date:r.date,type:'Customer Invoice',reference:r.reference,party:customer(job.customerId)?.name||'',description:r.sourceId,revenue:r.net,cost:0,committed:0,paid:r.paid,outstanding:r.outstanding,status:r.status}));
 poRows.forEach(r=>transactionLedger.push({date:r.date,type:'Purchase Order',reference:r.id,party:r.supplier,description:r.lines.map(l=>l.name).join(', '),revenue:0,cost:0,committed:r.ordered,paid:r.paid,outstanding:r.outstanding,status:r.status}));
 purchaseInvoices.forEach(r=>transactionLedger.push({date:r.date,type:'Purchase Invoice',reference:r.reference,party:r.supplier,description:r.poId,revenue:0,cost:r.net,committed:0,paid:r.paid,outstanding:r.outstanding,status:r.status}));
 psProjectReportArray(p.costs).filter(c=>!c.voidedAt).forEach(c=>transactionLedger.push({date:c.date||'',type:'Project Cost',reference:c.ref||c.id,party:c.supplier||'',description:c.notes||c.category||'',revenue:0,cost:c.state==='Actual'?psProjectReportPence(c.net):0,committed:c.state==='Committed'?psProjectReportPence(c.net):0,paid:0,outstanding:0,status:c.state||''}));
 labour.forEach(r=>transactionLedger.push({date:r.start,type:'Labour',reference:r.reference||r.id,party:r.person,description:r.rateType,revenue:0,cost:r.accrued,committed:Math.max(0,r.forecast-r.accrued),paid:0,outstanding:0,status:r.ongoing?'Ongoing':'Ended'}));
 tools.forEach(r=>transactionLedger.push({date:r.start,type:r.mode==='Purchase'?'Tool Purchase':'Tool Hire',reference:r.reference||r.id,party:r.supplier,description:r.name,revenue:0,cost:r.accrued,committed:Math.max(0,r.forecast-r.accrued),paid:0,outstanding:0,status:r.running?'Running':'Stopped'}));
 return {job,p,s,original,finance,invoiceRows,purchaseInvoices,salesOrders,poRows,suppliers,customerOutstanding,customerCash,supplierCash,cashPosition,runway,costSources,labour,labourByPerson,tools,checks,timeline,previous,transactionLedger,asOf:new Date(now).toISOString()};
}
function psProjectReportMoney(v){return psProjectCash(Number(v||0));}
function psProjectReportPct(v){return v===null||!Number.isFinite(Number(v))?'Not captured':Number(v).toFixed(1)+'%';}
function psProjectReportLabourTime(row,forecast=false){
 const full=Number(forecast?row.forecastFullDays:row.fullDays)||0,half=Number(forecast?row.forecastHalfDays:row.halfDays)||0,equivalent=Number(forecast?row.forecastEquivalentDays:row.equivalentDays)||0,parts=[];
 if(full)parts.push(full+' full day'+(full===1?'':'s'));
 if(half)parts.push(half+' half-day'+(half===1?'':'s'));
 const eq=(Math.round(equivalent*10)/10).toLocaleString('en-GB',{maximumFractionDigits:1});
 return eq+' day'+(equivalent===1?'':'s')+' equivalent'+(parts.length?' · '+parts.join(' + '):'');
}
function psProjectReportVariance(metric,current,original,known=true){
 if(!known)return '<span class="pr-neutral">No original baseline</span>';
 const delta=Number(current||0)-Number(original||0),favourable=metric==='cost'?delta<=0:delta>=0,label=metric==='margin'?Math.abs(delta).toFixed(1)+' pts '+(delta>=0?'up':'down'):psProjectReportMoney(Math.abs(delta))+' '+(delta>=0?(metric==='cost'?'over':'up'):(metric==='cost'?'under':'down'));
 return '<span class="'+(delta===0?'pr-neutral':favourable?'pr-good':'pr-bad')+'">'+psProjectEsc(label)+'</span>';
}
function psProjectReportGraph(model){
 const rows=model.timeline.slice(-12),mode=psProjectReportChartMode;
 if(!rows.length)return '<div class="pr-empty">Profit history will build automatically as project commercial values change.</div>';
 const values=rows.map(r=>mode==='margin'?Number(r.margin||0):Number(r.profit||0)/100),min=Math.min(...values),max=Math.max(...values),span=Math.max(1,max-min),w=900,h=250,pad=36;
 const point=(v,i)=>({x:pad+(rows.length===1?0.5:(i/(rows.length-1)))*(w-pad*2),y:pad+(max-v)/span*(h-pad*2)});
 const pts=values.map(point),path=pts.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
 const dots=pts.map((p,i)=>'<g><circle cx="'+p.x+'" cy="'+p.y+'" r="5"></circle><title>'+psProjectEsc(psProjectReportDateLabel(rows[i].at)+' · '+rows[i].reason+' · '+(mode==='margin'?values[i].toFixed(1)+'%':money(values[i])))+'</title></g>').join('');
 const labels=rows.map((r,i)=>{if(rows.length>6&&i%Math.ceil(rows.length/6)!==0&&i!==rows.length-1)return '';const p=pts[i];return '<text x="'+p.x+'" y="'+(h-8)+'" text-anchor="middle">'+psProjectEsc(new Date(r.at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}))+'</text>';}).join('');
 const grids=[0,.25,.5,.75,1].map(f=>{const y=pad+f*(h-pad*2),v=max-f*span;return '<line x1="'+pad+'" y1="'+y+'" x2="'+(w-pad)+'" y2="'+y+'"></line><text x="'+(pad-8)+'" y="'+(y+4)+'" text-anchor="end">'+psProjectEsc(mode==='margin'?v.toFixed(1)+'%':money(v))+'</text>';}).join('');
 return '<svg class="pr-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+(mode==='margin'?'Margin':'Profit')+' momentum">'+grids+'<path d="'+path+'"></path>'+dots+labels+'</svg>';
}
function psProjectReportBars(model){
 const max=Math.max(1,...model.costSources.map(x=>x.value));
 return '<div class="pr-bars">'+model.costSources.map(x=>'<div class="pr-bar-row"><span>'+psProjectEsc(x.name)+'</span><div><i style="width:'+Math.max(2,Math.round(x.value/max*100))+'%"></i></div><strong>'+psProjectReportMoney(x.value)+'</strong></div>').join('')+'</div>';
}
function psProjectReportRunway(model){
 const r=model.runway,outstanding=model.customerOutstanding;
 if(r.cashPosition<=0)return '<div class="pr-runway is-risk"><span>CASH RUNWAY SCENARIO</span><strong>Recorded project cash position is already '+psProjectReportMoney(Math.abs(r.cashPosition))+' negative.</strong><p>'+psProjectReportMoney(outstanding)+' customer cash is outstanding. This is a management scenario, not a bank forecast.</p></div>';
 if(r.daysToZero===null)return '<div class="pr-runway"><span>CASH RUNWAY SCENARIO</span><strong>No zero-cash date from the current recorded burn.</strong><p>Recorded project cash position is '+psProjectReportMoney(r.cashPosition)+'. Future costs remain visible in forecast cost.</p></div>';
 const due=r.nextCustomerDue,comparison=due?.dueDate?(due.dueDate>r.zeroDate?' The next recorded customer due date is after this runway date.':' The next recorded customer due date is before this runway date.'):'';
 return '<div class="pr-runway '+(r.daysToZero<=14?'is-risk':r.daysToZero<=30?'is-watch':'')+'"><span>CASH RUNWAY SCENARIO · IF NO FURTHER CUSTOMER CASH IS RECEIVED</span><strong>Projected to reach £0 in about '+r.daysToZero+' days · '+psProjectReportDateLabel(r.zeroDate)+'</strong><p>Current recorded project cash '+psProjectReportMoney(r.cashPosition)+' · estimated daily burn '+psProjectReportMoney(r.dailyBurn)+'.'+psProjectEsc(comparison)+' This uses recorded payments, active labour/hire and the remaining project forecast, so it is a management scenario rather than a bank balance forecast.</p></div>';
}
function psProjectReportSupplierDetails(model){
 if(!model.suppliers.length)return '<div class="pr-empty">No project-linked Purchase Orders yet.</div>';
 return model.suppliers.map(s=>'<details class="pr-supplier"><summary><span><strong>'+psProjectEsc(s.supplier)+'</strong><small>'+s.pos.length+' PO'+(s.pos.length===1?'':'s')+'</small></span><span>Ordered '+psProjectReportMoney(s.ordered)+'</span><span>PI '+psProjectReportMoney(s.invoiced)+'</span><span>Paid '+psProjectReportMoney(s.paid)+'</span></summary>'+s.pos.map(po=>'<div class="pr-po"><div class="pr-po-head"><button class="link-button" data-open-po="'+psProjectEsc(po.id)+'">'+psProjectEsc(po.id)+'</button><span>'+psProjectEsc(po.status)+'</span><strong>'+psProjectReportMoney(po.ordered)+'</strong></div>'+psProjectTable(['Item','SKU','Qty','Received','Unit cost','Line total'],po.lines.map(l=>'<tr><td>'+psProjectEsc(l.name)+'</td><td>'+psProjectEsc(l.sku)+'</td><td>'+l.qty+'</td><td>'+l.received+'</td><td>'+money(l.unitCost)+'</td><td>'+psProjectReportMoney(l.lineCost)+'</td></tr>').join(''),'No PO lines.')+'</div>').join('')+'</details>').join('');
}
function psProjectReports(job,p,s){
 const model=psProjectReportModel(job,data,Date.now());psProjectReportRecordSnapshot(job,s,'Report opened');
 const o=model.original,current=model.s,prev=model.previous,target=current.target;
 const originalProfit=o.profit===null?'Not captured':psProjectReportMoney(o.profit),originalMargin=psProjectReportPct(o.margin);
 const status=current.margin===null?'Not set':current.margin<current.minimumMargin?'Below minimum':current.margin<target?'Below target':'Above target';
 const supplierRows=model.suppliers.map(x=>'<tr><td>'+psProjectEsc(x.supplier)+'</td><td>'+psProjectReportMoney(x.ordered)+'</td><td>'+psProjectReportMoney(x.invoiced)+'</td><td>'+psProjectReportMoney(x.paid)+'</td><td>'+psProjectReportMoney(x.outstanding)+'</td><td>'+psProjectReportMoney(x.open)+'</td></tr>').join('');
 const piRows=model.purchaseInvoices.map(x=>'<tr><td>'+psProjectEsc(x.reference)+'</td><td>'+psProjectEsc(x.supplier)+'</td><td>'+psProjectEsc(x.poId)+'</td><td>'+psProjectReportDateLabel(x.date)+'</td><td>'+psProjectReportMoney(x.net)+'</td><td>'+psProjectReportMoney(x.vat)+'</td><td>'+psProjectReportMoney(x.gross)+'</td><td>'+psProjectReportMoney(x.paid)+'</td><td>'+psProjectReportMoney(x.outstanding)+'</td><td>'+psProjectEsc(x.status)+'</td></tr>').join('');
 const revenueRows=model.salesOrders.map(x=>'<tr><td><button class="link-button" data-open-so="'+psProjectEsc(x.id)+'">'+psProjectEsc(x.id)+'</button></td><td>'+psProjectEsc(x.scope)+'</td><td>'+psProjectEsc(x.status)+'</td><td>'+psProjectReportMoney(x.net)+'</td><td>'+psProjectReportMoney(x.invoiced)+'</td><td>'+psProjectReportMoney(x.paid)+'</td><td>'+psProjectReportMoney(x.outstanding)+'</td></tr>').join('');
 const labourRows=model.labourByPerson.map(x=>'<tr><td><strong>'+psProjectEsc(x.person)+'</strong><small>'+x.entries+' labour entr'+(x.entries===1?'y':'ies')+'</small></td><td>'+psProjectReportDateLabel(x.firstStart)+' → '+(x.ongoing?'Ongoing':psProjectReportDateLabel(x.lastEnd))+'</td><td>'+psProjectEsc(psProjectReportLabourTime(x))+'</td><td>'+psProjectReportMoney(x.accrued)+'</td><td>'+psProjectReportMoney(x.remainingForecast)+'</td><td>'+psProjectReportMoney(x.forecast)+'</td></tr>').join('');
 const toolRows=model.tools.map(x=>'<tr><td>'+psProjectEsc(x.name)+'</td><td>'+psProjectEsc(x.supplier)+'</td><td>'+psProjectEsc(x.reference)+'</td><td>'+psProjectEsc(x.mode)+'</td><td>'+psProjectReportDateLabel(x.start)+'</td><td>'+psProjectReportMoney(x.dailyRate||x.purchaseNet)+'</td><td>'+psProjectReportMoney(x.accrued)+'</td><td>'+psProjectReportMoney(x.forecast)+'</td><td>'+(x.running?'Running':'Stopped')+'</td></tr>').join('');
 const compare='<table class="pr-compare"><thead><tr><th>Measure</th><th>Original</th><th>Current forecast</th><th>Movement</th></tr></thead><tbody>'+
  '<tr><td>Revenue</td><td>'+psProjectReportMoney(o.revenue)+'</td><td>'+psProjectReportMoney(current.revenue)+'</td><td>'+psProjectReportVariance('revenue',current.revenue,o.revenue)+'</td></tr>'+
  '<tr><td>Cost</td><td>'+(o.costKnown?psProjectReportMoney(o.cost):'Not captured')+'</td><td>'+psProjectReportMoney(current.forecast)+'</td><td>'+psProjectReportVariance('cost',current.forecast,o.cost,o.costKnown)+'</td></tr>'+
  '<tr><td>Gross profit</td><td>'+originalProfit+'</td><td>'+psProjectReportMoney(current.profit)+'</td><td>'+psProjectReportVariance('profit',current.profit,o.profit,o.profit!==null)+'</td></tr>'+
  '<tr><td>Margin</td><td>'+originalMargin+'</td><td>'+psProjectReportPct(current.margin)+'</td><td>'+psProjectReportVariance('margin',current.margin,o.margin,o.margin!==null)+'</td></tr></tbody></table>';
 const previousStrip=prev?'<div class="pr-since"><span>SINCE LAST REPORT</span><div><b>Revenue</b>'+psProjectReportVariance('revenue',current.revenue,prev.revenue)+'</div><div><b>Forecast cost</b>'+psProjectReportVariance('cost',current.forecast,prev.forecast)+'</div><div><b>Profit</b>'+psProjectReportVariance('profit',current.profit,prev.profit)+'</div><div><b>Margin</b>'+psProjectReportVariance('margin',current.margin,prev.margin,prev.margin!==null)+'</div></div>':'';
 return '<section class="ps-project-report">'+
  '<header class="pr-hero"><div><span class="pl-eyebrow">PROJECT FINANCIAL REPORT · '+psProjectEsc(job.id)+'</span><h2>'+psProjectEsc(job.name)+'</h2><p>'+psProjectEsc(customer(job.customerId)?.name||'No customer')+' · '+psProjectEsc(job.status)+' · As at '+psProjectReportDateLabel(model.asOf)+'</p></div><div class="pr-actions"><button data-project-report-refresh>Refresh report</button><button data-project-report-pdf>Export PDF</button><button class="secondary" data-project-report-excel>Export Excel</button></div></header>'+
  '<div class="pr-kpis">'+
   '<article><span>SOLD VALUE</span><strong>'+psProjectReportMoney(current.revenue)+'</strong><small>Original '+psProjectReportMoney(o.revenue)+'</small>'+psProjectReportVariance('revenue',current.revenue,o.revenue)+'</article>'+
   '<article><span>FORECAST COST</span><strong>'+psProjectReportMoney(current.forecast)+'</strong><small>'+(o.costKnown?'Original '+psProjectReportMoney(o.cost):'Original cost not captured')+'</small>'+psProjectReportVariance('cost',current.forecast,o.cost,o.costKnown)+'</article>'+
   '<article><span>FORECAST PROFIT</span><strong>'+psProjectReportMoney(current.profit)+'</strong><small>Original '+originalProfit+'</small>'+psProjectReportVariance('profit',current.profit,o.profit,o.profit!==null)+'</article>'+
   '<article class="'+(current.margin!==null&&current.margin<current.minimumMargin?'is-risk':'')+'"><span>FORECAST MARGIN</span><strong>'+psProjectReportPct(current.margin)+'</strong><small>Target '+Number(target).toFixed(1)+'% · '+psProjectEsc(status)+'</small>'+psProjectReportVariance('margin',current.margin,o.margin,o.margin!==null)+'</article>'+
  '</div>'+previousStrip+
  '<div class="pr-grid pr-grid-compare"><section class="pr-card"><header><div><span>THEN VS NOW</span><h3>Original plan compared with current forecast</h3></div></header>'+compare+'</section><section class="pr-card"><header><div><span>CASH POSITION</span><h3>Payments and runway</h3></div></header><div class="pr-cash-grid"><div><span>Customer cash received</span><strong>'+psProjectReportMoney(model.customerCash)+'</strong></div><div><span>Supplier cash paid</span><strong>'+psProjectReportMoney(model.supplierCash)+'</strong></div><div><span>Direct actual costs</span><strong>'+psProjectReportMoney(model.runway.directActual)+'</strong></div><div><span>Recorded project cash</span><strong>'+psProjectReportMoney(model.cashPosition)+'</strong></div></div>'+psProjectReportRunway(model)+'</section></div>'+
  '<section class="pr-card"><header><div><span>PROFIT MOMENTUM</span><h3>Direction of travel</h3><p>Snapshots are recorded when the report sees a changed commercial position.</p></div><div class="pr-toggle"><button class="'+(psProjectReportChartMode==='profit'?'active':'')+'" data-project-report-chart="profit">Profit £</button><button class="'+(psProjectReportChartMode==='margin'?'active':'')+'" data-project-report-chart="margin">Margin %</button></div></header>'+psProjectReportGraph(model)+'</section>'+
  '<div class="pr-grid"><section class="pr-card"><header><div><span>WHERE THE MONEY GOES</span><h3>Forecast cost composition</h3></div><strong>'+psProjectReportMoney(current.forecast)+'</strong></header>'+psProjectReportBars(model)+'</section><section class="pr-card"><header><div><span>FINANCIAL HEALTH</span><h3>What needs attention</h3></div></header><div class="pr-checks">'+model.checks.map(c=>'<div class="'+psProjectEsc(c.severity)+'"><span></span><p>'+psProjectEsc(c.text)+'</p></div>').join('')+'</div></section></div>'+
  '<section class="pr-card"><header><div><span>SUPPLIERS & PURCHASE ORDERS</span><h3>Ordered, invoiced and paid</h3><p>PO value is committed cost. Linked PI/bill value is invoiced cost. Supplier payment is cash. They are not added together as separate project costs.</p></div></header>'+psProjectTable(['Supplier','Ordered net','PI net','Paid cash','Outstanding cash','Open PO'],supplierRows,'No project supplier spend yet.')+psProjectReportSupplierDetails(model)+'</section>'+
  '<section class="pr-card"><header><div><span>PURCHASE INVOICES / PI</span><h3>Supplier bill register</h3></div></header>'+psProjectTable(['PI / invoice','Supplier','PO','Date','Net','VAT','Gross','Paid','Outstanding','Status'],piRows,'No linked supplier invoices / PIs yet.')+'</section>'+
  '<section class="pr-card"><header><div><span>SALES & REVENUE</span><h3>From sold value to cash received</h3></div><div class="pr-mini-total"><span>Not yet invoiced</span><strong>'+psProjectReportMoney(Math.max(0,current.revenue-model.invoiceRows.reduce((n,r)=>n+r.net,0)))+'</strong></div></header><div class="pr-revenue-strip"><div><span>Original contract</span><strong>'+psProjectReportMoney(o.revenue)+'</strong></div><div><span>Approved extras</span><strong>'+psProjectReportMoney(current.approvedExtra)+'</strong></div><div><span>Current sold value</span><strong>'+psProjectReportMoney(current.revenue)+'</strong></div><div><span>Invoiced net</span><strong>'+psProjectReportMoney(model.invoiceRows.reduce((n,r)=>n+r.net,0))+'</strong></div><div><span>Cash received</span><strong>'+psProjectReportMoney(model.customerCash)+'</strong></div><div><span>Outstanding cash</span><strong>'+psProjectReportMoney(model.customerOutstanding)+'</strong></div></div>'+psProjectTable(['Sales Order','Scope','Status','Sell net','Invoiced net','Paid cash','Outstanding cash'],revenueRows,'No linked Sales Orders.')+'</section>'+
  '<div class="pr-grid"><section class="pr-card"><header><div><span>LABOUR</span><h3>Labour cost performance</h3></div><strong>'+psProjectReportMoney(current.labourForecast)+'</strong></header>'+psProjectTable(['Person','Period','Time worked','Cost to date','Remaining forecast','Forecast total'],labourRows,'No project labour periods.')+'</section><section class="pr-card"><header><div><span>HIRE & TOOLS</span><h3>Equipment cost</h3></div><strong>'+psProjectReportMoney(current.tools)+'</strong></header>'+psProjectTable(['Item','Supplier','Ref','Type','Start','Rate / cost','Accrued','Forecast','Status'],toolRows,'No project tools or hire.')+'</section></div>'+
  '<section class="pr-card"><header><div><span>RECONCILIATION</span><h3>How forecast profit is built</h3></div></header><div class="pr-reconcile">'+model.costSources.map(x=>'<div><span>'+psProjectEsc(x.name)+'</span><strong>'+psProjectReportMoney(x.value)+'</strong></div>').join('')+'<div class="total"><span>Forecast final cost</span><strong>'+psProjectReportMoney(current.forecast)+'</strong></div><div><span>Total sold value</span><strong>'+psProjectReportMoney(current.revenue)+'</strong></div><div class="profit"><span>Forecast gross profit</span><strong>'+psProjectReportMoney(current.profit)+'</strong></div><div class="profit"><span>Forecast margin</span><strong>'+psProjectReportPct(current.margin)+'</strong></div></div></section>'+
 '</section>';
}
function psProjectReportFilename(model,ext){const safe=String(model.job.name||model.job.id).replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||model.job.id;return 'Pool-Bros-'+safe+'-Financial-Report-'+psProjectUKDate()+'.'+ext;}
function psProjectReportPdf(model){
 const C=window.jspdf;
 if(!C?.jsPDF||typeof C.jsPDF.API.autoTable!=='function'){psProjectReportPrint(model);return;}
 const doc=new C.jsPDF({unit:'mm',format:'a4',orientation:'portrait'});
 const brand=[15,27,36],aqua=[24,124,140],ink=[23,36,44],muted=[92,105,113],green=[39,130,91],amber=[192,122,32],red=[185,71,79],light=[244,246,245],line=[214,222,225],white=[255,255,255];
 const moneyP=v=>'£'+(Number(v||0)/100).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
 const pct=v=>v===null||!Number.isFinite(Number(v))?'Not captured':Number(v).toFixed(1)+'%';
 const customerName=customer(model.job.customerId)?.name||'No customer';
 const pageMeta=new Map();
 const size=()=>({w:doc.internal.pageSize.getWidth(),h:doc.internal.pageSize.getHeight()});
 const meta=(title,sub)=>pageMeta.set(doc.internal.getCurrentPageInfo().pageNumber,{title,sub});
 const drawHeader=(title,sub)=>{
  const {w}=size();
  doc.setFillColor(...brand);doc.rect(0,0,w,24,'F');
  doc.setTextColor(...white);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text('POOL BROS',14,9);
  doc.setFontSize(8);doc.setFont('helvetica','normal');doc.text('PROJECT FINANCIAL REPORT',14,15);
  doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(title,w-14,9,{align:'right'});
  if(sub){doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text(doc.splitTextToSize(sub,95),w-14,14,{align:'right'});}
  doc.setTextColor(...ink);meta(title,sub);
 };
 const addPage=(orientation,title,sub)=>{
  doc.addPage('a4',orientation||'portrait');drawHeader(title,sub||model.job.name+' · '+model.job.id);
 };
 const drawFooterForPage=pageNo=>{
  doc.setPage(pageNo);const {w,h}=size(),m=pageMeta.get(pageNo)||{};
  doc.setDrawColor(...line);doc.line(14,h-13,w-14,h-13);
  doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(6.8);
  doc.text(model.job.id+' · '+model.job.name,14,h-7);
  doc.text('Management report · project accounting values exclude VAT unless explicitly labelled gross/cash',w/2,h-7,{align:'center'});
  doc.text(pageNo+' / '+doc.internal.getNumberOfPages(),w-14,h-7,{align:'right'});
 };
 const section=(title,eyebrow,y=33)=>{
  const {w}=size();doc.setTextColor(...muted);doc.setFont('helvetica','bold');doc.setFontSize(7.2);doc.text(String(eyebrow||'').toUpperCase(),14,y);
  doc.setTextColor(...ink);doc.setFontSize(14);doc.text(title,14,y+7);
  doc.setDrawColor(...line);doc.line(14,y+11,w-14,y+11);return y+17;
 };
 const note=(text,y,tone='neutral')=>{
  const {w}=size(),palette=tone==='bad'?red:tone==='warn'?amber:tone==='good'?green:aqua;
  const lines=doc.splitTextToSize(text,w-36),h=Math.max(15,8+lines.length*4.1);
  doc.setFillColor(...light);doc.setDrawColor(...palette);doc.setLineWidth(.8);doc.roundedRect(14,y,w-28,h,2,2,'FD');
  doc.setFillColor(...palette);doc.rect(14,y,3,h,'F');
  doc.setTextColor(...ink);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(lines,21,y+6);return y+h;
 };
 const empty=(label,y)=>{
  const {w}=size();doc.setFillColor(...light);doc.roundedRect(14,y,w-28,18,2,2,'F');
  doc.setTextColor(...muted);doc.setFont('helvetica','italic');doc.setFontSize(8.5);doc.text(label,20,y+11);return y+18;
 };
 const table=(head,body,y,opts={})=>{
  if(!body?.length)return empty(opts.empty||'No records to show for this section.',y);
  const currentMeta=pageMeta.get(doc.internal.getCurrentPageInfo().pageNumber)||{};
  doc.autoTable({
   head:[head],body,startY:y,theme:'grid',showHead:'everyPage',rowPageBreak:'avoid',
   margin:{left:14,right:14,top:31,bottom:18},
   styles:{font:'helvetica',fontSize:opts.fontSize||8.1,cellPadding:{top:2.2,right:2,bottom:2.2,left:2},textColor:ink,lineColor:line,lineWidth:.15,valign:'middle',overflow:'linebreak'},
   headStyles:{fillColor:brand,textColor:white,fontStyle:'bold',fontSize:opts.headFontSize||7.6,halign:'left'},
   alternateRowStyles:{fillColor:light},
   columnStyles:opts.columnStyles||{},
   didParseCell:data=>{
    if(opts.rightCols?.includes(data.column.index))data.cell.styles.halign='right';
    if(opts.centerCols?.includes(data.column.index))data.cell.styles.halign='center';
    if(opts.boldCols?.includes(data.column.index)&&data.section==='body')data.cell.styles.fontStyle='bold';
   },
   didDrawPage:()=>{
    const info=doc.internal.getCurrentPageInfo(),existing=pageMeta.get(info.pageNumber);
    if(!existing)drawHeader(currentMeta.title||'Project detail',currentMeta.sub||model.job.name+' · '+model.job.id);
   },
   ...opts.autoTable
  });
  return doc.lastAutoTable.finalY;
 };
 const kpi=(x,y,w,h,label,value,sub,tone='neutral')=>{
  const border=tone==='bad'?red:tone==='warn'?amber:tone==='good'?green:line;
  doc.setFillColor(...white);doc.setDrawColor(...border);doc.setLineWidth(.45);doc.roundedRect(x,y,w,h,2.5,2.5,'FD');
  doc.setTextColor(...muted);doc.setFont('helvetica','bold');doc.setFontSize(6.8);doc.text(label,x+4,y+7);
  doc.setTextColor(...ink);doc.setFontSize(15);doc.text(value,x+4,y+17);
  doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text(doc.splitTextToSize(sub||'',w-8),x+4,y+23);
 };
 const variance=(current,original,type)=>{
  if(original===null||original===undefined)return 'No original baseline';
  const d=Number(current||0)-Number(original||0);
  if(type==='margin')return (d>=0?'+':'')+d.toFixed(1)+' pts';
  return (d>=0?'+':'-')+moneyP(Math.abs(d));
 };
 const allPoLines=[];
 model.poRows.forEach(po=>po.lines.forEach(line=>allPoLines.push([po.supplier,po.id,line.name,line.sku,String(line.qty),String(line.received),moneyP(Math.round(Number(line.unitCost||0)*100)),moneyP(line.lineCost)])));

 const statementRows=[];
 const statementDate=v=>psProjectReportIso(v)||'';
 const statementCash=(amount,direction)=>!amount?'—':(direction==='in'?'+':'-')+moneyP(Math.abs(amount));
 const addStatement=(row)=>statementRows.push({
  date:statementDate(row.date),type:String(row.type||''),reference:String(row.reference||''),party:String(row.party||''),
  description:String(row.description||''),stage:String(row.stage||''),value:Number(row.value||0),cash:String(row.cash||'—'),
  outstanding:Number(row.outstanding||0),status:String(row.status||'')
 });
 psProjectReportArray(model.s.quoteRows).forEach(q=>addStatement({
  date:q.acceptedAt,type:q.role==='Original'?'Quote':'Quote / '+q.role,reference:q.quoteId||q.variationId||model.original.quoteId||'Quote',
  party:customerName,description:q.title||q.role,stage:q.status==='Accepted'?'Accepted commercial evidence':'Commercial evidence',
  value:Number(q.sellNet||0),cash:'—',outstanding:0,status:q.status
 }));
 model.salesOrders.forEach(o=>{
  const raw=psProjectReportArray(model.s.orders).find(x=>String(x.id)===String(o.id))||{};
  addStatement({date:raw.orderDate||raw.date||raw.createdAt,type:'Sales Order',reference:o.id,party:customerName,
   description:o.scope+' project revenue',stage:'Sold value',value:o.net,cash:o.paid?statementCash(o.paid,'in'):'—',outstanding:o.outstanding,status:o.status});
 });
 model.invoiceRows.forEach(r=>addStatement({date:r.date,type:'Customer Invoice',reference:r.reference,party:customerName,
  description:'Linked to '+(r.sourceId||'project'),stage:'Customer invoice',value:r.net,cash:r.paid?statementCash(r.paid,'in'):'—',outstanding:r.outstanding,status:r.status}));
 model.poRows.forEach(po=>{
  addStatement({date:po.date,type:'Purchase Order',reference:po.id,party:po.supplier,description:'Supplier order',
   stage:'Committed cost',value:po.ordered,cash:po.paid?statementCash(po.paid,'out'):'—',outstanding:po.outstanding,status:po.status});
  po.lines.forEach(line=>addStatement({date:po.date,type:'PO Line',reference:po.id,party:po.supplier,
   description:line.name+' · '+line.sku+' · Qty '+line.qty+' · Received '+line.received,stage:'Order line detail',
   value:line.lineCost,cash:'—',outstanding:0,status:po.status}));
 });
 model.purchaseInvoices.forEach(r=>addStatement({date:r.date,type:'Purchase Invoice / PI',reference:r.reference,party:r.supplier,
  description:'Linked PO '+r.poId,stage:'Supplier invoice',value:r.net,cash:r.paid?statementCash(r.paid,'out'):'—',outstanding:r.outstanding,status:r.status}));
 psProjectReportArray(model.p.costs).filter(c=>!c.voidedAt).forEach(c=>addStatement({date:c.date||c.createdAt,type:'Project Cost',reference:c.ref||c.id||'Cost',
  party:c.supplier||'',description:c.notes||c.category||'Project cost',stage:c.state==='Actual'?'Actual project cost':'Committed project cost',
  value:psProjectReportPence(c.net),cash:'—',outstanding:0,status:c.state||''}));
 model.labour.forEach(r=>addStatement({date:r.start,type:'Labour',reference:r.reference||r.id,party:r.person,
  description:(r.end==='Ongoing'?'Ongoing from '+psProjectReportDateLabel(r.start):psProjectReportDateLabel(r.start)+' to '+psProjectReportDateLabel(r.end))+' · Forecast '+moneyP(r.forecast),
  stage:'Labour cost',value:r.accrued,cash:'—',outstanding:Math.max(0,r.forecast-r.accrued),status:r.ongoing?'Ongoing':'Ended'}));
 model.tools.forEach(r=>addStatement({date:r.start,type:r.mode==='Purchase'?'Tool Purchase':'Hire / Tool',reference:r.reference||r.id,party:r.supplier,
  description:r.name+' · Forecast '+moneyP(r.forecast),stage:r.mode==='Purchase'?'Purchased equipment':'Equipment cost',
  value:r.accrued,cash:'—',outstanding:Math.max(0,r.forecast-r.accrued),status:r.running?'Running':'Stopped'}));
 statementRows.sort((a,b)=>{
  const ad=a.date||'9999-12-31',bd=b.date||'9999-12-31';
  return ad.localeCompare(bd)||a.type.localeCompare(b.type)||a.reference.localeCompare(b.reference);
 });

 drawHeader('Executive summary',model.job.name+' · '+model.job.id+' · '+psProjectReportDateLabel(model.asOf));
 doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(21);doc.text(model.job.name,14,38);
 doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...muted);
 doc.text(customerName+' · '+model.job.status+' · Owner: '+(model.job.owner||'Unassigned'),14,45);
 doc.text('As at '+psProjectReportDateLabel(model.asOf)+' · Project '+model.job.id,14,51);

 const marginTone=model.s.margin!==null&&model.s.margin<model.s.minimumMargin?'bad':model.s.margin!==null&&model.s.margin<model.s.target?'warn':'good';
 kpi(14,58,87,33,'SOLD VALUE',moneyP(model.s.revenue),'Original '+moneyP(model.original.revenue),'neutral');
 kpi(109,58,87,33,'FORECAST FINAL COST',moneyP(model.s.forecast),model.original.costKnown?'Original '+moneyP(model.original.cost):'Original cost not captured',model.original.costKnown&&model.s.forecast>model.original.cost?'warn':'neutral');
 kpi(14,98,87,33,'FORECAST GROSS PROFIT',moneyP(model.s.profit),model.original.profit===null?'Original profit not captured':'Original '+moneyP(model.original.profit),model.s.profit<0?'bad':'good');
 kpi(109,98,87,33,'FORECAST MARGIN',pct(model.s.margin),'Target '+Number(model.s.target||0).toFixed(1)+'% · Minimum '+Number(model.s.minimumMargin||0).toFixed(1)+'%',marginTone);

 let y=section('Original plan vs current forecast','Commercial movement',143);
 y=table(['Measure','Original','Current forecast','Movement'],[
  ['Revenue',moneyP(model.original.revenue),moneyP(model.s.revenue),variance(model.s.revenue,model.original.revenue,'money')],
  ['Cost',model.original.costKnown?moneyP(model.original.cost):'Not captured',moneyP(model.s.forecast),model.original.costKnown?variance(model.s.forecast,model.original.cost,'money'):'No baseline'],
  ['Gross profit',model.original.profit===null?'Not captured':moneyP(model.original.profit),moneyP(model.s.profit),model.original.profit===null?'No baseline':variance(model.s.profit,model.original.profit,'money')],
  ['Margin',pct(model.original.margin),pct(model.s.margin),model.original.margin===null?'No baseline':variance(model.s.margin,model.original.margin,'margin')]
 ],y,{rightCols:[1,2,3],boldCols:[0]});
 y+=8;
 const runwayTone=model.runway.cashPosition<=0||model.runway.daysToZero!==null&&model.runway.daysToZero<=14?'bad':model.runway.daysToZero!==null&&model.runway.daysToZero<=30?'warn':'good';
 const runwayTitle=model.runway.cashPosition<=0
  ?'Recorded project cash position is already '+moneyP(Math.abs(model.runway.cashPosition))+' negative.'
  :model.runway.daysToZero===null
   ?'No zero-cash date from the current recorded burn.'
   :'If no further customer cash is received, project cash reaches £0 in about '+model.runway.daysToZero+' days · '+psProjectReportDateLabel(model.runway.zeroDate)+'.';
 y=note(runwayTitle+' Recorded project cash '+moneyP(model.runway.cashPosition)+' · estimated daily burn '+moneyP(model.runway.dailyBurn)+' · customer cash outstanding '+moneyP(model.customerOutstanding)+'. This is a management scenario, not a bank balance forecast.',y,runwayTone);

 addPage('portrait','Profit & cost movement');
 y=section('Profit momentum','Direction of travel',34);
 const rows=model.timeline.slice(-16),vals=rows.map(r=>Number(r.profit||0)/100);
 if(rows.length){
  const {w}=size(),left=27,top=y+4,width=w-47,height=66,min=Math.min(...vals),max=Math.max(...vals),span=Math.max(1,max-min);
  doc.setDrawColor(...line);doc.setLineWidth(.25);
  for(let i=0;i<=4;i++){const gy=top+i*height/4;doc.line(left,gy,left+width,gy);}
  doc.setDrawColor(...aqua);doc.setLineWidth(1.2);let prev=null;
  vals.forEach((v,i)=>{const x=left+(rows.length===1 ? .5 : i/(rows.length-1))*width,yy=top+(max-v)/span*height;if(prev)doc.line(prev.x,prev.y,x,yy);doc.setFillColor(...aqua);doc.circle(x,yy,1.8,'F');prev={x,y:yy};});
  doc.setFontSize(7);doc.setTextColor(...muted);doc.text(moneyP(Math.round(max*100)),14,top+2);doc.text(moneyP(Math.round(min*100)),14,top+height);
  const step=Math.max(1,Math.ceil(rows.length/5));rows.forEach((r,i)=>{if(i%step&&i!==rows.length-1)return;const x=left+(rows.length===1 ? .5 : i/(rows.length-1))*width;doc.text(new Date(r.at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}),x,top+height+7,{align:'center'});});
  y=top+height+18;
 }else y=empty('Profit history will build automatically as project commercial values change.',y);
 y=section('Forecast cost composition','Where the money goes',y);
 if(model.costSources.length){
  const maxCost=Math.max(1,...model.costSources.map(x=>x.value));
  model.costSources.forEach(x=>{
   const {w}=size();doc.setTextColor(...ink);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(x.name,14,y+4);
   doc.setFillColor(230,236,236);doc.roundedRect(68,y,90,5,2,2,'F');doc.setFillColor(...aqua);doc.roundedRect(68,y,90*x.value/maxCost,5,2,2,'F');
   doc.setFont('helvetica','bold');doc.text(moneyP(x.value),w-14,y+4,{align:'right'});y+=11;
  });
  doc.setDrawColor(...line);doc.line(14,y,196,y);y+=7;doc.setFontSize(10);doc.setFont('helvetica','bold');doc.text('Forecast final cost',14,y);doc.text(moneyP(model.s.forecast),196,y,{align:'right'});
 }else y=empty('No project cost sources have been recorded.',y);

 addPage('portrait','Management overview');
 y=section('Revenue & cash','Management view',34);
 const invoicedNet=model.invoiceRows.reduce((n,r)=>n+r.net,0),notInvoiced=Math.max(0,model.s.revenue-invoicedNet);
 kpi(14,y,87,31,'CURRENT SOLD VALUE',moneyP(model.s.revenue),'Accepted project revenue','neutral');
 kpi(109,y,87,31,'INVOICED NET',moneyP(invoicedNet),'Customer invoices linked to this project','neutral');
 y+=38;
 kpi(14,y,87,31,'CUSTOMER CASH RECEIVED',moneyP(model.customerCash),'Cash recorded against linked customer invoices','good');
 kpi(109,y,87,31,'OUTSTANDING CUSTOMER CASH',moneyP(model.customerOutstanding),notInvoiced?moneyP(notInvoiced)+' also not yet invoiced':'All sold value is invoiced',model.customerOutstanding>0?'warn':'good');
 y+=45;
 y=section('Purchasing & supplier position','Cost control',y);
 const poOrdered=model.poRows.reduce((n,r)=>n+r.ordered,0),piNet=model.purchaseInvoices.reduce((n,r)=>n+r.net,0),poOpen=model.poRows.reduce((n,r)=>n+r.open,0);
 kpi(14,y,87,31,'PO ORDERED',moneyP(poOrdered),'Current supplier commitments','neutral');
 kpi(109,y,87,31,'PI / SUPPLIER INVOICED',moneyP(piNet),'Supplier invoices linked to project','neutral');
 y+=38;
 kpi(14,y,87,31,'SUPPLIER CASH PAID',moneyP(model.supplierCash),'Recorded supplier payments','neutral');
 kpi(109,y,87,31,'OPEN PO COMMITMENT',moneyP(poOpen),'Still open on linked Purchase Orders',poOpen>0?'warn':'good');
 y+=45;
 y=section('Largest supplier commitments','Quick supplier view',y);
 if(model.suppliers.length){
  const topSuppliers=model.suppliers.slice().sort((a,b)=>b.ordered-a.ordered).slice(0,5),maxSupplier=Math.max(1,...topSuppliers.map(x=>x.ordered));
  topSuppliers.forEach(sup=>{
   doc.setTextColor(...ink);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(doc.splitTextToSize(sup.supplier,48),14,y+4);
   doc.setFillColor(230,236,236);doc.roundedRect(68,y,90,5,2,2,'F');doc.setFillColor(...aqua);doc.roundedRect(68,y,90*sup.ordered/maxSupplier,5,2,2,'F');
   doc.setFont('helvetica','bold');doc.text(moneyP(sup.ordered),196,y+4,{align:'right'});y+=11;
  });
 }else y=empty('No linked supplier commitments yet.',y);
 y+=5;
 const issueCount=model.checks.filter(x=>x.severity==='bad'||x.severity==='warn').length;
 y=note(issueCount?issueCount+' financial reporting check'+(issueCount===1?' needs':'s need')+' attention. Full details are included in the appendix.':'No current financial reporting exceptions were found. Full source detail is included in the appendix.',y,issueCount?'warn':'good');

 addPage('portrait','Detailed appendix');
 const {w:appendixW,h:appendixH}=size();
 doc.setTextColor(...muted);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('DETAILED PROJECT STATEMENT & AUDIT APPENDIX',14,47);
 doc.setTextColor(...ink);doc.setFontSize(25);doc.text('Every record behind the report',14,62);
 doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(...muted);
 doc.text(doc.splitTextToSize('The following pages show the detailed Sales Orders, customer invoices, supplier commitments, Purchase Order lines, purchase invoices, labour, hire/tools and project ledger records that sit behind the management summary.',175),14,74);
 doc.setFillColor(...light);doc.setDrawColor(...line);doc.roundedRect(14,102,182,52,3,3,'FD');
 doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('Important: lifecycle records are linked, not additive.',20,114);
 doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...muted);
 doc.text(doc.splitTextToSize('A PO, its PI and its supplier payment can describe the same underlying spend at different stages. Likewise, a quote, Sales Order, invoice and payment can describe the same customer revenue. The reconciled totals shown in this report count each commercial amount once.',166),20,123);
 doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('Use the appendix to trace a number back to its source record.',14,171);
 doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...muted);
 doc.text('The final Detailed Project Statement is chronological and includes every reporting record currently linked to this project.',14,181);

 addPage('landscape','Appendix · Sales & customer invoices');
 y=section('Sales Orders','Revenue source',34);
 y=table(['Sales Order','Scope','Status','Sell net','Invoiced net','Paid cash','Outstanding cash'],model.salesOrders.map(x=>[x.id,x.scope,x.status,moneyP(x.net),moneyP(x.invoiced),moneyP(x.paid),moneyP(x.outstanding)]),y,{
  empty:'No linked Sales Orders.',
  rightCols:[3,4,5,6],boldCols:[0],
  columnStyles:{0:{cellWidth:30},1:{cellWidth:26},2:{cellWidth:27},3:{cellWidth:34},4:{cellWidth:34},5:{cellWidth:34},6:{cellWidth:38}}
 });
 y=doc.lastAutoTable?.finalY||y;y+=10;
 if(y>170){addPage('landscape','Appendix · Customer invoices');y=34;}
 else y=section('Customer invoices','Invoiced and paid',y);
 table(['Invoice','Source','Invoice date','Due date','Net','Gross','Paid cash','Outstanding cash','Status'],model.invoiceRows.map(x=>[x.reference,x.sourceId,psProjectReportDateLabel(x.date),psProjectReportDateLabel(x.dueDate),moneyP(x.net),moneyP(x.gross),moneyP(x.paid),moneyP(x.outstanding),x.status]),y,{
  empty:'No linked customer invoices.',
  rightCols:[4,5,6,7],boldCols:[0],
  columnStyles:{0:{cellWidth:28},1:{cellWidth:30},2:{cellWidth:27},3:{cellWidth:27},4:{cellWidth:30},5:{cellWidth:30},6:{cellWidth:30},7:{cellWidth:34},8:{cellWidth:28}}
 });

 addPage('landscape','Appendix · Suppliers & Purchase Orders');
 y=section('Supplier summary','Committed, invoiced and paid',34);
 y=table(['Supplier','Ordered net','PI net','Paid cash','Outstanding cash','Open PO'],model.suppliers.map(x=>[x.supplier,moneyP(x.ordered),moneyP(x.invoiced),moneyP(x.paid),moneyP(x.outstanding),moneyP(x.open)]),y,{
  empty:'No project supplier spend yet.',
  rightCols:[1,2,3,4,5],boldCols:[0],
  columnStyles:{0:{cellWidth:70},1:{cellWidth:38},2:{cellWidth:38},3:{cellWidth:38},4:{cellWidth:40},5:{cellWidth:38}}
 });
 y=(doc.lastAutoTable?.finalY||y)+10;
 if(y>170){addPage('landscape','Appendix · Purchase Order summary');y=34;}else y=section('Purchase Order summary','One row per PO',y);
 table(['PO','Supplier','Status','Ordered','Received','Open','PI net','Paid','Outstanding'],model.poRows.map(x=>[x.id,x.supplier,x.status,moneyP(x.ordered),moneyP(x.received),moneyP(x.open),moneyP(x.invoiced),moneyP(x.paid),moneyP(x.outstanding)]),y,{
  empty:'No linked Purchase Orders.',
  rightCols:[3,4,5,6,7,8],boldCols:[0],
  columnStyles:{0:{cellWidth:25},1:{cellWidth:55},2:{cellWidth:27},3:{cellWidth:30},4:{cellWidth:30},5:{cellWidth:30},6:{cellWidth:30},7:{cellWidth:30},8:{cellWidth:34}}
 });

 addPage('landscape','Appendix · Purchase Order line detail');
 y=section('Purchase Order product lines','Full supplier cost detail',34);
 table(['Supplier','PO','Product / description','SKU','Qty','Received','Unit cost','Line total'],allPoLines,y,{
  empty:'No Purchase Order product lines.',
  rightCols:[4,5,6,7],boldCols:[1],
  fontSize:7.8,
  columnStyles:{0:{cellWidth:45},1:{cellWidth:23},2:{cellWidth:78},3:{cellWidth:31},4:{cellWidth:18},5:{cellWidth:21},6:{cellWidth:30},7:{cellWidth:32}}
 });

 addPage('landscape','Appendix · Purchase invoices / PI');
 y=section('Purchase invoices / PI','Supplier bill register',34);
 table(['PI / invoice','Supplier','PO','Invoice date','Due date','Net','VAT','Gross','Paid','Outstanding','Status'],model.purchaseInvoices.map(x=>[x.reference,x.supplier,x.poId,psProjectReportDateLabel(x.date),psProjectReportDateLabel(x.dueDate),moneyP(x.net),moneyP(x.vat),moneyP(x.gross),moneyP(x.paid),moneyP(x.outstanding),x.status]),y,{
  empty:'No linked supplier invoices / PIs.',
  rightCols:[5,6,7,8,9],boldCols:[0],
  fontSize:7.5,
  columnStyles:{0:{cellWidth:25},1:{cellWidth:42},2:{cellWidth:22},3:{cellWidth:25},4:{cellWidth:25},5:{cellWidth:26},6:{cellWidth:24},7:{cellWidth:27},8:{cellWidth:27},9:{cellWidth:32},10:{cellWidth:24}}
 });

 addPage('landscape','Appendix · Labour');
 y=section('Labour cost performance','Project time cost',34);
 table(['Person','Entries','Period','Time worked','Cost to date','Remaining forecast','Forecast total'],model.labourByPerson.map(x=>[
  x.person,
  String(x.entries),
  psProjectReportDateLabel(x.firstStart)+' → '+(x.ongoing?'Ongoing':psProjectReportDateLabel(x.lastEnd)),
  psProjectReportLabourTime(x),
  moneyP(x.accrued),
  moneyP(x.remainingForecast),
  moneyP(x.forecast)
 ]),y,{
  empty:'No project labour periods.',
  rightCols:[1,4,5,6],boldCols:[0],
  fontSize:7.8,
  columnStyles:{0:{cellWidth:45},1:{cellWidth:20},2:{cellWidth:53},3:{cellWidth:73},4:{cellWidth:32},5:{cellWidth:36},6:{cellWidth:34}}
 });

 addPage('landscape','Appendix · Hire & tools');
 y=section('Hire & tools','Equipment cost',34);
 table(['Item','Supplier','Reference','Type','Start','End','Daily rate','Purchase cost','Accrued','Forecast','Status'],model.tools.map(x=>[x.name,x.supplier,x.reference,x.mode,psProjectReportDateLabel(x.start),x.end?psProjectReportDateLabel(x.end):'Open',moneyP(x.dailyRate),moneyP(x.purchaseNet),moneyP(x.accrued),moneyP(x.forecast),x.running?'Running':'Stopped']),y,{
  empty:'No project tools or hire records.',
  rightCols:[6,7,8,9],boldCols:[0],
  fontSize:7.6,
  columnStyles:{0:{cellWidth:46},1:{cellWidth:40},2:{cellWidth:28},3:{cellWidth:21},4:{cellWidth:26},5:{cellWidth:26},6:{cellWidth:28},7:{cellWidth:31},8:{cellWidth:29},9:{cellWidth:29},10:{cellWidth:24}}
 });

 addPage('portrait','Appendix · Reconciliation & checks');
 y=section('Forecast reconciliation','Every cost counted once',34);
 y=table(['Cost source','Amount'],model.costSources.map(x=>[x.name,moneyP(x.value)]).concat([
  ['Forecast final cost',moneyP(model.s.forecast)],
  ['Total sold value',moneyP(model.s.revenue)],
  ['Forecast gross profit',moneyP(model.s.profit)],
  ['Forecast margin',pct(model.s.margin)]
 ]),y,{rightCols:[1],boldCols:[0],columnStyles:{0:{cellWidth:118},1:{cellWidth:58}}});
 y=(doc.lastAutoTable?.finalY||y)+10;
 if(y>205){addPage('portrait','Appendix · Financial data checks');y=34;}else y=section('Financial data checks','Exceptions that affect confidence',y);
 if(model.checks.length){
  model.checks.forEach(c=>{
   if(y>260){addPage('portrait','Financial data checks');y=34;}
   const tone=c.severity==='bad'?'bad':c.severity==='warn'?'warn':'good';y=note(c.text,y,tone)+5;
  });
 }else y=empty('No financial data-quality exceptions were found.',y);

 addPage('landscape','Detailed Project Statement');
 y=section('Detailed Project Statement','Chronological source record',34);
 y=note('This statement lists every project reporting record currently linked to the financial report. Lifecycle rows are intentionally not additive: for example PO → PI → payment are stages of the same spend. Use the reconciled closing position below for authoritative totals.',y,'neutral')+7;
 const statementBody=statementRows.map(r=>[
  r.date?psProjectReportDateLabel(r.date):'Undated',
  r.type+(r.reference?'\\n'+r.reference:''),
  r.party||'—',
  r.description||'—',
  r.stage||'—',
  r.value?moneyP(r.value):'—',
  r.cash||'—',
  (r.outstanding?moneyP(r.outstanding):'—')+(r.status?'\\n'+r.status:'')
 ]);
 y=table(['Date','Record / reference','Supplier / customer','Description','Financial stage','Net value','Cash movement','Outstanding / status'],statementBody,y,{
  empty:'No detailed project records are linked yet.',
  rightCols:[5,6,7],boldCols:[1],
  fontSize:7.1,headFontSize:7,
  columnStyles:{0:{cellWidth:20},1:{cellWidth:34},2:{cellWidth:35},3:{cellWidth:63},4:{cellWidth:34},5:{cellWidth:29},6:{cellWidth:29},7:{cellWidth:35}},
  autoTable:{margin:{left:8,right:8,top:31,bottom:18}}
 });
 y=(doc.lastAutoTable?.finalY||y)+10;
 if(y>165){addPage('landscape','Detailed Project Statement · closing position');y=34;}
 else y=section('Reconciled closing position','Authoritative project totals',y);
 table(['Closing measure','Amount'],[
  ['Current sold value',moneyP(model.s.revenue)],
  ['Customer invoices net',moneyP(invoicedNet)],
  ['Customer cash received',moneyP(model.customerCash)],
  ['Customer cash outstanding',moneyP(model.customerOutstanding)],
  ['Forecast final project cost',moneyP(model.s.forecast)],
  ['Supplier cash paid',moneyP(model.supplierCash)],
  ['Forecast gross profit',moneyP(model.s.profit)],
  ['Forecast margin',pct(model.s.margin)]
 ],y,{rightCols:[1],boldCols:[0],columnStyles:{0:{cellWidth:130},1:{cellWidth:55}}});

 const pages=doc.internal.getNumberOfPages();
 for(let i=1;i<=pages;i++)drawFooterForPage(i);
 doc.setProperties({title:model.job.name+' Financial Report',subject:'Pool Bros project financial management report',author:'Pool Bros',creator:'Pool Shed'});
 doc.save(psProjectReportFilename(model,'pdf'));
}
function psProjectReportPrint(model){
 const win=window.open('','_blank','noopener,noreferrer');if(!win){toast('Allow pop-ups to export this report.');return;}
 const report=document.querySelector('.ps-project-report')?.outerHTML||'<h1>'+psProjectEsc(model.job.name)+'</h1>';win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+psProjectEsc(model.job.name)+'</title><link rel="stylesheet" href="./assets/css/app.css"></head><body>'+report+'<script>addEventListener("load",()=>print())<\/script></body></html>');win.document.close();
}
function psProjectReportSheet(rows,widths){
 const XLSX=window.XLSX,ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=(widths||[]).map(w=>({wch:w}));
 if(rows.length>1)ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length-1,c:Math.max(0,rows[0].length-1)}})};
 return ws;
}
function psProjectReportExcel(model){
 if(!window.XLSX){psProjectReportExcelFallback(model);return;}
 const X=window.XLSX,wb=X.utils.book_new(),p=v=>Number(v||0)/100,pct=v=>v===null?'':Number(v)/100;
 const add=(name,rows,widths)=>X.utils.book_append_sheet(wb,psProjectReportSheet(rows,widths),name);
 add('Dashboard',[
  ['POOL SHED PROJECT FINANCIAL REPORT','','',''],
  ['Project',model.job.name,'Project ID',model.job.id],
  ['Customer',customer(model.job.customerId)?.name||'','As at',psProjectReportDateLabel(model.asOf)],
  [],
  ['KPI','Original','Current forecast','Variance'],
  ['Revenue',p(model.original.revenue),p(model.s.revenue),p(model.s.revenue-model.original.revenue)],
  ['Cost',model.original.costKnown?p(model.original.cost):'',p(model.s.forecast),model.original.costKnown?p(model.s.forecast-model.original.cost):''],
  ['Gross profit',model.original.profit===null?'':p(model.original.profit),p(model.s.profit),model.original.profit===null?'':p(model.s.profit-model.original.profit)],
  ['Margin',pct(model.original.margin),pct(model.s.margin),model.original.margin===null?'':pct(model.s.margin-model.original.margin)],
  ['Target margin','',pct(model.s.target),''],
  [],
  ['Cash position','Value'],
  ['Customer cash received',p(model.customerCash)],
  ['Supplier cash paid',p(model.supplierCash)],
  ['Recorded project cash',p(model.cashPosition)],
  ['Estimated daily burn',p(model.runway.dailyBurn)],
  ['Days to £0 if no further customer cash',model.runway.daysToZero===null?'No depletion date':model.runway.daysToZero],
  ['Projected £0 date',model.runway.zeroDate||'']
 ],[34,20,34,20]);
 add('Revenue',[['Type','Reference','Scope / source','Status','Net sold / invoice','Paid cash','Outstanding cash']].concat(
  model.salesOrders.map(x=>['Sales Order',x.id,x.scope,x.status,p(x.net),p(x.paid),p(x.outstanding)]),
  model.invoiceRows.map(x=>['Customer Invoice',x.reference,x.sourceId,x.status,p(x.net),p(x.paid),p(x.outstanding)])
 ),[18,22,30,18,18,18,18]);
 const supplierLines=[['Supplier','PO','Status','Item','SKU','Qty','Received','Unit cost','Line total','PI ref','PI net','Paid cash','Outstanding cash']];
 model.poRows.forEach(po=>po.lines.forEach(line=>supplierLines.push([po.supplier,po.id,po.status,line.name,line.sku,line.qty,line.received,line.unitCost,p(line.lineCost),po.billReference,p(po.invoiced),p(po.paid),p(po.outstanding)])));
 add('Suppliers',supplierLines,[24,18,15,36,18,10,10,14,16,20,16,16,18]);
 add('Purchase Invoices',[['PI / Invoice','Supplier','PO','Date','Due','Net','VAT','Gross','Paid','Outstanding','Status']].concat(model.purchaseInvoices.map(x=>[x.reference,x.supplier,x.poId,x.date,x.dueDate,p(x.net),p(x.vat),p(x.gross),p(x.paid),p(x.outstanding),x.status])),[22,24,18,14,14,16,14,16,16,18,16]);
 add('Labour',[['Person','Entries','First date','Last date / status','Full days','Half-days','Days equivalent','Cost to date','Remaining forecast','Forecast total']].concat(model.labourByPerson.map(x=>[x.person,x.entries,x.firstStart,x.ongoing?'Ongoing':x.lastEnd,x.fullDays,x.halfDays,x.equivalentDays,p(x.accrued),p(x.remainingForecast),p(x.forecast)])),[26,10,14,18,12,12,16,16,18,16]);
 add('Labour Detail',[['Person','Reference','Start','End','Rate type','Rate','Accrued units','Forecast units','Accrued cost','Forecast cost']].concat(model.labour.map(x=>[x.person,x.reference,x.start,x.end,x.rateType,p(x.rate),x.units,x.forecastUnits,p(x.accrued),p(x.forecast)])),[24,20,14,14,14,14,14,14,16,16]);
 add('Hire & Tools',[['Item','Supplier','Reference','Type','Start','End','Daily rate','Purchase cost','Accrued','Forecast','Status']].concat(model.tools.map(x=>[x.name,x.supplier,x.reference,x.mode,x.start,x.end,p(x.dailyRate),p(x.purchaseNet),p(x.accrued),p(x.forecast),x.running?'Running':'Stopped'])),[28,24,20,12,14,14,14,16,16,16,14]);
 add('Cost Breakdown',[['Cost source','Actual / Forecast value']].concat(model.costSources.map(x=>[x.name,p(x.value)]),[['Forecast final cost',p(model.s.forecast)],['Forecast gross profit',p(model.s.profit)],['Forecast margin',pct(model.s.margin)]]),[34,22]);
 add('Profit Timeline',[['Date','Reason','Revenue','Actual cost','Committed cost','Forecast final cost','Forecast profit','Margin']].concat(model.timeline.map(x=>[x.at,x.reason,p(x.revenue),p(x.actual),p(x.committed),p(x.forecast),p(x.profit),pct(x.margin)])),[24,32,16,16,18,20,18,14]);
 add('Transaction Ledger',[['Date','Type','Reference','Supplier / Customer','Description','Revenue','Cost','Committed','Paid','Outstanding','Status']].concat(model.transactionLedger.map(x=>[x.date,x.type,x.reference,x.party,x.description,p(x.revenue),p(x.cost),p(x.committed),p(x.paid),p(x.outstanding),x.status])),[14,20,22,26,40,16,16,16,16,18,16]);
 add('Financial Checks',[['Severity','Check']].concat(model.checks.map(x=>[x.severity.toUpperCase(),x.text])),[14,90]);
 Object.values(wb.Sheets).forEach(ws=>{Object.keys(ws).forEach(addr=>{if(addr[0]==='!')return;const cell=ws[addr];if(typeof cell.v==='number'){const col=X.utils.decode_cell(addr).c;cell.z=col>=1?'£#,##0.00;[Red]-£#,##0.00':'0.00';}});});
 X.writeFile(wb,psProjectReportFilename(model,'xlsx'),{compression:true});
}
function psProjectReportExcelFallback(model){
 const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const rows=[
  ['Metric','Value'],['Sold value',psProjectReportMoney(model.s.revenue)],['Forecast cost',psProjectReportMoney(model.s.forecast)],['Forecast profit',psProjectReportMoney(model.s.profit)],['Forecast margin',psProjectReportPct(model.s.margin)],['Cash position',psProjectReportMoney(model.cashPosition)]
 ];
 const xml='<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Dashboard"><Table>'+rows.map(r=>'<Row>'+r.map(v=>'<Cell><Data ss:Type="String">'+esc(v)+'</Data></Cell>').join('')+'</Row>').join('')+'</Table></Worksheet></Workbook>';
 const a=document.createElement('a'),url=URL.createObjectURL(new Blob([xml],{type:'application/vnd.ms-excel'}));a.href=url;a.download=psProjectReportFilename(model,'xml');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Excel library was unavailable, so an Excel-compatible XML workbook was exported.');
}
(function(){
 document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  try{
   if(b.hasAttribute('data-project-report-refresh')){const job=data.jobs.find(j=>j.id===psProjectSelected);if(!job)return;psProjectReportRecordSnapshot(job,psProjectSummary(job),'Manual report refresh');if(typeof psFinanceRefresh==='function')await psFinanceRefresh();render();return;}
   if(b.hasAttribute('data-project-report-chart')){psProjectReportChartMode=b.dataset.projectReportChart==='margin'?'margin':'profit';render();return;}
   if(b.hasAttribute('data-project-report-pdf')){const job=data.jobs.find(j=>j.id===psProjectSelected);if(!job)return;b.disabled=true;psProjectReportRecordSnapshot(job,psProjectSummary(job),'PDF export');psProjectReportPdf(psProjectReportModel(job));b.disabled=false;return;}
   if(b.hasAttribute('data-project-report-excel')){const job=data.jobs.find(j=>j.id===psProjectSelected);if(!job)return;b.disabled=true;psProjectReportRecordSnapshot(job,psProjectSummary(job),'Excel export');psProjectReportExcel(psProjectReportModel(job));b.disabled=false;return;}
  }catch(error){b.disabled=false;toast(error.message||'Project report could not be generated.');}
 });
})();
