(function(global){
'use strict';
const nc=global.PoolShedNotificationsCommand;
if(!nc)return;
let openState=false;
let filter='all';
let historyMode=false;
let search='';
let lastFocused=null;

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function root(){return document.getElementById('notificationsCommandRoot');}
function bell(){return document.getElementById('notificationButton');}
function setExpanded(on){const b=bell();if(b)b.setAttribute('aria-expanded',String(!!on));}
function saveFocus(){lastFocused=document.activeElement&&typeof document.activeElement.focus==='function'?document.activeElement:null;}
function restoreFocus(){if(lastFocused&&typeof lastFocused.focus==='function')lastFocused.focus();else if(bell())bell().focus();lastFocused=null;}
function severityLabel(v){return ({critical:'Critical',warning:'Attention',success:'Complete',info:'Information',neutral:'Update'})[v]||'Update';}
function severityGlyph(v){return ({critical:'!',warning:'!',success:'✓',info:'i',neutral:'•'})[v]||'•';}
function actionLabel(item){return item.route&&item.route.label?item.route.label:'Open record';}
function dateGroup(iso){
  const d=new Date(iso),now=new Date();
  if(Number.isNaN(d.getTime()))return 'Earlier';
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  const day=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
  if(day===today)return 'Today';
  if(day===today-86400000)return 'Yesterday';
  return 'Earlier';
}
function relative(iso){
  const d=new Date(iso),now=Date.now();if(Number.isNaN(d.getTime()))return '';
  const seconds=Math.max(0,Math.floor((now-d.getTime())/1000));
  if(seconds<60)return 'Just now';if(seconds<3600)return Math.floor(seconds/60)+'m ago';if(seconds<86400)return Math.floor(seconds/3600)+'h ago';if(seconds<604800)return Math.floor(seconds/86400)+'d ago';
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}
function sourceLabel(item){
  const labels={salesorders:'Sales',crm:'Customers',jobs:'Projects',purchase:'Purchasing',locations:'Inventory',warehouse:'Warehouse',fulfilment:'Fulfilment',accounting:'Finance',automation:'Automation',settings:'System',dashboard:'System'};
  return labels[item.sourceModule]||item.category||'Pool Shed';
}
function visibleItems(){
  let items=nc.list({filter,includeArchived:historyMode});
  if(search.trim()){
    const q=search.trim().toLowerCase();
    items=items.filter(item=>[item.title,item.message,item.sourceId,item.category,sourceLabel(item)].some(v=>String(v||'').toLowerCase().includes(q)));
  }
  return items;
}
function summaryCard(summary){
  return '<section class="nc-summary" aria-label="Notification summary">'+
    '<div><span>Unread</span><strong>'+summary.unread+'</strong><small>requiring your attention</small></div>'+
    '<div><span>Critical</span><strong>'+summary.critical+'</strong><small>highest priority</small></div>'+
    '<div><span>Active</span><strong>'+summary.total+'</strong><small>visible to you</small></div>'+
  '</section>';
}
function filters(){
  const items=nc.filters().filter(f=>['all','unread','critical','orders','customers','projects','purchasing','stock','finance','automation'].includes(f.id));
  return '<div class="nc-filter-row" role="tablist" aria-label="Notification filters">'+items.map(f=>'<button type="button" class="nc-filter '+(filter===f.id?'is-active':'')+'" role="tab" aria-selected="'+String(filter===f.id)+'" data-nc-filter="'+esc(f.id)+'"><span>'+esc(f.label)+'</span><b>'+f.count+'</b></button>').join('')+'</div>';
}
function itemRow(item){
  const archived=item.archived?'<span class="nc-meta-pill">Archived</span>':'';
  const unread=item.unread?'<span class="nc-unread-dot" aria-label="Unread"></span>':'';
  const openAction=item.actionable?'<button type="button" class="nc-open" data-nc-action="open" data-nc-id="'+esc(item.id)+'">'+esc(actionLabel(item))+'</button>':'<button type="button" class="nc-open" disabled>Unavailable</button>';
  return '<article class="nc-item '+(item.unread?'is-unread ':'')+'severity-'+esc(item.severity)+'" data-nc-item="'+esc(item.id)+'">'+
    '<div class="nc-severity" data-severity="'+esc(item.severity)+'" aria-label="'+esc(severityLabel(item.severity))+'">'+esc(severityGlyph(item.severity))+'</div>'+
    '<div class="nc-item-body">'+
      '<div class="nc-item-top"><div class="nc-item-title-row">'+unread+'<h3>'+esc(item.title)+'</h3></div><time datetime="'+esc(item.createdAt)+'">'+esc(relative(item.createdAt))+'</time></div>'+
      '<p>'+esc(item.message)+'</p>'+
      '<div class="nc-item-meta"><span>'+esc(sourceLabel(item))+'</span>'+(item.sourceId?'<span>'+esc(item.sourceId)+'</span>':'')+'<span>'+esc(severityLabel(item.severity))+'</span>'+archived+'</div>'+
      '<div class="nc-item-actions">'+openAction+'<button type="button" class="nc-text-action" data-nc-action="read" data-nc-id="'+esc(item.id)+'">'+(item.unread?'Mark read':'Mark unread')+'</button><button type="button" class="nc-text-action" data-nc-action="archive" data-nc-id="'+esc(item.id)+'">'+(item.archived?'Restore':'Archive')+'</button></div>'+
    '</div>'+
  '</article>';
}
function groups(items){
  if(!items.length)return '<div class="nc-empty"><div class="nc-empty-mark">✓</div><h3>'+esc(historyMode?'No notification history':'You are all caught up')+'</h3><p>'+esc(historyMode?'Archived and older notifications will appear here.':'There are no notifications matching this view. Pool Shed will surface operational exceptions here when they need you.')+'</p></div>';
  const order=['Today','Yesterday','Earlier'];
  return order.map(group=>{
    const rows=items.filter(item=>dateGroup(item.createdAt)===group);
    if(!rows.length)return '';
    return '<section class="nc-group"><div class="nc-group-head"><h3>'+group+'</h3><span>'+rows.length+'</span></div><div class="nc-list">'+rows.map(itemRow).join('')+'</div></section>';
  }).join('');
}
function drawerMarkup(){
  const summary=nc.summary(),items=visibleItems();
  return '<div class="notifications-command-backdrop" data-nc-action="close" aria-hidden="true"></div>'+
    '<aside class="notifications-command-drawer" role="dialog" aria-modal="true" aria-labelledby="notificationsCommandTitle" tabindex="-1">'+
      '<header class="nc-header">'+
        '<div class="nc-heading"><span>NOTIFICATIONS COMMAND</span><h2 id="notificationsCommandTitle">'+esc(historyMode?'Notification history':'Your operational inbox')+'</h2><p>'+esc(historyMode?'Review archived and earlier activity without losing the live operational view.':'The things across Pool Shed that need your attention, in one place.')+'</p></div>'+
        '<button type="button" class="nc-close" data-nc-action="close" aria-label="Close notifications">×</button>'+
      '</header>'+
      '<div class="nc-toolbar"><label class="nc-search"><span class="sr-only">Search notifications</span><input type="search" data-nc-search value="'+esc(search)+'" placeholder="Search notifications, records or modules"></label><div class="nc-toolbar-actions">'+
        (historyMode?'<button type="button" class="nc-secondary" data-nc-action="history">Back to inbox</button>':'<button type="button" class="nc-secondary" data-nc-action="history">Notification history</button>')+
        '<button type="button" class="nc-primary" data-nc-action="read-all" '+(summary.unread===0?'disabled':'')+'>Mark all as read</button></div></div>'+
      '<div class="nc-scroll">'+summaryCard(summary)+filters()+'<div class="nc-results" aria-live="polite">'+groups(items)+'</div></div>'+
      '<footer class="nc-footer"><span><strong>'+summary.unread+'</strong> unread</span><span>Visibility follows your Pool Shed permissions</span></footer>'+
    '</aside>';
}
function render(){
  const r=root();if(!r)return;
  r.hidden=!openState;
  if(!openState){r.innerHTML='';return;}
  r.innerHTML=drawerMarkup();
  const drawer=r.querySelector('.notifications-command-drawer');
  if(drawer)setTimeout(()=>drawer.focus(),0);
}
function refreshBadge(){
  const badge=document.getElementById('notificationBadge'),count=nc.unreadCount();
  if(!badge)return count;
  badge.hidden=count===0;
  badge.textContent=count>99?'99+':String(count);
  badge.setAttribute('aria-label',count===1?'1 unread notification':count+' unread notifications');
  const b=bell();if(b)b.classList.toggle('has-unread',count>0);
  return count;
}
function open(){
  if(openState)return;
  saveFocus();openState=true;setExpanded(true);document.body.classList.add('notifications-command-open');render();refreshBadge();
}
function close(){
  if(!openState)return;
  openState=false;setExpanded(false);document.body.classList.remove('notifications-command-open');render();restoreFocus();
}
function toggle(){openState?close():open();}
function trapFocus(event){
  if(!openState||event.key!=='Tab')return;
  const r=root(),focusable=r?Array.from(r.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(el=>!el.hidden):[];
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
}
function openItem(id){
  const item=nc.get(id);if(!item)return;
  nc.markRead(id,true);refreshBadge();
  const result=global.PoolShedRouter&&typeof global.PoolShedRouter.open==='function'
    ? global.PoolShedRouter.open(item.route||{})
    : (typeof global.__POOL_SHED_OPEN_NOTIFICATION_TARGET__==='function'?global.__POOL_SHED_OPEN_NOTIFICATION_TARGET__(item.route||{}):null);
  if(!result)return render();
  if(result&&result.ok===false){render();return;}
  close();
}
function handle(action,id){
  if(action==='close')return close();
  if(action==='history'){historyMode=!historyMode;filter='all';search='';return render();}
  if(action==='read-all'){nc.markAllRead({includeArchived:historyMode});refreshBadge();return render();}
  if(action==='open')return openItem(id);
  if(action==='read'){const item=nc.get(id);if(item)nc.markRead(id,item.unread);refreshBadge();return render();}
  if(action==='archive'){const item=nc.get(id);if(item)nc.archive(id,!item.archived);refreshBadge();return render();}
}

document.addEventListener('click',function(event){
  if(!openState)return;
  const filterButton=event.target.closest&&event.target.closest('[data-nc-filter]');
  if(filterButton){event.preventDefault();filter=filterButton.dataset.ncFilter||'all';return render();}
  const action=event.target.closest&&event.target.closest('[data-nc-action]');
  if(action){event.preventDefault();return handle(action.dataset.ncAction,action.dataset.ncId||'');}
});
document.addEventListener('input',function(event){if(openState&&event.target.matches&&event.target.matches('[data-nc-search]')){search=event.target.value;const r=root();const results=r&&r.querySelector('.nc-results');if(results)results.innerHTML=groups(visibleItems());}});
document.addEventListener('keydown',function(event){if(!openState)return;if(event.key==='Escape'){event.preventDefault();return close();}trapFocus(event);});

global.PoolShedNotificationsWorkspace={open,close,toggle,refresh:render,refreshBadge,isOpen:()=>openState};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refreshBadge);else refreshBadge();
})(typeof globalThis!=='undefined'?globalThis:window);
