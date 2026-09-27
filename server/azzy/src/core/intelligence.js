import { projectGraph } from './business-graph.js';
import { daysLate, daysUntil, gbp } from './utils.js';

const can=(user,permission)=>Boolean(user?.permissions?.includes(permission));
const outstanding=po=>(po?.lines||[]).map(l=>({...l,outstanding:Math.max(0,Number(l.qty||0)-Number(l.received||0))})).filter(l=>l.outstanding>0);

export function projectSnapshot(db,projectId,user){
  const g=projectGraph(db,projectId); if(!g)return null;
  const p=g.project;
  const snap={projectId:p.id,name:p.name,revision:db.meta.revision,progress:p.progress,stage:p.stage,status:p.status,dueDate:p.dueDate};
  if(can(user,'finance.read')){
    const margin=((p.quotedNet-p.forecastCost)/p.quotedNet)*100;
    snap.forecastCost=p.forecastCost;
    snap.forecastMarginPct=Number(margin.toFixed(1));
    snap.unapprovedExtraCost=g.extras.filter(x=>!x.approved).reduce((s,x)=>s+Number(x.cost||0),0);
    snap.activeHireCost=g.hires.filter(x=>x.active).reduce((s,x)=>s+Number(x.accruedCost||0),0);
  }
  if(can(user,'purchasing.read')){
    const blocked=g.purchaseOrders.filter(po=>outstanding(po).length&&(daysLate(po.expectedDate,db.meta.today)>0||!po.expectedDate));
    snap.blockedPoCount=blocked.length;
    snap.outstandingUnits=blocked.reduce((s,po)=>s+outstanding(po).reduce((n,l)=>n+l.outstanding,0),0);
  }
  return snap;
}

export function snapshotDelta(before,after){
  if(!before||!after)return null;
  const changes=[];
  const push=(key,label,format=v=>String(v))=>{
    if(before[key]===undefined||after[key]===undefined||before[key]===after[key])return;
    changes.push({key,label,before:before[key],after:after[key],text:`${label} changed from ${format(before[key])} to ${format(after[key])}`});
  };
  push('progress','Progress',v=>`${v}%`);
  push('stage','Stage');
  push('status','Status');
  push('forecastMarginPct','Forecast margin',v=>`${Number(v).toFixed(1)}%`);
  push('forecastCost','Forecast cost',gbp);
  push('unapprovedExtraCost','Unapproved extra cost',gbp);
  push('activeHireCost','Active hire cost',gbp);
  push('blockedPoCount','Purchasing blockers');
  push('outstandingUnits','Outstanding units');
  return {projectId:after.projectId,name:after.name,fromRevision:before.revision,toRevision:after.revision,changes};
}

export function compareProjects(db,projectIds,user){
  const unique=[...new Set(projectIds||[])].filter(id=>db.projects[id]).slice(0,5);
  return unique.map(projectId=>{
    const g=projectGraph(db,projectId),p=g.project;
    const row={projectId:p.id,projectName:p.name,stage:p.stage,progress:p.progress,dueDate:p.dueDate,dueInDays:daysUntil(p.dueDate,db.meta.today),owner:p.owner,status:p.status};
    if(can(user,'finance.read')){
      const margin=((p.quotedNet-p.forecastCost)/p.quotedNet)*100;
      row.quotedNet=p.quotedNet; row.forecastCost=p.forecastCost; row.forecastMarginPct=Number(margin.toFixed(1)); row.targetMarginPct=p.targetMarginPct; row.marginGapPct=Number((margin-p.targetMarginPct).toFixed(1));
      row.activeHireCost=g.hires.filter(x=>x.active).reduce((s,x)=>s+Number(x.accruedCost||0),0);
      row.unapprovedExtraCost=g.extras.filter(x=>!x.approved).reduce((s,x)=>s+Number(x.cost||0),0);
      row.unpaidSupplierBills=g.supplierBills.filter(x=>x.status!=='Paid'&&!/rejected/i.test(x.status)).reduce((s,x)=>s+Number(x.amountNet||0)+Number(x.vat||0),0);
      row.customerCashExpected=g.customerInvoices.filter(x=>x.status!=='Paid').reduce((s,x)=>s+Number(x.amountNet||0),0);
    }
    if(can(user,'purchasing.read')){
      row.blockedPos=g.purchaseOrders.filter(po=>outstanding(po).length&&(daysLate(po.expectedDate,db.meta.today)>0||!po.expectedDate)).map(po=>({id:po.id,supplier:po.supplier,daysLate:daysLate(po.expectedDate,db.meta.today),hasEta:Boolean(po.expectedDate),outstandingUnits:outstanding(po).reduce((s,l)=>s+l.outstanding,0)}));
      row.outstandingUnits=row.blockedPos.reduce((s,x)=>s+x.outstandingUnits,0);
    }
    if(can(user,'customers.read')){
      row.waitingOnUs=g.customer?.waitingOnUs?.length||0;
      row.waitingOnCustomer=g.customer?.waitingOnCustomer?.length||0;
    }
    return row;
  });
}

function salesOrderAvailability(db,so){
  const rows=(so.lines||[]).map(l=>{
    const p=db.products[l.sku];
    const available=p?Math.max(0,Number(p.onHand||0)-Number(p.allocated||0)):0;
    return {...l,available,shortfall:Math.max(0,Number(l.qty||0)-available)};
  });
  return {rows,shortfall:rows.reduce((s,x)=>s+x.shortfall,0)};
}

export function findContradictions(db,user,{projectIds=[]}={}){
  const projectSet=new Set(projectIds||[]),limitProject=id=>!projectSet.size||projectSet.has(id),items=[];
  if(can(user,'stock.read')&&can(user,'projects.read')){
    for(const so of Object.values(db.salesOrders||{})){
      if(!limitProject(so.projectId)||so.status!=='Ready to pick')continue;
      const a=salesOrderAvailability(db,so);
      if(a.shortfall>0){
        items.push({id:`contradiction-${so.id}-pick`,kind:'contradiction',severity:91,title:`${so.id} says ready to pick, but stock does not support it`,summary:`${a.shortfall} unit${a.shortfall===1?' is':'s are'} short against the recorded sales-order lines.`,projectId:so.projectId,record:{type:'sales_order',id:so.id},related:a.rows.filter(x=>x.shortfall>0).map(x=>({type:'product',id:x.sku,label:x.name||x.sku})),evidence:a.rows.filter(x=>x.shortfall>0).map(x=>({entityType:'sales_order',entityId:so.id,label:x.name||x.sku,path:`line:${x.sku}`,value:`Needs ${x.qty}, ${x.available} free`}))});
      }
    }
  }
  if(can(user,'finance.read')){
    const groups=new Map();
    for(const bill of Object.values(db.supplierBills||{})){
      if(/rejected duplicate/i.test(bill.status))continue;
      if(!limitProject(bill.projectId))continue;
      const key=`${bill.supplierId}|${bill.invoiceNumber}|${bill.amountNet}`;const arr=groups.get(key)||[];arr.push(bill);groups.set(key,arr);
    }
    for(const arr of groups.values())if(arr.length>1)items.push({id:`contradiction-bill-${arr[0].invoiceNumber}`,kind:'contradiction',severity:97,title:'Possible duplicate supplier bill',summary:`${arr[0].supplier} invoice ${arr[0].invoiceNumber} appears ${arr.length} times for ${gbp(arr[0].amountNet)} net.`,projectId:arr[0].projectId,record:{type:'bill',id:arr[0].id},related:arr.slice(1).map(x=>({type:'bill',id:x.id,label:x.id}))});
  }
  if(can(user,'purchasing.read')){
    for(const po of Object.values(db.purchaseOrders||{})){
      if(!limitProject(po.projectId)||!outstanding(po).length)continue;
      if(po.status==='Complete')items.push({id:`contradiction-${po.id}-complete`,kind:'contradiction',severity:88,title:`${po.id} is marked complete with outstanding lines`,summary:`${outstanding(po).reduce((s,l)=>s+l.outstanding,0)} unit(s) are still recorded as not received.`,projectId:po.projectId,record:{type:'po',id:po.id}});
    }
  }
  return items.sort((a,b)=>b.severity-a.severity);
}

export function hiddenRisks(db,user,{projectIds=[]}={}){
  const ids=projectIds?.length?projectIds:Object.keys(db.projects||{}),rows=[...findContradictions(db,user,{projectIds:ids})];
  for(const id of ids){
    const g=projectGraph(db,id);if(!g)continue;
    if(can(user,'finance.read')){
      const extras=g.extras.filter(x=>!x.approved);
      if(extras.length)rows.push({id:`hidden-extra-${id}`,kind:'unapproved_extra',severity:84,title:`${g.project.name} has unrecovered extra cost`,summary:`${gbp(extras.reduce((s,x)=>s+Number(x.cost||0),0))} of recorded extras has not been approved for recovery.`,projectId:id,record:{type:'project',id}});
      for(const h of g.hires.filter(x=>x.active))if(h.purchaseEquivalent&&h.accruedCost/h.purchaseEquivalent>=.5)rows.push({id:`hidden-hire-${h.id}`,kind:'hire_exposure',severity:82,title:`${h.description} is becoming expensive to keep hiring`,summary:`${gbp(h.accruedCost)} has accrued, ${Math.round(h.accruedCost/h.purchaseEquivalent*100)}% of the recorded purchase-equivalent cost.`,projectId:id,record:{type:'hire',id:h.id}});
    }
    if(can(user,'purchasing.read')){
      for(const po of g.purchaseOrders){const miss=outstanding(po);if(miss.length&&!po.expectedDate)rows.push({id:`hidden-noeta-${po.id}`,kind:'no_eta',severity:79,title:`${po.id} still has no ETA`,summary:`${miss.reduce((s,l)=>s+l.outstanding,0)} outstanding unit(s) have no confirmed delivery date.`,projectId:id,record:{type:'po',id:po.id}});}
    }
    if(can(user,'customers.read')&&g.customer?.waitingOnUs?.length)rows.push({id:`hidden-customer-${id}`,kind:'customer_waiting',severity:72,title:`${g.customer.name} is waiting on Pool Bros`,summary:g.customer.waitingOnUs.join('; '),projectId:id,record:{type:'customer',id:g.customer.id}});
  }
  return rows.sort((a,b)=>b.severity-a.severity).slice(0,12);
}

export function runProjectScenario(db,projectId,{costDelta=0,revenueDelta=0}={}){
  const p=db.projects[projectId];if(!p)return null;
  const currentMargin=((p.quotedNet-p.forecastCost)/p.quotedNet)*100;
  const quotedNet=p.quotedNet+Number(revenueDelta||0),forecastCost=p.forecastCost+Number(costDelta||0);
  const newMargin=quotedNet?((quotedNet-forecastCost)/quotedNet)*100:0;
  return {projectId:p.id,projectName:p.name,current:{quotedNet:p.quotedNet,forecastCost:p.forecastCost,marginPct:Number(currentMargin.toFixed(1))},scenario:{revenueDelta:Number(revenueDelta||0),costDelta:Number(costDelta||0),quotedNet,forecastCost,marginPct:Number(newMargin.toFixed(1)),marginChangePct:Number((newMargin-currentMargin).toFixed(1))},committed:false};
}
