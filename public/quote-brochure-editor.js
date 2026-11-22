/* Pool Shed v1.75.0 Quote Studio brochure editor.
   Three panels like a website builder: the brochure's sections on the left, the customer's real page in the middle
   (click any words to change them), and the settings for what you clicked on the right. Every change saves itself
   and can be undone. */
(function(global){
'use strict';
const engine=global.PoolShedQuoteStudio;if(!engine||!engine.brochurePages)return;
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2}).format(Number(n||0));
const notify=m=>{try{if(typeof global.toast==='function')global.toast(m);else console.log(m)}catch(_){}};
const S={quote:'',page:'',group:'',option:'',catTimer:0,panel:'section',device:'desktop',previewKey:'',saveTimer:0,pushTimer:0,dragId:''};
const q=()=>S.quote?engine.getQuote(S.quote):null;
const locked=qt=>['Accepted','Won'].includes(String(qt&&qt.status||''));
const lib=()=>engine.brochureLibrary();
const libFor=type=>lib().find(x=>x.type===type)||{title:type,help:''};
const visiblePages=qt=>engine.brochurePages(qt).filter(p=>p.type!=='project');
const ICON={grip:'<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/></svg>',
 eye:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8s2.6-5 7-5 7 5 7 5-2.6 5-7 5-7-5-7-5Z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
 eyeOff:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2l12 12M6.5 3.3A6.9 6.9 0 0 1 8 3c4.4 0 7 5 7 5a12 12 0 0 1-2 2.6M10 12.7a6.9 6.9 0 0 1-2 .3c-4.4 0-7-5-7-5a12 12 0 0 1 2.6-3" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
 desktop:'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="8.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 14h5M8 11v3" stroke="currentColor" stroke-width="1.3"/></svg>',
 tablet:'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="1.5" width="10" height="13" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 12.5h2" stroke="currentColor" stroke-width="1.3"/></svg>',
 phone:'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4.5" y="1.5" width="7" height="13" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7.2 12.5h1.6" stroke="currentColor" stroke-width="1.3"/></svg>'};

/* ---------- reading and writing one setting by its path ---------- */
const SAFE_RE=/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/,BLOCKED=new Set(['constructor','prototype','toString','valueOf','hasOwnProperty']);const SAFE={test:x=>SAFE_RE.test(x)&&!BLOCKED.has(x)};
const GROUP_KEYS=['title','intro','eyebrow','rule','priceMode','layout','columns'];
const OPTION_KEYS=['title','description','subtitle','unitPrice','qty','selected','recommended','badge','image','costSnapshot','supplierSnapshot','benefits'];
function pageById(qt,id){return engine.brochurePages(qt).find(p=>p.id===id)||null}
function groupById(qt,id){return (qt.sections||[]).find(s=>s.id===id)||null}
function getPath(qt,path){const k=String(path||'').split('.');if(!k.every(x=>SAFE.test(x)))return undefined;
 if(k[0]==='presentation')return (qt.presentation||{})[k[1]];
 if(k[0]==='theme')return ((qt.presentation||{}).theme||{})[k[1]];
 if(k[0]==='pagemeta'){const p=pageById(qt,k[1]);return p?p[k[2]]:undefined}
 if(k[0]==='page'){let t=(pageById(qt,k[1])||{}).settings;for(let i=2;i<k.length&&t!=null;i++)t=t[k[i]];return t}
 if(k[0]==='group'){const g=groupById(qt,k[1]);if(!g)return undefined;return k[2]==='columns'?(g.style||{}).columns:g[k[2]]}
 if(k[0]==='option'){const g=groupById(qt,k[1]),o=g&&(g.options||[]).find(x=>x.id===k[2]);return o?o[k[3]]:undefined}
 return undefined}
function setPath(qt,path,value){const k=String(path||'').split('.');if(!qt||locked(qt)||!k.every(x=>SAFE.test(x)))return false;
 if(k[0]==='presentation'){if(!['heroTitle','heroIntro','about','heroImage','heroImagePosition','brandName','brandDescriptor','htmlPage','htmlPageOn'].includes(k[1]))return false;if(k[1]==='htmlPageOn'){qt.presentation.htmlPageOn=value===true||value==='1'?'1':'';return true}qt.presentation[k[1]]=String(value).slice(0,100000);return true}
 if(k[0]==='theme'){if(!['style','brandColour','headingFont'].includes(k[1]))return false;qt.presentation.theme=qt.presentation.theme||{};qt.presentation.theme[k[1]]=String(value);return true}
 if(k[0]==='pagemeta'){const p=pageById(qt,k[1]);if(!p||k[2]!=='title')return false;p.title=String(value).slice(0,80);return true}
 if(k[0]==='page'){const p=pageById(qt,k[1]);if(!p||k.length<3)return false;let t=p.settings=p.settings||{};for(let i=2;i<k.length-1;i++){if(t[k[i]]==null||typeof t[k[i]]!=='object')return false;t=t[k[i]]}t[k[k.length-1]]=value;return true}
 if(k[0]==='group'){const g=groupById(qt,k[1]);if(!g||!GROUP_KEYS.includes(k[2]))return false;if(k[2]==='columns'){g.style=g.style||{};g.style.columns=Math.max(1,Math.min(3,Number(value)||3))}else g[k[2]]=String(value);return true}
 if(k[0]==='option'){const g=groupById(qt,k[1]),o=g&&(g.options||[]).find(x=>x.id===k[2]);if(!o||!OPTION_KEYS.includes(k[3]))return false;
  if(k[3]==='benefits'){o.benefits=String(value).split('\n').map(x=>x.trim()).filter(Boolean).slice(0,6);return true}
  if(k[3]==='unitPrice'||k[3]==='qty'||k[3]==='costSnapshot'){const n=Number(String(value).replace(/[£,\s]/g,''));if(!Number.isFinite(n))return false;o[k[3]]=Math.round(n*100)/100}
  else if(k[3]==='selected'||k[3]==='recommended'){o[k[3]]=!!value;if(k[3]==='selected'&&value&&g.rule==='single')(g.options||[]).forEach(x=>{if(x!==o)x.selected=false})}
  else o[k[3]]=String(value);return true}
 return false}

/* ---------- saving and the live preview ---------- */
function savedLabel(t){const el=document.getElementById('beSaved');if(el){el.textContent=t;el.dataset.state=t==='Saved'?'saved':'saving'}}
function scheduleSave(){savedLabel('Saving…');clearTimeout(S.saveTimer);S.saveTimer=setTimeout(flushSave,700)}
function flushSave(){clearTimeout(S.saveTimer);S.saveTimer=0;const qt=q();if(!qt)return;try{engine.touch(qt);savedLabel('Saved')}catch(err){savedLabel('Not saved');notify(err.message)}}
function previewPayload(qt){const prev=S.previewKey,id=engine.savePreview(qt);if(!id)return null;let payload=null;try{payload=JSON.parse(localStorage.getItem('poolShedQuotePreview:'+id)||'{}').proposal||null}catch(_){}
 if(prev&&prev!==id){try{localStorage.removeItem('poolShedQuotePreview:'+prev)}catch(_){}}S.previewKey=id;return payload}
function frame(){return document.getElementById('beFrame')}
function push(scroll){clearTimeout(S.pushTimer);S.pushTimer=0;const qt=q(),fr=frame();if(!qt||!fr||!fr.contentWindow)return;const st=document.getElementById('beSpecTotal');if(st)st.textContent=specSummary(qt);const payload=previewPayload(qt);if(payload)fr.contentWindow.postMessage({type:'ps-brochure',proposal:payload,page:S.page,scroll:!!scroll},location.origin)}
function schedulePush(){clearTimeout(S.pushTimer);S.pushTimer=setTimeout(()=>push(false),180)}
function focusFrame(){const fr=frame();if(fr&&fr.contentWindow)fr.contentWindow.postMessage({type:'ps-focus',page:S.page},location.origin)}

/* ---------- panels ---------- */
function topBar(qt){const steps=[['Proposal','Quote details'],['Options & Packages','Full option builder'],qt.workflow==='quick'?null:['Pool Layout','Pool layout'],['Commercial','Pricing and payments'],['Engagement','Customer activity'],['Versions','Versions'],['Handover','Handover']].filter(Boolean);
 const c=engine.customer(qt.customerId),t=engine.totals(qt);
 return '<header class="be-top"><button type="button" class="be-btn ghost" data-qs-action="back-list" title="Back to quotes">← Quotes</button>'+
 '<div class="be-title"><b>'+esc(qt.id)+' · '+esc(qt.projectName||'Untitled quote')+'</b><span>'+esc(c?(c.name||c.companyName||''):'No customer yet')+' · '+esc(qt.status||'Draft')+' · '+cash(t.gross)+' inc. VAT</span></div>'+
 '<span class="be-saved" id="beSaved" data-state="saved">'+(locked(qt)?'Accepted, read only':'Saved')+'</span><span class="be-grow"></span>'+
 '<div class="be-seg" role="group" aria-label="Preview size">'+['desktop','tablet','phone'].map(d=>'<button type="button" class="'+(S.device===d?'on':'')+'" data-be-device="'+d+'" title="'+d[0].toUpperCase()+d.slice(1)+'" aria-pressed="'+(S.device===d)+'">'+ICON[d]+'</button>').join('')+'</div>'+
 '<div class="be-seg"><button type="button" data-qs-action="undo" title="Undo (Ctrl+Z)">↶</button><button type="button" data-qs-action="redo" title="Redo (Ctrl+Shift+Z)">↷</button></div>'+
 '<details class="be-menu"><summary class="be-btn">Quote steps</summary><div class="be-menu-list">'+steps.map(s=>'<button type="button" data-qs-tab="'+esc(s[0])+'">'+esc(s[1])+'</button>').join('')+'<button type="button" data-be-save-template>Save as a template…</button></div></details>'+
 '<button type="button" class="be-btn" data-qs-action="preview">Preview</button><button type="button" class="be-btn primary" data-qs-action="publish">Send to customer</button></header>'}
function leftHtml(qt){
 if(S.panel==='add'){const have=new Set(visiblePages(qt).filter(p=>p.visible!==false).map(p=>p.type));
  return '<div class="be-panel-head"><button type="button" class="be-btn ghost small" data-be-panel="section">← Back</button><b>Add a section</b></div><div class="be-lib">'+lib().map(x=>{const inUse=x.single&&have.has(x.type);return '<button type="button" class="be-lib-item'+(inUse?' in-use':'')+'" data-be-add="'+esc(x.type)+'"><b>'+esc(x.title)+'</b><span>'+esc(inUse?'Already in the brochure':x.help)+'</span></button>'}).join('')+'</div>'}
 const rows=visiblePages(qt).map((p,i)=>{const hidden=p.visible===false,active=S.page===p.id&&S.panel==='section';let sub='';
  if(p.type==='options'&&!hidden)sub=(qt.sections||[]).map(g=>'<li class="be-sub'+(S.group===g.id&&active?' on':'')+'"><button type="button" data-be-select="'+esc(p.id)+'" data-be-group="'+esc(g.id)+'">'+esc(g.title||'Choice group')+'<small>'+((g.options||[]).length)+'</small></button></li>').join('');
  return '<li class="be-row'+(active?' on':'')+(hidden?' off':'')+'" draggable="'+(!locked(qt))+'" data-be-page="'+esc(p.id)+'" data-be-index="'+i+'"><span class="be-grip" title="Drag to move">'+ICON.grip+'</span><button type="button" class="be-row-main" data-be-select="'+esc(p.id)+'">'+esc(p.title||libFor(p.type).title)+'</button><button type="button" class="be-eye" data-be-toggle="'+esc(p.id)+'" title="'+(hidden?'Show to customer':'Hide from customer')+'" aria-label="'+(hidden?'Show ':'Hide ')+esc(p.title||p.type)+'">'+(hidden?ICON.eyeOff:ICON.eye)+'</button></li>'+(sub?'<ul class="be-subs">'+sub+'</ul>':'')}).join('');
 return '<div class="be-panel-head"><b>Brochure sections</b><span>Drag to reorder</span></div>'+((qt.presentation||{}).htmlPageOn==='1'?'<p class="be-note">Your own HTML page is on (Theme). These sections only show where its placeholders put them.</p>':'')+'<ol class="be-list">'+rows+'</ol>'+(locked(qt)?'':'<button type="button" class="be-add" data-be-panel="add">+ Add section</button>')+
 '<div class="be-left-foot"><button type="button" class="be-foot-btn'+(S.panel==='theme'?' on':'')+'" data-be-panel="theme"><b>Theme</b><span>Colours, fonts, logo name</span></button></div>'}
function fieldWrap(label,inner,help){return '<label class="be-field"><span>'+esc(label)+'</span>'+inner+(help?'<small>'+esc(help)+'</small>':'')+'</label>'}
function inp(qt,label,path,opts={}){const v=getPath(qt,path);return fieldWrap(label,'<input type="'+(opts.type||'text')+'" data-be-path="'+esc(path)+'" value="'+esc(v==null?'':v)+'" placeholder="'+esc(opts.placeholder||'')+'"'+(opts.step?' step="'+opts.step+'"':'')+(locked(qt)?' readonly':'')+'>',opts.help)}
function area(qt,label,path,rows=4,opts={}){let v=getPath(qt,path);if(Array.isArray(v))v=v.join('\n');return fieldWrap(label,'<textarea data-be-path="'+esc(path)+'" rows="'+rows+'" placeholder="'+esc(opts.placeholder||'')+'"'+(locked(qt)?' readonly':'')+'>'+esc(v==null?'':v)+'</textarea>',opts.help)}
function sel(qt,label,path,options,opts={}){const v=String(getPath(qt,path)==null?(opts.fallback||''):getPath(qt,path));return fieldWrap(label,'<select data-be-path="'+esc(path)+'"'+(locked(qt)?' disabled':'')+'>'+options.map(o=>'<option value="'+esc(o[0])+'"'+(String(o[0])===v?' selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select>',opts.help)}
function check(qt,label,path){return '<label class="be-check"><input type="checkbox" data-be-path="'+esc(path)+'"'+(getPath(qt,path)?' checked':'')+(locked(qt)?' disabled':'')+'><span>'+esc(label)+'</span></label>'}
function thumb(qt,ref){const u=engine.mediaUrl?engine.mediaUrl(qt,ref):ref;return u?'<span class="be-thumb" style="background-image:url(&quot;'+esc(u)+'&quot;)"></span>':'<span class="be-thumb empty">No picture</span>'}
function mediaChoices(qt,path,mode){const items=(qt.mediaLibrary||[]).filter(m=>String(m.type||'image').startsWith('image')||m.type==='image').slice(-24).reverse();if(!items.length)return '';return '<details class="be-media"><summary>Choose from this quote’s pictures ('+items.length+')</summary><div class="be-media-grid">'+items.map(m=>'<button type="button" data-be-pick="'+esc(path)+'" data-be-mode="'+mode+'" data-be-url="'+esc(m.url)+'" title="'+esc(m.name||'Picture')+'">'+thumb(qt,m.url)+'</button>').join('')+'</div></details>'}
function picture(qt,label,path){const v=getPath(qt,path);if(locked(qt))return fieldWrap(label,thumb(qt,v));return '<div class="be-field"><span>'+esc(label)+'</span><div class="be-pic">'+thumb(qt,v)+'<div class="be-pic-actions"><label class="be-btn small">Upload<input type="file" accept="image/jpeg,image/png,image/webp" data-be-upload="'+esc(path)+'" data-be-mode="set" hidden></label>'+(v?'<button type="button" class="be-btn ghost small" data-be-clear="'+esc(path)+'">Remove</button>':'')+'</div></div>'+mediaChoices(qt,path,'set')+'</div>'}
function listEditor(qt,page,key,fields,addLabel,blank){const items=Array.isArray(page.settings[key])?page.settings[key]:[],base='page.'+page.id+'.'+key;
 return '<div class="be-items">'+items.map((x,n)=>'<fieldset class="be-item"><legend>'+(n+1)+'</legend>'+fields.map(f=>f[2]==='area'?area(qt,f[1],base+'.'+n+'.'+f[0],3):inp(qt,f[1],base+'.'+n+'.'+f[0])).join('')+(locked(qt)?'':'<div class="be-item-actions"><button type="button" class="be-btn ghost small" data-be-item-move="'+esc(base)+'" data-be-n="'+n+'" data-be-dir="-1"'+(n===0?' disabled':'')+'>↑</button><button type="button" class="be-btn ghost small" data-be-item-move="'+esc(base)+'" data-be-n="'+n+'" data-be-dir="1"'+(n===items.length-1?' disabled':'')+'>↓</button><button type="button" class="be-btn ghost small be-danger" data-be-item-remove="'+esc(base)+'" data-be-n="'+n+'">Remove</button></div>')+'</fieldset>').join('')+'</div>'+(locked(qt)?'':'<button type="button" class="be-btn small" data-be-item-add="'+esc(base)+'" data-be-blank="'+esc(JSON.stringify(blank))+'">'+esc(addLabel)+'</button>')}
function stepLink(tab,label,help){return '<div class="be-link"><p>'+esc(help)+'</p><button type="button" class="be-btn small" data-qs-tab="'+esc(tab)+'">'+esc(label)+' →</button></div>'}
function marginText(o){const p=Number(o.unitPrice||0),c=Number(o.costSnapshot||0);if(!p)return 'Add a price';if(!c)return 'Add the cost to see the margin';return Math.round((p-c)/p*100)+'% margin · '+cash(p-c)+' profit each'}
function marginTone(o){const p=Number(o.unitPrice||0),c=Number(o.costSnapshot||0);if(!p||!c)return 'muted';const m=(p-c)/p*100;return m<20?'bad':m<30?'warn':'good'}
function choiceEditor(qt,g,o,n,count){const ob='option.'+g.id+'.'+o.id,isCat=!!o.productId,open=S.option===o.id;
 return '<details class="be-choice" data-be-choice="'+esc(o.id)+'"'+(open?' open':'')+'><summary>'+thumb(qt,o.image)+'<span class="be-choice-sum"><b>'+esc(o.title||'Choice')+'</b><small>'+cash(Number(o.qty||1)*Number(o.unitPrice||0))+(o.selected||g.rule==='locked'?' · in the starting total':'')+'</small><small class="be-margin '+marginTone(o)+'" data-be-margin="'+esc(o.id)+'">'+esc(marginText(o))+'</small></span></summary><div class="be-choice-body">'+
 picture(qt,'Photo',ob+'.image')+inp(qt,'Choice name',ob+'.title')+area(qt,'Description',ob+'.description',3)+area(qt,'Highlights (one per line, up to 6)',ob+'.benefits',3)+inp(qt,'Badge (optional)',ob+'.badge',{placeholder:'Most popular'})+
 '<div class="be-two">'+inp(qt,'Price each (ex VAT)',ob+'.unitPrice',{type:'number',step:'0.01'})+inp(qt,'Qty',ob+'.qty',{type:'number',step:'1'})+'</div>'+
 '<div class="be-two">'+inp(qt,'Cost each (only you see this)',ob+'.costSnapshot',{type:'number',step:'0.01'})+(isCat?fieldWrap('From the catalogue','<span class="be-cat-ref">'+esc(o.skuSnapshot||o.productId)+(o.supplierSnapshot?' · '+esc(o.supplierSnapshot):'')+'</span>'):inp(qt,'Order from supplier',ob+'.supplierSnapshot',{placeholder:'Leave blank if not bought in',help:'Named: a draft purchase order is made when accepted.'}))+'</div>'+
 '<div class="be-checks">'+check(qt,g.rule==='single'?'Chosen to start with':'Ticked to start with',ob+'.selected')+check(qt,'Recommended',ob+'.recommended')+'</div>'+
 (locked(qt)?'':'<div class="be-item-actions"><button type="button" class="be-btn ghost small" data-be-option-move="'+esc(g.id)+'" data-be-option="'+esc(o.id)+'" data-be-dir="-1"'+(n===0?' disabled':'')+'>↑</button><button type="button" class="be-btn ghost small" data-be-option-move="'+esc(g.id)+'" data-be-option="'+esc(o.id)+'" data-be-dir="1"'+(n===count-1?' disabled':'')+'>↓</button><button type="button" class="be-btn ghost small be-danger" data-be-option-remove="'+esc(g.id)+'" data-be-option="'+esc(o.id)+'">Remove choice</button></div>')+'</div></details>'}
function specSummary(qt){const t=engine.totals(qt);return 'Starting total '+cash(t.gross)+' inc. VAT'+(t.cost?' · margin '+Math.round(t.margin)+'%':'')}
function templateGroups(qt){const rows=[];(engine.templates()||[]).forEach(t=>(t.sections||[]).forEach(g=>{if((g.options||[]).length)rows.push('<button type="button" class="be-lib-item" data-be-tpl="'+esc(t.id)+'" data-be-tpl-group="'+esc(g.id)+'"><b>'+esc(g.title||'Choice group')+'</b><span>'+esc(t.name||'Template')+' · '+(g.options||[]).length+' choices</span></button>')}));
 return '<details class="be-media be-tpl"><summary>Copy a group from a template'+(rows.length?' ('+rows.length+')':'')+'</summary>'+(rows.length?'<div class="be-lib">'+rows.join('')+'</div>':'<p class="be-help">No templates with choice groups yet. Use “Save as a template” under Quote steps to keep this quote’s groups for next time.</p>')+'</details>'}
function catalogueResults(term){const words=String(term||'').toLowerCase().split(/\s+/).filter(Boolean);if(!words.length)return [];const list=(global.__POOL_SHED_GET_DATA__?global.__POOL_SHED_GET_DATA__():{}).products||[],out=[];
 for(const p of list){if(!p||p.deleted||p.virtual||p.hiddenFromCatalogue||/^(CUSTOM|SHIP)-/i.test(String(p.id)))continue;const hay=(String(p.sku||'')+' '+String(p.name||'')+' '+String(p.supplierSku||'')).toLowerCase();if(words.every(w=>hay.includes(w))){out.push(p);if(out.length>=8)break}}return out}
function groupEditor(qt,g){const base='group.'+g.id,opts=g.options||[];
 return '<details class="be-group"'+(S.group===g.id||(qt.sections||[]).length===1?' open':'')+' data-be-group-box="'+esc(g.id)+'"><summary><b>'+esc(g.title||'Choice group')+'</b><span>'+esc({single:'Pick one',multi:'Pick any',locked:'Included',optional:'Optional'}[g.rule]||'Pick one')+' · '+opts.length+' choice'+(opts.length===1?'':'s')+'</span></summary>'+
 inp(qt,'Group title',base+'.title')+area(qt,'Words under the title',base+'.intro',2)+
 '<div class="be-two">'+sel(qt,'Customer can',base+'.rule',[['single','Pick one'],['multi','Pick any'],['optional','Choose if they want'],['locked','Not choose (included)']])+sel(qt,'Prices show as',base+'.priceMode',[['full','Full price'],['upgrade','Extra cost (+£)'],['included','Included'],['hide','Hidden']])+'</div>'+
 sel(qt,'Cards across',base+'.columns',[['1','1'],['2','2'],['3','3']],{fallback:'3'})+
 '<div class="be-choices">'+opts.map((o,n)=>choiceEditor(qt,g,o,n,opts.length)).join('')+'</div>'+
 (locked(qt)?'':'<div class="be-cat"><input type="search" placeholder="Add from the catalogue: name or code" data-be-cat="'+esc(g.id)+'" autocomplete="off"><div class="be-cat-results" data-be-cat-results="'+esc(g.id)+'"></div></div><div class="be-row-actions"><button type="button" class="be-btn small" data-be-option-add="'+esc(g.id)+'">+ Type in a choice</button><button type="button" class="be-btn ghost small be-danger" data-be-group-remove="'+esc(g.id)+'">Remove group</button></div>')+'</details>'}
function sectionSettings(qt,p){const s='page.'+p.id+'.',L=libFor(p.type);let body='';
 switch(p.type){
  case 'welcome':body=inp(qt,'Title','presentation.heroTitle',{placeholder:qt.projectName||''})+area(qt,'Welcome line','presentation.heroIntro',3)+picture(qt,'Cover picture','presentation.heroImage')+sel(qt,'Picture focus','presentation.heroImagePosition',[['left','Left'],['center','Centre'],['right','Right']],{fallback:'center'});break;
  case 'about':body=inp(qt,'Heading',s+'heading')+area(qt,'About you','presentation.about',6);break;
  case 'letter':body=inp(qt,'Small label',s+'label')+inp(qt,'Heading',s+'heading')+area(qt,'Letter',s+'body',9,{help:'Leave a blank line between paragraphs.'})+'<div class="be-two">'+inp(qt,'Signed by',s+'name')+inp(qt,'Role',s+'role')+'</div>';break;
  case 'options':body='<p class="be-help">Each group is one question for the customer, like size, heating or cover. They see the price change as they choose.</p><div class="be-spec-total" id="beSpecTotal">'+esc(specSummary(qt))+'</div>'+(qt.sections||[]).map(g=>groupEditor(qt,g)).join('')+(locked(qt)?'':'<div class="be-row-actions"><button type="button" class="be-btn small" data-be-group-add>+ Add a choice group</button><button type="button" class="be-btn ghost small" data-be-open-builder="">Full option builder →</button></div>'+templateGroups(qt));break;
  case 'gallery':{const imgs=Array.isArray(p.settings.images)?p.settings.images:[];body=inp(qt,'Small label',s+'label')+inp(qt,'Heading',s+'heading')+area(qt,'Words under the heading',s+'intro',2)+
   '<div class="be-field"><span>Pictures ('+imgs.length+' of 12)</span><div class="be-gallery">'+imgs.map((u,n)=>'<div class="be-gallery-item">'+thumb(qt,u)+(locked(qt)?'':'<button type="button" class="be-x" data-be-item-remove="'+esc(s+'images')+'" data-be-n="'+n+'" aria-label="Remove picture">×</button>')+'</div>').join('')+(locked(qt)||imgs.length>=12?'':'<label class="be-gallery-add">+ Upload<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-be-upload="'+esc(s+'images')+'" data-be-mode="append" hidden></label>')+'</div>'+(imgs.length<12&&!locked(qt)?mediaChoices(qt,s+'images','append'):'')+'</div>';break}
  case 'text':body=inp(qt,'Small label',s+'label')+inp(qt,'Heading',s+'heading')+area(qt,'Words',s+'body',7)+picture(qt,'Picture',s+'image')+sel(qt,'Picture on the',s+'side',[['right','Right'],['left','Left']],{fallback:'right'});break;
  case 'timeline':body=inp(qt,'Small label',s+'label')+inp(qt,'Heading',s+'heading')+area(qt,'Words under the heading',s+'intro',2)+listEditor(qt,p,'steps',[['title','Step'],['text','What happens','area']],'+ Add a step',{title:'',text:''});break;
  case 'reviews':body=inp(qt,'Small label',s+'label')+inp(qt,'Heading',s+'heading')+listEditor(qt,p,'items',[['text','What they said','area'],['name','Name and town']],'+ Add a review',{text:'',name:''})+'<p class="be-help">Only use real reviews you have permission to show.</p>';break;
  case 'faqs':body=inp(qt,'Small label',s+'label')+inp(qt,'Heading',s+'heading')+listEditor(qt,p,'items',[['q','Question'],['a','Answer','area']],'+ Add a question',{q:'',a:''});break;
  case 'html':body=inp(qt,'Small label (optional)',s+'label')+inp(qt,'Heading (optional)',s+'heading')+codeArea(qt,'HTML',s+'html',16)+placeholderHelp();break;
  case 'terms':body=inp(qt,'Small label',s+'label')+inp(qt,'Heading',s+'heading')+area(qt,'Terms',s+'body',12);break;
  case 'layout':body=inp(qt,'Heading',s+'heading')+area(qt,'Words under the heading',s+'intro',2)+stepLink('Pool Layout','Open Pool layout','The drawing, shape and sizes come from the Pool layout step.');break;
  case 'documents':body=inp(qt,'Heading',s+'heading')+area(qt,'Words under the heading',s+'intro',2)+stepLink('Proposal','Open Quote details','Add brochures and specification sheets in Quote details.');break;
  case 'investment':body=inp(qt,'Heading',s+'heading',{placeholder:qt.workflow==='quick'?'Your quote, clearly presented.':'Your investment, clearly presented.'})+area(qt,'Words under the heading',s+'intro',2)+stepLink('Commercial','Open Pricing and payments','The deposit and payment stages come from Pricing and payments.');break;
  case 'acceptance':body=stepLink('Commercial','Open Pricing and payments','Customers review, type their name to sign and accept. What is due on acceptance comes from Pricing and payments.');break;
 }
 const single=!!L.single,hidden=p.visible===false;
 return '<div class="be-panel-head"><b>'+esc(p.title||L.title)+'</b><span>'+esc(L.help||'')+'</span></div>'+(locked(qt)?'<p class="be-note">This quote is accepted. Create a revision to change it.</p>':'')+
 (hidden?'<p class="be-note">Hidden from the customer. <button type="button" class="be-btn small" data-be-toggle="'+esc(p.id)+'">Show it</button></p>':'')+
 '<div class="be-fields">'+(single?'':inp(qt,'Section name (only you see this)','pagemeta.'+p.id+'.title'))+body+'</div>'+
 (locked(qt)?'':'<div class="be-row-actions be-section-actions">'+(single?'':'<button type="button" class="be-btn ghost small" data-be-duplicate="'+esc(p.id)+'">Duplicate</button>')+'<button type="button" class="be-btn ghost small be-danger" data-be-remove="'+esc(p.id)+'">'+(single?'Hide section':'Remove section')+'</button></div>')}
function themeSettings(qt){const th=(qt.presentation||{}).theme||{},colour=/^#[0-9a-f]{6}$/i.test(th.brandColour||'')?th.brandColour:'';
 return '<div class="be-panel-head"><b>Theme</b><span>Applies to the whole brochure</span></div><div class="be-fields">'+
 sel(qt,'Style','theme.style',[['architectural','Architectural'],['waterline','Waterline (softer corners)'],['minimal','Minimal (flat)'],['contrast','High contrast']],{fallback:'architectural'})+
 sel(qt,'Heading font','theme.headingFont',[['serif','Classic serif'],['sans','Clean sans']],{fallback:'serif'})+
 '<div class="be-field"><span>Brand colour</span><div class="be-colour"><input type="color" data-be-path="theme.brandColour" value="'+esc(colour||'#0f1b24')+'"'+(locked(qt)?' disabled':'')+'><span>'+esc(colour||'Standard')+'</span>'+(colour&&!locked(qt)?'<button type="button" class="be-btn ghost small" data-be-clear="theme.brandColour">Use standard</button>':'')+'</div><small>Used for the dark sections and the top bar.</small></div>'+
 inp(qt,'Business name','presentation.brandName')+inp(qt,'Line under the name','presentation.brandDescriptor')+picture(qt,'Cover picture','presentation.heroImage')+'</div>'+
 '<div class="be-panel-head"><b>Full HTML page</b><span>Replace the sections with your own page</span></div><div class="be-fields">'+check(qt,'Use my own HTML for the whole brochure','presentation.htmlPageOn')+((qt.presentation||{}).htmlPageOn==='1'?codeArea(qt,'Page HTML (a <style> block is allowed)','presentation.htmlPage',20)+placeholderHelp()+'<p class="be-help">The top bar, the live total bar and accepting online stay. If you leave out {{accept_button}}, it is added at the end.</p>':'<p class="be-help">Off: the brochure is built from the sections on the left.</p>')+'</div>'}
function placeholderHelp(){return '<details class="be-media"><summary>Placeholders you can use</summary><div class="be-ph"><p class="be-help">Words: <code>{{customer_name}}</code> <code>{{project_name}}</code> <code>{{quote_number}}</code> <code>{{version}}</code> <code>{{total}}</code> <code>{{deposit}}</code> <code>{{valid_until}}</code> <code>{{business_name}}</code> <code>{{prepared_by}}</code></p><p class="be-help">Live parts (on a line of their own): <code>{{pool_specs}}</code> the choices with live prices, <code>{{investment}}</code> total and payment stages, <code>{{accept_button}}</code>, <code>{{documents}}</code>, <code>{{pool_layout}}</code></p><p class="be-help">Removed for safety: scripts, frames, forms, buttons, on… handlers, javascript: links and data- attributes. Links and pictures must start with https://.</p></div></details>'}
function codeArea(qt,label,path,rows){const v=getPath(qt,path);return fieldWrap(label,'<textarea class="be-code" data-be-path="'+esc(path)+'" rows="'+rows+'" spellcheck="false" autocapitalize="off"'+(locked(qt)?' readonly':'')+'>'+esc(v==null?'':v)+'</textarea>')}
function rightHtml(qt){if(S.panel==='theme')return themeSettings(qt);const p=pageById(qt,S.page)||visiblePages(qt)[0];if(!p)return '<p class="be-help">Add a section to start.</p>';S.page=p.id;return sectionSettings(qt,p)}
function refreshPanels(){const qt=q();if(!qt)return;const l=document.getElementById('beLeft'),r=document.getElementById('beRight');if(l)l.innerHTML=leftHtml(qt);if(r){const y=r.scrollTop;r.innerHTML=rightHtml(qt);r.scrollTop=y}}

/* ---------- the view the workspace places on screen ---------- */
function view(qt){if(S.quote!==qt.id){Object.assign(S,{quote:qt.id,page:'',group:'',panel:'section'})}
 const pages=visiblePages(qt);if(!pageById(qt,S.page))S.page=(pages.find(p=>p.visible!==false)||pages[0]||{}).id||'';
 previewPayload(qt);
 const src='./proposal.html?preview='+encodeURIComponent(S.previewKey)+'&edit=1'+(locked(qt)?'&lock=1':'');
 return '<div class="be-root" data-be-root>'+topBar(qt)+'<div class="be-body"><aside class="be-left" id="beLeft" aria-label="Brochure sections">'+leftHtml(qt)+'</aside>'+
 '<main class="be-stage"><div class="be-frame-wrap device-'+esc(S.device)+'"><iframe id="beFrame" src="'+esc(src)+'" title="The customer’s brochure, click any words to change them"></iframe></div><p class="be-stage-hint">This is exactly what your customer sees. Click any words to change them, or click a section to see its settings.</p></main>'+
 '<aside class="be-right" id="beRight" aria-label="Settings">'+rightHtml(qt)+'</aside></div></div>'}

/* ---------- events ---------- */
const inRoot=e=>e.target&&e.target.closest&&e.target.closest('[data-be-root]');
function afterStructure(scroll){scheduleSave();flushSave();refreshPanels();push(scroll)}
function listAt(qt,base){const v=getPath(qt,base);return Array.isArray(v)?v:null}
async function upload(file){const ws=global.PoolShedQuoteStudioWorkspace;if(!ws||!ws.uploadImage)throw Error('Picture upload is not available.');return ws.uploadImage(file)}
document.addEventListener('click',async e=>{if(!inRoot(e))return;const qt=q();if(!qt)return;const t=e.target.closest('button,[data-be-select]');if(!t)return;const d=t.dataset;
 try{
  if(d.beDevice){S.device=d.beDevice;document.querySelectorAll('[data-be-device]').forEach(b=>{b.classList.toggle('on',b.dataset.beDevice===S.device);b.setAttribute('aria-pressed',b.dataset.beDevice===S.device)});const w=document.querySelector('.be-frame-wrap');if(w)w.className='be-frame-wrap device-'+S.device;return}
  if(d.bePanel){S.panel=d.bePanel;refreshPanels();return}
  if(d.beSelect){S.page=d.beSelect;S.group=d.beGroup||'';S.panel='section';refreshPanels();focusFrame();return}
  if(d.beToggle){const p=pageById(qt,d.beToggle);if(!p||locked(qt))return;p.visible=p.visible===false;S.page=p.id;afterStructure(p.visible!==false);return}
  if(d.beAdd){const p=engine.addPage(qt.id,d.beAdd,S.page);S.page=p.id;S.panel='section';afterStructure(true);notify((p.title||'Section')+' added.');return}
  if(d.beDuplicate){const p=engine.duplicatePage(qt.id,d.beDuplicate);if(p){S.page=p.id;afterStructure(true)}return}
  if(d.beRemove){const p=pageById(qt,d.beRemove);if(!p)return;const single=libFor(p.type).single;if(!single&&!confirm('Remove the '+(p.title||p.type)+' section and its words and pictures? You can undo this.'))return;engine.removePage(qt.id,p.id);if(!single){S.page=''}afterStructure(false);return}
  if(d.beClear){if(setPath(qt,d.beClear,'')){afterStructure(false)}return}
  if(d.bePick){const base=d.bePick,url=d.beUrl;if(d.beMode==='append'){const arr=listAt(qt,base);if(!arr||arr.length>=12)return;arr.push(url)}else if(!setPath(qt,base,url))return;afterStructure(false);return}
  if(d.beItemAdd){const arr=listAt(qt,d.beItemAdd);if(!arr||locked(qt))return;let blank={};try{blank=JSON.parse(d.beBlank||'{}')}catch(_){}arr.push(blank);afterStructure(false);return}
  if(d.beItemRemove){const arr=listAt(qt,d.beItemRemove);if(!arr||locked(qt))return;arr.splice(Number(d.beN),1);afterStructure(false);return}
  if(d.beItemMove){const arr=listAt(qt,d.beItemMove),n=Number(d.beN),m=n+Number(d.beDir);if(!arr||locked(qt)||m<0||m>=arr.length)return;const [x]=arr.splice(n,1);arr.splice(m,0,x);afterStructure(false);return}
  if(d.beGroupAdd!=null&&t.hasAttribute('data-be-group-add')){const g=engine.addSection(qt.id,{title:'New choice group'});S.group=g.id;afterStructure(true);return}
  if(d.beGroupRemove){const g=groupById(qt,d.beGroupRemove);if(!g||!confirm('Remove the '+(g.title||'choice')+' group and its choices? You can undo this.'))return;engine.deleteSection(qt.id,g.id);S.group='';afterStructure(false);return}
  if(d.beOptionAdd){const o=engine.addCustomOption(qt.id,d.beOptionAdd,{title:'New choice'});S.group=d.beOptionAdd;S.option=o.id;afterStructure(false);return}
  if(d.beOptionRemove){const g=groupById(qt,d.beOptionRemove);if(!g)return;g.options=(g.options||[]).filter(o=>o.id!==d.beOption);afterStructure(false);return}
  if(d.beCatAdd){const g=groupById(qt,d.beGroup);if(!g||locked(qt))return;const o=engine.addProductOption(qt.id,g.id,d.beCatAdd);S.group=g.id;S.option=o.id;afterStructure(false);notify((o.title||'Product')+' added.');return}
  if(d.beOptionMove){const g=groupById(qt,d.beOptionMove);if(!g||locked(qt))return;const i=(g.options||[]).findIndex(o=>o.id===d.beOption),m=i+Number(d.beDir);if(i<0||m<0||m>=g.options.length)return;const [x]=g.options.splice(i,1);g.options.splice(m,0,x);S.group=g.id;S.option=x.id;afterStructure(false);return}
  if(d.beTpl){const g=engine.copyGroup(qt.id,d.beTpl,d.beTplGroup);S.group=g.id;afterStructure(true);notify((g.title||'Group')+' copied into this quote.');return}
  if(t.hasAttribute('data-be-save-template')){const name=prompt('Name for the template',qt.projectType||qt.projectName||'Pool template');if(!name)return;flushSave();engine.saveTemplate(qt.id,name.trim().slice(0,80));notify('Saved as the template “'+name.trim().slice(0,80)+'”.');t.closest('details')?.removeAttribute('open');return}
  if(d.beOpenBuilder!=null&&t.hasAttribute('data-be-open-builder')){const ws=global.PoolShedQuoteStudioWorkspace;if(ws&&ws.openBuilder)ws.openBuilder(d.beOpenBuilder);return}
 }catch(err){notify(err.message)}
});
function onField(el,live){const qt=q();if(!qt)return;const path=el.dataset.bePath;let v=el.type==='checkbox'?el.checked:el.value;if(!setPath(qt,path,v))return;const k=path.split('.');if(k[0]==='option'){S.group=k[1];S.option=k[2];const g=groupById(qt,k[1]),o=g&&(g.options||[]).find(x=>x.id===k[2]),mEl=o&&document.querySelector('[data-be-margin="'+CSS.escape(o.id)+'"]');if(mEl){mEl.textContent=marginText(o);mEl.className='be-margin '+marginTone(o)}}scheduleSave();if(live)schedulePush();else push(false)}
document.addEventListener('input',e=>{if(!inRoot(e))return;const cat=e.target.closest('[data-be-cat]');if(cat){clearTimeout(S.catTimer);S.catTimer=setTimeout(()=>{const box=document.querySelector('[data-be-cat-results="'+CSS.escape(cat.dataset.beCat)+'"]');if(!box)return;const rows=catalogueResults(cat.value);box.innerHTML=!cat.value.trim()?'':rows.length?rows.map(p=>'<button type="button" class="be-cat-row" data-be-cat-add="'+esc(p.id)+'" data-be-group="'+esc(cat.dataset.beCat)+'"><b>'+esc(p.name||p.sku)+'</b><span>'+esc(p.sku||'')+(p.supplier?' · '+esc(p.supplier):'')+'</span><em>'+cash(p.rrp||p.sellPrice||p.price||0)+'</em></button>').join(''):'<p class="be-help">Nothing in the catalogue matches. Use “Type in a choice” instead.</p>'},160);return}const el=e.target.closest('[data-be-path]');if(el&&el.type!=='checkbox'&&el.tagName!=='SELECT')onField(el,true)});
document.addEventListener('change',async e=>{if(!inRoot(e))return;const el=e.target.closest('[data-be-path]');if(el){onField(el,false);if(el.type==='checkbox'||el.tagName==='SELECT'||el.type==='color')refreshPanels();else flushSave();return}
 const up=e.target.closest('[data-be-upload]');if(up&&up.files&&up.files.length){const qt=q();if(!qt)return;const files=[...up.files];savedLabel('Uploading…');try{for(const f of files){const item=await upload(f);if(up.dataset.beMode==='append'){const arr=listAt(qt,up.dataset.beUpload);if(!arr||arr.length>=12)break;arr.push(item.url)}else setPath(qt,up.dataset.beUpload,item.url)}afterStructure(false)}catch(err){savedLabel('Not saved');notify(err.message)}}});
document.addEventListener('focusout',e=>{if(inRoot(e)&&e.target.matches&&e.target.matches('[data-be-path]')&&S.saveTimer)flushSave()});
document.addEventListener('dragstart',e=>{const row=inRoot(e)&&e.target.closest('.be-row[draggable="true"]');if(!row)return;S.dragId=row.dataset.bePage;row.classList.add('dragging');try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',S.dragId)}catch(_){}});
document.addEventListener('dragover',e=>{const row=inRoot(e)&&e.target.closest('.be-row');if(!row||!S.dragId)return;e.preventDefault();const r=row.getBoundingClientRect(),after=e.clientY>r.top+r.height/2;document.querySelectorAll('.be-row.drop-before,.be-row.drop-after').forEach(x=>x.classList.remove('drop-before','drop-after'));row.classList.add(after?'drop-after':'drop-before')});
document.addEventListener('dragend',()=>{S.dragId='';document.querySelectorAll('.be-row.dragging,.be-row.drop-before,.be-row.drop-after').forEach(x=>x.classList.remove('dragging','drop-before','drop-after'))});
document.addEventListener('drop',e=>{const row=inRoot(e)&&e.target.closest('.be-row');if(!row||!S.dragId)return;e.preventDefault();const qt=q();if(!qt||locked(qt))return;const pages=engine.brochurePages(qt),from=pages.findIndex(p=>p.id===S.dragId);let to=pages.findIndex(p=>p.id===row.dataset.bePage);if(from<0||to<0)return;if(row.classList.contains('drop-after'))to+=1;if(from<to)to-=1;S.page=S.dragId;S.dragId='';engine.movePage(qt.id,S.page,to);afterStructure(true)});
global.addEventListener('message',e=>{const fr=frame();if(!fr||e.source!==fr.contentWindow||e.origin!==location.origin)return;const m=e.data||{},qt=q();if(!qt)return;
 if(m.type==='ps-ready'){push(false);return}
 if(m.type==='ps-select'&&typeof m.page==='string'){const f=String(m.field||'');S.page=m.page;S.panel='section';if(f.startsWith('group.')||f.startsWith('option.'))S.group=f.split('.')[1];refreshPanels();return}
 if(m.type==='ps-edit'&&typeof m.path==='string'){if(!setPath(qt,m.path,String(m.value==null?'':m.value).slice(0,20000)))return;scheduleSave();const box=document.querySelector('[data-be-path="'+CSS.escape(m.path)+'"]');if(box&&document.activeElement!==box)box.value=String(m.value||'')}
});
document.addEventListener('toggle',e=>{const d=e.target;if(d&&d.matches&&d.matches('details.be-choice')&&d.open)S.option=d.dataset.beChoice},true);
global.PoolShedBrochureEditor={view,setPath,getPath,flush:flushSave,state:()=>Object.assign({},S)};
})(typeof globalThis!=='undefined'?globalThis:window);
