import { snapshot as runtimeSnapshot, currentUser as runtimeUser, actionExecutor, isSandbox, demoStoreForDevelopment } from '../data/runtime-data.js';
import { memory } from './memory.js';
import { deterministicPlan } from './planner.js';
import { toolDefinitions, executeTool } from '../tools/registry.js';
import { health as brainHealth, planWithLocalModel, narrateWithLocalModel } from '../local-ai/ollama.js';
import { buildSignals, filterIntelligenceForUser } from './attention.js';
import { projectSnapshot, snapshotDelta } from './intelligence.js';
import { gbp, dedupeEvidence, hash } from './utils.js';
import { normaliseRecordType, recordLinksForAnswer } from './record-links.js';

const currentUser=userId=>runtimeUser(userId);
const actionId=()=>`ACT-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const actionTitle=a=>({draft_po:'Draft purchase order',draft_po_batch:'Draft purchase orders',stock_allocation:'Stock allocation',sales_order_allocation:'Sales order allocation',sales_order_subscription:'Sales Order subscription',project_extra:'Project extra',bill_review_batch:'Bill review batch',internal_task:'Internal task'})[a.type]||'Proposed action';
const asFacts=executions=>executions.map(x=>({tool:x.name,ok:x.result.ok,data:x.result.data,error:x.result.error||null}));
const allEvidence=executions=>dedupeEvidence(executions.flatMap(x=>x.result.evidence||[]));
const projectName=(db,id)=>db.projects[id]?.name||id;
const normalise=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
const answerWords=s=>new Set(normalise(s).replace(/[^a-z0-9. ]/g,' ').split(' ').filter(x=>x.length>2));
function answerSimilarity(a,b){const A=answerWords(a),B=answerWords(b);if(!A.size||!B.size)return 0;let i=0;for(const x of A)if(B.has(x))i++;return i/Math.max(A.size,B.size);}
function searchResultText(row){
  if(!row)return '';
  if(row.type==='stock'){const p=row.obj||{},available=p.available??Math.max(0,Number(p.onHand||0)-Number(p.allocated||0));return `${row.label} (${row.id}) · ${available} free${p.bin?` · bin ${p.bin}`:''}`;}
  return `${row.label} (${row.id})`;
}
const contextKey=c=>c?.type&&c?.id?`${c.type}:${c.id}`:null;
const sameContext=(a,b)=>contextKey(a)===contextKey(b);
const projectContexts=contexts=>(contexts||[]).filter(c=>c.type==='project');

function contextLabel(db,c){
  if(!c)return 'Pool Shed';
  const t=normaliseRecordType(c.type);
  if(t==='project')return db.projects[c.id]?.name||c.id;
  if(t==='po')return c.id;
  if(t==='product')return db.products[c.id]?.name||c.id;
  if(t==='sales_order')return c.id;
  if(t==='customer')return db.customers[c.id]?.name||c.id;
  if(t==='supplier')return db.suppliers[c.id]?.name||c.id;
  if(t==='bill')return db.supplierBills[c.id]?.invoiceNumber||c.id;
  if(t==='invoice')return db.customerInvoices[c.id]?.id||c.id;
  if(t==='hire')return db.hires[c.id]?.description||c.id;
  if(t==='extra')return db.extras[c.id]?.description||c.id;
  if(t==='supplier_price')return db.supplierOffers[c.id]?.productName||c.id;
  if(c.type==='finance')return 'Finance';
  return c.id;
}

function contextAllowed(db,user,c){
  if(!c?.type||!c?.id)return false;const t=normaliseRecordType(c.type),can=p=>user.permissions.includes(p);
  if(t==='project')return can('projects.read')&&Boolean(db.projects[c.id]);
  if(t==='po')return can('purchasing.read')&&Boolean(db.purchaseOrders[c.id]);
  if(t==='product')return can('stock.read')&&Boolean(db.products[c.id]);
  if(t==='sales_order')return can('projects.read')&&Boolean(db.salesOrders[c.id]);
  if(t==='customer')return can('customers.read')&&Boolean(db.customers[c.id]);
  if(t==='supplier')return can('purchasing.read')&&Boolean(db.suppliers[c.id]);
  if(t==='bill')return can('finance.read')&&Boolean(db.supplierBills[c.id]);
  if(t==='invoice')return can('finance.read')&&Boolean(db.customerInvoices[c.id]);
  if(t==='hire')return can('finance.read')&&Boolean(db.hires[c.id]);
  if(t==='extra')return can('finance.read')&&Boolean(db.extras[c.id]);
  if(t==='supplier_price')return can('purchasing.read')&&Boolean(db.supplierOffers[c.id]);
  if(c.type==='finance')return can('finance.read');
  return false;
}
function sanitiseContexts(db,user,contexts){const out=[],seen=new Set();for(const c of contexts||[]){const n={type:c.type==='stock'?'stock':normaliseRecordType(c.type),id:String(c.id||'')},key=contextKey(n);if(!key||seen.has(key)||!contextAllowed(db,user,n))continue;seen.add(key);out.push(n);if(out.length>=5)break;}return out;}

function activeDecisions(session,contexts){const keys=new Set((contexts||[]).map(contextKey));return (session.decisions||[]).filter(d=>d.active!==false&&(!d.contexts?.length||d.contexts.some(c=>keys.has(contextKey(c))))).slice(0,8);}

function compose({intent,executions,session,user,contexts,primaryContext,deltas=[],plan=null,message=''}){
  const db=runtimeSnapshot(),get=name=>executions.find(x=>x.name===name)?.result,decisions=activeDecisions(session,contexts);
  let answer='',followups=[],tone='normal',quickActions=[];
  if(executions.some(x=>x.result.ok===false)){
    const bad=executions.find(x=>x.result.ok===false),recovery=executions.find(x=>x.name==='search_system'&&x.result.ok)?.result?.data||[];
    if(String(bad.result.error||'').startsWith('Permission denied'))return {answer:`That sits outside your Pool Shed access, so I won't expose it here.`,followups:[],quickActions:[],tone:'warning'};
    if(recovery.length){const closest=recovery.slice(0,3).map(searchResultText);return {answer:`I couldn't match that exact record, but the closest things I can see are ${closest.join('; ')}.`,followups:recovery.slice(0,3).map(x=>`Open ${x.id}`),quickActions:[],tone:'steady'};}
    return {answer:`I can't find an exact recorded match for that in Pool Shed. I also checked the closest related records, but nothing is similar enough to recommend confidently.`,followups:[],quickActions:[],tone:'warning'};
  }
  switch(intent){
    case 'greeting':{
      const {signals,wins}=filterIntelligenceForUser(buildSignals(db),user),high=signals.filter(x=>x.severity>=80);
      const hour=new Date().getHours(),hello=hour<12?'Morning':hour<18?'Afternoon':'Evening';answer=`${hello}, ${user.name}. I'm here.`;if(high.length)answer+=` ${high.length===1?'One thing needs':'A couple of things need'} your attention when you're ready.`;else if(wins.length)answer+=` Nothing critical is jumping out, and there is some good movement in the system.`;else answer+=` Nothing urgent is jumping out right now.`;
      followups=['What needs me today?','What changed?'];break;
    }
    case 'smalltalk':answer=`I'm good. Keeping the moving parts organised so you don't have to hold all of them in your head. What are we sorting?`;break;
    case 'conversation':answer=`Any time. I'm with you.`;break;
    case 'context_add':{
      const names=(contexts||[]).map(c=>contextLabel(db,c));answer=`Added. I'm now holding ${names.join(names.length>2?', ': ' and ')} together in this conversation.`;followups=projectContexts(contexts).length>=2?['Compare these projects','What am I missing across them?']:[];break;
    }
    case 'context_remove':answer=`Done. I've dropped that from the working set and kept ${contexts.map(c=>contextLabel(db,c)).join(' and ')} in focus.`;break;
    case 'context_only':answer=`Done. I'm focused on ${contexts.map(c=>contextLabel(db,c)).join(' and ')} now.`;break;
    case 'watch':{const watched=(plan?.contextRefs?.length?plan.contextRefs:contexts);answer=`I'll keep an eye on ${watched.map(c=>contextLabel(db,c)).join(' and ')}. I'll only flag it when something meaningful changes.`;followups=['What am I missing here?'];break;}
    case 'unwatch':answer=`No problem. I won't treat that as something you're actively watching now.`;break;
    case 'decision':{
      const d=session.decisions?.[0];answer=d?`Got it. I'll keep that decision in mind: “${d.text}”`:`Got it. I'll keep that decision in mind for this work.`;followups=['What does that decision affect?'];break;
    }
    case 'briefing':{
      const b=get('get_operational_briefing')?.data,hidden=get('get_hidden_risks')?.data||[],top=b?.attention?.slice(0,3)||[],wins=b?.wins?.slice(0,2)||[];
      const trends=get('get_order_trends')?.data||null,subscriptions=get('get_subscription_review')?.data||null;
      if(!top.length)answer='Nothing urgent is standing out right now.';else{answer=`There are ${top.length} things I'd put at the top of the list: ${top.map((x,i)=>`${i+1}) ${x.title}`).join('; ')}.`;if(wins.length)answer+=` The good news is ${wins.map(x=>x.title.toLowerCase()).join(' and ')}.`;}
      const extra=hidden.find(x=>!top.some(t=>t.id===x.id));if(extra)answer+=` One less obvious thing I'd also keep in sight is ${extra.title.toLowerCase()}.`;
      if(trends?.replenishmentRecommendations?.length){const row=trends.replenishmentRecommendations[0];answer+=` Commercially, I'd review ${row.name}: ${row.reason}`;}
      if(subscriptions?.due?.length)answer+=` ${subscriptions.due.length} recurring Sales Order subscription${subscriptions.due.length===1?' is':'s are'} due for review now.`;
      else if(subscriptions?.candidates?.length)answer+=` I can also see ${subscriptions.candidates.length} repeat-order pattern${subscriptions.candidates.length===1?'':'s'} worth reviewing as subscription opportunities.`;
      followups=['Start with the highest risk','Show order trends','Show subscription opportunities'];break;
    }
    case 'changes':{
      const rows=get('get_changes_since')?.data||[],meaningful=deltas.flatMap(d=>(d?.changes||[]).map(c=>`${d.name}: ${c.text}`));
      if(meaningful.length)answer=`Since we last held these jobs in context: ${meaningful.slice(0,5).join('; ')}.`;else if(rows.length)answer=`${rows.length} thing${rows.length===1?' has':'s have'} changed since we last looked. ${rows.slice(-4).reverse().map(x=>x.summary).join(' ')}`;else answer='Nothing new has been recorded since we last looked.';
      followups=['What needs my attention now?'];break;
    }
    case 'compare_projects':{
      const rows=get('compare_projects')?.data||[];if(rows.length<2){answer='I need at least two projects in the working set to compare them.';break;}
      const parts=rows.map(r=>{let s=`${r.projectName}: ${r.progress}% complete`;if(r.forecastMarginPct!==undefined)s+=`, ${r.forecastMarginPct}% forecast margin`;if(r.blockedPos!==undefined)s+=`, ${r.blockedPos.length} purchasing blocker${r.blockedPos.length===1?'':'s'}`;if(r.activeHireCost!==undefined)s+=`, ${gbp(r.activeHireCost)} active hire`;return s;});
      answer=`Side by side, ${parts.join('. ')}.`;
      if(rows.every(r=>r.forecastMarginPct!==undefined)){const margin=[...rows].sort((a,b)=>a.marginGapPct-b.marginGapPct),hire=[...rows].sort((a,b)=>(b.activeHireCost||0)-(a.activeHireCost||0));answer+=` ${margin[0].projectName} has the most margin pressure against target${hire[0].activeHireCost?`, while ${hire[0].projectName} has the highest active hire exposure`:''}.`;}
      if(decisions.length)answer+=` I'm also keeping ${decisions.length} active decision${decisions.length===1?'':'s'} in mind while comparing them.`;
      followups=['Which one is worse for cashflow?','Compare stock and purchasing','What am I missing across them?'];quickActions=[{label:'What am I missing?',prompt:'What am I missing across these projects?'},{label:'Test a scenario',prompt:`What happens if ${rows[0].projectName} costs another £2,000?`}];break;
    }
    case 'hidden_risks':{
      const rows=get('get_hidden_risks')?.data||[];if(!rows.length){answer=`I can't see a hidden contradiction or cross-record risk in the current working set.`;break;}
      answer=`There ${rows.length===1?'is one thing':'are a few things'} you may not have asked about. ${rows.slice(0,3).map(x=>`${x.title}: ${x.summary}`).join(' ')} `;answer=answer.trim();
      followups=['Talk me through the first one','What would you do first?'];break;
    }
    case 'scenario':{
      const s=get('run_project_scenario')?.data;if(!s){answer='I can’t calculate that scenario from the current project data.';break;}
      const delta=s.scenario.marginChangePct;answer=`If ${s.projectName} takes another ${gbp(s.scenario.costDelta)} of cost${s.scenario.revenueDelta?` and ${gbp(s.scenario.revenueDelta)} of extra revenue`:''}, forecast margin moves from ${s.current.marginPct}% to ${s.scenario.marginPct}% (${Math.abs(delta).toFixed(1)} points ${delta<0?'down':'up'}). This is scenario-only; I haven't changed the project.`;followups=['What cost would take us below 20%?','Compare that with the other project'];break;
    }
    case 'project_health':{
      const o=get('get_project_overview')?.data,f=get('get_project_financials')?.data,m=get('get_project_materials')?.data;if(!o){answer='I can’t find that project.';break;}const risks=[];if(f&&f.marginGap<0)risks.push(`forecast margin is ${Math.abs(f.marginGap).toFixed(1)} points below target`);if(m?.blocked?.length)risks.push(`${m.blocked.length} purchasing blocker${m.blocked.length===1?'':'s'}`);if(f?.unapprovedExtras?.length)risks.push(`${f.unapprovedExtras.length} unapproved extra${f.unapprovedExtras.length===1?'':'s'}`);answer=`${o.project.name} is ${o.project.progress}% complete and ${o.project.status.toLowerCase()}. ${risks.length?`The main pressure points are ${risks.join(', ')}.`:'Nothing major is currently out of line.'}`;if(f)answer+=` Forecast margin is ${f.forecastMarginPct}% against a ${f.targetMarginPct}% target.`;if(decisions.length)answer+=` There is also an active decision in this thread that I'm keeping in mind.`;followups=['Why is that a problem?','What are we waiting for?','What is going well?','What would you do next?'];break;
    }
    case 'project_finance':{
      const f=get('get_project_financials')?.data,h=get('get_hire_costs')?.data||[];if(!f){answer='I can’t find financial data for that project.';break;}answer=`Forecast margin is ${f.forecastMarginPct}% against a ${f.targetMarginPct}% target, with ${gbp(f.forecastCost)} forecast cost against ${gbp(f.quotedNet)} quoted net.`;if(f.marginGap<0)answer+=` That leaves it ${Math.abs(f.marginGap).toFixed(1)} points below target.`;if(f.unapprovedExtras.length)answer+=` There ${f.unapprovedExtras.length===1?'is':'are'} ${f.unapprovedExtras.length} unapproved extra${f.unapprovedExtras.length===1?'':'s'} carrying ${gbp(f.unapprovedExtras.reduce((s,x)=>s+x.cost,0))} of cost.`;if(h.length)answer+=` Active hire has reached ${gbp(h.reduce((s,x)=>s+x.accruedCost,0))}.`;followups=['Why is that a problem?','Prepare the unapproved extra','Run a £2,000 cost scenario'];break;
    }
    case 'project_materials':{
      const m=get('get_project_materials')?.data;if(!m){answer='I can’t find purchasing data for that project.';break;}if(!m.blocked.length)answer=`I can’t see a current purchasing blocker on ${projectName(db,m.projectId||primaryContext?.id)}.`;else{const rows=m.blocked.flatMap(po=>po.outstanding.map(l=>`${l.outstanding} × ${l.name} on ${po.id}${po.daysLate?` (${po.daysLate} days late)`:' with no ETA'}`));answer=`The job is currently waiting on ${rows.join('; ')}.`;}followups=['Why does that matter?','What would you do next?','Create a draft PO for overdue items'];break;
    }
    case 'sales_order':{
      const so=get('get_sales_order')?.data;if(!so){answer='I can’t find that sales order.';break;}
      const qty=(so.lines||[]).reduce((s,l)=>s+Number(l.qty||0),0),allocated=(so.lines||[]).reduce((s,l)=>s+Number(l.allocatedQty||0),0),picked=(so.lines||[]).reduce((s,l)=>s+Number(l.pickedQty||0),0),packed=(so.lines||[]).reduce((s,l)=>s+Number(l.packedQty||0),0);
      answer=`${so.id} is ${so.status}. It has ${so.lines.length} line${so.lines.length===1?'':'s'} and ${qty} unit${qty===1?'':'s'} recorded; ${allocated} allocated, ${picked} picked and ${packed} packed.`;
      if(so.customer?.name)answer+=` Customer: ${so.customer.name}.`;
      if(so.project?.name)answer+=` Project: ${so.project.name}.`;
      if(so.dueDate)answer+=` Due ${so.dueDate}.`;
      if(so.totalNet||so.calculatedNet)answer+=` Recorded/calculated net value is ${gbp(so.totalNet||so.calculatedNet)}.`;
      if(so.linkedPurchaseOrders?.length)answer+=` It is linked to ${so.linkedPurchaseOrders.length} purchase order${so.linkedPurchaseOrders.length===1?'':'s'}: ${so.linkedPurchaseOrders.map(x=>x.id).join(', ')}.`;
      const shortages=(so.lines||[]).filter(l=>l.product&&Number(l.qty||0)>Number(l.allocatedQty||0)&&Number(l.product.available||0)<Math.max(0,Number(l.qty||0)-Number(l.allocatedQty||0)));
      if(shortages.length)answer+=` Current stock still leaves ${shortages.length} line${shortages.length===1?'':'s'} exposed.`;
      followups=['Show me every line on this order','What is still short?','Show linked purchase orders'];break;
    }
    case 'po':{
      const po=get('get_purchase_order')?.data;if(!po){answer='I can’t find that purchase order.';break;}const missing=po.outstanding.map(x=>`${x.outstanding} × ${x.name}`).join(', ');if(!po.outstanding.length)answer=`${po.id} is complete. Everything recorded on it has been received.`;else answer=`${po.id} from ${po.supplier} still has ${missing}. ${po.expectedDate?(po.daysLate?`It is ${po.daysLate} days late against the ${po.expectedDate} ETA.`:`Its recorded ETA is ${po.expectedDate}.`):`There isn't a confirmed ETA recorded.`}`;if(po.linkedSalesOrders?.length)answer+=` It is linked to ${po.linkedSalesOrders.map(x=>x.id).join(', ')}.`;if(po.receipts?.length)answer+=` ${po.receipts.length} goods-receipt record${po.receipts.length===1?' is':'s are'} attached.`;followups=['Show every PO line','Compare its prices with current supplier prices','Show linked sales orders'];break;
    }
    case 'product_detail':{
      const p=get('get_product_record')?.data;if(!p){answer='I can’t find that product record.';break;}
      answer=`${p.name} (${p.sku}) has ${p.onHand} on hand, ${p.allocated} allocated and ${p.available} free, with ${p.onOrder} on order.`;
      if(p.unitCost)answer+=` Current product cost is ${gbp(p.unitCost)}.`;
      const sell=[];if(p.rrp)sell.push(`RRP ${gbp(p.rrp)}`);if(p.trade)sell.push(`trade ${gbp(p.trade)}`);if(p.wholesale)sell.push(`wholesale ${gbp(p.wholesale)}`);if(sell.length)answer+=` Pool Shed selling prices: ${sell.join(', ')}.`;
      if(p.bestSupplier)answer+=` Best currently recorded approved supplier offer is ${p.bestSupplier.supplier} at ${gbp(p.bestSupplier.unitNet)} net${p.bestSupplier.lastUpdated?`, updated ${p.bestSupplier.lastUpdated}`:''}.`;
      if(p.openSalesDemand?.length)answer+=` It appears on ${p.openSalesDemand.length} open Sales Order demand line${p.openSalesDemand.length===1?'':'s'}.`;
      if(p.inboundPurchaseOrders?.length)answer+=` There ${p.inboundPurchaseOrders.length===1?'is':'are'} ${p.inboundPurchaseOrders.length} inbound PO line${p.inboundPurchaseOrders.length===1?'':'s'}.`;
      followups=['Compare every supplier price','Show open sales demand','Show inbound purchase orders'];break;
    }
    case 'product_search':{
      const p=get('find_products')?.data,rows=p?.matches||[],query=plan?.working?.query||p?.query||message;
      if(!rows.length){answer=`I can’t find an exact product matching “${query}”, and there isn’t a close enough recorded product for me to recommend confidently.`;followups=['Search all Pool Shed records'];break;}
      const top=rows[0],exact=Boolean(top.exactMatch),show=rows.slice(0,3);
      if(plan?.working?.recovery){const [first,...rest]=show;answer=`Yes. The closest thing I can match in Pool Shed is ${first.name} (${first.sku}): ${first.available} free${first.bin?` in ${first.bin}`:''}${first.onOrder?`, plus ${first.onOrder} on order`:''}.`;if(rest.length)answer+=` The next closest ${rest.length===1?'match is':'matches are'} ${rest.map(x=>`${x.name} (${x.sku}), ${x.available} free${x.bin?` in ${x.bin}`:''}`).join('; ')}.`;answer+=` I still can’t see an exact product matching “${query}”.`;}
      else if(exact){answer=`I found ${rows.length===1?'a matching product':'matching products'} for that. ${show.map(x=>`${x.name} (${x.sku}) has ${x.available} free${x.bin?` in ${x.bin}`:''}${x.onOrder?`, with ${x.onOrder} on order`:''}`).join('; ')}.`;}
      else{answer=`I can’t see an exact product called “${query}”, but the closest recorded matches are ${show.map(x=>`${x.name} (${x.sku}) with ${x.available} free${x.bin?` in ${x.bin}`:''}`).join('; ')}.`;}
      followups=show.map(x=>`Open ${x.sku}`).slice(0,3);break;
    }
    case 'stock':{
      const s=get('get_stock_position')?.data;if(!s){answer='I can’t find that stock item.';break;}answer=`${s.name} is in ${s.bin}. There are ${s.onHand} physically on hand, ${s.allocated} allocated and ${s.available} free to use, with ${s.onOrder} on order.`;followups=['Which jobs are using it?','Allocate stock to this project'];break;
    }
    case 'margin_watch':{
      const rows=get('get_margin_watch')?.data||[];if(!rows.length){answer=`I can't see any active project margin data.`;break;}const below=rows.filter(x=>x.gapPct<0),above=rows.filter(x=>x.gapPct>=0).sort((a,b)=>b.gapPct-a.gapPct);if(below.length)answer=`${below.length} active project${below.length===1?' is':'s are'} below target margin. ${below.slice(0,3).map(x=>`${x.projectName} is ${x.forecastMarginPct}% against ${x.targetMarginPct}%`).join('; ')}.`;else answer='All active projects with recorded financials are currently on or above target margin.';if(above.length)answer+=` Best relative position is ${above[0].projectName} at ${above[0].forecastMarginPct}% against a ${above[0].targetMarginPct}% target.`;followups=['Why is the weakest job below target?','Compare Williams and Jones','What should I focus on?'];break;
    }
    case 'hire_review':{
      const rows=get('get_active_hire_review')?.data||[];if(!rows.length){answer=`There isn't any active hire recorded right now.`;break;}const top=rows[0],daily=rows.reduce((s,x)=>s+x.dailyRate,0),accrued=rows.reduce((s,x)=>s+x.accruedCost,0);answer=`There are ${rows.length} active hire item${rows.length===1?'':'s'} costing ${gbp(daily)} per day, with ${gbp(accrued)} accrued so far. ${top.description} on ${top.projectName} is the one I'd review first: ${top.accruedDays} days on hire and ${top.purchaseProgressPct}% of its purchase-equivalent cost already spent.`;followups=['Show the margin impact','What should go back first?'];break;
    }
    case 'hire':{
      const rows=get('get_hire_costs')?.data||[];if(!rows.length){answer='I can’t find active hire against this project.';break;}answer=rows.map(x=>`${x.description} has been on hire ${x.accruedDays} days at ${gbp(x.dailyRate)}/day, so it has accrued ${gbp(x.accruedCost)}. That's ${x.purchaseProgressPct}% of the purchase-equivalent cost.`).join(' ');followups=['What would you do next?','Show the project margin impact'];break;
    }
    case 'procurement_demand':{
      const rows=get('get_procurement_demand')?.data||[];if(!rows.length){answer=`You're covered on the recorded demand. I can't see anything that needs ordering right now.`;break;}const urgent=rows.filter(x=>x.priorityScore>=78),replen=rows.length-urgent.length;answer=`I can see ${rows.length} product${rows.length===1?'':'s'} worth ordering. ${urgent.length?`${urgent.length} ${urgent.length===1?'is':'are'} tied to committed or near-term demand`:''}${urgent.length&&replen?', and ':''}${replen?`${replen} ${replen===1?'is':'are'} replenishment`:''}.`;answer+=` I'd start with ${rows.slice(0,5).map(x=>{const source=x.sources?.[0],why=source?` for ${source.salesOrderId}${source.projectName?` on ${source.projectName}`:''}`:x.priority==='Below reorder level'?' to restore the stock floor':'';return `${x.name} (${x.sku}): order ${x.recommendedQty}${why}${x.bestSupplier?` from ${x.bestSupplier.supplier} based on the recorded delivered price`:''}`;}).join('; ')}.`;followups=['Create draft POs for everything urgent','Why do I need these quantities?','Show supplier comparisons'];quickActions=[{label:'Prepare urgent POs',prompt:'Create draft POs for everything urgent today'}];break;
    }
    case 'pick_list':{
      const p=get('get_pick_list')?.data;if(!p?.rows?.length){answer=`There isn't a picking list to build from the current recorded orders.`;break;}answer=`I've built the pick in bin order for ${p.orders.length} sales order${p.orders.length===1?'':'s'}, covering ${p.rows.length} line${p.rows.length===1?'':'s'}.`;if(p.shortfall)answer+=` There are ${p.shortfall} unit${p.shortfall===1?'':'s'} still short, so I wouldn't mark the whole pick complete.`;else answer+=` The recorded allocation supports the full pick.`;if(p.salesOrderId&&p.printUrl)answer+=` The print-ready list is available for ${p.salesOrderId}.`;followups=p.salesOrderId?['Print this picking list',`Allocate available stock to ${p.salesOrderId}`]:['Open the first ready order'];quickActions=p.printUrl?[{label:'Print picking list',href:p.printUrl}]:[];break;
    }
    case 'supplier_scorecard':{
      const rows=get('get_supplier_scorecards')?.data||[];if(!rows.length){answer=`I don't have enough recorded supplier performance to compare them yet.`;break;}const top=rows[0],weak=[...rows].sort((a,b)=>(a.onTimePct??101)-(b.onTimePct??101))[0];answer=`From the recorded delivery history, ${top.supplier} has the strongest on-time position${top.onTimePct===null?' with limited history':` at ${top.onTimePct}% on time`}.`;if(weak&&weak.supplierId!==top.supplierId&&weak.onTimePct!==null)answer+=` ${weak.supplier} is the one I'd watch most at ${weak.onTimePct}% on time.`;followups=['Who is cheapest for 1.5 inch pipework?','Show me supplier lead times'];break;
    }
    case 'invoice_match':{
      const m=get('get_three_way_match')?.data;if(!m){answer=`I can't find that supplier bill to match it.`;break;}if(m.status==='Matched')answer=`${m.supplier} invoice ${m.invoiceNumber} matches the recorded PO and goods-receipt quantities and prices.`;else answer=`${m.supplier} invoice ${m.invoiceNumber} needs review. ${m.exceptions.length} line${m.exceptions.length===1?' does':'s do'} not fully match the linked PO and goods receipts.`;answer+=` PO value is ${gbp(m.poNet)}, received value ${gbp(m.receivedNet)}, and the supplier bill is ${gbp(m.billNet)} net.`;followups=['Open the supplier bill','Show the mismatched lines'];break;
    }
    case 'cycle_count':{
      const rows=get('get_cycle_count_plan')?.data||[];if(!rows.length){answer=`I don't have enough stock data to recommend a cycle count.`;break;}answer=`I'd count ${rows.slice(0,4).map(x=>`${x.name} in ${x.bin} (${x.reason.toLowerCase()})`).join('; ')}.`;followups=['Open the first product','What stock is affecting orders?'];break;
    }
    case 'exception_inbox':{
      const rows=get('get_exception_inbox')?.data||[];if(!rows.length){answer=`Nothing currently needs a decision from you based on the records you can access.`;break;}answer=`There are ${rows.length} things that genuinely need a decision or action. I'd work through ${rows.slice(0,4).map((x,i)=>`${i+1}) ${x.title}`).join('; ')}.`;followups=['Start with number 1','What can wait?'];break;
    }
    case 'chemical_safety':{
      const d=get('get_chemical_safety')?.data;if(!d){answer=`I can't find recorded safety information for that product.`;break;}if(!d.documents.length)answer=`${d.name} is recorded, but there isn't an SDS or safety document linked to it in Pool Shed.`;else{answer=`${d.name} has ${d.current.length?`${d.current.length} current safety document${d.current.length===1?'':'s'}`:`${d.documents.length} safety document${d.documents.length===1?'':'s'} but none marked current`}.`;const controls=d.current.flatMap(x=>x.controls||[]).slice(0,4);if(controls.length)answer+=` The recorded controls include ${controls.join('; ')}.`;answer+=` ${d.warning}`;}followups=['Open the product'];break;
    }
    case 'supplier_price':{
      const p=get('get_supplier_price_comparison')?.data;if(!p?.best){answer=`I don't have a matching supplier price recorded in Pool Shed, so I won't guess.`;break;}
      if(p.groups?.length>1){answer=`I found ${p.groups.length} different matching product groups, so I won't compare unlike items as though they're the same product. `+p.groups.slice(0,4).map(g=>{const b=g.best;if(!b)return g.productName;const qty=p.qty>1?` For ${p.qty}, the recorded delivered total is ${gbp(b.totalNet)} net.`:'';return `${g.productName}: ${b.supplier} is cheapest at ${gbp(b.unitNet)} net per unit.${qty}`;}).join(' ');followups=['Compare the pressure pipe only','Compare the elbows only','Show supplier performance'];break;}
      const b=p.best,others=p.offers.slice(1,3),pack=b.packLitres?`${b.packLitres} L pack`:'unit';answer=`${b.supplier} is the best recorded option for ${b.productName} at ${gbp(b.unitNet)} net per ${pack}.`;if(p.qty>1)answer+=` For ${p.qty}, that's ${gbp(b.subtotal)} net${b.carriage?` plus ${gbp(b.carriage)} recorded carriage`:' with no recorded carriage at that order value'}, ${gbp(b.totalNet)} net in total.`;else if(b.carriage)answer+=` For one, the recorded carriage takes that to ${gbp(b.totalNet)} net.`;if(others.length)answer+=` The next recorded prices are ${others.map(o=>`${o.supplier} ${gbp(o.unitNet)}`).join(' and ')}.`;answer+=` ${b.supplier}'s price was last updated ${b.lastUpdated}.`;if(b.changePct!==null&&b.changePct!==undefined&&Math.abs(b.changePct)>=.1)answer+=` That's ${Math.abs(b.changePct).toFixed(1)}% ${b.changePct>0?'higher':'lower'} than its previous recorded price.`;if(b.priceAgeDays>60)answer+=` That price is ${b.priceAgeDays} days old, so I'd treat it as needing confirmation.`;followups=['Compare a larger quantity','Show supplier performance','Create a draft PO'];break;
    }
    case 'finance':{
      const f=get('get_finance_briefing')?.data;if(!f){answer='I can’t access the finance briefing.';break;}answer=`Supplier bills due in the next seven days total ${gbp(f.sevenDayTotal)} gross.`;if(f.duplicates.length)answer+=` The standout issue is a possible duplicate: ${f.duplicates[0].supplier} invoice ${f.duplicates[0].invoiceNumber} appears more than once.`;if(f.cashflowRisks.length)answer+=` ${f.cashflowRisks.length} bill${f.cashflowRisks.length===1?' is':'s are'} due before the matching customer cash is expected.`;followups=['Show me the duplicate bill','Which bills create cashflow pressure?','What would you do next?'];break;
    }
    case 'next_step':
    case 'explain_followup':{
      const o=get('get_project_overview')?.data,f=get('get_project_financials')?.data,m=get('get_project_materials')?.data,po=get('get_purchase_order')?.data,s=get('get_stock_position')?.data,fin=get('get_finance_briefing')?.data;if(o){const bits=[];if(f?.marginGap<0)bits.push(`margin is ${Math.abs(f.marginGap).toFixed(1)} points below target`);if(f?.unapprovedExtras?.length)bits.push(`${f.unapprovedExtras.length} extra${f.unapprovedExtras.length===1?' is':'s are'} still unapproved`);if(m?.blocked?.length)bits.push(`${m.blocked.length} purchasing blocker${m.blocked.length===1?' remains':'s remain'}`);answer=`On ${o.project.name}, ${bits.length?bits.join(', '):'the current records do not show a major exception'}.`;if(decisions.length)answer+=` I wouldn't override your active decision: “${decisions[0].text}”`;}else if(po)answer=`${po.id} still has ${po.outstanding.reduce((n,x)=>n+x.outstanding,0)} unit${po.outstanding.reduce((n,x)=>n+x.outstanding,0)===1?'':'s'} outstanding${po.daysLate?` and is ${po.daysLate} days late`:''}.`;else if(s)answer=`There are ${s.available} ${s.name} free to use from ${s.bin}, with ${s.onOrder} on order.`;else if(fin)answer=`There are ${fin.cashflowRisks.length} cashflow timing risk${fin.cashflowRisks.length===1?'':'s'} and ${fin.duplicates.length?'a possible duplicate supplier invoice':'no duplicate supplier invoice currently flagged'}.`;else answer=`I have the current context, but I don't have enough system facts to explain that confidently.`;followups=intent==='next_step'?['Show me the highest-impact action','What changed today?']:['What would you do next?'];break;
    }
    case 'customer_lookup':{
      const r=get('find_customers')?.data;if(!r?.matches?.length){answer='I can’t find a customer close enough to that name in Pool Shed.';break;}
      const best=r.best,options=r.matches.slice(0,3);
      if(r.confident&&best){
        const customer=best.customer,detail=best.customer;
        answer=best.exactMatch?`I found ${customer.name}.`:`I think you mean ${customer.name}.`;
        if(detail.orderCount!==undefined)answer+=` They have ${detail.orderCount} recorded Sales Order${detail.orderCount===1?'':'s'}${detail.subscriptions?.length?` and ${detail.subscriptions.length} recurring subscription${detail.subscriptions.length===1?'':'s'}`:''}.`;
        followups=[`Show everything for ${customer.name}`,`What has ${customer.name} ordered?`,`Check subscription opportunities for ${customer.name}`];
      }else{
        answer=`I found a few close customer matches. Did you mean ${options.map(x=>x.customer.name).join(', ')}?`;
        followups=options.map(x=>`Open ${x.customer.name}`);
      }
      break;
    }
    case 'customer_record':{
      const customer=get('get_customer_record')?.data;if(!customer){answer='I can’t find that customer record.';break;}
      answer=`${customer.name} has ${customer.orderCount} recorded Sales Order${customer.orderCount===1?'':'s'}`;
      if(customer.projects?.length)answer+=`, ${customer.projects.length} linked project${customer.projects.length===1?'':'s'}`;
      if(customer.quotes?.length)answer+=`, ${customer.quotes.length} quote${customer.quotes.length===1?'':'s'}`;
      if(customer.subscriptions?.length)answer+=` and ${customer.subscriptions.length} recurring Sales Order subscription${customer.subscriptions.length===1?'':'s'}`;
      answer+='.';
      const open=(customer.salesOrders||[]).filter(x=>!/shipped|completed|invoiced|cancel/i.test(x.status||''));if(open.length)answer+=` ${open.length} order${open.length===1?' is':'s are'} currently open: ${open.slice(0,4).map(x=>x.id+' ('+x.status+')').join(', ')}.`;
      followups=['Show their recent orders','Recommend products for this customer','Check whether they suit a subscription'];break;
    }
    case 'stock_movement':{
      const m=get('get_stock_movement_insights')?.data;if(!m){answer='I can’t read the stock movement history.';break;}
      if(m.sku&&m.products?.length){const x=m.products[0];answer=`${x.name} has ${x.outboundQty} outbound and ${x.inboundQty} inbound units across the last ${m.days} days.`;if(x.weeksCover!==null)answer+=` Current free stock is about ${x.weeksCover} weeks of cover at that recorded movement rate.`;if(x.trendPct)answer+=` Outbound movement is ${x.trendPct>0?'up':'down'} ${Math.abs(x.trendPct)}% versus the previous half of that period.`;}
      else if(m.fastMovers?.length){answer=`Across the last ${m.days} days, the fastest-moving recorded products are ${m.fastMovers.slice(0,5).map(x=>x.name+' ('+x.outboundQty+' outbound)').join('; ')}.`;}
      else answer=`I can’t see qualifying stock movements in the last ${m.days} days.`;
      followups=['Which fast movers are at risk of running out?','Show 30-day movement','Show reorder recommendations'];break;
    }
    case 'order_trends':{
      const t=get('get_order_trends')?.data;if(!t){answer='I can’t calculate order trends from the current records.';break;}
      if(t.trendingSales?.length)answer=`From the last ${t.days} days, the strongest current Sales Order demand is ${t.trendingSales.slice(0,5).map(x=>x.name+' ('+x.currentUnits+' recent units, '+(x.growthPct>=0?'+':'')+x.growthPct+'%)').join('; ')}.`;
      else answer=`There is not enough recent Sales Order history in the last ${t.days} days to establish a reliable product trend.`;
      if(t.purchaseTrends?.length){const rising=t.purchaseTrends.filter(x=>x.costTrendPct!==null&&x.costTrendPct>0).slice(0,3);if(rising.length)answer+=` Purchase cost is also rising on ${rising.map(x=>x.name+' ('+x.costTrendPct+'%)').join('; ')}.`;}
      if(t.replenishmentRecommendations?.length)answer+=` I would review stock settings on ${t.replenishmentRecommendations.slice(0,3).map(x=>x.name).join(', ')} before the next buying run.`;
      followups=['Show PO buying trends','Show stock movement behind this','Which reorder points should we review?'];break;
    }
    case 'product_recommendations':{
      const r=get('get_product_recommendations')?.data;if(!r){answer='I can’t build product recommendations from the current order history.';break;}
      const bits=[];if(r.relatedProducts?.length)bits.push('Products commonly ordered alongside it are '+r.relatedProducts.slice(0,5).map(x=>x.name+' ('+x.coOrderCount+' shared orders)').join(', '));
      if(r.customerRepeatProducts?.length)bits.push('Likely customer reorders are '+r.customerRepeatProducts.slice(0,5).map(x=>x.name+' ('+x.orderCount+' orders'+(x.cadence?' · '+x.cadence:'')+')').join(', '));
      answer=bits.length?bits.join('. ')+'.':'I do not have enough repeat/co-order history yet to make a useful recommendation.';
      followups=['Check subscription opportunities','Show demand trends','Compare supplier prices for the top recommendation'];break;
    }
    case 'subscription_review':{
      const s=get('get_subscription_review')?.data;if(!s){answer='I can’t review recurring Sales Orders right now.';break;}
      answer=`There are ${s.active.length} active recurring Sales Order subscription${s.active.length===1?'':'s'}.`;
      if(s.due.length)answer+=` ${s.due.length} ${s.due.length===1?'is':'are'} due now: ${s.due.slice(0,4).map(x=>x.name+' ('+x.nextOrderDate+')').join(', ')}.`;
      if(s.candidates.length)answer+=` I also found ${s.candidates.length} evidence-based subscription opportunit${s.candidates.length===1?'y':'ies'}. The strongest ${s.candidates.length===1?'is':'are'} ${s.candidates.slice(0,4).map(x=>x.customerName+' · '+x.cadence+' · '+x.lines.map(l=>l.name).join(' + ')).join('; ')}.`;
      else if(!s.due.length)answer+=' I do not see a strong new repeat-order pattern yet.';
      followups=['Show the strongest subscription candidate','Which subscriptions are due next?','Open Sales Order subscriptions'];break;
    }
    case 'customer_waiting':{
      const rows=get('get_customer_waiting')?.data||[],us=rows.flatMap(x=>x.waitingOnUs.map(v=>`${x.name}: ${v}`)),them=rows.flatMap(x=>x.waitingOnCustomer.map(v=>`${x.name}: ${v}`));answer=`Customers are waiting on us for ${us.length} item${us.length===1?'':'s'}${us.length?`: ${us.join('; ')}`:''}. We are waiting on customers for ${them.length} item${them.length===1?'':'s'}${them.length?`: ${them.join('; ')}`:''}.`;followups=['Who should we chase first?'];break;
    }
    case 'knowledge':{
      const rows=get('search_knowledge')?.data||[];answer=rows.length?rows[0].text:`I can’t find a matching internal policy or knowledge entry for that.`;followups=rows.length?['Show the source']:[];break;
    }
    case 'prepare_po':case 'prepare_procurement_pos':case 'prepare_allocation':case 'prepare_sales_order_allocation':case 'prepare_subscription':case 'prepare_extra':case 'prepare_task':{
      const r=executions[0]?.result;if(!r?.data){answer='I couldn’t prepare that action.';break;}const a={id:actionId(),...r.data,status:'prepared',requestedBy:user.id,createdAt:new Date().toISOString()};memory.saveAction(a);{const title=actionTitle(a).toLowerCase(),article=/^[aeiou]/i.test(title)?'an':'a';answer=`I've prepared ${article} ${title} for review. Nothing has been changed yet.`};followups=['Review proposed action'];return {answer,followups,quickActions,action:a,tone:'action'};
    }
    case 'search':{
      const rows=get('search_system')?.data||[],query=plan?.working?.query||message;
      if(!rows.length){answer=`I can’t find an accessible exact match for that, and nothing close enough is recorded for me to recommend confidently.`;break;}
      const exact=rows.filter(x=>x.exactMatch),show=(exact.length?exact:rows).slice(0,3);
      if(plan?.working?.recovery){const [first,...rest]=show;answer=`The closest useful record I can match is ${searchResultText(first)}.`;if(rest.length)answer+=` Other close matches are ${rest.map(searchResultText).join('; ')}.`;answer+=` I still can’t see an exact record matching “${query}”.`;}
      else if(exact.length)answer=`I found ${show.map(searchResultText).join('; ')}.`;
      else answer=`I can’t find an exact match for “${query}”, but the closest recorded matches are ${show.map(searchResultText).join('; ')}.`;
      followups=show.map(x=>`Open ${x.id}`);break;
    }
    default:answer=`I can help from the information held in Pool Shed. Give me the job, PO, stock item, customer or finance issue you want to work through.`;
  }
  return {answer,followups,quickActions,tone};
}

function validateLocalPlan(candidate,user,db){
  if(!candidate||!Array.isArray(candidate.tools))return false;
  const validNames=new Set(toolDefinitions(user).map(x=>x.name));
  const known=(name,args={})=>{
    if(name==='get_stock_position'||name==='get_product_record'||name==='prepare_stock_allocation'||name==='get_chemical_safety')return Boolean(db.products?.[args.sku]);
    if(['get_project_overview','get_project_financials','get_project_materials','get_hire_costs','run_project_scenario','prepare_purchase_order'].includes(name))return Boolean(db.projects?.[args.projectId]);
    if(name==='get_purchase_order')return Boolean(db.purchaseOrders?.[args.poId]);
    if(name==='get_sales_order')return Boolean(db.salesOrders?.[args.salesOrderId]);
    if(name==='get_customer_record')return Boolean(db.customers?.[args.customerId]);
    if(name==='prepare_sales_order_subscription')return Boolean(db.customers?.[args.customerId])&&Array.isArray(args.lines)&&args.lines.length>0;
    if(name==='get_three_way_match')return Boolean(db.supplierBills?.[args.billId]);
    if(name==='get_pick_list'||name==='prepare_sales_order_allocation')return !args.salesOrderId||Boolean(db.salesOrders?.[args.salesOrderId]);
    if(name==='prepare_project_extra')return Boolean(db.extras?.[args.extraId]);
    if(name==='prepare_internal_task')return Boolean(db.users?.[args.assigneeId]);
    return true;
  };
  return candidate.tools.length<=6&&candidate.tools.every(x=>x&&validNames.has(x.name)&&known(x.name,x.args||{}));
}

function applyContextIntent(userId,plan){
  if(plan.intent==='context_add')return memory.addContexts(userId,plan.contextRefs,{primary:false});
  if(plan.intent==='context_remove'){let s;for(const c of plan.contextRefs||[])s=memory.removeContext(userId,c);return s||memory.session(userId);}
  if(plan.intent==='context_only')return memory.setOnlyContexts(userId,plan.contextRefs);
  return memory.session(userId);
}

function collectSnapshotDeltas(db,user,contexts){
  const deltas=[];for(const c of projectContexts(contexts)){const current=projectSnapshot(db,c.id,user),before=memory.getSnapshot(user.id,`project:${c.id}`),delta=snapshotDelta(before,current);if(delta?.changes?.length)deltas.push(delta);}return deltas;
}

export async function prepareTurn({userId='aaron',message,context=null,contexts=null}){
  const db=runtimeSnapshot(),user=currentUser(userId);let session=memory.session(user.id);
  if(Array.isArray(contexts)&&contexts.length){const safe=sanitiseContexts(db,user,contexts);if(safe.length)session=memory.syncContexts(user.id,safe,context&&safe.some(c=>sameContext(c,context))?context:session.primaryContext);}
  if(context&&contextAllowed(db,user,context)){session=memory.addContexts(user.id,[context]);session=memory.setPrimaryContext(user.id,context);}
  let activeContexts=session.contexts,primaryContext=session.primaryContext;
  const historyBefore=session.history.slice(-16);
  memory.addMessage(user.id,'user',message,{contexts:activeContexts,primaryContext});memory.audit(user.id,'question','Question asked',message,{contexts:activeContexts,primaryContext});

  const brain=await brainHealth();let plan=deterministicPlan({message,contexts:activeContexts,primaryContext,history:historyBefore,db,user});
  if(['context_add','context_remove','context_only'].includes(plan.intent)){session=applyContextIntent(user.id,plan);activeContexts=session.contexts;primaryContext=session.primaryContext;}
  const canAutoFocus=!['greeting','smalltalk','conversation','context_add','context_remove','context_only','watch','unwatch','decision'].includes(plan.intent);
  if(canAutoFocus&&plan.contextRefs?.length){const refs=sanitiseContexts(db,user,plan.contextRefs);if(refs.length){session=memory.addContexts(user.id,refs,{primary:true});activeContexts=session.contexts;primaryContext=session.primaryContext;}}
  if(plan.intent==='watch'){const refs=sanitiseContexts(db,user,plan.contextRefs?.length?plan.contextRefs:activeContexts);memory.watch(user.id,refs);session=memory.session(user.id);}
  if(plan.intent==='unwatch'){const refs=sanitiseContexts(db,user,plan.contextRefs?.length?plan.contextRefs:activeContexts);memory.unwatch(user.id,refs);session=memory.session(user.id);}
  if(plan.intent==='decision'){memory.addDecision(user.id,{text:plan.decision?.text||message,kind:plan.decision?.kind||'operational',contexts:activeContexts});session=memory.session(user.id);}

  if(brain.connected&&brain.model&&!['conversation','greeting','smalltalk','context_add','context_remove','context_only','watch','unwatch','decision'].includes(plan.intent)&&(plan.confidence??0)<.65){
    const localPlan=await planWithLocalModel({message,contexts:activeContexts,primaryContext,history:historyBefore,tools:toolDefinitions(user),model:brain.model});if(validateLocalPlan(localPlan,user,db))plan={...localPlan,contextRefs:plan.contextRefs||[],confidence:.75,style:'local-planner'};
  }

  const executions=[];for(const call of plan.tools.slice(0,6)){try{const r=executeTool(call.name,call.args||{},user);executions.push({name:call.name,args:call.args||{},result:r});memory.audit(user.id,'tool',`Used ${call.name}`,r.ok?'Completed':r.error,{args:call.args||{},evidence:r.evidence?.map(x=>x.id)});}catch(e){executions.push({name:call.name,args:call.args||{},result:{ok:false,error:e.message,evidence:[]}});}}
  const recoverableFailure=executions.find(x=>x.result.ok===false&&!String(x.result.error||'').startsWith('Permission denied'));
  const actionIntent=/^prepare_/.test(plan.intent||'');
  if(recoverableFailure&&!actionIntent&&!executions.some(x=>x.name==='search_system')){try{const r=executeTool('search_system',{query:plan?.working?.query||message,limit:6,broad:true},user);executions.push({name:'search_system',args:{query:plan?.working?.query||message,limit:6,broad:true},result:r});memory.audit(user.id,'tool','Used search_system for recovery',r.ok?'Completed':r.error,{recoveryFor:recoverableFailure.name});}catch{}}
  const facts=asFacts(executions),evidence=allEvidence(executions),deltas=collectSnapshotDeltas(db,user,activeContexts);if(deltas.length)facts.push({tool:'working_context_changes',ok:true,data:deltas,error:null});
  const decisions=memory.decisionsFor(user.id,activeContexts);if(decisions.length)facts.push({tool:'active_decisions',ok:true,data:decisions,error:null});
  let response=compose({intent:plan.intent,executions,session,user,contexts:activeContexts,primaryContext,deltas,plan,message});const factHash=hash(facts),unchanged=session.lastIntent===plan.intent&&session.lastFactHash===factHash&&normalise(session.lastUserMessage)===normalise(message)&&!response.action;
  if(unchanged)response={...response,answer:`Nothing's changed since we last looked at that.`,followups:[...(response.followups||[]).slice(0,2),'What changed today?'],tone:'steady'};
  response={...response,evidence,intent:plan.intent,contexts:activeContexts,primaryContext,dataRevision:db.meta.revision,deltas,decisions,assistantMode:brain.connected&&brain.model?'enhanced':'core',brainConnected:Boolean(brain.connected)};
  return {userId:user.id,user,message,contexts:activeContexts,primaryContext,history:historyBefore,session,brain,plan,executions,facts,evidence,deltas,unchanged,shouldNarrate:Boolean(brain.connected&&brain.model&&!response.action&&!unchanged),response};
}

export function finalizeTurn(turn,answerOverride=null){
  const response={...turn.response};if(answerOverride&&String(answerOverride).trim()){const candidate=String(answerOverride).trim(),previous=turn.session.lastAnswer||'',sameUserQuestion=normalise(turn.session.lastUserMessage)===normalise(turn.message);response.answer=(!sameUserQuestion&&answerSimilarity(candidate,previous)>.84&&answerSimilarity(response.answer,previous)<.84)?response.answer:candidate;}response.links=recordLinksForAnswer(runtimeSnapshot(),turn.user,response.answer,response.evidence,response.primaryContext);
  memory.addMessage(turn.userId,'assistant',response.answer,{intent:response.intent,evidence:response.evidence.map(x=>x.id),evidenceObjects:response.evidence,links:response.links,quickActions:response.quickActions||[],action:response.action||null,contexts:response.contexts,primaryContext:response.primaryContext});
  memory.updateTurn(turn.userId,{intent:response.intent,facts:turn.facts,answer:response.answer,userMessage:turn.message,working:{lastContexts:response.contexts,lastContext:response.primaryContext,topic:response.intent}});
  const db=runtimeSnapshot();for(const c of projectContexts(response.contexts)){const snap=projectSnapshot(db,c.id,turn.user);if(snap)memory.setSnapshot(turn.userId,`project:${c.id}`,snap);}memory.audit(turn.userId,'answer','Azzy answered',response.answer,{intent:response.intent});return response;
}

export async function runAgent(input){const turn=await prepareTurn(input);let answer=null;if(turn.shouldNarrate){const narrated=await narrateWithLocalModel({message:turn.message,intent:turn.plan.intent,facts:turn.facts,previousAnswer:turn.session.lastAnswer,draftAnswer:turn.response.answer,model:turn.brain.model,user:turn.user,contexts:turn.contexts,primaryContext:turn.primaryContext,history:turn.history,unchanged:turn.unchanged,decisions:turn.response.decisions,deltas:turn.deltas});answer=narrated?.answer||null;}return finalizeTurn(turn,answer);}

function availableContexts(db,user){
  const out=[],can=p=>user.permissions.includes(p);
  if(can('projects.read')){
    out.push(...Object.values(db.projects).map(x=>({type:'project',id:x.id,label:x.name,meta:`${x.stage} · ${x.progress}%`})));
    out.push(...Object.values(db.salesOrders).map(x=>({type:'sales_order',id:x.id,label:x.id,meta:x.status})));
  }
  if(can('purchasing.read')){
    out.push(...Object.values(db.purchaseOrders).map(x=>({type:'po',id:x.id,label:`${x.id} · ${x.supplier}`,meta:x.status})));
    out.push(...Object.values(db.suppliers).map(x=>({type:'supplier',id:x.id,label:x.name,meta:'Supplier'})));
  }
  if(can('stock.read'))out.push(...Object.values(db.products).map(x=>({type:'stock',id:x.sku,label:x.name,meta:`${x.sku} · ${x.bin}`})));
  if(can('customers.read'))out.push(...Object.values(db.customers).map(x=>({type:'customer',id:x.id,label:x.name,meta:'Customer'})));
  if(can('finance.read')){
    out.push({type:'finance',id:'finance',label:'Finance & bills',meta:'Supplier bills · customer cash'});
    out.push(...Object.values(db.supplierBills).map(x=>({type:'bill',id:x.id,label:`${x.supplier} · ${x.invoiceNumber}`,meta:x.status})));
    out.push(...Object.values(db.customerInvoices).map(x=>({type:'invoice',id:x.id,label:x.id,meta:x.status})));
    out.push(...Object.values(db.hires).filter(x=>x.active).map(x=>({type:'hire',id:x.id,label:x.description,meta:`${x.supplier} · active hire`})));
    out.push(...Object.values(db.extras).filter(x=>!x.approved).map(x=>({type:'extra',id:x.id,label:x.description,meta:'Unapproved project extra'})));
  }
  return out;
}

function watchedSignals(db,user,session){
  const rows=[];for(const w of memory.watchesFor(user.id)){const c=w.context;let events=[];if(c.type==='project')events=db.events.filter(e=>e.projectId===c.id&&new Date(e.at)>new Date(w.createdAt));else events=db.events.filter(e=>e.entityType===normaliseRecordType(c.type)&&e.entityId===c.id&&new Date(e.at)>new Date(w.createdAt));if(!events.length)continue;const latest=events.at(-1),id=`watch-${contextKey(c)}-${latest.id||'change'}`;rows.push({id,kind:'watch_change',severity:86,title:`${contextLabel(db,c)} changed`,summary:latest.summary,context:c,record:c.type==='finance'?null:c,projectId:c.type==='project'?c.id:latest.projectId||null,actionPrompt:'What changed here?',seen:session.seenSignals[id]===hash({title:`${contextLabel(db,c)} changed`,summary:latest.summary,severity:86})});}return rows;
}

export async function bootstrap(userId='aaron'){
  const db=runtimeSnapshot(),user=currentUser(userId),brain=await brainHealth(),available=availableContexts(db,user);let session=memory.session(user.id);const safe=sanitiseContexts(db,user,session.contexts);if(safe.length!==session.contexts.length)session=memory.syncContexts(user.id,safe,session.primaryContext);
  const {signals,wins}=filterIntelligenceForUser(buildSignals(db),user),attention=signals.map(x=>({...x,seen:session.seenSignals[x.id]===hash({title:x.title,summary:x.summary,severity:x.severity})})),watchSignals=watchedSignals(db,user,session);for(const w of watchSignals)if(!attention.some(a=>a.id===w.id))attention.unshift(w);
  return {user,users:Object.values(db.users).map(x=>({id:x.id,name:x.name,role:x.role})),primaryContext:session.primaryContext,activeContexts:session.contexts,contexts:available,attention,wins,assistantReady:true,assistantMode:brain.connected&&brain.model?'enhanced':'core',brainConnected:Boolean(brain.connected),brainError:brain.connected?null:(brain.error||'Local brain unavailable'),dataMode:db.meta.mode,revision:db.meta.revision,audit:memory.auditFor(user.id),conversationId:session.conversationId,conversationStartedAt:session.conversationStartedAt,conversation:session.history.slice(-50),conversations:memory.conversationsFor(user.id),decisions:memory.decisionsFor(user.id,session.contexts),watches:memory.watchesFor(user.id)};
}

export function updateWorkingContexts(userId,{action='add',context=null,contexts=[]}={}){
  const db=runtimeSnapshot(),user=currentUser(userId),targets=sanitiseContexts(db,user,context?[context]:contexts);if(!targets.length)return {ok:false,error:'No accessible record was supplied.'};let s;if(action==='add')s=memory.addContexts(user.id,targets);else if(action==='only')s=memory.setOnlyContexts(user.id,targets);else if(action==='remove'){s=memory.session(user.id);for(const c of targets)s=memory.removeContext(user.id,c);}else if(action==='primary')s=memory.setPrimaryContext(user.id,targets[0]);else return {ok:false,error:'Unknown context action.'};return {ok:true,activeContexts:s.contexts,primaryContext:s.primaryContext};
}

export function markAttentionSeen(userId,ids=[]){const user=currentUser(userId),db=runtimeSnapshot(),session=memory.session(user.id),{signals}=filterIntelligenceForUser(buildSignals(db),user),all=[...signals,...watchedSignals(db,user,session)],wanted=new Set(ids||[]),rows=all.filter(x=>wanted.has(x.id));for(const x of rows)memory.rememberSignal(user.id,x.id,hash({title:x.title,summary:x.summary,severity:x.severity}));return {ok:true,count:rows.length};}

export async function approveAction(userId,actionIdValue){
  const user=currentUser(userId);if(!user.permissions.includes('actions.approve'))return {ok:false,error:'You do not have approval permission.'};
  const action=memory.getAction(actionIdValue);if(!action)return {ok:false,error:'Action not found.'};if(action.status!=='prepared')return {ok:false,error:`Action is already ${action.status}.`};
  action.approvedBy=user.id;action.approvedAt=new Date().toISOString();
  if(isSandbox()){
    action.status='approved_sandbox';demoStoreForDevelopment().approveSandboxAction(action);memory.saveAction(action);memory.audit(user.id,'approval',`Approved ${actionTitle(action)}`,'Sandbox approval only. No live business record changed.',{actionId:action.id});return {ok:true,action,message:'Approved in sandbox. No live business record was changed.'};
  }
  const execute=actionExecutor();
  if(!execute){action.status='approved_pending_execution';memory.saveAction(action);memory.audit(user.id,'approval',`Approved ${actionTitle(action)}`,'Awaiting Pool Shed action authority.',{actionId:action.id});return {ok:true,action,pendingExecution:true,message:'Approved and ready for Pool Shed to execute through its existing action authority.'};}
  try{
    const execution=await execute({action:structuredClone(action),user:structuredClone(user)});
    if(!execution?.ok){action.status='execution_failed';action.executionError=execution?.error||'Pool Shed action authority rejected the change.';memory.saveAction(action);memory.audit(user.id,'execution',`Execution failed for ${actionTitle(action)}`,action.executionError,{actionId:action.id});return {ok:false,error:action.executionError,action};}
    action.status='executed';action.executedAt=new Date().toISOString();action.executionResult=execution.result||execution.data||null;memory.saveAction(action);memory.audit(user.id,'execution',`Executed ${actionTitle(action)}`,'Confirmed by Pool Shed action authority.',{actionId:action.id});return {ok:true,action,message:'Pool Shed confirmed the action was completed.',execution:execution.result||execution.data||null};
  }catch(e){action.status='execution_failed';action.executionError=e.message||'Execution failed.';memory.saveAction(action);memory.audit(user.id,'execution',`Execution failed for ${actionTitle(action)}`,action.executionError,{actionId:action.id});return {ok:false,error:action.executionError,action};}
}
