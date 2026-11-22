/* Pool Shed v1.80.0 — back-office frame (blueprint step 1).
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

  // ---------- 1. Menu (v1.66): 11 areas, each page in one place, everything else under the area's "More" ----------
  // Each page is [section, sub-page, label]. Pages open through the existing screens, so nothing moves or is lost.
  var MENU = [
    { id: 'home', label: 'Home', pages: [['dashboard', '', 'Today'], ['mywork', '', 'My work'], ['audits', 'All Audits', 'Pool audits']] },
    { id: 'sales', label: 'Sales', pages: [['salesorders', 'Sales Orders', 'Orders'], ['quotes', 'Quotes', 'Quotes'], ['salesorders', 'Contracts', 'Contracts'], ['salesorders', 'Web Orders', 'Web orders'], ['salesorders', 'Sales Credits', 'Returns & credits']] },
    { id: 'customers', label: 'Customers', pages: [['crm', 'All Customers', 'Customers']] },
    { id: 'projects', label: 'Projects', pages: [['jobs', 'Projects', 'Projects'], ['jobs', 'Tool Register', 'Tool register']] },
    { id: 'purchasing', label: 'Purchasing', pages: [['purchase', 'Purchase Orders', 'Purchase orders'], ['purchase', 'Reorder List', 'Reorder list'], ['purchase', 'Suppliers', 'Suppliers'], ['purchase', 'Supplier Returns & Credits', 'Supplier returns']] },
    { id: 'stock', label: 'Stock', pages: [['products', 'Product Command', 'Products'], ['locations', 'Stock', 'Stock levels'], ['products', 'Core Stock', 'Core stock'], ['locations', 'Cycle Counts', 'Counts'], ['locations', 'Transfers & Top-Ups', 'Transfers'], ['locations', 'Stock Movements', 'Movements']] },
    { id: 'warehouse', label: 'Warehouse', pages: [['warehouse', 'Work Queue', 'Today’s work'], ['warehouse', 'Inbound', 'Goods in'], ['fulfilment', 'Pick Queue', 'Pick & pack'], ['fulfilment', 'Dispatch', 'Dispatch & collections'], ['warehouse', 'Returns & Quarantine', 'Returns & quarantine'], ['fulfilment', 'Delivery Exceptions', 'Problems']] },
    { id: 'team', label: 'Team & vans', pages: [['fleet', '', 'Vans'], ['locations', 'Engineer Vans', 'Van stock']] },
    { id: 'accounts', label: 'Accounts', pages: [['accounting', 'Overview', 'Accounts home'], ['accounting', 'Invoice Ready', 'Ready to invoice'], ['accounting', 'Customer Invoices', 'Invoices'], ['accounting', 'Payments & Allocations', 'Payments'], ['accounting', 'Credit Control', 'Credit control'], ['accounting', 'Supplier Bills', 'Bills'], ['accounting', 'Payment Runs', 'Payment runs']] },
    { id: 'reports', label: 'Reports', pages: [['analytics', 'Monthly Pack', 'Monthly pack'], ['accounting', 'Order Profit', 'Profit'], ['analytics', 'Overview', 'Overview'], ['analytics', 'Sales', 'Sales'], ['analytics', 'Inventory', 'Stock'], ['analytics', 'Projects', 'Projects'], ['analytics', 'Reports & Data Export', 'Export']] },
    { id: 'settings', label: 'Settings', pages: [['settings', 'Company Settings', 'Company'], ['settings', 'Users', 'Users'], ['settings', 'Roles & Permissions', 'Roles'], ['settings', 'Statuses', 'Statuses'], ['settings', 'Notifications', 'Emails & alerts'], ['settings', 'Web Shop', 'Web shop'], ['settings', 'Integrations', 'Integrations']] }
  ];
  // Which area each section belongs to (for "More" and for pages opened from elsewhere).
  var OWNER = { dashboard: 'home', mywork: 'home', audits: 'home', salesorders: 'sales', quotes: 'sales', crm: 'customers', jobs: 'projects', purchase: 'purchasing',
    products: 'stock', locations: 'stock', warehouse: 'warehouse', fulfilment: 'warehouse', fleet: 'team', accounting: 'accounts', analytics: 'reports', settings: 'settings', automation: 'settings' };
  // Sub-pages these screens have but do not list in the old side menu.
  var EXTRA = { accounting: ['Month End', 'Customer Accounts', 'Credits & Returns', 'Record a Purchase', 'Payables', 'Supplier Accounts', 'Three-Way Match', 'Xero Sync', 'Reconciliation', 'Reports'],
    analytics: ['Business Performance', 'Operations', 'Purchasing & Suppliers', 'Finance', 'Customers', 'Products', 'Metric Library'] };
  // Duplicates and actions that are not pages: kept working, not listed twice.
  var SKIP = { 'products|Replenishment': 1, 'crm|Suppliers': 1, 'crm|Create Customer': 1, 'salesorders|Invoices': 1, 'salesorders|Customer Orders': 1, 'warehouse|Counts': 1, 'warehouse|Transfers': 1, 'fulfilment|Collections': 1 };
  var moreOpen = {};
  function pageKey(tab, sub){ return tab + '|' + (sub || ''); }
  // Pages that open another screen under a different name (Purchasing → Reorder list shows the stock replenishment screen).
  var ALIAS = { 'products|Replenishment': ['purchase', 'Reorder List'] };
  function findPage(active, sub){
    var al = ALIAS[active + '|' + sub]; if (al) { active = al[0]; sub = al[1]; }
    for (var i = 0; i < MENU.length; i++) for (var j = 0; j < MENU[i].pages.length; j++) { var p = MENU[i].pages[j]; if (p[0] === active && (!p[1] || p[1] === sub)) return { area: MENU[i], page: p }; }
    return null;
  }
  function currentPlace(){
    var a = typeof active !== 'undefined' ? active : '', s = '';
    try { s = (activeSubPage && activeSubPage[a]) || (typeof defaultSubPage === 'function' ? defaultSubPage(a) : ''); } catch (_) {}
    var hit = findPage(a, s), area = hit ? hit.area : MENU.filter(function(m){ return m.id === OWNER[a]; })[0];
    return { tab: a, sub: s, area: area || null, label: hit ? hit.page[2] : (s || '') };
  }
  function navHtml(tabs, active, activeSub, subGroups, defaultSub){
    var allowed = {}; tabs.forEach(function(t){ allowed[t.id] = t; });
    var cur = activeSub[active] || defaultSub(active), here = findPage(active, cur), hereArea = here ? here.area.id : OWNER[active];
    var listed = {}; MENU.forEach(function(m){ m.pages.forEach(function(p){ listed[pageKey(p[0], p[1])] = 1; }); });
    var btn = function(tab, sub, label, on){ return '<button type="button" class="' + (on ? 'active' : '') + '" data-nav-page="' + esc(pageKey(tab, sub)) + '"' + (on ? ' aria-current="page"' : '') + '>' + esc(label) + '</button>'; };
    var html = MENU.map(function(m){
      var pages = m.pages.filter(function(p){ return allowed[p[0]]; }); if (!pages.length) return '';
      var open = hereArea === m.id, ownTabs = Object.keys(OWNER).filter(function(t){ return OWNER[t] === m.id && allowed[t]; });
      var more = []; ownTabs.forEach(function(t){
        var subs = (subGroups(t) || []).concat(EXTRA[t] || []);
        if (!subs.length && !m.pages.some(function(p){ return p[0] === t; })) more.push([t, '', LABELS[t] || allowed[t].label]);
        subs.forEach(function(s){ if (!listed[pageKey(t, s)] && !SKIP[pageKey(t, s)] && !more.some(function(x){ return x[0] === t && x[1] === s; })) more.push([t, s, s]); }); });
      var inMore = !here && open && more.some(function(x){ return x[0] === active && (x[1] === cur || !x[1]); });
      var first = pages[0];
      return '<div class="nav-area' + (open ? ' open' : '') + '"><button type="button" class="nav-area-head' + (open ? ' current' : '') + '" data-nav-page="' + esc(pageKey(first[0], first[1])) + '" aria-expanded="' + open + '">' + esc(m.label) + '</button>' +
        (open ? '<div class="nav-area-items">' + pages.map(function(p){ return btn(p[0], p[1], p[2], here && here.page === p); }).join('') +
          (more.length ? '<button type="button" class="nav-more-toggle" data-nav-more="' + esc(m.id) + '" aria-expanded="' + !!(moreOpen[m.id] || inMore) + '">More ' + (moreOpen[m.id] || inMore ? '▾' : '▸') + '</button>' +
            (moreOpen[m.id] || inMore ? '<div class="nav-more">' + more.map(function(x){ return btn(x[0], x[1], x[2], active === x[0] && (x[1] === cur || !x[1]) && !here); }).join('') + '</div>' : '') : '') + '</div>' : '') + '</div>';
    }).join('');
    // Any section added later that no area knows about still shows, so nothing becomes unreachable.
    var unknown = tabs.filter(function(t){ return !OWNER[t.id]; });
    if (unknown.length) html += '<div class="nav-area' + (unknown.some(function(t){ return t.id === active; }) ? ' open' : '') + '"><button type="button" class="nav-area-head" data-nav-page="' + esc(pageKey(unknown[0].id, '')) + '">More</button>' +
      (unknown.some(function(t){ return t.id === active; }) ? '<div class="nav-area-items">' + unknown.map(function(t){ return btn(t.id, '', t.label, t.id === active); }).join('') + '</div>' : '') + '</div>';
    return '<div class="nav-new"><button type="button" class="nav-jump-btn" data-jump-open title="Jump to anything (Ctrl+K)">Jump to… <kbd>' + (/Mac|iPhone|iPad/.test((global.navigator || {}).platform || '') ? '⌘K' : 'Ctrl K') + '</kbd></button><button type="button" class="nav-new-btn" data-nav-new aria-expanded="false">+ New</button><div class="nav-new-menu" hidden>' +
      [['sales-order', 'Sales order'], ['quote', 'Quote'], ['customer', 'Customer'], ['purchase-order', 'Purchase order'], ['product', 'Product'], ['contract', 'Contract'], ['project', 'Project']].map(function(x){ return '<button type="button" data-nav-create="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
      html + '<div class="nav-style-switch"><button type="button" class="link" data-menu-style="classic">Classic menu</button><button type="button" class="link" data-new-look="' + (newLook() ? 'off' : 'on') + '">New look: ' + (newLook() ? 'on' : 'off') + '</button></div>';
  }
  function openPage(tab, sub){
    if (sub && typeof global.openSidebarSubGroup === 'function') { global.openSidebarSubGroup(tab, sub); return; }
    if (sub && typeof global.__POOL_SHED_OPEN_SUBPAGE__ === 'function') { global.__POOL_SHED_OPEN_SUBPAGE__(tab, sub); return; }
    if (typeof global.__POOL_SHED_OPEN_TAB__ === 'function') global.__POOL_SHED_OPEN_TAB__(tab);
  }
  function create(kind){
    var click = function(sel){ setTimeout(function(){ var b = document.querySelector(sel); if (b) b.click(); }, 250); };
    if (kind === 'sales-order' && typeof global.createNewSalesOrder === 'function') return global.createNewSalesOrder();
    if (kind === 'customer') return openPage('crm', 'Create Customer');
    if (kind === 'project') return openPage('jobs', 'Create Job');
    if (kind === 'purchase-order' && typeof global.createDraftPurchaseOrder === 'function') { try { active = 'purchase'; activeSubPage.purchase = 'Purchase Orders'; } catch (_) {} return global.createDraftPurchaseOrder(); }
    if (kind === 'quote') { openPage('quotes', 'Quotes'); return click('[data-qs-action="new-quote"]'); }
    if (kind === 'product') { openPage('products', 'Product Command'); return click('[data-ph-new-product]'); }
    if (kind === 'contract') { openPage('salesorders', 'Contracts'); return click('[data-ct-new]'); }
  }
  // After each screen draw: one title ("Area › Page") in the top bar, no repeated page titles, no second menus.
  var KIT_PAGES = { 'salesorders|Sales Orders': 1, 'purchase|Purchase Orders': 1, 'products|Product Command': 1 };
  // v1.70: whole areas move to the kit as they are checked (Sales first: every order screen, contracts, web orders, returns).
  // v1.76: every area is on the kit (the engineer and barcode screens keep their own full-screen layouts).
  var KIT_TABS = { salesorders: 1, quotes: 1, dashboard: 1, mywork: 1, audits: 1, crm: 1, jobs: 1, purchase: 1, products: 1, locations: 1, warehouse: 1, fulfilment: 1, fleet: 1, accounting: 1, analytics: 1, settings: 1, automation: 1 };
  var INTRO = {
    'salesorders|Sales Orders': 'Every customer order: what is waiting, ready to pick, to invoice and to be paid.',
    'salesorders|Contracts': 'Maintenance contracts and repeat orders. Nothing is created until you click.',
    'salesorders|Web Orders': 'Orders from the website, waiting to become sales orders.',
    'salesorders|Sales Credits': 'Customer returns and credit notes: receive the goods, restock or quarantine, credit the customer.',
    'quotes|Quotes': 'Quotes being written, sent and accepted.',
    'purchase|Purchase Orders': 'Orders to suppliers: sent, confirmed, received, billed and paid.',
    'products|Product Command': 'Your catalogue at a glance, with what needs attention first.'
  };
  var LOOK = 'poolshed:new-look';
  function newLook(){ try { return !global.localStorage || global.localStorage.getItem(LOOK) !== 'off'; } catch (_) { return true; } }
  function tidy(){
    if (!enabled() || typeof document === 'undefined' || !document.body) { if (document && document.body) document.body.classList.remove('ps-areas'); return; }
    document.body.classList.add('ps-areas');
    var p = currentPlace(); document.body.classList.toggle('ps-on-home', p.tab === 'dashboard'); var h1 = document.getElementById('pageTitle'), crumb = document.querySelector('.topbar .breadcrumb');
    if (p.area && h1) { h1.textContent = p.label || p.area.label; document.title = (p.label || p.area.label) + ' · The Pool Shed'; }
    // One short line under the title that describes this page (the old line described the whole section).
    var intro = document.getElementById('pageIntro'), line = INTRO[p.tab + '|' + p.sub];
    if (intro) { if (line) { intro.textContent = line; intro.style.display = ''; } else if (KIT_TABS[p.tab]) intro.style.display = 'none'; else intro.style.display = ''; }
    if (p.area && crumb) crumb.innerHTML = '<span>' + esc(p.area.label) + '</span>' + (p.label && p.label !== p.area.label ? ' <span aria-hidden="true">›</span> <span>' + esc(p.label) + '</span>' : '');
    var screen = document.getElementById('screen-' + p.tab), title = String(h1 ? h1.textContent : '').trim().toLowerCase();
    // v1.69 look pilot: the design kit on three pages first (switch off from the menu to compare).
    var kitOn = newLook() && (KIT_TABS[p.tab] || (KIT_PAGES[p.tab + '|' + p.sub] && !(p.tab === 'purchase' && typeof purchaseOrderView !== 'undefined' && purchaseOrderView !== 'list')));
    if (kitOn && p.tab === 'quotes' && screen && screen.querySelector('.qs-studio-root')) kitOn = false;   // the quote editor keeps its full-screen studio
    if (kitOn && p.tab === 'quotes' && screen && typeof setTimeout === 'function') setTimeout(function(){ if (screen.querySelector('.qs-studio-root')) { screen.classList.remove('ps-kit-scope'); document.body.classList.remove('ps-kit'); } }, 0);
    document.body.classList.toggle('ps-kit', !!kitOn);
    [].slice.call(document.querySelectorAll('.ps-kit-scope')).forEach(function(el){ if (el !== screen || !kitOn) el.classList.remove('ps-kit-scope'); });
    if (screen && kitOn) screen.classList.add('ps-kit-scope');
    if (screen) [].slice.call(screen.querySelectorAll('h1,h2')).slice(0, 3).forEach(function(h){
      var r = h.getBoundingClientRect(), t = String(h.textContent || '').trim().toLowerCase();
      if (r.top < 420 && t && (t === title || t === (p.sub || '').toLowerCase() || /^(finance command|analytics command|settings control|automation command|warehouse operations desk|precision stock control|fulfilment)$/.test(t))) h.classList.add('ps-dup-title');
    });
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
    if (role !== 'Engineer' && role !== 'Warehouse' && global.PoolShedContracts && global.PoolShedContracts.due) {
      var cdue = global.PoolShedContracts.due();
      out.push({ n: cdue.length, label: 'contracts due', sub: cdue.length ? money(cdue.reduce(function(t, c){ return t + global.PoolShedContracts.periodNet(c); }, 0)) + ' to create' : 'maintenance and repeat orders', hot: cdue.length > 0, go: ['salesorders', 'Contracts'] });
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
      var pg = t.closest('[data-nav-page]'); if (pg) { e.preventDefault(); e.stopPropagation(); var k = pg.dataset.navPage.split('|'); openPage(k[0], k.slice(1).join('|')); return; }
      var mo = t.closest('[data-nav-more]'); if (mo) { e.preventDefault(); e.stopPropagation(); moreOpen[mo.dataset.navMore] = mo.getAttribute('aria-expanded') !== 'true'; if (typeof global.render === 'function') global.render(); return; }
      var nb = t.closest('[data-nav-new]'); if (nb) { e.preventDefault(); e.stopPropagation(); var menu = nb.parentNode.querySelector('.nav-new-menu'), show = menu.hidden; menu.hidden = !show; nb.setAttribute('aria-expanded', String(show)); return; }
      var nc = t.closest('[data-nav-create]'); if (nc) { e.preventDefault(); e.stopPropagation(); var m2 = nc.closest('.nav-new-menu'); if (m2) m2.hidden = true; create(nc.dataset.navCreate); return; }
      if (!t.closest('.nav-new')) [].slice.call(document.querySelectorAll('.nav-new-menu')).forEach(function(x){ x.hidden = true; });
      var look = t.closest('[data-new-look]'); if (look) { e.preventDefault(); try { global.localStorage.setItem(LOOK, look.dataset.newLook); } catch (_) {} if (typeof global.render === 'function') global.render(); return; }
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
  // Wrap the screen draw once the app and every add-on have loaded, so the tidy-up runs last.
  function installTidy(){
    if (typeof global.render !== 'function' || global.render.__psTidy) return;
    var baseRender = global.render;
    var tidyRender = function(){ try { if (global.PoolShedProductHub && global.PoolShedProductHub._resetCache) global.PoolShedProductHub._resetCache(); } catch (_) {} var out = baseRender.apply(this, arguments); try { tidy(); } catch (_) {} return out; };
    tidyRender.__psTidy = true;
    try { render = tidyRender; } catch (_) {} global.render = tidyRender;
    try { tidy(); } catch (_) {}
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', installTidy); else if (typeof setTimeout === 'function') setTimeout(installTidy, 0);
    if (global.addEventListener) global.addEventListener('load', installTidy);
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
      '[data-theme="dark"] .home-queue b,.dark .home-queue b{color:#7fd3df}' +
      '.nav-more-toggle{opacity:.75;font-size:.9em!important}.nav-more{margin:2px 0 4px 8px;padding-left:8px;border-left:1px dashed rgba(255,255,255,.2)}.nav-more button{font-size:.9em!important;opacity:.9}' +
      '.nav-new{position:relative;margin:4px 0 10px}.nav-new-btn{width:100%;font-weight:700!important;border:1px solid rgba(255,255,255,.35)!important;border-radius:10px!important;justify-content:center!important;text-align:center!important}' +
      '.nav-new-menu{display:flex;flex-direction:column;gap:2px;margin-top:4px;padding:6px;border-radius:10px;background:rgba(255,255,255,.08)}.nav-new-menu[hidden]{display:none}.nav-new-menu button{font-size:.92em!important}' +
      '.ps-areas #pageBackRow,.ps-areas .ps-dup-title,.ps-areas .ah-nav,.ps-areas .analytics-subnav,.ps-areas .qs-globalbar-tabs,.ps-areas .analytics-eyebrow,.ps-areas .settings-eyebrow{display:none!important}' +
      '.ps-areas :has(> .ah-nav:only-child){display:none!important}.ps-areas .finance-command-head > div:first-child{display:none!important}.ps-areas .finance-command-head{justify-content:flex-end!important;padding-top:8px!important;padding-bottom:8px!important}' +
      '.ps-areas:not(.ps-on-home) #fleet-reminder{display:none!important}.ps-areas .so-list-command-copy > span,.ps-areas .so-list-command-copy > strong{display:none!important}.ps-areas section.so-list-page[aria-label="Sales order queue"] > .so-list-kpis{display:none!important}';
    document.head.appendChild(st);
  }
  global.PoolShedFrame = { enabled: enabled, navHtml: navHtml, MENU: MENU, OWNER: OWNER, findPage: findPage, currentPlace: currentPlace, tidy: tidy, create: create, openPage: openPage, classicSwitch: classicSwitch, statusBar: statusBar, isLate: isLate, paintHome: paintHome, homeHtml: homeHtml, tiles: tiles, AREAS: AREAS, _cache: cache };
})(typeof window !== 'undefined' ? window : globalThis);
