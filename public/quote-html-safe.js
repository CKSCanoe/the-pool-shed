/* Pool Shed v1.75.0 Custom HTML for Quote Studio brochures, made safe.
   Only plain page content is kept: no scripts, frames, forms, buttons, event handlers, javascript: links or
   data- attributes, and no ids that could clash with the proposal page's own. Placeholders such as {{total}}
   are filled in afterwards by the proposal page from its own values, never from the custom HTML. */
(function(global){
'use strict';
const TAGS=new Set(['a','abbr','article','aside','b','blockquote','br','caption','cite','code','col','colgroup','dd','del','details','div','dl','dt','em','figcaption','figure','footer','h1','h2','h3','h4','h5','h6','header','hr','i','img','ins','kbd','li','main','mark','nav','ol','p','picture','pre','q','s','section','small','source','span','strong','sub','summary','sup','table','tbody','td','tfoot','th','thead','time','tr','u','ul']);
const DROP_WITH_CONTENT=new Set(['script','style','iframe','frame','frameset','object','embed','applet','noscript','template','svg','math','form','input','button','select','textarea','option','link','meta','base','title','head','audio','video','canvas','dialog','portal']);
const ATTRS=new Set(['class','id','title','alt','src','srcset','href','width','height','colspan','rowspan','align','style','target','rel','loading','role','datetime','lang','dir','open','sizes','media','type','cite','start','reversed','scope','headers','span']);
const URL_ATTRS=new Set(['href','src','cite']);
const LIMIT=100000;
function safeUrl(v,attr){const u=String(v||'').trim().replace(/[\u0000-\u001F\u007F\s]+/g,'');if(!u)return '';if(u.startsWith('#'))return u;if(/^https:\/\//i.test(u))return u;if(attr==='href'&&/^(?:mailto:|tel:)/i.test(u))return u;if(attr==='src'&&/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(u))return u;return ''}
function safeSrcset(v){return String(v||'').split(',').map(x=>x.trim()).filter(x=>/^https:\/\/\S+(\s+\d+(?:\.\d+)?[wx])?$/i.test(x)).join(', ')}
function safeCss(v){const s=String(v||'');if(/expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding|@import|url\s*\(\s*['"]?\s*(?!https:)/i.test(s))return '';return s.replace(/[<>]/g,'').slice(0,2000)}
function cleanStyleSheet(css){let s=String(css||'').slice(0,40000);s=s.replace(/@import[^;]*;?/gi,'').replace(/expression\s*\(/gi,'(').replace(/(?:java|vb)script:/gi,'').replace(/behavior\s*:/gi,'x:').replace(/-moz-binding/gi,'x').replace(/url\s*\(\s*['"]?\s*(?!https:)[^)]*\)/gi,'none').replace(/<\/?\w[^>]*>/g,'');return s}
function cleanNode(node,doc,opts){const out=doc.createDocumentFragment();node.childNodes.forEach(child=>{
  if(child.nodeType===3){out.appendChild(doc.createTextNode(child.nodeValue));return}
  if(child.nodeType!==1)return;const tag=child.tagName.toLowerCase();
  if(tag==='style'&&opts.allowStyle){const st=doc.createElement('style');st.textContent=cleanStyleSheet(child.textContent);out.appendChild(st);return}
  if(DROP_WITH_CONTENT.has(tag))return;
  if(!TAGS.has(tag)){out.appendChild(cleanNode(child,doc,opts));return}
  const el=doc.createElement(tag);
  for(const a of Array.from(child.attributes)){const name=a.name.toLowerCase();let v=a.value;
   if(name.startsWith('aria-')){el.setAttribute(name,v.slice(0,300));continue}
   if(!ATTRS.has(name))continue;
   if(URL_ATTRS.has(name)){v=safeUrl(v,name);if(!v)continue}
   else if(name==='srcset'){v=safeSrcset(v);if(!v)continue}
   else if(name==='style'){v=safeCss(v);if(!v)continue}
   else if(name==='id'||name==='class'){if(name==='id'&&/^(?:pc|ps|be|qs)/i.test(v))continue;v=v.replace(/[^\w\- ]/g,'').slice(0,200);if(!v)continue}
   else if(name==='target'){v=v==='_blank'?'_blank':'';if(!v)continue}
   el.setAttribute(name,v)}
  if(tag==='a'&&el.getAttribute('target')==='_blank')el.setAttribute('rel','noopener noreferrer');
  if(tag==='img'&&!el.getAttribute('loading'))el.setAttribute('loading','lazy');
  el.appendChild(cleanNode(child,doc,opts));out.appendChild(el)});return out}
function cleanFragment(html,opts={}){const doc=document.implementation.createHTMLDocument('');const parsed=new DOMParser().parseFromString('<!doctype html><body>'+String(html||'').slice(0,LIMIT)+'</body>','text/html');const frag=cleanNode(parsed.body,doc,opts);const box=doc.createElement('div');box.appendChild(frag);return box}
function clean(html,opts={}){return cleanFragment(html,opts).innerHTML}
const INLINE=['customer_name','project_name','quote_number','version','total','deposit','valid_until','business_name','prepared_by'];
const BLOCKS=['pool_specs','investment','accept_button','documents','pool_layout'];
// values: {customer_name:'…', total:'£…'} plain text; blocks: {pool_specs:'<trusted html>'} made by the proposal page.
function render(html,values,blocks,opts={}){const box=cleanFragment(html,opts),doc=box.ownerDocument,re=/\{\{\s*([a-z_]+)\s*\}\}/g,used=new Set();
 const fill=s=>String(s).replace(re,(m,k)=>INLINE.includes(k)&&values&&values[k]!=null?String(values[k]):m);
 const walker=doc.createTreeWalker(box,4),texts=[];while(walker.nextNode())texts.push(walker.currentNode);
 texts.forEach(t=>{if(t.parentNode&&t.parentNode.tagName==='STYLE')return;const v=t.nodeValue;if(!v.includes('{{'))return;const parts=v.split(/(\{\{\s*[a-z_]+\s*\}\})/g);if(parts.length===1)return;const frag=doc.createDocumentFragment();
  parts.forEach(p=>{const m=p.match(/^\{\{\s*([a-z_]+)\s*\}\}$/);if(m&&BLOCKS.includes(m[1])){used.add(m[1]);const slot=doc.createElement('div');slot.setAttribute('data-ps-slot',m[1]);frag.appendChild(slot)}else frag.appendChild(doc.createTextNode(fill(p)))});t.parentNode.replaceChild(frag,t)});
 box.querySelectorAll('*').forEach(el=>{for(const a of Array.from(el.attributes))if(a.value.includes('{{')){const v=fill(a.value);if(URL_ATTRS.has(a.name)){const u=safeUrl(v,a.name);if(u)el.setAttribute(a.name,u);else el.removeAttribute(a.name)}else el.setAttribute(a.name,v)}});
 let out=box.innerHTML;
 out=out.replace(/<div data-ps-slot="([a-z_]+)"><\/div>/g,(m,k)=>blocks&&blocks[k]!=null?'<div class="pc-slot pc-slot-'+k+'">'+blocks[k]+'</div>':'');
 return {html:out,used}}
global.PoolShedSafeHtml={clean,render,INLINE,BLOCKS,LIMIT};
})(typeof globalThis!=='undefined'?globalThis:window);
