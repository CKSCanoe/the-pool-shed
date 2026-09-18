(function(global){
'use strict';

const CATEGORY_IDS={
  'All':'all','Unread':'unread','Critical':'critical','Orders':'orders','Customers':'customers','Projects':'projects','Purchasing':'purchasing','Stock/Warehouse':'stock','Finance':'finance','Automation/System':'automation'
};

function data(){
  try{return global.__POOL_SHED_GET_DATA__?global.__POOL_SHED_GET_DATA__():(global.data||{});}catch(_){return global.data||{};}
}
function user(){
  try{return global.__POOL_SHED_CURRENT_USER__?global.__POOL_SHED_CURRENT_USER__():{};}catch(_){return {};}
}
function isAdmin(){
  try{if(typeof global.__POOL_SHED_IS_ADMIN__==='function')return !!global.__POOL_SHED_IS_ADMIN__();}catch(_){}
  return String(user().role||'').toLowerCase()==='admin';
}
function can(module){
  if(!module||module==='dashboard')return true;
  try{if(typeof global.__POOL_SHED_CAN_ACCESS__==='function')return !!global.__POOL_SHED_CAN_ACCESS__(module);}catch(_){return false;}
  return true;
}
function save(){
  try{if(typeof global.saveAppData==='function')global.saveAppData();}catch(_){}
}
function state(){
  const d=data();
  d.notificationCommand=d.notificationCommand&&typeof d.notificationCommand==='object'?d.notificationCommand:{};
  if(!d.notificationCommand.readByUser||typeof d.notificationCommand.readByUser!=='object')d.notificationCommand.readByUser={};
  if(!d.notificationCommand.archivedByUser||typeof d.notificationCommand.archivedByUser!=='object')d.notificationCommand.archivedByUser={};
  if(!d.notificationCommand.initializedAtByUser||typeof d.notificationCommand.initializedAtByUser!=='object')d.notificationCommand.initializedAtByUser={};
  return d.notificationCommand;
}
function userKey(){
  const u=user();
  return String(u.id||u.email||u.name||'anonymous');
}
function userMap(bucket){
  const s=state(),key=userKey();
  s[bucket][key]=s[bucket][key]&&typeof s[bucket][key]==='object'?s[bucket][key]:{};
  return s[bucket][key];
}
function text(v){return String(v==null?'':v).trim();}
function lower(v){return text(v).toLowerCase();}
function stablePart(v){return lower(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120);}
function parseDate(value){
  if(!value)return new Date(0);
  const raw=String(value).trim();
  const normalized=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw)?raw.replace(' ','T'):raw;
  const date=new Date(normalized);
  return Number.isNaN(date.getTime())?new Date(0):date;
}
function isoDate(value){const d=parseDate(value);return d.getTime()?d.toISOString():new Date(0).toISOString();}
function titleCase(v){return text(v).replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
function first(){for(let i=0;i<arguments.length;i++){const v=arguments[i];if(v!==undefined&&v!==null&&String(v).trim()!=='')return v;}return '';}

function inferCategory(note,source){
  const explicit=text(note.category);
  if(CATEGORY_IDS[explicit])return explicit;
  const blob=lower([note.type,note.trigger,note.title,note.subject,note.message,note.body,note.status,note.sourceModule,source].join(' '));
  if(note.salesOrderId||/sales order|invoice ready|order /.test(blob))return 'Orders';
  if(note.customerId||/customer|crm|credit limit/.test(blob))return 'Customers';
  if(note.projectId||note.jobId||/project|job margin|margin warning/.test(blob))return 'Projects';
  if(note.purchaseOrderId||note.supplierId||/^po[- ]|supplier|purchase|backorder/.test(blob))return 'Purchasing';
  if(note.locationId||note.goodsNoteId||/stock|warehouse|goods in|goods note|pick|pack|ship|fulfil|allocation/.test(blob))return 'Stock/Warehouse';
  if(note.invoiceId||note.paymentId||/finance|account|xero|payment|invoice|credit|refund|vat/.test(blob))return 'Finance';
  if(source==='admin'||source==='automation'||/automation|system|security|admin|release|sync|integration/.test(blob))return 'Automation/System';
  return 'Automation/System';
}
function inferSeverity(note,category){
  const explicit=lower(note.severity);
  if(['neutral','info','success','warning','critical'].includes(explicit))return explicit;
  const blob=lower([note.type,note.trigger,note.title,note.subject,note.message,note.body,note.status].join(' '));
  if(/critical|failed|failure|security|blocked|breach|error|urgent/.test(blob))return 'critical';
  if(/needs review|late|overdue|short|missing|low stock|warning|attention|hold|variance|risk/.test(blob))return 'warning';
  if(/complete|completed|success|sent|shipped|paid|approved|resolved|received/.test(blob))return 'success';
  if(category==='Automation/System'||/info|created|updated|changed|ready/.test(blob))return 'info';
  return 'neutral';
}
function inferModule(note,category){
  if(note.sourceModule)return text(note.sourceModule);
  if(note.route&&note.route.module)return text(note.route.module);
  if(note.salesOrderId)return 'salesorders';
  if(note.customerId)return 'crm';
  if(note.projectId||note.jobId)return 'jobs';
  if(note.purchaseOrderId||note.supplierId)return 'purchase';
  if(note.goodsNoteId)return 'fulfilment';
  if(note.locationId)return 'locations';
  if(category==='Orders')return 'salesorders';
  if(category==='Customers')return 'crm';
  if(category==='Projects')return 'jobs';
  if(category==='Purchasing')return 'purchase';
  if(category==='Stock/Warehouse')return /warehouse|pick|pack|goods in/.test(lower([note.type,note.trigger,note.message].join(' ')))?'warehouse':'locations';
  if(category==='Finance')return 'accounting';
  if(category==='Automation/System')return /automation/.test(lower([note.type,note.trigger,note.title,note.message].join(' ')))?'automation':'settings';
  return 'dashboard';
}
function inferRoute(note,category,module){
  if(note.route&&typeof note.route==='object')return Object.assign({},note.route);
  if(note.salesOrderId)return {module:'salesorders',recordType:'salesOrder',recordId:text(note.salesOrderId),label:'Open Sales Order'};
  if(note.customerId)return {module:'crm',recordType:'customer',recordId:text(note.customerId),label:'Open Customer'};
  if(note.projectId||note.jobId)return {module:'jobs',recordType:'project',recordId:text(note.projectId||note.jobId),label:'Open Project'};
  if(note.purchaseOrderId)return {module:'purchase',recordType:'purchaseOrder',recordId:text(note.purchaseOrderId),label:'Open Purchase Order'};
  if(note.supplierId)return {module:'purchase',recordType:'supplier',recordId:text(note.supplierId),label:'Open Supplier'};
  if(note.goodsNoteId)return {module:'fulfilment',recordType:'goodsNote',recordId:text(note.goodsNoteId),label:'Open Fulfilment'};
  if(note.locationId)return {module:'locations',recordType:'location',recordId:text(note.locationId),label:'Review Stock'};
  const labels={salesorders:'Open Sales Orders',crm:'Open Customers',jobs:'Open Projects',purchase:'Open Purchasing',locations:'Review Stock',warehouse:'Open Warehouse',fulfilment:'Open Fulfilment',accounting:'Open Finance',automation:'Open Automation',settings:'Open Settings',dashboard:'Open Dashboard'};
  return {module,recordType:'module',recordId:'',label:labels[module]||'Open'};
}
function sourceId(note){return text(first(note.sourceId,note.salesOrderId,note.customerId,note.projectId,note.jobId,note.purchaseOrderId,note.supplierId,note.goodsNoteId,note.locationId,note.invoiceId,note.paymentId,note.id));}
function sourceType(note,category){
  if(note.sourceType)return text(note.sourceType);
  if(note.salesOrderId)return 'salesOrder';if(note.customerId)return 'customer';if(note.projectId||note.jobId)return 'project';if(note.purchaseOrderId)return 'purchaseOrder';if(note.supplierId)return 'supplier';if(note.goodsNoteId)return 'goodsNote';if(note.locationId)return 'location';
  return stablePart(category)||'notification';
}
function eventTitle(note,category){
  return text(first(note.title,note.subject,note.trigger,note.type,category==='Automation/System'?'System update':'Notification'));
}
function eventMessage(note,title){
  const candidate=first(note.message,note.body,note.detail,note.reason,note.description);
  return text(candidate)||title;
}
function eventCreated(note){return first(note.createdAt,note.updatedAt,note.created,note.date,note.timestamp,new Date().toISOString());}
function sourceKey(note,normalized){
  return text(note.dedupeKey||note.notificationDedupeKey||note.sourceKey)||[
    normalized.sourceModule||'system',normalized.sourceType||'event',normalized.sourceId||'none',stablePart(first(note.trigger,note.type,normalized.title)),stablePart(normalized.message)
  ].join(':');
}
function audienceAllowed(note){
  const a=note.audience;
  if(!a)return true;
  const u=user(),role=text(u.role),id=userKey();
  if(typeof a==='string')return lower(a)==='all'||lower(a)===lower(role)||lower(a)===lower(id);
  if(Array.isArray(a))return a.some(x=>lower(x)===lower(role)||lower(x)===lower(id)||lower(x)==='all');
  if(typeof a==='object'){
    const roles=Array.isArray(a.roles)?a.roles:[];
    const users=Array.isArray(a.users)?a.users:(Array.isArray(a.userIds)?a.userIds:[]);
    if(a.adminOnly&&!isAdmin())return false;
    if(roles.length&&!roles.some(x=>lower(x)===lower(role)))return false;
    if(users.length&&!users.some(x=>lower(x)===lower(id)))return false;
  }
  return true;
}
function permissionAllowed(item,source){
  if(source==='admin'&&!isAdmin())return false;
  if(item.audienceAdminOnly&&!isAdmin())return false;
  if(item.sourceModule==='settings'&&item.category==='Automation/System'&&!isAdmin()&&item._adminSource)return false;
  return can(item.sourceModule);
}
function normalize(note,source,index){
  if(!note||typeof note!=='object')return null;
  const category=inferCategory(note,source);
  const module=inferModule(note,category);
  const title=eventTitle(note,category);
  const message=eventMessage(note,title);
  const route=inferRoute(note,category,module);
  const normalized={
    id:text(note.id)||`${source.toUpperCase()}-${index+1}`,
    category,
    title,
    message,
    severity:inferSeverity(note,category),
    sourceModule:module,
    sourceType:sourceType(note,category),
    sourceId:sourceId(note),
    route,
    createdAt:isoDate(eventCreated(note)),
    audience:note.audience||null,
    audienceAdminOnly:!!(note.adminOnly||(note.audience&&note.audience.adminOnly)),
    actionable:!!(route&&route.module),
    _source:source,
    _adminSource:source==='admin',
    _raw:note
  };
  normalized.sourceKey=sourceKey(note,normalized);
  return normalized;
}
function collect(){
  const d=data(),out=[];
  (Array.isArray(d.notifications)?d.notifications:[]).forEach((n,i)=>{const x=normalize(n,'notification',i);if(x)out.push(x);});
  (Array.isArray(d.adminNotifications)?d.adminNotifications:[]).forEach((n,i)=>{const x=normalize(n,'admin',i);if(x)out.push(x);});
  const command=d.automationCommand&&typeof d.automationCommand==='object'?d.automationCommand:{};
  (Array.isArray(command.alerts)?command.alerts:[]).forEach((n,i)=>{const x=normalize(Object.assign({sourceModule:'automation',category:'Automation/System'},n),'automation',i);if(x)out.push(x);});
  (Array.isArray(command.runs)?command.runs:[]).filter(n=>/fail|error|blocked/i.test(String(n&&n.status||n&&n.result||''))).forEach((n,i)=>{const x=normalize(Object.assign({sourceModule:'automation',category:'Automation/System'},n),'automation',1000+i);if(x)out.push(x);});
  (Array.isArray(d.automationLogs)?d.automationLogs:[]).filter(n=>/fail|error|blocked/i.test(String(n&&n.status||n&&n.result||''))).forEach((n,i)=>{const x=normalize(Object.assign({sourceModule:'automation',category:'Automation/System'},n),'automation',2000+i);if(x)out.push(x);});
  const seen=new Set();
  return out.sort((a,b)=>parseDate(b.createdAt)-parseDate(a.createdAt)).filter(item=>{if(seen.has(item.sourceKey))return false;seen.add(item.sourceKey);return true;});
}
function initializedAt(){
  const s=state(),key=userKey();
  if(!s.initializedAtByUser[key]){s.initializedAtByUser[key]=new Date().toISOString();save();}
  return s.initializedAtByUser[key];
}
function withLifecycle(item){
  const read=userMap('readByUser'),archived=userMap('archivedByUser'),readState=read[item.sourceKey],baseline=initializedAt();
  const unresolved=item.severity==='critical'||item.severity==='warning'||/needs review|late|overdue|missing|blocked|failed|error/i.test(String(item._raw&&item._raw.status||''));
  const isNew=parseDate(item.createdAt).getTime()>parseDate(baseline).getTime();
  const unread=readState==='unread'?true:(readState==='read'||readState===true)?false:(unresolved||isNew);
  return Object.assign({},item,{unread,archived:!!archived[item.sourceKey]});
}
function matchesFilter(item,filter){
  const f=lower(filter||'all');
  if(f==='all')return true;if(f==='unread')return item.unread;if(f==='critical')return item.severity==='critical';
  if(f==='orders')return item.category==='Orders';if(f==='customers')return item.category==='Customers';if(f==='projects')return item.category==='Projects';if(f==='purchasing')return item.category==='Purchasing';if(f==='stock')return item.category==='Stock/Warehouse';if(f==='finance')return item.category==='Finance';if(f==='automation')return item.category==='Automation/System';
  return true;
}
function list(options){
  const opts=options||{};
  return collect().map(withLifecycle).filter(item=>audienceAllowed(item._raw)&&permissionAllowed(item,item._source)).filter(item=>opts.includeArchived||!item.archived).filter(item=>matchesFilter(item,opts.filter));
}
function get(id){return list({includeArchived:true}).find(item=>item.id===id||item.sourceKey===id)||null;}
function persistFlag(bucket,item,on){
  if(!item)return {ok:false,reason:'Notification not found.'};
  const map=userMap(bucket);
  if(on)map[item.sourceKey]=new Date().toISOString();else delete map[item.sourceKey];
  save();
  return {ok:true,item:get(item.id)};
}
function markRead(id,on){
  const item=get(id);if(!item)return {ok:false,reason:'Notification not found.'};
  const map=userMap('readByUser');map[item.sourceKey]=on===false?'unread':'read';save();return {ok:true,item:get(item.id)};
}
function archive(id,on){return persistFlag('archivedByUser',get(id),on!==false);}
function markAllRead(options){
  const items=list(options||{}),map=userMap('readByUser');
  items.forEach(item=>{map[item.sourceKey]='read';});
  save();
  return {ok:true,count:items.length};
}
function unreadCount(){return list().filter(item=>item.unread).length;}
function filters(){
  const items=list(),defs=[['all','All'],['unread','Unread'],['critical','Critical'],['orders','Orders'],['customers','Customers'],['projects','Projects'],['purchasing','Purchasing'],['stock','Stock/Warehouse'],['finance','Finance'],['automation','Automation/System']];
  return defs.map(([id,label])=>({id,label,count:id==='all'?items.length:items.filter(n=>matchesFilter(n,id)).length}));
}
function summary(){
  const items=list(),unread=items.filter(n=>n.unread),critical=items.filter(n=>n.severity==='critical');
  return {total:items.length,unread:unread.length,critical:critical.length,warning:items.filter(n=>n.severity==='warning').length,actionable:items.filter(n=>n.actionable).length};
}
function create(input){
  const d=data(),x=input&&typeof input==='object'?input:{};
  if(!text(x.title)&&!text(x.message))return {ok:false,reason:'Notification title or message is required.'};
  if(!Array.isArray(d.notifications))d.notifications=[];
  const dedupe=text(x.dedupeKey||x.sourceKey);
  if(dedupe){
    const existing=d.notifications.find(n=>text(n.notificationDedupeKey||n.dedupeKey||n.sourceKey)===dedupe);
    if(existing)return {ok:true,deduped:true,notification:existing};
  }
  const id=text(x.id)||`NC-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
  const record={
    id,
    category:text(x.category)||'Automation/System',
    title:text(x.title)||text(x.message),
    message:text(x.message)||text(x.title),
    severity:text(x.severity)||'info',
    sourceModule:text(x.sourceModule)||text(x.route&&x.route.module)||'dashboard',
    sourceType:text(x.sourceType)||'event',
    sourceId:text(x.sourceId),
    route:x.route&&typeof x.route==='object'?Object.assign({},x.route):null,
    audience:x.audience||null,
    notificationDedupeKey:dedupe,
    createdAt:new Date().toISOString(),
    status:'In App'
  };
  d.notifications.unshift(record);
  save();
  return {ok:true,deduped:false,notification:record};
}

global.PoolShedNotificationsCommand={list,unreadCount,markRead,markAllRead,archive,create,get,filters,summary};
})(typeof globalThis!=='undefined'?globalThis:window);
