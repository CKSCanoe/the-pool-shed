import { snapshot as runtimeSnapshot } from '../data/runtime-data.js';
import { requirePermission, visibleTool } from '../core/permissions.js';
import { buildSignals, explainProjectHealth, filterIntelligenceForUser } from '../core/attention.js';
import { projectGraph } from '../core/business-graph.js';
import { compareProjects, hiddenRisks, runProjectScenario } from '../core/intelligence.js';
import { buildProcurementDemand, buildPickList, supplierScorecards, threeWayMatch, cycleCountPlan, exceptionInbox, chemicalSafety, bestSupplierForSku } from '../core/procurement.js';
import { daysLate, daysBetween, gbp, evidence, dedupeEvidence } from '../core/utils.js';

const outstanding=po=>(po.lines||[]).map(l=>({...l,outstanding:Math.max(0,Number(l.qty||0)-Number(l.received||0))})).filter(l=>l.outstanding>0);
const result=(data,evidenceItems=[])=>({ok:true,data,evidence:dedupeEvidence(evidenceItems)});
const err=message=>({ok:false,error:message,data:null,evidence:[]});
const can=(user,permission)=>Boolean(user?.permissions?.includes(permission));
function visibleEvents(db,user,projectIds=[]){const ids=new Set(projectIds||[]);return db.events.filter(e=>{if(ids.size&&e.projectId&&!ids.has(e.projectId))return false;if(['supplier_bill','customer_payment','project_cost'].includes(e.type))return can(user,'finance.read');if(['goods_in','purchase_order'].includes(e.type))return can(user,'purchasing.read')||can(user,'stock.read');return can(user,'projects.read');});}


const SEARCH_STOP=new Set(['a','an','and','are','can','could','do','does','for','from','have','i','in','is','it','me','my','of','on','or','please','show','some','tell','that','the','there','this','to','we','what','whats','where','which','with','you','our','any','got','get','find','need','stock','item','items','product','products']);
function normaliseSearchText(value=''){
  let s=String(value).toLowerCase();
  s=s.replace(/(\d+)½/g,(_,n)=>String(Number(n)+0.5)).replace(/½/g,'0.5').replace(/¼/g,'0.25').replace(/¾/g,'0.75');
  s=s.replace(/\b(\d+)\s+1\s*\/\s*2\b/g,(_,n)=>String(Number(n)+0.5));
  s=s.replace(/\b(\d+)\s*[- ]\s*1\s*\/\s*2\b/g,(_,n)=>String(Number(n)+0.5));
  s=s.replace(/\b(\d+(?:\.\d+)?)\s*(?:\"|inches?|inch|in\.)\b/g,'$1 inch');
  s=s.replace(/\bpipework\b/g,'pipe fitting');
  s=s.replace(/[^a-z0-9.]+/g,' ').replace(/\s+/g,' ').trim();
  return s;
}
function searchTokens(value=''){
  return normaliseSearchText(value).split(' ').filter(t=>t&&!SEARCH_STOP.has(t)&&(t.length>1||/^\d+(?:\.\d+)?$/.test(t)));
}
function editDistance(a='',b=''){
  a=String(a);b=String(b);const prev=Array.from({length:b.length+1},(_,i)=>i),cur=new Array(b.length+1);
  for(let i=1;i<=a.length;i++){cur[0]=i;for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));for(let j=0;j<=b.length;j++)prev[j]=cur[j];}
  return prev[b.length];
}
function fuzzyTokenMatch(token,hayTokens=[]){
  if(token.length<4)return null;let best=null;
  for(const h of hayTokens){if(h.length<4)continue;const d=editDistance(token,h),max=Math.max(token.length,h.length),ratio=1-d/max;if((d<=2||ratio>=.72)&&(!best||ratio>best.ratio))best={token:h,distance:d,ratio};}
  return best;
}
function relevance(query,haystack){
  const q=normaliseSearchText(query),h=normaliseSearchText(haystack),qt=searchTokens(query),ht=new Set(searchTokens(haystack));
  if(!q)return {score:0,exact:false,matched:[]};
  let score=0;const matched=[];
  if(h.includes(q)){score+=100;}
  let exactCount=0;
  const hayTokens=[...ht];
  for(const t of qt){
    if(ht.has(t)||h.includes(t)){matched.push(t);exactCount++;score+=/^\d+(?:\.\d+)?$/.test(t)?34:18;continue;}
    const fuzzy=fuzzyTokenMatch(t,hayTokens);if(fuzzy){matched.push(t);score+=Math.round(12*fuzzy.ratio);}
  }
  if(qt.length){const ratio=matched.length/qt.length;score+=Math.round(ratio*45);if(ratio===1)score+=30;}
  const exact=Boolean(h.includes(q)||(qt.length>0&&exactCount===qt.length));
  return {score,exact,matched};
}
function rankedProducts(db,query,{limit=6}={}){
  return Object.values(db.products||{}).map(p=>{
    const r=relevance(query,`${p.sku} ${p.name} ${p.supplierSku||''} ${p.bin||''}`),available=Math.max(0,Number(p.onHand||0)-Number(p.allocated||0));
    return {...p,available,matchScore:r.score,exactMatch:r.exact,matchedTerms:r.matched};
  }).filter(x=>x.matchScore>=28).sort((a,b)=>b.matchScore-a.matchScore||b.available-a.available||a.name.localeCompare(b.name)).slice(0,limit);
}
function rankedSystemRecords(db,user,query,{limit=10}={}){
  const rows=[];
  const add=(type,id,label,obj,extra='')=>{const r=relevance(query,`${id} ${label} ${extra}`);if(r.score>=28)rows.push({type,id,label,obj,score:r.score,exactMatch:r.exact,matchedTerms:r.matched});};
  if(can(user,'projects.read'))for(const x of Object.values(db.projects||{}))add('project',x.id,x.name,{id:x.id,name:x.name,status:x.status,stage:x.stage,progress:x.progress,dueDate:x.dueDate,owner:x.owner},`${x.status} ${x.stage} ${x.owner||''}`);
  if(can(user,'purchasing.read'))for(const x of Object.values(db.purchaseOrders||{}))add('po',x.id,`${x.id} · ${x.supplier}`,x,`${x.status} ${(x.lines||[]).map(l=>`${l.sku} ${l.name}`).join(' ')}`);
  if(can(user,'stock.read'))for(const x of Object.values(db.products||{}))add('stock',x.sku,x.name,{...x,available:Math.max(0,Number(x.onHand||0)-Number(x.allocated||0))},`${x.supplierSku||''} ${x.bin||''}`);
  if(can(user,'customers.read'))for(const x of Object.values(db.customers||{}))add('customer',x.id,x.name,x,`${(x.waitingOnUs||[]).join(' ')} ${(x.waitingOnCustomer||[]).join(' ')}`);
  if(can(user,'purchasing.read')){
    for(const x of Object.values(db.suppliers||{}))add('supplier',x.id,x.name,x);
    for(const x of Object.values(db.supplierOffers||{}))add('supplier_price',x.id,`${x.productName} · ${x.supplier}`,x,`${x.productFamily||''} ${x.searchText||''} ${x.supplierSku||''}`);
  }
  if(can(user,'finance.read'))for(const x of Object.values(db.supplierBills||{}))add('bill',x.id,`${x.supplier} ${x.invoiceNumber}`,x,`${x.status||''} ${x.projectId||''}`);
  return rows.sort((a,b)=>b.score-a.score||Number(b.exactMatch)-Number(a.exactMatch)||a.label.localeCompare(b.label)).slice(0,limit);
}

function supplierPriceTerms(query='',qty=null){
  const stop=new Set(['what','whats','whatsoever','is','are','the','a','an','best','price','prices','pricing','cheapest','cheap','compare','comparison','for','of','my','with','from','supplier','suppliers','who','currently','current','recorded','please','can','you','get','me','find','drum','drums','pack','packs','unit','units','bottle','bottles','tub','tubs','container','containers','length','lengths']);
  return searchTokens(query).filter(x=>!stop.has(x)&&!(qty&&/^\d+$/.test(x)&&Number(x)===Number(qty)));
}
function supplierPriceComparison(db,args={}){
  const qty=Math.max(1,Number(args.qty||1)),terms=supplierPriceTerms(args.query||'',qty),cleanQuery=terms.join(' ');
  const candidates=Object.values(db.supplierOffers||{}).filter(o=>o.approved!==false).map(o=>{
    const descriptor=`${o.poolSku||''} ${o.equivalenceKey||''} ${o.productFamily||''} ${o.productName||''} ${o.searchText||''} ${o.supplierSku||''}`;
    const match=cleanQuery?relevance(cleanQuery,descriptor):{score:1,exact:false,matched:[]};
    return {...o,_matchScore:match.score,_matchExact:match.exact};
  }).filter(o=>!cleanQuery||o._matchScore>=28);
  const groups=new Map();
  for(const o of candidates){
    const key=o.equivalenceKey||o.poolSku||normaliseSearchText(o.productFamily||o.productName||o.id);
    const g=groups.get(key)||{key,score:0,productName:o.productName,productFamily:o.productFamily,poolSku:o.poolSku||null,equivalenceKey:o.equivalenceKey||null,offers:[]};
    g.score=Math.max(g.score,o._matchScore);g.offers.push(o);groups.set(key,g);
  }
  const rankedGroups=[...groups.values()].sort((a,b)=>b.score-a.score||a.productName.localeCompare(b.productName));
  const selected=rankedGroups[0]||null;
  const priceRows=offers=>offers.map(o=>{const subtotal=Number((o.unitNet*qty).toFixed(2)),carriage=subtotal>=Number(o.freeCarriageThreshold||Infinity)?0:Number(o.carriageNet||0),totalNet=Number((subtotal+carriage).toFixed(2)),pricePerLitre=o.packLitres?Number((o.unitNet/o.packLitres).toFixed(4)):null,activeEquivalent=o.packLitres&&o.concentrationPct?Number((o.unitNet/(o.packLitres*(o.concentrationPct/100))).toFixed(4)):null,changePct=o.previousNet?Number((((o.unitNet-o.previousNet)/o.previousNet)*100).toFixed(1)):null,priceAgeDays=o.lastUpdated?daysBetween(o.lastUpdated,db.meta.today):null;const {_matchScore,_matchExact,...clean}=o;return {...clean,qty,subtotal,carriage,totalNet,pricePerLitre,activeEquivalent,changePct,priceAgeDays};}).sort((a,b)=>a.totalNet-b.totalNet||a.unitNet-b.unitNet);
  const groupResults=rankedGroups.map(g=>{const offers=priceRows(g.offers);return {key:g.key,score:g.score,productName:g.productName,productFamily:g.productFamily,poolSku:g.poolSku,equivalenceKey:g.equivalenceKey,best:offers[0]||null,offers};});
  const selectedResult=groupResults[0]||null;
  const genericCategory=/\b(pipework|fittings?|chemicals?|products?)\b/i.test(args.query||'')&&!/\b(pipe|elbow|valve|union|chlorine|pump|liner)\b/i.test(String(args.query||'').replace(/pipework/ig,''));
  const comparableGroups=genericCategory?groupResults.filter(g=>g.score>=Math.max(28,(groupResults[0]?.score||0)-20)):selectedResult?[selectedResult]:[];
  return {query:args.query||'',qty,best:selectedResult?.best||null,offers:selectedResult?.offers||[],groups:comparableGroups,matched:candidates.length,selectedGroup:selectedResult?.key||null};
}

const registry={
  get_operational_briefing:{
    permission:'projects.read',description:'Summarise the business with permission-safe risks, wins and meaningful changes.',
    run:({db,user})=>{const a=filterIntelligenceForUser(buildSignals(db),user);return result({attention:a.signals.slice(0,8),wins:a.wins.slice(0,6),changes:visibleEvents(db,user).slice(-8).reverse(),revision:db.meta.revision});}
  },
  get_project_overview:{
    permission:'projects.read',description:'Project status, progress and permission-safe relationships.',
    run:({db,args,user})=>{const g=projectGraph(db,args.projectId);if(!g)return err('Project not found');const raw=explainProjectHealth(db,args.projectId);const health={progress:raw.progress,dueDate:raw.dueDate,status:raw.status};if(can(user,'finance.read'))Object.assign(health,{margin:raw.margin,marginGap:raw.marginGap,unapproved:raw.unapproved,activeHire:raw.activeHire});if(can(user,'purchasing.read'))Object.assign(health,{latePos:raw.latePos,noEta:raw.noEta});const customer=can(user,'customers.read')?g.customer:null;return result({project:{id:g.project.id,name:g.project.name,status:g.project.status,stage:g.project.stage,progress:g.project.progress,dueDate:g.project.dueDate,owner:g.project.owner,notes:g.project.notes},health,customer},[evidence('project',g.project.id,'Project progress','progress',g.project.progress),evidence('project',g.project.id,'Due date','dueDate',g.project.dueDate)]);}
  },
  get_project_financials:{
    permission:'finance.read',description:'Forecast margin, costs, extras and financial exposure for a project.',
    run:({db,args})=>{const g=projectGraph(db,args.projectId);if(!g)return err('Project not found');const p=g.project,margin=((p.quotedNet-p.forecastCost)/p.quotedNet)*100,extras=g.extras.filter(x=>!x.approved),bills=g.supplierBills.filter(x=>x.status!=='Paid'&&!/rejected duplicate/i.test(x.status)),invoices=g.customerInvoices;const data={projectId:p.id,quotedNet:p.quotedNet,actualCost:p.actualCost,committedCost:p.committedCost,forecastCost:p.forecastCost,targetMarginPct:p.targetMarginPct,forecastMarginPct:Number(margin.toFixed(1)),marginGap:Number((margin-p.targetMarginPct).toFixed(1)),unapprovedExtras:extras,supplierBills:bills,customerInvoices:invoices};return result(data,[evidence('project',p.id,'Quoted net','quotedNet',gbp(p.quotedNet)),evidence('project',p.id,'Forecast cost','forecastCost',gbp(p.forecastCost)),evidence('project',p.id,'Forecast margin','forecastMarginPct',margin.toFixed(1)+'%'),...extras.map(x=>evidence('extra',x.id,x.description,'approved',String(x.approved)))]);}
  },
  get_project_materials:{
    permission:'purchasing.read',description:'Purchase orders and blockers related to a project.',
    run:({db,args})=>{const g=projectGraph(db,args.projectId);if(!g)return err('Project not found');const rows=g.purchaseOrders.map(po=>({id:po.id,projectId:po.projectId,supplier:po.supplier,status:po.status,expectedDate:po.expectedDate,daysLate:daysLate(po.expectedDate,db.meta.today),outstanding:outstanding(po)})),blocked=rows.filter(x=>x.outstanding.length&&(x.daysLate>0||!x.expectedDate));return result({projectId:args.projectId,purchaseOrders:rows,blocked},rows.flatMap(po=>[evidence('po',po.id,'PO status','status',po.status),evidence('po',po.id,'Expected date','expectedDate',po.expectedDate||'No ETA'),...po.outstanding.map(l=>evidence('po',po.id,l.name,`line:${l.sku}`,`${l.outstanding} outstanding`))]));}
  },
  get_purchase_order:{
    permission:'purchasing.read',description:'Detailed purchase order status.',
    run:({db,args})=>{const po=db.purchaseOrders[args.poId];if(!po)return err('Purchase order not found');const out=outstanding(po);return result({...po,daysLate:daysLate(po.expectedDate,db.meta.today),outstanding:out},[evidence('po',po.id,'Status','status',po.status),evidence('po',po.id,'Expected date','expectedDate',po.expectedDate||'No ETA'),...out.map(l=>evidence('po',po.id,l.name,`line:${l.sku}`,`${l.outstanding} outstanding`))]);}
  },
  get_stock_position:{
    permission:'stock.read',description:'On-hand, allocated, available and on-order stock for a known Pool Shed SKU.',
    run:({db,args})=>{const p=db.products[args.sku];if(!p)return err('Product not found');const available=Math.max(0,p.onHand-p.allocated);return result({...p,available},[evidence('product',p.sku,'On hand','onHand',p.onHand),evidence('product',p.sku,'Allocated','allocated',p.allocated),evidence('product',p.sku,'Available','available',available),evidence('product',p.sku,'Bin','bin',p.bin),evidence('product',p.sku,'On order','onOrder',p.onOrder)]);}
  },
  find_products:{
    permission:'stock.read',description:'Find exact or closest matching Pool Shed products from natural wording, sizes and aliases. Use this instead of inventing a SKU.',
    run:({db,args})=>{const matches=rankedProducts(db,args.query||'',{limit:Math.min(8,Math.max(1,Number(args.limit||5)))});return result({query:String(args.query||''),matches,exact:Boolean(matches[0]?.exactMatch)},matches.flatMap(p=>[evidence('product',p.sku,p.name,'available',p.available),evidence('product',p.sku,'Bin','bin',p.bin),evidence('product',p.sku,'On order','onOrder',p.onOrder)]));}
  },
  get_hire_costs:{
    permission:'finance.read',description:'Active hire and purchase-equivalent exposure for a project.',
    run:({db,args})=>{const rows=Object.values(db.hires).filter(h=>h.projectId===args.projectId&&h.active).map(h=>({...h,purchaseProgressPct:Number((h.accruedCost/h.purchaseEquivalent*100).toFixed(1))}));return result(rows,rows.flatMap(h=>[evidence('hire',h.id,h.description,'accruedCost',gbp(h.accruedCost)),evidence('hire',h.id,'Daily rate','dailyRate',gbp(h.dailyRate)),evidence('hire',h.id,'Days','accruedDays',h.accruedDays)]));}
  },
  get_active_hire_review:{
    permission:'finance.read',description:'Review all active hired equipment, daily burn, accrued cost and purchase-equivalent exposure.',
    run:({db})=>{const rows=Object.values(db.hires).filter(h=>h.active).map(h=>{const p=db.projects[h.projectId];return {...h,projectName:p?.name||h.projectId,purchaseProgressPct:Number((h.accruedCost/h.purchaseEquivalent*100).toFixed(1))};}).sort((a,b)=>b.purchaseProgressPct-a.purchaseProgressPct);return result(rows,rows.flatMap(h=>[evidence('hire',h.id,h.description,'project',h.projectName),evidence('hire',h.id,'Accrued cost','accruedCost',gbp(h.accruedCost)),evidence('hire',h.id,'Daily burn','dailyRate',gbp(h.dailyRate)),evidence('hire',h.id,'Days on hire','accruedDays',h.accruedDays)]));}
  },
  get_margin_watch:{
    permission:'finance.read',description:'Compare forecast margin versus target across active projects.',
    run:({db})=>{const rows=Object.values(db.projects).filter(p=>p.status==='Active').map(p=>{const forecastMarginPct=((p.quotedNet-p.forecastCost)/p.quotedNet)*100;return {projectId:p.id,projectName:p.name,targetMarginPct:p.targetMarginPct,forecastMarginPct:Number(forecastMarginPct.toFixed(1)),gapPct:Number((forecastMarginPct-p.targetMarginPct).toFixed(1)),quotedNet:p.quotedNet,forecastCost:p.forecastCost};}).sort((a,b)=>a.gapPct-b.gapPct);return result(rows,rows.flatMap(p=>[evidence('project',p.projectId,p.projectName,'forecastMarginPct',`${p.forecastMarginPct}%`),evidence('project',p.projectId,'Margin target','targetMarginPct',`${p.targetMarginPct}%`)]));}
  },
  compare_projects:{
    permission:'projects.read',description:'Compare two to five active projects using the same permission-safe operating measures.',
    run:({db,args,user})=>{const rows=compareProjects(db,args.projectIds||[],user);if(rows.length<2)return err('At least two projects are needed for comparison');const ev=rows.flatMap(p=>[evidence('project',p.projectId,p.projectName,'progress',`${p.progress}%`),...(p.forecastMarginPct===undefined?[]:[evidence('project',p.projectId,'Forecast margin','forecastMarginPct',`${p.forecastMarginPct}%`)]),...(p.outstandingUnits===undefined?[]:[evidence('project',p.projectId,'Outstanding blocked units','outstandingUnits',p.outstandingUnits)])]);return result(rows,ev);}
  },
  get_hidden_risks:{
    permission:'projects.read',description:'Find contradictions, unrecovered cost, waiting customers and other cross-record risks the user may not have asked about.',
    run:({db,args,user})=>{const rows=hiddenRisks(db,user,{projectIds:args.projectIds||[]});return result(rows,rows.flatMap(x=>x.record?[evidence(x.record.type,x.record.id,x.title,'risk',x.summary)]:[]));}
  },
  run_project_scenario:{
    permission:'finance.read',description:'Calculate a what-if project margin scenario without changing any business record.',
    run:({db,args})=>{const s=runProjectScenario(db,args.projectId,{costDelta:args.costDelta,revenueDelta:args.revenueDelta});if(!s)return err('Project not found');return result(s,[evidence('project',s.projectId,'Current forecast cost','forecastCost',gbp(s.current.forecastCost)),evidence('project',s.projectId,'Scenario forecast cost','scenarioForecastCost',gbp(s.scenario.forecastCost)),evidence('project',s.projectId,'Scenario margin','scenarioMarginPct',`${s.scenario.marginPct}%`)]);}
  },
  get_finance_briefing:{
    permission:'finance.read',description:'Bills due, duplicates, customer receipts and cashflow timing risks.',
    run:({db})=>{const unpaid=Object.values(db.supplierBills).filter(x=>x.status!=='Paid'&&!/rejected duplicate/i.test(x.status)),due=[...unpaid].sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate))),groups={};for(const b of unpaid){const k=`${b.supplierId}|${b.invoiceNumber}|${b.amountNet}`;(groups[k]??=[]).push(b);}const duplicates=Object.values(groups).filter(x=>x.length>1).flat(),incoming=Object.values(db.customerInvoices).filter(x=>x.status!=='Paid'),sevenDayTotal=due.filter(x=>new Date(x.dueDate)<=new Date('2026-10-04')).reduce((s,x)=>s+x.amountNet+x.vat,0),risks=[];for(const b of due){const inv=Object.values(db.customerInvoices).find(x=>x.projectId===b.projectId&&x.status!=='Paid');if(inv&&(!inv.expectedPaymentDate||inv.expectedPaymentDate>b.dueDate))risks.push({bill:b,customerInvoice:inv,reason:'Supplier bill due before matching customer cash is expected.'});}return result({billsDue:due,duplicates,cashflowRisks:risks,incomingCustomerInvoices:incoming,sevenDayTotal},[...due.map(x=>evidence('bill',x.id,`${x.supplier} ${x.invoiceNumber}`,'dueDate',`${x.dueDate} · ${gbp(x.amountNet+x.vat)} gross`)),...incoming.map(x=>evidence('invoice',x.id,'Customer invoice','status',`${x.status} · ${gbp(x.amountNet)} net`))]);}
  },
  get_changes_since:{
    permission:'projects.read',description:'Permission-safe system events since a timestamp, optionally filtered to projects in the working set.',
    run:({db,args,user})=>{const since=args.since?new Date(args.since):new Date(0),rows=visibleEvents(db,user,args.projectIds||[]).filter(e=>new Date(e.at)>since);return result(rows,rows.map(x=>evidence(x.entityType,x.entityId,x.summary,'eventAt',x.at)));}
  },
  get_customer_waiting:{
    permission:'customers.read',description:'What customers are waiting on us for and what we are waiting on from them.',
    run:({db,args})=>{const rows=args.customerId?[db.customers[args.customerId]].filter(Boolean):Object.values(db.customers);return result(rows.map(c=>({customerId:c.id,name:c.name,waitingOnUs:c.waitingOnUs,waitingOnCustomer:c.waitingOnCustomer})));}
  },
  get_supplier_price_comparison:{
    permission:'purchasing.read',description:'Compare current recorded supplier prices for a product, including pack size, strength, carriage, freshness and quantity.',
    run:({db,args})=>{const data=supplierPriceComparison(db,args);if(!data.matched)return err('No matching supplier price is recorded');const compared=(data.groups?.length>1?data.groups.flatMap(g=>g.offers):data.offers);const ev=compared.flatMap(o=>{const rows=[evidence('supplier_price',o.id,`${o.supplier} · ${o.productName}`,'unitNet',gbp(o.unitNet)),evidence('supplier_price',o.id,'Price updated','lastUpdated',o.lastUpdated),evidence('supplier_price',o.id,'Delivered comparison','totalNet',`${gbp(o.totalNet)} net for ${data.qty}`)];if(o.packLitres||o.concentrationPct)rows.splice(1,0,evidence('supplier_price',o.id,'Pack and strength','pack',[o.packLitres?`${o.packLitres} L`:null,o.concentrationPct?`${o.concentrationPct}%`:null].filter(Boolean).join(' · ')));return rows;});return result(data,ev);}
  },
  search_system:{
    permission:null,description:'Search only Pool Shed records this user is allowed to see, returning the closest useful matches when wording is not exact.',
    run:({db,args,user})=>{const rows=rankedSystemRecords(db,user,args.query||'',{limit:Math.min(12,Math.max(1,Number(args.limit||8)))});return result(rows,rows.flatMap(x=>x.type==='stock'?[evidence('product',x.id,x.label,'matchScore',x.score)]:[evidence(x.type,x.id,x.label,'matchScore',x.score)]));}
  },
  search_knowledge:{
    permission:'knowledge.read',description:'Search Pool Shed policies and approved internal knowledge only.',
    run:({db,args})=>{const terms=String(args.query||'').toLowerCase().split(/\W+/).filter(x=>x.length>2),rows=db.knowledge.map(k=>({...k,score:terms.reduce((n,t)=>n+(`${k.title} ${k.tags.join(' ')} ${k.text}`.toLowerCase().includes(t)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);return result(rows.slice(0,5),rows.slice(0,5).map(k=>evidence('knowledge',k.id,k.title,'text',k.text)));}
  },
  get_procurement_demand:{
    permission:'purchasing.read',description:'Show what needs ordering now from committed shortages, free stock, incoming stock and reorder levels.',
    run:({db,args})=>{const rows=buildProcurementDemand(db,{includeReorder:args.includeReorder!==false,urgentOnly:Boolean(args.urgentOnly)});return result(rows,rows.flatMap(x=>[evidence('product',x.sku,x.name,'recommendedQty',x.recommendedQty),...x.sources.map(s=>evidence('sales_order',s.salesOrderId,`${s.salesOrderId} · ${s.name}`,`line:${s.sku}`,`${s.shortageQty} unallocated`))]));}
  },
  get_pick_list:{
    permission:'stock.read',description:'Build a bin-sorted picking list for one sales order or all eligible orders.',
    run:({db,args})=>{const data=buildPickList(db,{salesOrderId:args.salesOrderId||null,readyOnly:Boolean(args.readyOnly)});if(args.salesOrderId&&!db.salesOrders?.[args.salesOrderId])return err('Sales order not found');return result({...data,printUrl:args.salesOrderId?`/warehouse/pick-list/${encodeURIComponent(args.salesOrderId)}/print`:null},data.rows.flatMap(x=>[evidence('sales_order',x.salesOrderId,`${x.salesOrderId} · ${x.name}`,`line:${x.sku}`,`${x.pickQty} to pick from ${x.bin}`),evidence('product',x.sku,x.name,'bin',x.bin)]));}
  },
  get_supplier_scorecards:{
    permission:'purchasing.read',description:'Compare supplier on-time performance, issues and average lead time from Pool Shed history.',
    run:({db,args})=>{let rows=supplierScorecards(db);if(args.supplierId)rows=rows.filter(x=>x.supplierId===args.supplierId);return result(rows,rows.flatMap(x=>[evidence('supplier',x.supplierId,x.supplier,'onTimePct',x.onTimePct===null?'Not enough history':`${x.onTimePct}%`),evidence('supplier',x.supplierId,'Average lead time','avgLeadTimeDays',x.avgLeadTimeDays??'Not recorded')]));}
  },
  get_three_way_match:{
    permission:'finance.read',description:'Match supplier bill quantities and prices against linked purchase orders and goods receipts.',
    run:({db,args})=>{const m=threeWayMatch(db,args.billId);if(!m)return err('Supplier bill not found');return result(m,[evidence('bill',m.billId,`${m.supplier} ${m.invoiceNumber}`,'matchStatus',m.status),...m.linkedPoIds.map(id=>evidence('po',id,'Linked PO','threeWayMatch',m.status))]);}
  },
  get_cycle_count_plan:{
    permission:'stock.read',description:'Prioritise cycle counts using count age, discrepancies and stock movement/allocation pressure.',
    run:({db,args})=>{const rows=cycleCountPlan(db,{limit:args.limit||8});return result(rows,rows.map(x=>evidence('product',x.sku,x.name,'cycleCountScore',`${x.score} · ${x.reason}`)));}
  },
  get_exception_inbox:{
    permission:null,description:'Return only actionable purchasing, stock and finance exceptions the current user is allowed to see.',
    run:({db,args,user})=>{const rows=exceptionInbox(db,user,{limit:args.limit||20});return result(rows,rows.flatMap(x=>x.record?[evidence(x.record.type,x.record.id,x.title,'exception',x.summary)]:[]));}
  },
  get_chemical_safety:{
    permission:'knowledge.read',description:'Show Pool Shed-recorded SDS/COSHH-related product safety information only.',
    run:({db,args})=>{const data=chemicalSafety(db,args.sku);if(!data)return err('Product not found');return result(data,[evidence('product',data.sku,data.name,'safetyDocuments',data.documents.length),...data.documents.map(d=>evidence('product',data.sku,d.title,'revisionDate',d.revisionDate))]);}
  },
  prepare_procurement_purchase_orders:{
    permission:'actions.prepare',requires:['purchasing.read'],description:'Prepare grouped draft POs for today’s procurement demand using the best recorded supplier option. Never submits them silently.',action:true,
    run:({db,args})=>{
      const demand=buildProcurementDemand(db,{includeReorder:args.includeReorder!==false,urgentOnly:Boolean(args.urgentOnly)}).filter(x=>x.recommendedQty>0);
      if(!demand.length)return err('There is no current procurement demand to prepare.');
      const groups=new Map();
      for(const d of demand){
        const offer=d.bestSupplier;if(!offer)continue;
        const g=groups.get(offer.supplierId)||{supplierId:offer.supplierId,supplier:offer.supplier,lines:[],subtotalNet:0,carriageNet:0,totalNet:0,freeCarriageThreshold:0};
        const cost=Number((offer.unitNet*d.recommendedQty).toFixed(2));
        g.lines.push({sku:d.sku,name:d.name,qty:d.recommendedQty,unitCost:offer.unitNet,supplierSku:offer.supplierSku,reason:d.priority,sources:d.sources.map(s=>s.salesOrderId),priceLastUpdated:offer.lastUpdated||null});
        g.subtotalNet=Number((g.subtotalNet+cost).toFixed(2));
        g.freeCarriageThreshold=Math.max(g.freeCarriageThreshold,Number(offer.freeCarriageThreshold||0));
        g.carriageNet=Math.max(g.carriageNet,Number(offer.carriageNet||0));
        groups.set(offer.supplierId,g);
      }
      const purchaseOrders=[...groups.values()].map(g=>{const carriage=g.freeCarriageThreshold&&g.subtotalNet>=g.freeCarriageThreshold?0:g.carriageNet;return {...g,carriageNet:carriage,totalNet:Number((g.subtotalNet+carriage).toFixed(2))};});
      if(!purchaseOrders.length)return err('Demand exists, but no approved supplier price is recorded for those items.');
      return result({type:'draft_po_batch',purchaseOrders,totalNet:Number(purchaseOrders.reduce((s,g)=>s+g.totalNet,0).toFixed(2)),requiresApproval:true,reason:'Pool Shed procurement demand'});
    }
  },
  prepare_sales_order_allocation:{
    permission:'actions.prepare',requires:['stock.read'],description:'Prepare stock allocation for a sales order without exceeding free stock. Never mutates stock before approval.',action:true,
    run:({db,args})=>{const so=db.salesOrders?.[args.salesOrderId];if(!so)return err('Sales order not found');const lines=[];for(const l of so.lines||[]){const p=db.products?.[l.sku];if(!p)continue;const remaining=Math.max(0,Number(l.qty||0)-Number(l.allocatedQty||0)),available=Math.max(0,Number(p.onHand||0)-Number(p.allocated||0)),qty=Math.min(remaining,available);lines.push({sku:l.sku,name:l.name||p.name,required:Number(l.qty||0),alreadyAllocated:Number(l.allocatedQty||0),available,allocateQty:qty,shortfallAfter:Math.max(0,remaining-qty)});}return result({type:'sales_order_allocation',salesOrderId:so.id,projectId:so.projectId||null,lines,totalAllocate:lines.reduce((s,x)=>s+x.allocateQty,0),remainingShortfall:lines.reduce((s,x)=>s+x.shortfallAfter,0),requiresApproval:true});}
  },
  prepare_purchase_order:{
    permission:'actions.prepare',requires:['purchasing.read','projects.read'],description:'Prepare, but never silently place, a purchase order.',action:true,
    run:({db,args})=>{const g=projectGraph(db,args.projectId);if(!g)return err('Project not found');const missing=[];for(const po of g.purchaseOrders){if(daysLate(po.expectedDate,db.meta.today)<=0)continue;for(const l of outstanding(po))missing.push({sku:l.sku,name:l.name,qty:l.outstanding,unitCost:l.unitCost,sourcePo:po.id});}const total=missing.reduce((s,x)=>s+x.qty*x.unitCost,0);return result({type:'draft_po',projectId:g.project.id,supplier:args.supplier||'Certikin',reason:args.reason||'Replace overdue missing project items',lines:missing,totalNet:total,requiresApproval:true});}
  },
  prepare_stock_allocation:{
    permission:'actions.prepare',requires:['stock.read','projects.read'],description:'Prepare a stock allocation for approval.',action:true,
    run:({db,args})=>{const p=db.products[args.sku],pr=db.projects[args.projectId];if(!p||!pr)return err('Project or product not found');const available=Math.max(0,p.onHand-p.allocated),qty=Math.max(0,Number(args.qty||1));if(qty>available)return err(`Only ${available} available.`);return result({type:'stock_allocation',projectId:pr.id,sku:p.sku,qty,availableBefore:available,availableAfter:available-qty,requiresApproval:true});}
  },
  prepare_project_extra:{
    permission:'actions.prepare',requires:['projects.read'],description:'Prepare an unapproved project extra for customer review.',action:true,
    run:({db,args})=>{const x=db.extras[args.extraId];if(!x)return err('Extra not found');return result({type:'project_extra',projectId:x.projectId,extraId:x.id,description:x.description,cost:x.cost,suggestedSellPrice:Number((x.cost*1.35).toFixed(2)),requiresApproval:true});}
  },
  prepare_bill_review_batch:{
    permission:'actions.prepare',requires:['finance.read'],description:'Prepare bills for human review. Never pays money.',action:true,
    run:({db,args})=>{const ids=args.billIds||[],bills=ids.map(id=>db.supplierBills[id]).filter(Boolean),totalGross=bills.reduce((s,b)=>s+b.amountNet+b.vat,0);return result({type:'bill_review_batch',billIds:bills.map(b=>b.id),count:bills.length,totalGross,requiresApproval:true,execution:'review_only_never_bank_payment'});}
  },
  prepare_internal_task:{
    permission:'actions.prepare',description:'Prepare an internal Pool Shed task handoff for a named team member. It does not send an external message.',action:true,
    run:({db,args})=>{const assignee=db.users[args.assigneeId];if(!assignee)return err('Team member not found');const contexts=(args.contextRefs||[]).filter(c=>c?.type&&c?.id).slice(0,5);return result({type:'internal_task',assigneeId:assignee.id,assigneeName:assignee.name,summary:String(args.summary||'').trim(),contextRefs:contexts,requiresApproval:true,delivery:'Pool Shed internal task only'});}
  }
};

function extraPermissionsVisible(tool,user){return !(tool.requires||[]).some(permission=>!can(user,permission));}
export function toolDefinitions(user){return Object.entries(registry).filter(([,t])=>visibleTool(t,user)&&extraPermissionsVisible(t,user)).map(([name,t])=>({name,description:t.description,action:Boolean(t.action)}));}
export function executeTool(name,args,user){const tool=registry[name];if(!tool)return err(`Unknown tool: ${name}`);if(tool.permission)requirePermission(user,tool.permission);for(const permission of tool.requires||[])requirePermission(user,permission);return tool.run({db:runtimeSnapshot(),args:args||{},user});}
