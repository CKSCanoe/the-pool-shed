/* Project management arithmetic and commands. Money is summed in integer pence. */
function psProjectPence(value){const n=Number(value);if(!Number.isFinite(n))throw Error('Enter a valid amount');return Math.round(n*100);}
function psProjectModel(j){return j.project||(j.project={version:1,quoteNet:0,quoteRef:'',quoteAccepted:false,targetMargin:30,lossWarningMargin:5,remainingNet:0,billingMode:'orders',variations:[],costs:[],phases:[],tasks:[],documents:[],audit:[]});}
function psProjectSummary(j,source,now){
 source=source||data;now=now||Date.now();const p=j.project||{},cents=psProjectPence;
 const orders=(source.salesOrders||[]).filter(o=>o.jobId===j.id&&!['Cancelled','Canceled'].includes(o.status)),orderIds=new Set(orders.map(o=>o.id));
 const requestJobs=new Map((source.engineerRequests||[]).map(r=>[r.id,r.jobId]));
 const allOrders=new Map((source.salesOrders||[]).map(o=>[o.id,o]));
 const productMap=new Map((source.products||[]).map(x=>[x.id,x]));
 const costs=(p.costs||[]).filter(x=>!x.voidedAt),variations=(p.variations||[]).filter(v=>v.status==='Approved');
 const quote=cents(p.quoteNet||0),approvedExtra=variations.reduce((n,v)=>n+cents(v.sellNet),0),revenue=quote+approvedExtra;
 let actual=0,committed=0,uncommitted=cents(p.remainingNet||0),estimatedReceived=0,missingCosts=0;
 const poRows=[],coverage=new Map();
 (source.purchaseOrders||[]).forEach(po=>{
  const cancelled=['Cancelled','Canceled'].includes(po.status);
  const lines=(po.lines||[]).filter(l=>(l.jobId||allOrders.get(l.salesOrderId)?.jobId||requestJobs.get(l.engineerRequestId)||po.jobId||requestJobs.get(po.engineerRequestId))===j.id);if(!lines.length)return;
  let total=0,received=0;lines.forEach(l=>{
   const rate=l.unitCost??l.cost??productMap.get(l.productId)?.cost;
   if(rate==null||!Number.isFinite(Number(rate))||Number(rate)===0)missingCosts++;
   const unit=Number(rate||0),orderedQty=cancelled?Number(l.received||0):Number(l.qty||0);total+=cents(orderedQty*unit);received+=cents(Math.min(Number(l.qty||0),Number(l.received||0))*unit);
   if(orderIds.has(l.salesOrderId)){const key=l.salesOrderId+'|'+l.productId;coverage.set(key,(coverage.get(key)||0)+orderedQty);}
  });
  const bills=costs.filter(x=>x.poId===po.id&&x.state==='Actual');const covered=bills.reduce((n,b)=>n+cents(b.coverageNet||0),0),billed=bills.reduce((n,b)=>n+cents(b.net),0);
  const committedPo=!String(po.status).toLowerCase().includes('draft');
  const estimate=Math.max(0,received-covered),open=Math.max(0,total-Math.max(received,covered));actual+=billed;
  if(committedPo){estimatedReceived+=estimate;committed+=open;}else uncommitted+=open+estimate;
  poRows.push({po,total,received,billed,covered,estimate,open,committed:committedPo});
 });
 const matchedPos=new Set(poRows.map(r=>r.po.id));
 costs.forEach(c=>{if(c.poId&&c.state==='Actual'&&matchedPos.has(c.poId))return;if(c.state==='Actual')actual+=cents(c.net);else committed+=cents(c.net);});
 // Sales-order materials not covered by a linked PO remain forecast costs, never extra sales revenue.
 const items=[],orderMaterialAmounts={};orders.forEach(o=>(o.lines||[]).filter(l=>l.bundleRole!=='head').forEach((l,index)=>{
  const key=o.id+'|'+l.productId,available=coverage.get(key)||0,covered=Math.min(Number(l.qty||0),available);coverage.set(key,Math.max(0,available-covered));
  const rate=l.unitCost??productMap.get(l.productId)?.cost;if(rate==null||Number(rate)===0)missingCosts++;
  const remaining=Math.max(0,Number(l.qty||0)-covered);orderMaterialAmounts[o.id]=(orderMaterialAmounts[o.id]||0)+cents(remaining*Number(rate||0));
  items.push({order:o.id,orderStatus:o.status||'',due:o.due||'',index,productId:l.productId,name:productMap.get(l.productId)?.name||l.productId,qty:Number(l.qty||0),allocated:Number(l.allocated||0),shipped:Number(l.shipped||0),open:Math.max(0,Number(l.qty||0)-Number(l.shipped||0)),covered});
 }));
 Object.entries(orderMaterialAmounts).forEach(([orderId,value])=>{const covered=costs.filter(c=>c.orderId===orderId&&c.state==='Actual').reduce((n,c)=>n+cents(c.coverageNet||0),0);uncommitted+=Math.max(0,value-covered);});
 variations.forEach(v=>{const recorded=costs.filter(c=>c.variationId===v.id).reduce((n,c)=>n+cents(c.net),0);uncommitted+=Math.max(0,cents(v.costNet||0)-recorded);});
 let tools=0;(source.toolAssignments||[]).filter(a=>a.jobId===j.id).forEach(a=>{if(typeof psToolCost==='function')tools+=cents(psToolCost(a,now));else{const end=a.ownership==='Hired In'?a.offHireAt:a.returnedAt;tools+=cents(Math.max(1,Math.ceil(((end?Date.parse(end):now)-Date.parse(a.startedAt))/86400000))*Number(a.dailyRate||0));}});
 const forecast=actual+estimatedReceived+committed+uncommitted+tools,profit=revenue-forecast,margin=revenue>0?100*profit/revenue:null;
 const target=Number(p.targetMargin??30),headroom=Math.round(revenue*(1-target/100))-forecast;
 const alerts=[];
 if(!p.quoteAccepted)alerts.push({severity:'warn',text:'The quote has not been recorded as accepted. Revenue is provisional.'});
 if(margin===null)alerts.push({severity:'warn',text:'Set the total quote value before relying on profit forecasts.'});
 else if(profit<0)alerts.push({severity:'bad',text:'Forecast loss: '+(Math.abs(profit)/100).toFixed(2)+'. Review costs and approved scope now.'});
 else if(margin<=Number(p.lossWarningMargin??5))alerts.push({severity:'bad',text:'The forecast is close to break-even. Only '+(profit/100).toFixed(2)+' remains before a loss.'});
 else if(margin<target)alerts.push({severity:'warn',text:'Forecast margin '+margin.toFixed(1)+'% is below the '+target+'% target.'});
 if(missingCosts)alerts.push({severity:'warn',text:missingCosts+' material lines have missing or zero costs. The forecast may be too optimistic.'});
 if(!p.forecastReviewedAt||now-Date.parse(p.forecastReviewedAt)>7*86400000)alerts.push({severity:'warn',text:'Review the remaining-cost forecast; it is unconfirmed or over seven days old.'});
 Object.entries(orderMaterialAmounts).forEach(([orderId,value])=>{const covered=costs.filter(c=>c.orderId===orderId).reduce((n,c)=>n+cents(c.coverageNet||0),0);if(covered>value)alerts.push({severity:'warn',text:orderId+' has matched material costs that overlap its current PO coverage. Review the matching.'});});
 const pending=(p.variations||[]).filter(v=>v.status==='Proposed');if(pending.length)alerts.push({severity:'warn',text:pending.length+' extras await approval. Their selling value is excluded from agreed revenue.'});
 const today=new Date(now).toISOString().slice(0,10);
 const overdue=(p.tasks||[]).filter(t=>t.status!=='Done'&&t.due&&t.due<today);if(overdue.length)alerts.push({severity:'warn',text:overdue.length+' tasks are overdue.'});
 const planned=(p.phases||[]).reduce((n,ph)=>n+cents(ph.amountNet),0);if(p.billingMode==='phases'&&planned<revenue)alerts.push({severity:'warn',text:((revenue-planned)/100).toFixed(2)+' of the contract is not assigned to invoice stages yet.'});
 const recommendations=(p.phases||[]).filter(ph=>!ph.invoiceRequested).map(ph=>{
  const dependency=ph.dependencyId&&(p.phases||[]).find(x=>x.id===ph.dependencyId);
  const tasks=(p.tasks||[]).filter(t=>t.phaseId===ph.id&&t.status!=='Done');
  const ready=!!p.quoteAccepted&&!!ph.ready&&!!ph.agreement&&(!dependency||dependency.ready)&&!tasks.length;
  return {id:ph.id,ready,text:ready?'Ready for invoice review: '+ph.name+'. Agreed stage completed; check evidence and customer details.':ph.due&&ph.due<=today?'Review '+ph.name+': the planned billing date has arrived, but completion/approval checks are still required.':'Next stage: '+ph.name+'. Invoice only when its agreed completion conditions are met.'};
 });
 return {quote,approvedExtra,revenue,actual,estimatedReceived,committed,uncommitted,tools,forecast,profit,margin,headroom,target,alerts,recommendations,items,orders,poRows,orderMaterialAmounts,pendingExtra:pending.reduce((n,v)=>n+cents(v.sellNet),0),phaseTotal:(p.phases||[]).reduce((n,ph)=>n+cents(ph.amountNet),0)};
}
function psProjectApply(action,v){
 if(!canAccessTab('jobs'))throw Error('You do not have access to projects.');
 if(!isAdminUser())throw Error('A manager must change project costs, scope and billing.');
 if(action==='time'){const hours=Number(v.hours),rate=Number(v.hourlyRate);if(!Number.isFinite(hours)||hours<=0||!Number.isFinite(rate)||rate<0)throw Error('Enter valid hours and an hourly employment cost.');v={...v,net:hours*rate,category:'Labour',state:'Actual'};action='cost';}
 let j=data.jobs.find(j=>j.id===v.jobId);if(!j)throw Error('Choose a job first');const p=psProjectModel(j),now=new Date().toISOString();
 const amount=(x,allowNegative=false)=>{const n=Number(x);if(!Number.isFinite(n)||(!allowNegative&&n<0))throw Error('Enter a valid '+(allowNegative?'':'non-negative ')+'amount');return psProjectPence(n)/100;};
 const text=(x,label)=>{const t=String(x||'').trim();if(!t)throw Error('Enter '+label);return t;};
 const id=()=>crypto.randomUUID();
 if(action==='settings'){
  const quote=amount(v.quoteNet),target=Number(v.targetMargin),loss=Number(v.lossWarningMargin);
  if(target<0||target>=100||loss<0||loss>=target||!Number.isFinite(target)||!Number.isFinite(loss))throw Error('Set a target below 100% and a lower break-even warning margin.');
  if(p.quoteAccepted&&quote!==p.quoteNet)throw Error('The accepted quote is locked. Add an approved extra or credit variation to change the agreed value.');
  if(v.quoteAccepted&&!String(v.quoteRef||'').trim())throw Error('Enter the accepted quote reference.');
  Object.assign(p,{quoteNet:quote,quoteRef:String(v.quoteRef||''),quoteAccepted:p.quoteAccepted||!!v.quoteAccepted,targetMargin:target,lossWarningMargin:loss,remainingNet:amount(v.remainingNet),forecastReviewedAt:now,billingMode:'phases'});
 }else if(action==='link'){
  const o=data.salesOrders.find(o=>o.id===v.orderId);if(!o)throw Error('Choose a sales order');if(o.jobId&&o.jobId!==j.id)throw Error('That sales order already belongs to another project.');if(o.customerId!==j.customerId)throw Error('Project and sales order must have the same customer.');
  if(o.invoiceSource||o.invoiceDate||o.xeroRef&&!['Draft',''].includes(o.xeroRef))throw Error('Review existing invoices before moving this order into project phase billing.');
  o.jobId=j.id;
 }else if(action==='variation'){
  const sellNet=amount(v.sellNet,true),costNet=amount(v.costNet),title=text(v.title,'the extra description');p.variations.push({id:id(),title,sellNet,costNet,status:'Proposed',date:now});
 }else if(action==='approve-extra'||action==='reject-extra'){
  const extra=p.variations.find(x=>x.id===v.id);if(!extra||extra.status!=='Proposed')throw Error('This extra has already been decided.');
  if(action==='approve-extra'){const ref=text(v.approvalRef,'the customer approval reference');const s=psProjectSummary(j);if(s.revenue+psProjectPence(extra.sellNet)<s.phaseTotal)throw Error('This reduction would put planned billing above the contract. Review the billing plan first.');extra.approvalRef=ref;}
  extra.status=action==='approve-extra'?'Approved':'Rejected';extra.decidedAt=now;
 }else if(action==='cost'){
  const net=amount(v.net),ref=text(v.ref,'a receipt, timesheet or invoice reference'),supplier=text(v.supplier,'a supplier or employee');
  if(p.costs.some(c=>!c.voidedAt&&c.ref.trim().toLowerCase()===ref.toLowerCase()&&c.supplier.trim().toLowerCase()===supplier.toLowerCase()))throw Error('That supplier/reference is already recorded.');
  const poId=v.poId||'',orderId=v.orderId||'',coverageNet=poId||orderId?amount(v.coverageNet):0;if(poId&&orderId)throw Error('Match a bill to either its PO or an order material estimate, not both.');
  if(orderId){const s=psProjectSummary(j);if(!s.orders.some(o=>o.id===orderId)||v.state!=='Actual')throw Error('Choose a linked order and record an actual cost.');const covered=p.costs.filter(c=>!c.voidedAt&&c.orderId===orderId).reduce((n,c)=>n+psProjectPence(c.coverageNet||0),0);if(covered+psProjectPence(coverageNet)>(s.orderMaterialAmounts[orderId]||0))throw Error('The matched amount exceeds the uncovered order material estimate.');}
  if(poId){const po=psProjectSummary(j).poRows.find(r=>r.po.id===poId);if(!po)throw Error('Choose a PO linked to this project.');if(v.state!=='Actual')throw Error('PO commitments are already counted. Match only an actual bill to a PO.');if(psProjectPence(coverageNet)+po.covered>po.total)throw Error('The matched PO amount exceeds its unbilled value.');}
  if(v.variationId&&!p.variations.some(x=>x.id===v.variationId))throw Error('Extra not found.');
  p.costs.push({id:id(),net,ref,supplier,category:v.category||'Other',state:v.state==='Committed'?'Committed':'Actual',poId,orderId,coverageNet,variationId:v.variationId||'',date:v.date||now.slice(0,10),notes:String(v.notes||''),...(v.hours?{hours:Number(v.hours),hourlyRate:Number(v.hourlyRate)}:{})});
 }else if(action==='void-cost'){
  const c=p.costs.find(x=>x.id===v.id);if(!c||c.voidedAt)throw Error('Cost is already corrected.');c.voidedAt=now;c.voidReason=text(v.reason,'a correction reason');
 }else if(action==='phase'){
  const net=amount(v.amountNet);if(!net)throw Error('Enter a positive stage amount.');const s=psProjectSummary(j);
  if(s.phaseTotal+psProjectPence(net)>s.revenue)throw Error('Invoice stages cannot exceed the quote plus approved extras.');
  if(v.dependencyId&&!p.phases.some(ph=>ph.id===v.dependencyId))throw Error('Choose an existing earlier stage.');
  p.phases.push({id:id(),name:text(v.name,'the stage name'),amountNet:net,due:v.due||'',agreement:text(v.agreement,'the agreed billing condition/reference'),dependencyId:v.dependencyId||'',ready:false});
 }else if(action==='remove-phase'){
  const ph=p.phases.find(ph=>ph.id===v.id);if(!ph||ph.invoiceRequested)throw Error('An invoiced stage must remain in history.');if(p.phases.some(x=>x.dependencyId===ph.id)||p.tasks.some(t=>t.phaseId===ph.id))throw Error('This stage has tasks or dependent stages. Retain it for review.');p.phases=p.phases.filter(x=>x.id!==ph.id);
 }else if(action==='ready-phase'){
  const ph=p.phases.find(ph=>ph.id===v.id);if(!ph||ph.invoiceRequested)throw Error('Stage unavailable or already queued.');
  if(p.tasks.some(t=>t.phaseId===ph.id&&t.status!=='Done'))throw Error('Complete this stage’s tasks first.');
  if(ph.dependencyId&&!p.phases.find(x=>x.id===ph.dependencyId)?.ready)throw Error('Complete the preceding stage first.');ph.ready=true;ph.completedAt=now;
 }else if(action==='task'){
  if(v.phaseId&&!p.phases.some(ph=>ph.id===v.phaseId&&!ph.ready))throw Error('Choose an incomplete stage.');p.tasks.push({id:id(),title:text(v.title,'the task description'),owner:text(v.owner,'who is responsible'),due:v.due||'',phaseId:v.phaseId||'',status:'To do'});
 }else if(action==='done-task'){
  const t=p.tasks.find(t=>t.id===v.id);if(!t)throw Error('Task not found');t.status='Done';t.completedAt=now;
 }else throw Error('Unknown project action');
 p.audit.push({id:id(),action,at:now,user:currentUser().name,details:JSON.parse(JSON.stringify(v))});return j;
}
function psProjectTransaction(action,v){const before=JSON.stringify(data);try{const j=psProjectApply(action,v);if(saveAppData()===false||workspaceLocalSaveFailed)throw Error('Project could not be saved locally.');return j;}catch(e){data=JSON.parse(before);throw e;}}
// Shared pure summary is also used by the server's optional advisory endpoint.
globalThis.PoolShedProjectEngine={summary:psProjectSummary};
