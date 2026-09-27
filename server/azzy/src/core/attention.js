import { daysLate, daysUntil, gbp, clamp } from './utils.js';
import { projectGraph } from './business-graph.js';
import { findContradictions } from './intelligence.js';

function score({impact=1,urgency=1,confidence=1,time=1}){return Math.round(clamp((impact*.38+urgency*.30+confidence*.20+time*.12)*20,0,100));}
function soCanPick(db,so){if(!(so.lines||[]).length)return true;return so.lines.every(l=>{const p=db.products[l.sku];return p&&Math.max(0,p.onHand-p.allocated)>=Number(l.qty||0);});}

export function buildSignals(db){
  const today=db.meta.today,signals=[],wins=[];
  for(const po of Object.values(db.purchaseOrders)){
    const outstanding=po.lines.reduce((s,l)=>s+Math.max(0,l.qty-l.received),0);if(!outstanding)continue;
    const late=daysLate(po.expectedDate,today),p=db.projects[po.projectId],dueIn=daysUntil(p?.dueDate,today);
    if(late>0){
      let availableForMissing=0;for(const l of po.lines){const prod=db.products[l.sku];if(prod)availableForMissing+=Math.max(0,prod.onHand-prod.allocated);}
      const urgency=late>=3?5:3.5,impact=(dueIn!==null&&dueIn<=7&&availableForMissing===0)?5:3.5;
      signals.push({id:`late-${po.id}`,kind:'late_po',severity:score({impact,urgency,confidence:5,time:4}),title:`${po.id} is ${late} day${late===1?'':'s'} late`,summary:`${outstanding} unit${outstanding===1?'':'s'} remain outstanding from ${po.supplier}${p?` for ${p.name}`:''}.`,context:{type:'po',id:po.id},record:{type:'po',id:po.id},projectId:po.projectId,actionPrompt:'What is the impact of this late PO?'});
    }
    if(!po.expectedDate)signals.push({id:`noeta-${po.id}`,kind:'no_eta',severity:76,title:`${po.id} has no confirmed ETA`,summary:`${po.supplier} has ${outstanding} outstanding unit${outstanding===1?'':'s'} with no delivery date recorded.`,context:{type:'po',id:po.id},record:{type:'po',id:po.id},projectId:po.projectId,actionPrompt:'What is the risk from this PO having no ETA?'});
  }
  for(const p of Object.values(db.projects)){
    const forecastMargin=((p.quotedNet-p.forecastCost)/p.quotedNet)*100,gap=p.targetMarginPct-forecastMargin;
    if(gap>0){const extras=(p.extraIds||[]).map(id=>db.extras[id]).filter(x=>x&&!x.approved),impact=gap>=4?5:3.5;signals.push({id:`margin-${p.id}`,kind:'margin',severity:score({impact,urgency:3.2,confidence:5,time:3}),title:`${p.name} margin is below target`,summary:`Forecast ${forecastMargin.toFixed(1)}% vs ${p.targetMarginPct}% target${extras.length?`; ${extras.length} unapproved extra${extras.length===1?'':'s'} found`:''}.`,context:{type:'project',id:p.id},record:{type:'project',id:p.id},projectId:p.id,actionPrompt:'Why is this project margin below target?'});}else if(p.status==='Active')wins.push({id:`win-margin-${p.id}`,kind:'margin_positive',title:`${p.name} is protecting margin`,summary:`Forecast margin ${forecastMargin.toFixed(1)}% is on or above the ${p.targetMarginPct}% target.`,context:{type:'project',id:p.id},record:{type:'project',id:p.id}});
  }
  for(const h of Object.values(db.hires)){if(!h.active)continue;const ratio=h.accruedCost/h.purchaseEquivalent;if(ratio>=.35)signals.push({id:`hire-${h.id}`,kind:'hire',severity:score({impact:ratio>=.55?4.5:3,urgency:3,confidence:5,time:4}),title:`${h.description} hire has reached ${gbp(h.accruedCost)}`,summary:`${h.accruedDays} days at ${gbp(h.dailyRate)}/day, ${Math.round(ratio*100)}% of purchase-equivalent cost.`,context:{type:'project',id:h.projectId},record:{type:'hire',id:h.id},projectId:h.projectId,actionPrompt:'Should I be worried about this hire cost?'});}
  const invoiceGroups=new Map();for(const bill of Object.values(db.supplierBills)){if(/rejected duplicate/i.test(bill.status))continue;const k=`${bill.supplierId}|${bill.invoiceNumber}|${bill.amountNet}`,arr=invoiceGroups.get(k)||[];arr.push(bill);invoiceGroups.set(k,arr);}for(const arr of invoiceGroups.values())if(arr.length>1)signals.push({id:`dup-${arr[0].supplierId}-${arr[0].invoiceNumber}`,kind:'duplicate_bill',severity:97,title:'Possible duplicate supplier bill',summary:`${arr[0].supplier} invoice ${arr[0].invoiceNumber} appears ${arr.length} times for ${gbp(arr[0].amountNet)} net.`,context:{type:'bill',id:arr[0].id},record:{type:'bill',id:arr[0].id},projectId:arr[0].projectId,actionPrompt:'Show me the possible duplicate bill.'});
  for(const so of Object.values(db.salesOrders))if(so.status==='Ready to pick'&&soCanPick(db,so)){const p=db.projects[so.projectId];wins.push({id:`win-${so.id}`,kind:'ready_to_pick',title:`${so.id} is ready to pick`,summary:`${p?.name||so.projectId} can progress without waiting for stock allocation.`,context:{type:'project',id:so.projectId},record:{type:'sales_order',id:so.id}});}
  for(const inv of Object.values(db.customerInvoices).filter(x=>x.status==='Paid')){const p=db.projects[inv.projectId];wins.push({id:`win-${inv.id}`,kind:'customer_payment',title:'Customer funds received',summary:`${inv.id} for ${p?.name||inv.projectId} is marked paid.`,context:{type:'project',id:inv.projectId},record:{type:'invoice',id:inv.id}});}
  for(const c of findContradictions(db,{permissions:['projects.read','stock.read','purchasing.read','finance.read']})){if(c.record?.type==='bill')continue;if(!signals.some(x=>x.id===c.id))signals.push({...c,context:c.record||{type:'project',id:c.projectId},actionPrompt:'Talk me through this contradiction.'});}
  signals.sort((a,b)=>b.severity-a.severity);return {signals,wins};
}

export function filterIntelligenceForUser({signals=[],wins=[]},user){
  const can=p=>Boolean(user?.permissions?.includes(p)),financial=new Set(['margin','hire','duplicate_bill']),purchasing=new Set(['late_po','no_eta']);
  const visibleSignals=signals.filter(x=>!(financial.has(x.kind)&&!can('finance.read'))&&!(purchasing.has(x.kind)&&!can('purchasing.read'))&&!(x.kind==='contradiction'&&x.record?.type==='sales_order'&&!can('stock.read'))&&!(x.kind==='contradiction'&&x.record?.type==='bill'&&!can('finance.read'))&&!(x.kind==='contradiction'&&x.record?.type==='po'&&!can('purchasing.read')));
  const visibleWins=wins.filter(x=>!(x.kind==='margin_positive'&&!can('finance.read'))&&!(x.kind==='customer_payment'&&!can('finance.read'))&&!(x.kind==='ready_to_pick'&&!can('stock.read')));
  return {signals:visibleSignals,wins:visibleWins};
}

export function explainProjectHealth(db,projectId){
  const g=projectGraph(db,projectId);if(!g)return null;const p=g.project,margin=((p.quotedNet-p.forecastCost)/p.quotedNet)*100,latePos=g.purchaseOrders.filter(po=>daysLate(po.expectedDate,db.meta.today)>0&&po.lines.some(l=>l.received<l.qty)),noEta=g.purchaseOrders.filter(po=>!po.expectedDate&&po.lines.some(l=>l.received<l.qty)),unapproved=g.extras.filter(x=>!x.approved),activeHire=g.hires.filter(x=>x.active);return {margin,marginGap:margin-p.targetMarginPct,latePos,noEta,unapproved,activeHire,progress:p.progress,dueDate:p.dueDate,status:p.status};
}
