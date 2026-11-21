/* Pool Shed v1.60.0 — back-office frame (blueprint step 1).
   1. The menu grouped into eight areas (plus Reports and Settings). Every existing page stays where it was, under its area;
      a "Classic menu" switch brings back the old flat menu for anyone who prefers it.
   2. Home queues: what needs doing today, by role, each opening the list to act on.
   3. Status count bars for sales and purchase orders (your own statuses, colours and order from Settings → Statuses),
      and "waiting too long" using each status's reminder time. */
(function(global){
  'use strict';
  var AREAS = [
    { id: 'home', label: 'Home & My Work', tabs: ['dashboard', 'mywork', 'audits'] },
    { id: 'customers', label: 'Customers', tabs: ['crm'] },
    { id: 'sales', label: 'Sales', tabs: ['salesorders', 'quotes'] },
    { id: 'projects', label: 'Projects', tabs: ['jobs'] },
    { id: 'purchasing', label: 'Purchasing', tabs: ['purchase'] },
    { id: 'stock', label: 'Stock', tabs: ['products', 'locations', 'warehouse', 'fulfilment'] },
    { id: 'team', label: 'Team & Vans', tabs: ['fleet'] },
    { id: 'accounts', label: 'Accounts', tabs: ['accounting'] },
    { id: 'reports', label: 'Reports', tabs: ['analytics'] },
    { id: 'settings', label: 'Settings', tabs: ['settings', 'automation'] }
  ];
  var LABELS = { dashboard: 'Home', mywork: 'My Work', audits: 'Pool Audits', quotes: 'Quotes', salesorders: 'Sales Orders', products: 'Products',
                 locations: 'Inventory', warehouse: 'Warehouse', fulfilment: 'Fulfilment', settings: 'Settings', automation: 'Automation' };
  var PREF = 'poolshed:menu-style';
  var FINANCE = ['Admin', 'Management', 'Manager', 'Accounts'];

  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function pref(){ try { return global.localStorage && global.localStorage.getItem(PREF) || 'areas'; } catch (_) { return 'areas'; } }
  function enabled(){ return pref() !== 'classic'; }
  function DATA(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? (global.__POOL_SHED_GET_DATA__() || {}) : {}; }
  function me(){ return typeof global.__POOL_SHED_CURRENT_USER__ === 'function' ? (global.__POOL_SHED_CURRENT_USER__() || {}) : {}; }
  function isFinance(){ return FINANCE.indexOf(String(me().role || '')) >= 0; }
  function money(v){ return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Number(v || 0)); }
  function areaOf(tabId){ for (var i = 0; i < AREAS.length; i++) if (AREAS[i].tabs.indexOf(tabId) >= 0) return AREAS[i]; return null; }

  // ---------- 1. Menu ----------
  // tabs: the person's allowed tabs in their saved order; subGroups(tabId) gives the existing sub-pages.
  function navHtml(tabs, active, activeSub, subGroups, defaultSub){
    var allowed = {}; tabs.forEach(function(t){ allowed[t.id] = t; });
    var placed = {};
    var areas = AREAS.map(function(a){
      var own = tabs.filter(function(t){ return a.tabs.indexOf(t.id) >= 0; }).sort(function(x, y){ return a.tabs.indexOf(x.id) - a.tabs.indexOf(y.id); });
      own.forEach(function(t){ placed[t.id] = true; });
      return { a: a, own: own };
    });
    // Any section not listed in an area (added later) still shows, so nothing becomes unreachable.
    var extra = tabs.filter(function(t){ return !placed[t.id]; });
    if (extra.length) areas.push({ a: { id: 'more', label: 'More' }, own: extra });
    var activeArea = areaOf(active);
    var subs = function(tabId){ var list = subGroups(tabId) || [], cur = activeSub[tabId] || defaultSub(tabId);
      return list.length ? '<div class="nav-subgroups">' + list.map(function(item){ return '<button type="button" class="' + (cur === item ? 'active' : '') + '" data-sidebar-subgroup="' + esc(tabId + '|' + item) + '">' + esc(item) + '</button>'; }).join('') + '</div>' : ''; };
    var html = areas.filter(function(x){ return x.own.length; }).map(function(x){
      var open = (activeArea && activeArea.id === x.a.id) || (x.a.id === 'more' && extra.some(function(t){ return t.id === active; }));
      if (x.own.length === 1) {   // single-section area: the area button is the section itself
        var t = x.own[0];
        return '<div class="nav-area' + (open ? ' open' : '') + '"><button type="button" class="nav-area-head' + (active === t.id ? ' active' : '') + '" data-tab="' + esc(t.id) + '">' + esc(x.a.label) + '</button>' + (active === t.id ? subs(t.id) : '') + '</div>';
      }
      return '<div class="nav-area' + (open ? ' open' : '') + '"><button type="button" class="nav-area-head' + (open ? ' current' : '') + '" data-nav-area="' + esc(x.a.id) + '" aria-expanded="' + open + '">' + esc(x.a.label) + '</button>' +
        (open ? '<div class="nav-area-items">' + x.own.map(function(t){ return '<div><button type="button" class="' + (active === t.id ? 'active' : '') + '" data-tab="' + esc(t.id) + '">' + esc(LABELS[t.id] || t.label) + '</button>' + (active === t.id ? subs(t.id) : '') + '</div>'; }).join('') + '</div>' : '') + '</div>';
    }).join('');
    return html + '<div class="nav-style-switch"><button type="button" class="link" data-menu-style="classic">Classic menu</button></div>';
  }
  function classicSwitch(){ return '<div class="nav-style-switch"><button type="button" class="link" data-menu-style="areas">New grouped menu</button></div>'; }

  // ---------- 3. Statuses ----------
  function authority(){ return global.PoolShedStatusAuthority || null; }
  function statusList(kind){ var a = authority(); if (a) return a.list(kind) || [];
    var d = DATA(); return ((kind === 'purchase' ? d.purchaseStatuses : d.statuses) || []).map(function(x){ return { key: x.name, name: x.label || x.name, color: x.color || '#5C6971', hidden: !!x.hidden, remindDays: Number(x.remindDays || 0) }; }); }
  function daysSince(iso){ if (!iso) return null; var t = Date.parse(String(iso).replace(' ', 'T')); if (isNaN(t)) return null; return Math.floor((Date.now() - t) / 86400000); }
  function statusSince(o, kind){ return kind === 'purchase' ? (o.statusUpdatedAt || o.updatedAt || o.orderedDate || o.created || o.date) : (o.statusUpdatedAt || o.updatedAt || o.created); }
  // Has this order sat in its status longer than the status's reminder time?
  function isLate(o, kind){
    var st = statusList(kind || 'sales').find(function(x){ return x.key === o.status; }); if (!st || !(st.remindDays > 0)) return false;
    var days = daysSince(statusSince(o, kind || 'sales')); return days !== null && days > st.remindDays;
  }
  function textOn(hex){ var h = String(hex || '').replace('#', ''); if (!/^[0-9a-f]{6}$/i.test(h)) return '#fff';
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0F1B24' : '#FFFFFF'; }
  // A row of coloured chips, one per status in your order, with how many orders are in each; click to filter.
  function statusBar(kind, orders, selected){
    var counts = {}; (orders || []).forEach(function(o){ var k = String(o.status || ''); counts[k] = (counts[k] || 0) + 1; });
    var late = (orders || []).filter(function(o){ return isLate(o, kind); }).length;
    var list = statusList(kind).filter(function(x){ return counts[x.key] || x.key === selected; });
    Object.keys(counts).forEach(function(k){ if (k && !list.some(function(x){ return x.key === k; })) list.push({ key: k, name: k, color: '#5C6971' }); });
    var chip = function(key, label, colour, n, on){ return '<button type="button" class="status-chip' + (on ? ' on' : '') + (n ? '' : ' empty') + '" data-status-chip="' + esc(kind + '|' + key) + '" style="--chip:' + esc(colour) + ';--chip-ink:' + textOn(colour) + '" aria-pressed="' + !!on + '"><span class="dot"></span>' + esc(label) + ' <b>' + n + '</b></button>'; };
    return '<div class="status-chips" role="toolbar" aria-label="' + (kind === 'purchase' ? 'Purchase' : 'Sales') + ' order statuses">' +
      chip('', 'All', '#0f4c57', (orders || []).length, !selected) +
      list.map(function(x){ return chip(x.key, x.name, x.color, counts[x.key] || 0, selected === x.key); }).join('') +
      (late ? chip('__late', 'Waiting too long', '#b9474f', late, selected === '__late') : '') + '</div>';
  }

  // ---------- 2. Home queues ----------
  var cache = { ledger: null, at: 0, loading: false };
  function rpc(name, args){ var db = typeof global.__POOL_SHED_DB__ === 'function' ? global.__POOL_SHED_DB__() : null; if (!db) return Promise.reject(new Error('offline'));
    return db.rpc(name, args).then(function(r){ if (r.error) throw r.error; return r.data; }); }
  function W(){ return typeof global.__POOL_SHED_WORKSPACE_ID__ === 'function' ? global.__POOL_SHED_WORKSPACE_ID__() : 'pool-bros-main'; }
  function loadLedger(){
    if (!isFinance() || cache.loading || (cache.ledger && Date.now() - cache.at < 120000)) return;
    cache.loading = true;
    var w = W(), soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    Promise.all([rpc('ps_invoicing_queue', { w: w }).catch(function(){ return null; }), rpc('ps_sales_documents_list', { w: w, max_rows: 500 }).catch(function(){ return null; }),
                 rpc('ps_payment_candidates', { w: w, up_to: soon }).catch(function(){ return null; })])
      .then(function(r){ cache.ledger = { queue: r[0], docs: r[1], bills: r[2] }; cache.at = Date.now(); cache.loading = false; paintHome(); })
      .catch(function(){ cache.loading = false; });
  }
  function tiles(){
    var d = DATA(), out = [], role = String(me().role || ''), finance = isFinance();
    var so = (d.salesOrders || []).filter(function(o){ return !o.isCompleted && ['Invoiced', 'Cancelled', 'Completed'].indexOf(o.status) < 0; });
    var po = (d.purchaseOrders || []).filter(function(o){ return ['Received', 'Cancelled'].indexOf(o.status) < 0; });
    var lateSo = so.filter(function(o){ return isLate(o, 'sales'); }), latePo = po.filter(function(o){ return isLate(o, 'purchase'); });
    var review = so.filter(function(o){ return o.status === 'Needs Review'; });
    var toPick = so.filter(function(o){ return ['Ready To Pick', 'Ready To Ship', 'Picking'].indexOf(o.status) >= 0; });
    var today = new Date().toISOString().slice(0, 10);
    var overdueDeliveries = po.filter(function(o){ return o.due && String(o.due).slice(0, 10) < today && ['Sent', 'Supplier Confirmed', 'Part Received'].indexOf(o.status) >= 0; });
    var L = cache.ledger;
    if (finance && L && L.queue) { var ready = (L.queue.orders || []).filter(function(o){ return o.state === 'ready'; });
      out.push({ n: ready.length, label: 'ready to invoice', sub: money(ready.reduce(function(t, o){ return t + Number(o.remaining_gross || 0); }, 0)), hot: ready.length > 0, go: ['accounting', 'Invoice Ready'] }); }
    if (finance && L && L.docs) { var od = L.docs.filter(function(x){ return x.doc_type === 'sales_invoice' && x.state === 'overdue'; });
      out.push({ n: od.length, label: 'invoices overdue', sub: money(od.reduce(function(t, x){ return t + Number(x.open || 0); }, 0)), hot: od.length > 0, go: ['accounting', 'Credit Control'] }); }
    if (finance && L && L.bills) { var due = L.bills.filter(function(b){ return b.ready; });
      out.push({ n: due.length, label: 'bills to pay this week', sub: money(due.reduce(function(t, b){ return t + Number(b.outstanding || 0); }, 0)), go: ['accounting', 'Payment Runs'] }); }
    out.push({ n: lateSo.length, label: 'sales orders waiting too long', sub: 'past their status reminder', hot: lateSo.length > 0, go: ['salesorders', 'Sales Orders'], filter: '__late' });
    if (role !== 'Engineer') out.push({ n: review.length, label: 'orders need review', sub: 'status Needs Review', go: ['salesorders', 'Sales Orders'], filter: 'Needs Review' });
    if (['Warehouse', 'Admin', 'Management', 'Manager'].indexOf(role) >= 0) out.push({ n: toPick.length, label: 'orders to pick and ship', sub: 'ready to pick or ship', go: ['fulfilment', 'Picking List'] });
    if (['Purchasing', 'Admin', 'Management', 'Manager', 'Accounts'].indexOf(role) >= 0) {
      out.push({ n: overdueDeliveries.length, label: 'deliveries overdue', sub: 'POs past their due date', hot: overdueDeliveries.length > 0, go: ['purchase', 'Purchase Orders'] });
      out.push({ n: latePo.length, label: 'POs waiting too long', sub: 'past their status reminder', go: ['purchase', 'Purchase Orders'] });
    }
    if (['Purchasing', 'Warehouse', 'Admin', 'Management', 'Manager'].indexOf(role) >= 0 && global.PoolShedCoreStock && global.PoolShedCoreStock.needsOrder) {
      var low = global.PoolShedCoreStock.needsOrder();
      out.push({ n: low.length, label: 'core stock lines to reorder', sub: low.length ? money(low.reduce(function(t, r){ return t + Number(r.suggestedCost || 0); }, 0)) + ' suggested' : 'at or below reorder point', hot: low.length > 0, go: ['products', 'Replenishment'] });
    }
    var fleet = global.PoolShedFleetUI && global.PoolShedFleetUI._reminders ? global.PoolShedFleetUI._reminders() : null;
    if (fleet && fleet.count) out.push({ n: fleet.count, label: 'van report reminders', sub: fleet.items[0] ? fleet.items[0].text.replace(/\.$/, '') : '', go: ['fleet', ''] });
    if (finance && !L) loadLedger();
    return out;
  }
  function homeHtml(){
    var all = tiles(), t = all.filter(function(x){ return x.n > 0; }), clear = all.filter(function(x){ return !x.n; });
    var first = me().name ? String(me().name).split(' ')[0] : ''; first = first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
    return '<div class="home-queues-head"><strong>' + (first ? esc(first) + ', here' : 'Here') + '’s what needs doing</strong><button type="button" class="link" data-home-refresh>Refresh</button></div>' +
      (t.length ? '' : '<p class="home-clear-all">Nothing is waiting. Well done.</p>') +
      '<div class="home-queue-grid">' + t.map(function(x){ return '<button type="button" class="home-queue' + (x.hot ? ' hot' : '') + (x.n ? '' : ' clear') + '" data-home-go="' + esc(x.go.join('|')) + '"' + (x.filter ? ' data-home-filter="' + esc(x.filter) + '"' : '') + '><b>' + x.n + '</b><span>' + esc(x.label) + '</span><small>' + esc(x.sub || '') + '</small></button>'; }).join('') + '</div>' +
      (clear.length && t.length ? '<p class="home-clear">All clear: ' + esc(clear.map(function(x){ return x.label; }).join(', ')) + '.</p>' : '');
  }
  function paintHome(){ if (typeof document === 'undefined') return; var box = document.getElementById('home-queues'); if (box) box.innerHTML = homeHtml(); }

  // ---------- Events ----------
  function openArea(id){
    var a = AREAS.filter(function(x){ return x.id === id; })[0]; if (!a) return;
    var can = typeof global.__POOL_SHED_CAN_ACCESS__ === 'function' ? global.__POOL_SHED_CAN_ACCESS__ : function(){ return true; };
    var first = a.tabs.filter(function(t){ return can(t); })[0];
    if (first && typeof global.__POOL_SHED_OPEN_TAB__ === 'function') global.__POOL_SHED_OPEN_TAB__(first);
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function(e){
      var t = e.target; if (!t || !t.closest) return;
      var area = t.closest('[data-nav-area]'); if (area) { e.preventDefault(); e.stopPropagation(); openArea(area.dataset.navArea); return; }
      var style = t.closest('[data-menu-style]'); if (style) { e.preventDefault(); try { global.localStorage.setItem(PREF, style.dataset.menuStyle); } catch (_) {} if (typeof global.render === 'function') global.render(); return; }
      var chip = t.closest('[data-status-chip]'); if (chip) { e.preventDefault(); var p = chip.dataset.statusChip.split('|'), kind = p[0], key = p.slice(1).join('|');
        if (kind === 'sales' && typeof global.__POOL_SHED_SALES_FILTER__ === 'function') global.__POOL_SHED_SALES_FILTER__(key);
        if (kind === 'purchase' && global.PoolShedPurchaseFilter) global.PoolShedPurchaseFilter(key);
        return; }
      if (t.closest('[data-home-refresh]')) { cache.at = 0; cache.ledger = null; loadLedger(); paintHome(); return; }
      var go = t.closest('[data-home-go]'); if (go) { var g = go.dataset.homeGo.split('|');
        if (go.dataset.homeFilter && g[0] === 'salesorders' && typeof global.__POOL_SHED_SALES_FILTER__ === 'function') { global.__POOL_SHED_OPEN_SUBPAGE__ && global.__POOL_SHED_OPEN_SUBPAGE__('salesorders', 'Sales Orders'); global.__POOL_SHED_SALES_FILTER__(go.dataset.homeFilter); return; }
        if (g[1] && typeof global.__POOL_SHED_OPEN_SUBPAGE__ === 'function') global.__POOL_SHED_OPEN_SUBPAGE__(g[0], g[1]);
        else if (typeof global.__POOL_SHED_OPEN_TAB__ === 'function') global.__POOL_SHED_OPEN_TAB__(g[0]);
      }
    }, true);
  }
  if (typeof document !== 'undefined' && document.head && !document.getElementById('frame-styles')) {
    var st = document.createElement('style'); st.id = 'frame-styles';
    st.textContent =
      '.nav-area{margin:2px 0}.nav-area-head{font-weight:700!important}.nav-area-head.current{opacity:1}' +
      '.nav-area-items{margin:2px 0 6px 10px;padding-left:8px;border-left:2px solid rgba(255,255,255,.14)}.nav-area-items button{font-size:.94em}' +
      '.nav-style-switch{margin:14px 0 4px;padding-top:10px;border-top:1px solid rgba(255,255,255,.12)}.nav-style-switch .link{font-size:12.5px;opacity:.75;background:none;border:0;color:inherit;text-decoration:underline;cursor:pointer;padding:4px 8px;min-height:0}' +
      '.status-chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.status-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(0,0,0,.12);background:transparent;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:600;cursor:pointer;min-height:32px;color:inherit}' +
      '.status-chip .dot{width:10px;height:10px;border-radius:50%;background:var(--chip)}.status-chip b{font-variant-numeric:tabular-nums}.status-chip.empty{opacity:.55}.status-chips .status-chip.on{background:var(--chip)!important;color:var(--chip-ink)!important;border-color:var(--chip)!important}.status-chips .status-chip.on .dot{background:var(--chip-ink)}.status-chips .status-chip:not(.on){background:transparent!important}' +
      '.home-queues{margin:0 0 16px;padding:14px clamp(14px,2vw,24px) 4px}.home-clear,.home-clear-all{margin:8px 0 0;font-size:13.5px;opacity:.75}'+
      '.home-queues.home-queues-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.home-queues-head strong{font-size:1.05em}.home-queues-head .link{background:none;border:0;text-decoration:underline;cursor:pointer;color:inherit;min-height:0}' +
      '.home-queue-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.home-queue{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;border:1px solid rgba(15,76,87,.18);border-radius:12px;padding:12px 14px;background:rgba(15,76,87,.04);cursor:pointer;color:inherit;min-height:0}' +
      '.home-queue b{font-size:26px;line-height:1.1;color:#0f4c57}.home-queue.hot b{color:#d8432c}.home-queue span{font-weight:700}.home-queue small{opacity:.75}.home-queue.clear{opacity:.6}.home-queue:hover,.home-queue:focus-visible{border-color:#0f4c57;outline:none}' +
      '[data-theme="dark"] .home-queue b,.dark .home-queue b{color:#7fd3df}';
    document.head.appendChild(st);
  }
  global.PoolShedFrame = { enabled: enabled, navHtml: navHtml, classicSwitch: classicSwitch, statusBar: statusBar, isLate: isLate, paintHome: paintHome, homeHtml: homeHtml, tiles: tiles, AREAS: AREAS, _cache: cache };
})(typeof window !== 'undefined' ? window : globalThis);
