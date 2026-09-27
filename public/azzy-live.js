(function(global){
'use strict';

const MAX_CONTEXTS=5;
const ROUTE_TO_AZZY={project:'project','purchase-order':'po',product:'stock','sales-order':'sales_order',customer:'customer',supplier:'supplier'};
const AZZY_TO_ROUTE={project:'project',po:'purchase-order',stock:'product',product:'product',sales_order:'sales-order',customer:'customer',supplier:'supplier'};
const ICONS={project:'▣',po:'▤',stock:'◇',product:'◇',sales_order:'▧',finance:'£',bill:'£',invoice:'£',customer:'◉',supplier:'◆',hire:'⌁',extra:'＋',supplier_price:'£'};
const state={open:false,boot:null,contexts:[],primary:null,busy:false,tab:'chat',messages:[],followups:[],booting:null,contextMenu:false};
let root=null;

const text=v=>String(v??'').trim();
const keyOf=c=>c&&c.type&&c.id?`${c.type}:${c.id}`:'';
const same=(a,b)=>keyOf(a)===keyOf(b);
const icon=t=>ICONS[t]||'◈';
const titleCase=s=>text(s).replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
const time=v=>{try{return new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit'}).format(new Date(v||Date.now()));}catch{return'';}};

function el(tag,className,content){const node=document.createElement(tag);if(className)node.className=className;if(content!==undefined&&content!==null)node.textContent=String(content);return node;}
function button(label,className,handler){const b=el('button',className,label);b.type='button';if(handler)b.addEventListener('click',handler);return b;}
function availableContext(context){const k=keyOf(context);return (state.boot?.contexts||[]).find(c=>keyOf(c)===k)||null;}
function contextLabel(context){return availableContext(context)?.label||context?.label||context?.id||'Pool Shed';}
function normalizeContext(context){if(!context||!context.type||!context.id)return null;const type=context.type==='product'?'stock':String(context.type),id=String(context.id);return{type,id};}
function currentRouteContext(){
  const router=global.PoolShedRouter;if(!router?.current)return null;
  const route=router.current();
  if(route?.recordType&&ROUTE_TO_AZZY[route.recordType])return normalizeContext({type:ROUTE_TO_AZZY[route.recordType],id:route.recordId});
  const raw=String(global.location?.hash||'').toLowerCase();
  if((raw==='#\/finance'||raw.startsWith('#/finance/'))&&(state.boot?.contexts||[]).some(c=>c.type==='finance'))return{type:'finance',id:'finance'};
  return null;
}
function setPrimary(context,{add=true}={}){
  const c=normalizeContext(context);if(!c)return;
  const known=availableContext(c);if(!known&&state.boot)return;
  const i=state.contexts.findIndex(x=>same(x,c));
  if(i>=0){state.contexts.splice(i,1);state.contexts.unshift(c);}else if(add){state.contexts.unshift(c);state.contexts=state.contexts.slice(0,MAX_CONTEXTS);}
  state.primary=state.contexts[0]||null;renderContexts();
}
function addContext(context){const c=normalizeContext(context);if(!c||!availableContext(c))return false;if(state.contexts.some(x=>same(x,c))){setPrimary(c);return true;}if(state.contexts.length>=MAX_CONTEXTS){toast('Keep the working set to five records or fewer.');return false;}state.contexts.push(c);if(!state.primary)state.primary=c;renderContexts();return true;}
function removeContext(context){state.contexts=state.contexts.filter(x=>!same(x,context));if(same(state.primary,context))state.primary=state.contexts[0]||null;renderContexts();}
function syncRouteContext(){const c=currentRouteContext();if(c&&availableContext(c))setPrimary(c);}

async function authToken(){
  const provider=global.__POOL_SHED_AUTH_TOKEN__;if(typeof provider!=='function')throw new Error('Pool Shed sign-in is not ready.');
  const token=await provider();if(!token)throw new Error('Sign in to Pool Shed to use Azzy.');return token;
}
async function api(action,{method='GET',body,params}={}){
  const token=await authToken(),url=new URL('/api/azzy',global.location.origin);url.searchParams.set('action',action);
  for(const[k,v]of Object.entries(params||{}))if(v!==undefined&&v!==null)url.searchParams.set(k,String(v));
  const headers={Authorization:`Bearer ${token}`,Accept:'application/json'};if(body!==undefined)headers['Content-Type']='application/json';
  const response=await fetch(url,{method,headers,credentials:'same-origin',cache:'no-store',body:body===undefined?undefined:JSON.stringify(body)});
  let json={};try{json=await response.json();}catch{}
  if(!response.ok||json.ok===false)throw new Error(json.error||`Azzy request failed (${response.status}).`);return json;
}

function mount(){
  if(root)return;
  document.getElementById('azzyFloating')?.remove();
  root=el('div');root.id='azzyLiveRoot';root.innerHTML=`
    <button class="azl-launcher" type="button" aria-label="Open Azzy" aria-expanded="false">
      <img src="./assets/img/azzy-live-64.png" alt=""><span class="azl-launcher-label">Azzy</span><span class="azl-badge" hidden>0</span>
    </button>
    <aside class="azl-panel" role="dialog" aria-label="Azzy, Pool Shed intelligence" hidden>
      <header class="azl-head"><div class="azl-identity"><img src="./assets/img/azzy-live-64.png" alt=""><div><strong>Azzy</strong><small class="azl-status">Pool Shed intelligence · Read-only Preview</small></div></div><button type="button" class="azl-icon azl-close" aria-label="Close Azzy">×</button></header>
      <div class="azl-tabs" role="tablist"><button type="button" class="active" data-tab="chat" role="tab">Chat</button><button type="button" data-tab="attention" role="tab">Attention <span class="azl-attention-count" hidden>0</span></button></div>
      <section class="azl-context-bar"><div class="azl-context-label"><span>Talking about</span><small class="azl-context-count"></small></div><div class="azl-context-row"></div><div class="azl-context-menu" hidden><label>Find Pool Shed record<input type="search" class="azl-context-search" autocomplete="off" placeholder="Project, PO, SKU, customer…"></label><div class="azl-context-options"></div></div></section>
      <section class="azl-view azl-chat-view"><div class="azl-messages" aria-live="polite"></div><div class="azl-suggestions"></div><form class="azl-composer"><textarea rows="1" maxlength="4000" placeholder="Ask Azzy about Pool Shed…" aria-label="Ask Azzy"></textarea><button type="submit" class="azl-send">Send</button></form></section>
      <section class="azl-view azl-attention-view" hidden><div class="azl-attention-list"></div><div class="azl-win-block"><h3>Going well</h3><div class="azl-wins-list"></div></div></section>
      <footer class="azl-foot"><span class="azl-engine">Loading secure workspace…</span><span>Writes disabled in Preview</span></footer>
      <div class="azl-toast" role="status" hidden></div>
    </aside>`;
  document.body.appendChild(root);
  root.querySelector('.azl-launcher').addEventListener('click',open);
  root.querySelector('.azl-close').addEventListener('click',close);
  root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
  root.querySelector('.azl-composer').addEventListener('submit',e=>{e.preventDefault();send(root.querySelector('.azl-composer textarea').value);});
  const input=root.querySelector('.azl-composer textarea');input.addEventListener('input',resizeComposer);input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();root.querySelector('.azl-composer').requestSubmit();}});
  root.querySelector('.azl-context-search').addEventListener('input',renderContextOptions);
  document.addEventListener('click',e=>{if(!root||!state.contextMenu)return;const menu=root.querySelector('.azl-context-menu'),add=root.querySelector('.azl-context-add');if(!menu.contains(e.target)&&e.target!==add)toggleContextMenu(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.open)close();});
  global.addEventListener('hashchange',()=>{if(state.boot)syncRouteContext();});
  render();
}
function resizeComposer(){const input=root?.querySelector('.azl-composer textarea');if(!input)return;input.style.height='auto';input.style.height=Math.min(input.scrollHeight,120)+'px';}
function toggleContextMenu(force){state.contextMenu=typeof force==='boolean'?force:!state.contextMenu;const menu=root?.querySelector('.azl-context-menu');if(!menu)return;menu.hidden=!state.contextMenu;if(state.contextMenu){renderContextOptions();setTimeout(()=>root.querySelector('.azl-context-search')?.focus(),20);}}
function toast(message){const box=root?.querySelector('.azl-toast');if(!box)return;box.textContent=message;box.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{box.hidden=true;},2600);}

async function bootstrap({force=false}={}){
  mount();if(state.boot&&!force)return state.boot;if(state.booting)return state.booting;
  state.booting=(async()=>{const out=await api('bootstrap');state.boot=out;
    if(!state.contexts.length){state.contexts=(out.activeContexts||[]).map(normalizeContext).filter(Boolean).slice(0,MAX_CONTEXTS);state.primary=normalizeContext(out.primaryContext)||state.contexts[0]||null;}
    if(!state.messages.length&&Array.isArray(out.conversation))state.messages=out.conversation.map(m=>({role:m.role==='user'?'user':'assistant',text:String(m.text||''),at:m.at,evidence:m.meta?.evidenceObjects||[],links:m.meta?.links||[],action:m.meta?.action||null,quickActions:m.meta?.quickActions||[]}));
    syncRouteContext();render();return out;})().catch(e=>{renderError(e.message);throw e;}).finally(()=>{state.booting=null;});return state.booting;
}
async function open(){mount();state.open=true;root.querySelector('.azl-panel').hidden=false;root.querySelector('.azl-launcher').hidden=true;root.querySelector('.azl-launcher').setAttribute('aria-expanded','true');render();try{await bootstrap();setTimeout(()=>root.querySelector('.azl-composer textarea')?.focus(),20);}catch{} }
function close(){if(!root)return;state.open=false;root.querySelector('.azl-panel').hidden=true;root.querySelector('.azl-launcher').hidden=false;root.querySelector('.azl-launcher').setAttribute('aria-expanded','false');}
function toggle(){state.open?close():open();}
function setTab(tab){state.tab=tab==='attention'?'attention':'chat';renderTabs();if(state.tab==='attention')markAttentionSeen();}

function render(){if(!root)return;renderTabs();renderHeader();renderContexts();renderMessages();renderSuggestions();renderAttention();}
function renderTabs(){if(!root)return;root.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===state.tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});root.querySelector('.azl-chat-view').hidden=state.tab!=='chat';root.querySelector('.azl-attention-view').hidden=state.tab!=='attention';}
function renderHeader(){if(!root)return;const engine=root.querySelector('.azl-engine');if(!state.boot){engine.textContent='Loading secure workspace…';return;}engine.textContent=state.boot.assistantReady?'Local AI connected':'Deterministic Pool Shed engine';const high=(state.boot.attention||[]).filter(x=>Number(x.severity||0)>=80&&!x.seen).length;const badge=root.querySelector('.azl-badge');badge.textContent=String(high);badge.hidden=!high;const count=root.querySelector('.azl-attention-count'),all=(state.boot.attention||[]).length;count.textContent=String(all);count.hidden=!all;}
function renderError(message){if(!root)return;state.messages=[{role:'assistant',text:message||'Azzy could not load the current Pool Shed workspace.',error:true,at:new Date().toISOString()}];renderMessages();root.querySelector('.azl-engine').textContent='Secure workspace unavailable';}
function renderContexts(){if(!root)return;const row=root.querySelector('.azl-context-row');row.replaceChildren();const count=root.querySelector('.azl-context-count');count.textContent=state.contexts.length>1?`${state.contexts.length} items`:'';
  for(const c of state.contexts){const chip=el('div','azl-context-chip'+(same(c,state.primary)?' primary':''));const main=button('', 'azl-context-main',()=>setPrimary(c));main.append(el('span','azl-context-icon',icon(c.type)),el('span','',contextLabel(c)));chip.append(main,button('×','azl-context-remove',()=>removeContext(c)));row.append(chip);}
  const add=button(state.contexts.length?'＋':'＋ Add record','azl-context-add',()=>toggleContextMenu());add.disabled=!state.boot;add.setAttribute('aria-label','Add Pool Shed record to working set');row.append(add);renderContextOptions();}
function renderContextOptions(){if(!root)return;const box=root.querySelector('.azl-context-options'),input=root.querySelector('.azl-context-search');if(!box||!input)return;box.replaceChildren();const q=input.value.trim().toLowerCase(),active=new Set(state.contexts.map(keyOf));const rows=(state.boot?.contexts||[]).filter(c=>!q||`${c.label||''} ${c.id||''} ${c.meta||''}`.toLowerCase().includes(q)).slice(0,40);
  for(const c of rows){const b=button('','azl-context-option',()=>{if(active.has(keyOf(c)))setPrimary(c);else addContext(c);toggleContextMenu(false);input.value='';});b.append(el('span','azl-context-icon',icon(c.type)));const copy=el('div');copy.append(el('b','',c.label||c.id),el('small','',c.meta||c.id));b.append(copy,el('span','',active.has(keyOf(c))?'Added':'＋'));box.append(b);}if(!rows.length)box.append(el('p','azl-empty','No permitted records match that search.'));}

function renderMessages(){if(!root)return;const list=root.querySelector('.azl-messages');list.replaceChildren();if(!state.messages.length){const name=state.boot?.user?.name||state.boot?.user?.full_name||'there';appendMessageNode(list,{role:'assistant',text:`Hi, ${name}. What are we sorting in Pool Shed?`,at:new Date().toISOString()});return;}for(const m of state.messages)appendMessageNode(list,m);list.scrollTop=list.scrollHeight;}
function appendMessageNode(list,message){const wrap=el('div',`azl-message ${message.role==='user'?'user':'assistant'}${message.error?' error':''}`);if(message.role!=='user'){const img=document.createElement('img');img.className='azl-message-avatar';img.src='./assets/img/azzy-live-64.png';img.alt='';wrap.append(img);}const body=el('div','azl-message-body');const bubble=el('div','azl-bubble',message.text||'');body.append(bubble);
  const usableLinks=(message.links||[]).filter(canOpenLink);if(usableLinks.length){const links=el('div','azl-record-links');for(const link of usableLinks.slice(0,8))links.append(button(`↗ ${link.label||link.id}`,'azl-record-link',()=>openRecord(link.type,link.id)));body.append(links);}
  if(message.action){const card=el('div','azl-action-preview');card.append(el('b','','Prepared action (Preview only)'),el('p','',message.action.summary||message.action.reason||message.action.description||titleCase(message.action.type)));card.append(el('small','','Execution is disabled until Pool Shed action authorities are wired and accepted.'));body.append(card);}
  if((message.evidence||[]).length){const details=document.createElement('details');details.className='azl-evidence';const summary=document.createElement('summary');summary.textContent='Why?';details.append(summary);for(const e of message.evidence.slice(0,40)){const row=el('div','azl-evidence-row');row.append(el('small','',`${titleCase(e.entityType||'record')} · ${e.entityId||''}`),el('b','',e.label||''),el('span','',e.value??''));details.append(row);}body.append(details);}
  if((message.quickActions||[]).length){const quick=el('div','azl-quick-actions');for(const a of message.quickActions.slice(0,4)){if(!a?.prompt)continue;quick.append(button(a.label||a.prompt,'azl-quick-action',()=>send(a.prompt)));}body.append(quick);}
  body.append(el('small','azl-message-time',time(message.at)));wrap.append(body);list.append(wrap);}
function renderSuggestions(){if(!root)return;const box=root.querySelector('.azl-suggestions');box.replaceChildren();if(state.busy)return;const base=state.followups.length?state.followups:defaultSuggestions();for(const item of base.slice(0,4)){const prompt=typeof item==='string'?item:item?.prompt||item?.label;if(prompt)box.append(button(prompt,'azl-suggestion',()=>send(prompt)));}}
function defaultSuggestions(){if(state.contexts.filter(c=>c.type==='project').length>=2)return['Compare these projects','What am I missing across them?'];if(state.primary?.type==='project')return['What should I focus on?','What are we waiting for?'];if(state.primary?.type==='finance')return['What needs paying soon?','Any duplicate bills?'];if(['stock','product'].includes(state.primary?.type))return['How many are free?','Who supplies this cheapest?'];if(state.primary?.type==='po')return['What is still missing?','How late is it?'];return['What needs me today?','What am I missing?'];}

function renderAttention(){if(!root)return;renderHeader();const list=root.querySelector('.azl-attention-list'),wins=root.querySelector('.azl-wins-list');list.replaceChildren();wins.replaceChildren();for(const item of state.boot?.attention||[]){const card=el('article','azl-attention-card');const severity=el('span','azl-severity','!'),copy=el('div');copy.append(el('h3','',item.title||'Attention'),el('p','',item.summary||''));const actions=el('div','azl-attention-actions');if(item.record&&canOpenLink(item.record))actions.append(button('Open','',()=>openRecord(item.record.type,item.record.id)));actions.append(button('Discuss','',()=>{if(item.context)addContext(item.context);setTab('chat');send(item.actionPrompt||'Talk me through this.');}));card.append(severity,copy,actions);list.append(card);}if(!list.children.length)list.append(el('p','azl-empty','Nothing currently needs your attention.'));
  for(const item of state.boot?.wins||[]){const card=el('article','azl-win-card');card.append(el('h4','',item.title||'Positive signal'),el('p','',item.summary||''));if(item.record&&canOpenLink(item.record))card.append(button('Open','',()=>openRecord(item.record.type,item.record.id)));wins.append(card);}if(!wins.children.length)wins.append(el('p','azl-empty','No positive signal is recorded yet.'));}
async function markAttentionSeen(){const ids=(state.boot?.attention||[]).filter(x=>!x.seen).map(x=>x.id).filter(Boolean);if(!ids.length)return;for(const item of state.boot.attention)if(ids.includes(item.id))item.seen=true;renderHeader();try{await api('attention-seen',{method:'POST',body:{ids}});}catch{} }

function canOpenLink(link){if(!link?.type||!link?.id)return false;if(AZZY_TO_ROUTE[link.type==='product'?'product':link.type])return true;return link.type==='bill'||link.type==='invoice';}
function openRecord(type,id){const router=global.PoolShedRouter;if(!router)return toast('Pool Shed record routing is unavailable.');const normalized=type==='product'?'product':type,routeType=AZZY_TO_ROUTE[normalized];if(routeType){const result=router.open(router.to(routeType,id));if(result?.ok===false)toast(result.reason||'You do not have access to that record.');else close();return;}if(type==='bill'||type==='invoice'){const result=router.open(router.parse('#/finance'));if(result?.ok===false)toast(result.reason||'You do not have access to Finance.');else close();}}

async function send(message){message=text(message);if(!message||state.busy)return;try{if(!state.boot)await bootstrap();}catch{return;}state.busy=true;state.tab='chat';state.followups=[];const input=root.querySelector('.azl-composer textarea');input.value='';resizeComposer();state.messages.push({role:'user',text:message,at:new Date().toISOString()},{role:'assistant',text:'Working from the current Pool Shed records…',pending:true,at:new Date().toISOString()});render();input.disabled=true;root.querySelector('.azl-send').disabled=true;
  try{const out=await api('chat',{method:'POST',body:{message,context:state.primary,contexts:state.contexts}});state.messages.pop();state.messages.push({role:'assistant',text:out.answer||'No answer was returned.',at:new Date().toISOString(),evidence:out.evidence||[],links:out.links||[],action:out.action||null,quickActions:out.quickActions||[]});if(Array.isArray(out.contexts)){state.contexts=out.contexts.map(normalizeContext).filter(Boolean).slice(0,MAX_CONTEXTS);state.primary=normalizeContext(out.primaryContext)||state.contexts[0]||null;}state.followups=Array.isArray(out.followups)?out.followups:[];}
  catch(e){state.messages.pop();state.messages.push({role:'assistant',text:`I couldn't complete that request: ${e.message}`,error:true,at:new Date().toISOString()});}
  finally{state.busy=false;input.disabled=false;root.querySelector('.azl-send').disabled=false;render();setTimeout(()=>input.focus(),20);}}

const apiSurface={open,close,toggle,send,refresh:()=>bootstrap({force:true}),getState:()=>({open:state.open,contexts:[...state.contexts],primary:state.primary,previewMode:true})};
global.PoolShedAzzyLive=apiSurface;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof globalThis!=='undefined'?globalThis:window);
