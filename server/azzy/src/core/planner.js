import { lower } from './utils.js';

const contextKey=c=>c?.type&&c?.id?`${c.type}:${c.id}`:null;
const unique=arr=>[...new Map((arr||[]).filter(Boolean).map(x=>[contextKey(x),x])).values()];

function projectAliases(project){
  const words=String(project.name||'').split(/\s+/).filter(Boolean);
  const generic=new Set(['pool','refurb','replacement','natural','liner','project','job']);
  return [project.id,project.name,...words.filter(w=>w.length>=4&&!generic.has(w.toLowerCase()))];
}

function resolveEntities(message,contexts=[],history=[],db){
  const current=unique(contexts);
  const messageText=String(message||'');
  const historyText=history.slice(-8).map(x=>x.text).join(' ');
  const combined=`${messageText} ${historyText}`;
  const lowerMessage=messageText.toLowerCase();
  const projectIds=[];
  for(const id of messageText.match(/PRJ-\d+/ig)||[])projectIds.push(id.toUpperCase());
  for(const p of Object.values(db.projects||{}))if(projectAliases(p).some(a=>a&&lowerMessage.includes(String(a).toLowerCase())))projectIds.push(p.id);
  const poIds=(messageText.match(/PO-\d+/ig)||[]).map(x=>x.toUpperCase());
  const skus=(messageText.match(/PB-[A-Z0-9-]+/ig)||[]).map(x=>x.toUpperCase());
  const bills=(messageText.match(/BILL-\d+/ig)||[]).map(x=>x.toUpperCase());
  const salesOrders=(messageText.match(/SO-\d+/ig)||[]).map(x=>x.toUpperCase());
  for(const c of current){
    if(c.type==='project'&&!projectIds.length)projectIds.push(c.id);
    if(c.type==='po'&&!poIds.length)poIds.push(c.id);
    if((c.type==='stock'||c.type==='product')&&!skus.length)skus.push(c.id);
    if(c.type==='bill'&&!bills.length)bills.push(c.id);
    if(c.type==='sales_order'&&!salesOrders.length)salesOrders.push(c.id);
  }
  if(!projectIds.length){
    for(const poId of poIds){const po=db.purchaseOrders?.[poId];if(po?.projectId)projectIds.push(po.projectId);}
    for(const soId of salesOrders){const so=db.salesOrders?.[soId];if(so?.projectId)projectIds.push(so.projectId);}
  }
  return {projectIds:[...new Set(projectIds)].filter(id=>db.projects?.[id]),poIds:[...new Set(poIds)],skus:[...new Set(skus)],bills:[...new Set(bills)],salesOrders:[...new Set(salesOrders)],combined};
}

function lastIntent(history=[]){return [...history].reverse().find(x=>x.role==='assistant'&&x.meta?.intent)?.meta?.intent||null;}
function lastUserText(history=[]){return [...history].reverse().find(x=>x.role==='user'&&String(x.text||'').trim())?.text||'';}
function lastAssistantText(history=[]){return [...history].reverse().find(x=>x.role==='assistant'&&String(x.text||'').trim())?.text||'';}
function looksLikeProductQuery(q=''){return /\b(?:do we have|have we got|stock|product|pipework|pipe|valve|union|fitting|elbow|tee|pump|heater|liner|chemical|chlorine|inch|inches|mm|filter|laterals?|media|cover|skimmer|return|socket|nipple)\b/i.test(q)||/\b\d+(?:\.\d+)?\s*(?:inch|inches|mm|\")\b/i.test(q)||/\b\d+\s+1\s*\/\s*2\b/.test(q);}
function isAssent(q=''){return /^(?:yes|yeah|yep|yup|please|yes please|yeah please|go ahead|do it|sure|okay|ok|carry on|continue)[.!\s]*$/i.test(String(q).trim());}
function moneyValue(q){const m=q.match(/£\s?([\d,]+(?:\.\d+)?)/i)||q.match(/\b([\d,]+(?:\.\d+)?)\s*(?:pounds?|quid)\b/i);return m?Number(m[1].replace(/,/g,'')):null;}
function namedProjectRefs(message,db){
  const q=lower(message),out=[];for(const p of Object.values(db.projects||{}))if(projectAliases(p).some(a=>a&&q.includes(String(a).toLowerCase())))out.push({type:'project',id:p.id});return unique(out);
}
function assigneeFrom(q,db){return Object.values(db.users||{}).find(u=>q.includes(u.name.toLowerCase())||q.includes(u.id.toLowerCase()))||null;}

export function deterministicPlan({message,contexts=[],primaryContext=null,history,db,user}){
  const q=lower(message).trim(), previousIntent=lastIntent(history), entities=resolveEntities(message,contexts,history,db);
  const activeProjects=unique(contexts).filter(c=>c.type==='project').map(c=>c.id).filter(id=>db.projects[id]);
  const explicitProjects=namedProjectRefs(message,db).map(c=>c.id);
  const selectedProjects=explicitProjects.length?explicitProjects:(entities.projectIds.length?entities.projectIds:activeProjects);
  const primary=primaryContext||contexts?.[0]||null;
  const firstProject=selectedProjects[0]||entities.projectIds[0]||null,firstPo=entities.poIds[0]||null,firstSku=entities.skus[0]||null,firstBill=entities.bills[0]||null,firstSalesOrder=entities.salesOrders[0]||null;
  const explicitRefs=unique([
    ...explicitProjects.map(id=>({type:'project',id})),
    ...(message.match(/PO-\d+/ig)||[]).map(id=>({type:'po',id:id.toUpperCase()})),
    ...(message.match(/PB-[A-Z0-9-]+/ig)||[]).map(id=>({type:'stock',id:id.toUpperCase()})),
    ...(message.match(/BILL-\d+/ig)||[]).map(id=>({type:'bill',id:id.toUpperCase()})),
    ...(message.match(/SO-\d+/ig)||[]).map(id=>({type:'sales_order',id:id.toUpperCase()}))
  ]);
  const plan={intent:'general',tools:[],working:{},style:'conversational',confidence:.2,contextRefs:explicitRefs};
  const add=(name,args={})=>plan.tools.push({name,args});
  const can=p=>Boolean(user?.permissions?.includes(p));
  const projectBundle=(projectId=firstProject)=>{if(!projectId)return;add('get_project_overview',{projectId});if(can('finance.read')){add('get_project_financials',{projectId});add('get_hire_costs',{projectId});}if(can('purchasing.read'))add('get_project_materials',{projectId});};

  if(/^(hi|hiya|hey|hello|morning|good morning|afternoon|good afternoon|evening|good evening|yo|you there|azzy)[.!?\s]*$/i.test(q))return {...plan,intent:'greeting',confidence:1};
  if(/^(how are you|how's it going|hows it going|you good|all good)[.!?\s]*$/i.test(q))return {...plan,intent:'smalltalk',confidence:1};
  if(/^(thanks|thank you|cheers|great|nice|awesome|perfect|got it|brilliant)[.!\s]*$/i.test(q))return {...plan,intent:'conversation',confidence:1};
  if(/tell me a joke|make me laugh|say something funny/.test(q))return {...plan,intent:'smalltalk',confidence:1};

  if(isAssent(q)){
    const priorQuestion=lastUserText(history),priorAnswer=lastAssistantText(history),recovering=/can(?:not|'t) find|couldn(?:not|'t) find|not found|don't have a matching|do not have a matching|closest/i.test(priorAnswer);
    if(priorQuestion&&recovering){
      if(looksLikeProductQuery(priorQuestion)){plan.intent='product_search';plan.confidence=.99;plan.working={recovery:true,query:priorQuestion};add('find_products',{query:priorQuestion,limit:6,broad:true});return plan;}
      plan.intent='search';plan.confidence=.98;plan.working={recovery:true,query:priorQuestion};add('search_system',{query:priorQuestion,limit:8,broad:true});return plan;
    }
    return {...plan,intent:'conversation',confidence:1};
  }

  const contextTargets=namedProjectRefs(message,db);
  if(/^(?:add|include|bring in)\b/.test(q)&&contextTargets.length)return {...plan,intent:'context_add',confidence:1,contextRefs:contextTargets};
  if(/^(?:forget|remove|drop)\b/.test(q)&&contextTargets.length)return {...plan,intent:'context_remove',confidence:1,contextRefs:contextTargets};
  if(/(?:just|only)\s+(?:focus|look)|focus\s+(?:just|only)\s+on/.test(q)&&contextTargets.length)return {...plan,intent:'context_only',confidence:1,contextRefs:contextTargets};
  if(/^(?:watch\b)|\bwatch (?:this|these|them)|keep an eye on|keep watching\b/.test(q))return {...plan,intent:'watch',confidence:1,contextRefs:contextTargets.length?contextTargets:contexts};
  if(/stop watching|don't watch|do not watch/.test(q))return {...plan,intent:'unwatch',confidence:1,contextRefs:contextTargets.length?contextTargets:contexts};
  if(/(?:don't|do not|we're not|we are not|hold|wait).*(?:until|unless|before)|remember (?:that|this decision)|decision:/.test(q))return {...plan,intent:'decision',confidence:1,decision:{text:message,kind:/order|purchase|po\b/.test(q)?'hold_order':'operational'}};

  const assignee=assigneeFrom(q,db);
  if(assignee&&(/\bremind\b|put .* on .*list|\bask\b|give .* task|assign/.test(q))){plan.intent='prepare_task';plan.confidence=.99;const taskRefs=[...(firstPo?[{type:'po',id:firstPo}]:[]),...contexts];add('prepare_internal_task',{assigneeId:assignee.id,summary:message,contextRefs:taskRefs});return plan;}

  const wantsCompare=/\bcompare\b|\bversus\b|\bvs\b|difference between|which (?:one|job|project)|between (?:them|these)|both projects|all (?:three|projects|jobs)/.test(q)||(['compare_projects'].includes(previousIntent)&&/margin|cash|stock|risk|hire|better|worse|more|less|which/.test(q));
  const compareIds=[...new Set([...(explicitProjects.length?explicitProjects:[]),...activeProjects])].filter(id=>db.projects[id]).slice(0,5);
  if(wantsCompare&&compareIds.length>=2){plan.intent='compare_projects';plan.confidence=.99;plan.contextRefs=compareIds.map(id=>({type:'project',id}));add('compare_projects',{projectIds:compareIds});return plan;}

  if(/what am i missing|what.*haven't i|what.*have i missed|anything hidden|hidden risk|anything i.*not.*seen|contradiction|doesn't add up|does not add up/.test(q)){
    plan.intent='hidden_risks';plan.confidence=.99;add('get_hidden_risks',{projectIds:activeProjects.length?activeProjects:selectedProjects});return plan;
  }

  if(/what happens if|what if|scenario|if .*cost|another £|extra £|spend another|costs another/.test(q)&&firstProject&&can('finance.read')){
    const amount=moneyValue(q)||0;let costDelta=amount,revenueDelta=0;if(/sell|revenue|quote|charge|recover/.test(q)&&!/cost|spend|overrun/.test(q)){revenueDelta=amount;costDelta=0;}
    plan.intent='scenario';plan.confidence=.99;add('run_project_scenario',{projectId:firstProject,costDelta,revenueDelta});return plan;
  }

  if(/what.*need.*order|what.*order.*today|order.*today|buying list|procurement demand|what.*need.*buy|what.*short.*order|shortages.*order/.test(q)){
    plan.intent='procurement_demand';plan.confidence=.995;add('get_procurement_demand',{includeReorder:!/committed only|jobs only|only committed/.test(q),urgentOnly:/urgent|blocking|today only/.test(q)});return plan;
  }
  if(/create.*(?:po|purchase order).*(?:everything|all|today|urgent)|prepare.*(?:po|purchase order).*(?:everything|all|today|urgent)|create.*today.*(?:po|purchase order)/.test(q)){
    plan.intent='prepare_procurement_pos';plan.confidence=.995;add('prepare_procurement_purchase_orders',{includeReorder:!/committed only|jobs only|only committed/.test(q),urgentOnly:/urgent/.test(q)});return plan;
  }
  if(/print.*pick|picking list|pick list|what.*pick.*today/.test(q)){
    plan.intent='pick_list';plan.confidence=.995;add('get_pick_list',{salesOrderId:firstSalesOrder||null,readyOnly:!firstSalesOrder});return plan;
  }
  if(/allocate.*(?:sales order|so-?\d+)|allocate.*stock.*(?:sales order|order)/.test(q)&&firstSalesOrder){
    plan.intent='prepare_sales_order_allocation';plan.confidence=.995;add('prepare_sales_order_allocation',{salesOrderId:firstSalesOrder});return plan;
  }
  if(/supplier.*(?:performance|reliab|scorecard)|who.*reliable|best supplier.*reliab|delivery performance/.test(q)){
    plan.intent='supplier_scorecard';plan.confidence=.99;add('get_supplier_scorecards',{});return plan;
  }
  if(/three.?way|invoice match|match.*(?:bill|invoice)|(?:bill|invoice).*match.*po|received.*invoice/.test(q)&&firstBill){
    plan.intent='invoice_match';plan.confidence=.99;add('get_three_way_match',{billId:firstBill});return plan;
  }
  if(/cycle count|stock count|what.*count.*today|which.*bin.*count|inventory count/.test(q)){
    plan.intent='cycle_count';plan.confidence=.99;add('get_cycle_count_plan',{limit:8});return plan;
  }
  if(/exception inbox|decisions.*need|what.*need.*decision|only.*exceptions|what.*actually.*need.*me/.test(q)){
    plan.intent='exception_inbox';plan.confidence=.99;add('get_exception_inbox',{limit:20});return plan;
  }
  if(/sds|coshh|safety data|chemical safety|handling.*chemical|ppe.*chemical/.test(q)&&firstSku){
    plan.intent='chemical_safety';plan.confidence=.99;add('get_chemical_safety',{sku:firstSku});return plan;
  }

  if(looksLikeProductQuery(q)&&!/best price|cheapest|compare.*price|price.*supplier|supplier.*price|invoice|bill|cashflow/.test(q)){
    plan.intent='product_search';plan.confidence=.96;add('find_products',{query:message,limit:6});return plan;
  }

  if(/best price|cheapest|compare.*price|price.*supplier|supplier.*price|who.*cheapest|what.*pay.*supplier|last paid|price gone up|price increase|price.*chlorine|chlorine.*price|price.*chemical|chemical.*price|cheaper.*same product|same product.*supplier|compare.*pipework/.test(q)){
    plan.intent='supplier_price';plan.confidence=.99;const qty=Number(q.match(/\b(\d+)\s*(?:drums?|packs?|units?|bottles?|tubs?|containers?)\b/)?.[1]||q.match(/\bfor\s+(\d+)\b/)?.[1]||1);add('get_supplier_price_comparison',{query:message,qty});return plan;
  }
  if(/create.*po|draft.*po|order missing|prepare.*po/.test(q)&&firstProject){plan.intent='prepare_po';plan.confidence=.99;add('prepare_purchase_order',{projectId:firstProject,supplier:'Certikin',reason:'User requested a draft for overdue missing items'});return plan;}
  if(/allocate/.test(q)&&firstProject&&firstSku){const qty=Number(q.match(/\b(\d+)\b/)?.[1]||1);plan.intent='prepare_allocation';plan.confidence=.99;add('prepare_stock_allocation',{projectId:firstProject,sku:firstSku,qty});return plan;}
  if(/extra|charge customer|recover.*cost/.test(q)&&firstProject){plan.intent='prepare_extra';plan.confidence=.95;const project=db.projects[firstProject];const extra=(project?.extraIds||[]).map(id=>db.extras[id]).find(x=>x&&!x.approved);if(extra)add('prepare_project_extra',{projectId:firstProject,extraId:extra.id});else add('get_project_financials',{projectId:firstProject});return plan;}
  if(/bill|invoice|pay|cash|cashflow|supplier.*due|duplicate|paying.*twice|buying.*twice/.test(q)){plan.intent='finance';plan.confidence=.98;add('get_finance_briefing');if(firstProject&&can('finance.read'))add('get_project_financials',{projectId:firstProject});return plan;}
  if(/where.*losing money|which projects?.*margin|margin.*across|most profitable|more profitable|profit.*expected|margin.*business/.test(q)){plan.intent='margin_watch';plan.confidence=.98;add('get_margin_watch');return plan;}
  if(/which hires?|hires?.*return|return.*hire|active hire|hire.*across|plant.*hire/.test(q)&&!firstProject){plan.intent='hire_review';plan.confidence=.97;add('get_active_hire_review');return plan;}
  if(/what.*(changed|new)|changed today|since (yesterday|last)|what's changed|whats changed/.test(q)){plan.intent='changes';plan.confidence=.98;const prior=[...history].reverse().find(x=>x.role==='assistant')?.at||'2026-09-27T00:00:00+01:00';add('get_changes_since',{since:prior,projectIds:activeProjects});return plan;}
  if(/what do i need to know|need my attention|morning briefing|business.*today|operational briefing|anything important today|what should i know|decisions?.*today|what.*focus.*today|stop next week|block next week|next week.*risk/.test(q)){plan.intent='briefing';plan.confidence=.99;add('get_operational_briefing');add('get_hidden_risks',{projectIds:[]});return plan;}

  if(/what (would|should) you do|what next|next step|what should we do|how would you handle|sort this|how do we fix/.test(q)){
    plan.intent='next_step';plan.confidence=.92;if(activeProjects.length>=2){plan.intent='compare_projects';add('compare_projects',{projectIds:activeProjects});}else if(firstProject)projectBundle(firstProject);else if(firstPo)add('get_purchase_order',{poId:firstPo});else if(firstSku)add('get_stock_position',{sku:firstSku});else add('get_operational_briefing');return plan;
  }
  if(/margin|profit|cost|over budget|overspend|financial|gone over/.test(q)&&firstProject){plan.intent='project_finance';plan.confidence=.99;add('get_project_financials',{projectId:firstProject});add('get_hire_costs',{projectId:firstProject});return plan;}
  if(/waiting|material|stock.*job|parts|delivery|eta|arriv/.test(q)&&firstProject){plan.intent='project_materials';plan.confidence=.97;add('get_project_materials',{projectId:firstProject});return plan;}
  if(/hire|digger|excavator/.test(q)&&firstProject){plan.intent='hire';plan.confidence=.99;add('get_hire_costs',{projectId:firstProject});return plan;}
  if(/where|bin|available|on hand|allocated|stock/.test(q)&&firstSku){plan.intent='stock';plan.confidence=.99;add('get_stock_position',{sku:firstSku});return plan;}
  if((/late|purchase order|\bpo\b|wrong with this/.test(q))&&firstPo){plan.intent='po';plan.confidence=.98;add('get_purchase_order',{poId:firstPo});return plan;}
  if(/how.*doing|status|overall|this job|this project|what.*wrong|anything.*worry|what.*good|going well|how are we doing/.test(q)&&firstProject){plan.intent='project_health';plan.confidence=.98;projectBundle(firstProject);return plan;}
  if(/attention|worry|problem|issue/.test(q)&&!firstProject){plan.intent='briefing';plan.confidence=.9;add('get_operational_briefing');return plan;}
  if(/customer.*waiting|waiting on (us|customer)|who needs chasing|who should i chase|who.*chase first/.test(q)){plan.intent='customer_waiting';plan.confidence=.98;add('get_customer_waiting',{});return plan;}
  if(/policy|normally|procedure|sop|how do we/.test(q)){plan.intent='knowledge';plan.confidence=.9;add('search_knowledge',{query:message});return plan;}

  if(/why (is|does|has|would)|why's|whys|explain (that|this)|tell me more|go on|why.*problem|why.*worry|why.*matter/.test(q)){
    plan.intent='explain_followup';plan.confidence=.9;if(previousIntent==='finance'){add('get_finance_briefing');if(firstProject&&can('finance.read'))add('get_project_financials',{projectId:firstProject});}else if(previousIntent==='compare_projects'&&activeProjects.length>=2){plan.intent='compare_projects';add('compare_projects',{projectIds:activeProjects});}else if(previousIntent==='po'&&firstPo)add('get_purchase_order',{poId:firstPo});else if(previousIntent==='stock'&&firstSku)add('get_stock_position',{sku:firstSku});else if(firstProject)projectBundle(firstProject);else add('get_operational_briefing');return plan;
  }

  plan.intent='search';plan.confidence=.5;add('search_system',{query:message});return plan;
}
