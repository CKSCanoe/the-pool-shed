(function(global){
'use strict';
const registry=new Map();let applyingHash=false;
function data(){try{return global.__POOL_SHED_GET_DATA__?global.__POOL_SHED_GET_DATA__():(global.data||{});}catch(_){return global.data||{};}}
function allowed(module,user){try{if(global.PoolShedSettingsPermissions&&typeof global.PoolShedSettingsPermissions.can==='function')return !!global.PoolShedSettingsPermissions.can(module,'view',user);if(typeof global.__POOL_SHED_CAN_ACCESS__==='function')return !!global.__POOL_SHED_CAN_ACCESS__(module);}catch(_){}return module==='dashboard';}
function enc(v){return encodeURIComponent(String(v==null?'':v));}function dec(v){try{return decodeURIComponent(v);}catch(_){return v;}}
const defs={
 'customer':{prefix:'customers',module:'crm',collection:'customers'},
 'sales-order':{prefix:'sales-orders',module:'salesorders',collection:'salesOrders'},
 'project':{prefix:'projects',module:'jobs',collection:'jobs'},
 'purchase-order':{prefix:'purchase-orders',module:'purchase',collection:'purchaseOrders'},
 'supplier':{prefix:'suppliers',module:'purchase',collection:'suppliers'},
 'product':{prefix:'products',module:'products',collection:'products'},
 'inventory-location':{prefix:'inventory/location',module:'locations',collection:'locations'},
 'goods-note':{prefix:'fulfilment/goods-note',module:'fulfilment',collection:'goodsNotes'},
 'action':{prefix:'my-work/actions',module:'mywork',exists:(d,id)=>!!(d.actionAuthority&&Array.isArray(d.actionAuthority.actions)&&d.actionAuthority.actions.some(x=>String(x.id)===String(id)))},
 'approval':{prefix:'my-work/approvals',module:'mywork',exists:(d,id)=>!!(d.actionAuthority&&Array.isArray(d.actionAuthority.approvals)&&d.actionAuthority.approvals.some(x=>String(x.id)===String(id)))}
};
const staticRoutes={dashboard:{path:'#/dashboard',module:'dashboard'},mywork:{path:'#/my-work',module:'mywork'},finance:{path:'#/finance',module:'accounting'},analytics:{path:'#/analytics',module:'analytics'},automation:{path:'#/automation',module:'automation'},settings:{path:'#/settings',module:'settings'},warehouse:{path:'#/warehouse',module:'warehouse'},inventory:{path:'#/inventory',module:'locations'},fulfilment:{path:'#/fulfilment',module:'fulfilment'},purchase:{path:'#/purchase-orders',module:'purchase'},customers:{path:'#/customers',module:'crm'},projects:{path:'#/projects',module:'jobs'},products:{path:'#/products',module:'products'},salesorders:{path:'#/sales-orders',module:'salesorders'}};
function canonicalPath(path){let h=String(path||'').trim();const hash=h.indexOf('#');if(hash>=0)h=h.slice(hash);if(!h.startsWith('#'))h='#/'+h.replace(/^\/+/, '');if(h==='#'||h==='#/')h='#/dashboard';return h;}
function to(recordType,recordId,options){const type=String(recordType||''),def=defs[type]||registry.get(type),opts=options||{};if(!def){const st=staticRoutes[type]||staticRoutes.dashboard;return Object.assign({recordType:'',recordId:'',page:''},st); }const id=String(recordId||'');return {path:'#/'+def.prefix+(id?'/'+enc(id):''),module:def.module,recordType:type,recordId:id,page:String(opts.page||''),label:String(opts.label||'')};}
function href(recordType,recordId,options){return to(recordType,recordId,options).path;}
function parse(input){const h=canonicalPath(input&&typeof input==='object'&&'hash'in input?input.hash:(input||global.location&&global.location.hash||''));const raw=h.replace(/^#\//,'').split('/').map(dec);if(!raw[0])return to('dashboard');
 if(raw[0]==='my-work'&&raw[1]==='actions')return raw[2]?to('action',raw[2]):Object.assign({},staticRoutes.mywork);
 if(raw[0]==='my-work'&&raw[1]==='approvals')return raw[2]?to('approval',raw[2]):Object.assign({},staticRoutes.mywork);
 if(raw[0]==='my-work')return Object.assign({},staticRoutes.mywork);
 if(raw[0]==='customers')return raw[1]?to('customer',raw[1]):Object.assign({},staticRoutes.customers);
 if(raw[0]==='sales-orders')return raw[1]?to('sales-order',raw[1]):Object.assign({},staticRoutes.salesorders);
 if(raw[0]==='projects')return raw[1]?to('project',raw[1]):Object.assign({},staticRoutes.projects);
 if(raw[0]==='purchase-orders')return raw[1]?to('purchase-order',raw[1]):Object.assign({},staticRoutes.purchase);
 if(raw[0]==='suppliers')return raw[1]?to('supplier',raw[1]):Object.assign({},staticRoutes.purchase);
 if(raw[0]==='products')return raw[1]?to('product',raw[1]):Object.assign({},staticRoutes.products);
 if(raw[0]==='inventory'&&raw[1]==='location')return raw[2]?to('inventory-location',raw[2]):Object.assign({},staticRoutes.inventory);
 if(raw[0]==='inventory')return Object.assign({},staticRoutes.inventory);
 if(raw[0]==='warehouse'){return {path:h,module:'warehouse',recordType:raw[1]==='goods-in'?'purchase-order':'',recordId:raw[2]||'',page:raw[1]==='goods-in'?'Goods In':''};}
 if(raw[0]==='fulfilment'&&raw[1]==='goods-note')return raw[2]?to('goods-note',raw[2]):Object.assign({},staticRoutes.fulfilment);
 if(raw[0]==='fulfilment')return Object.assign({},staticRoutes.fulfilment);
 if(raw[0]==='finance')return Object.assign({},staticRoutes.finance);
 if(raw[0]==='analytics')return Object.assign({},staticRoutes.analytics);
 if(raw[0]==='automation')return Object.assign({},staticRoutes.automation);
 if(raw[0]==='settings'){const slug=raw.slice(1).join('/');const pages={'roles-permissions':'Roles & Permissions','audit-security':'Audit & Security','production-readiness':'Production Readiness','notifications':'Notifications','users':'Users'};return {path:h,module:'settings',recordType:'',recordId:'',page:pages[slug]||slug.replace(/-/g,' ')||''};}
 if(raw[0]==='dashboard')return Object.assign({},staticRoutes.dashboard);
 for(const [type,def] of registry){const seg=String(def.prefix||'').split('/');if(seg.length===1&&raw[0]===seg[0])return to(type,raw[1]||'');}
 return Object.assign({},staticRoutes.dashboard);
}
function exists(route){if(!route||!route.recordId)return true;const def=defs[route.recordType]||registry.get(route.recordType);if(def&&typeof def.exists==='function')return !!def.exists(data(),route.recordId);if(!def||!def.collection)return true;const rows=data()[def.collection]||[];if(route.recordType==='supplier')return rows.some(x=>String(x.id||x.name)===String(route.recordId)||String(x.name)===String(route.recordId));return rows.some(x=>String(x.id)===String(route.recordId));}
function canOpen(route,user){const r=typeof route==='string'?parse(route):(route||parse(''));if(!allowed(r.module||'dashboard',user))return {ok:false,reason:'permission',route:r};if(!exists(r))return {ok:false,reason:'unavailable',route:r};const def=registry.get(r.recordType);if(def&&typeof def.canOpen==='function'&&!def.canOpen(r,user))return {ok:false,reason:'permission',route:r};return {ok:true,route:r};}
function legacyRoute(r){if(r.recordType==='supplier')return {module:'purchase',recordType:'supplier',recordId:r.recordId,page:r.page};if(r.recordType==='inventory-location')return {module:'locations',recordType:'location',recordId:r.recordId,page:r.page};if(r.recordType==='goods-note')return {module:'fulfilment',recordType:'goodsNote',recordId:r.recordId,page:r.page};return {module:r.module,recordType:r.recordType,recordId:r.recordId,page:r.page};}
function setHash(path,replaceMode){if(!global.location)return;const next=canonicalPath(path);if(global.location.hash===next)return;applyingHash=true;try{if(replaceMode&&typeof global.location.replace==='function')global.location.replace(next);else global.location.hash=next;}catch(_){try{global.location.hash=next;}catch(__){}}setTimeout(()=>{applyingHash=false;},0);}
function open(route,options){const opts=options||{},r=typeof route==='string'?parse(route):(route||parse(''));const gate=canOpen(r,opts.user);if(!gate.ok)return gate;const def=registry.get(r.recordType);let result=null;if(def&&typeof def.activate==='function')result=def.activate(global,r.recordId,opts);else if(typeof global.__POOL_SHED_OPEN_NOTIFICATION_TARGET__==='function')result=global.__POOL_SHED_OPEN_NOTIFICATION_TARGET__(legacyRoute(r));else result={ok:false,reason:'unavailable'};if(result&&result.ok===false)return Object.assign({route:r},result);if(opts.updateHash!==false)setHash(r.path||href(r.recordType,r.recordId),!!opts.replace);return {ok:true,route:r,module:r.module,recordId:r.recordId};}
function current(){return parse(global.location&&global.location.hash||'');}
function replace(route){return open(typeof route==='string'?parse(route):route,{replace:true});}
function register(recordType,adapter){registry.set(String(recordType),Object.assign({},adapter||{}));return true;}
function applyCurrent(){if(applyingHash)return;const r=current();if(r.path&&r.path!=='#/dashboard'||(global.location&&global.location.hash)){open(r,{updateHash:false,fromHistory:true});}}
try{if(typeof global.addEventListener==='function')global.addEventListener('hashchange',applyCurrent);}catch(_){}
global.PoolShedRouter={parse,to,open,current,replace,href,canOpen,register,applyCurrent};
})(typeof globalThis!=='undefined'?globalThis:window);
