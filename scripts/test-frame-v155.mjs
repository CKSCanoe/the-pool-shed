// v1.55 back-office frame: eight-area menu (nothing unreachable), status chips and "waiting too long", Home queues, wiring.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const store = {};
const old = new Date(Date.now() - 10 * 86400000).toISOString(), fresh = new Date().toISOString();
const data = { statuses: [{ name: 'Needs Review', color: '#C07A20', remindDays: 1 }, { name: 'Invoice Ready', color: '#27825B', remindDays: 0 }, { name: 'On Hold', color: '#B9474F', remindDays: 2, hidden: true }],
  purchaseStatuses: [{ name: 'Sent', color: '#397FA5', remindDays: 3 }],
  salesOrders: [{ id: 'SO-1', status: 'Needs Review', statusUpdatedAt: old }, { id: 'SO-2', status: 'Needs Review', statusUpdatedAt: fresh }, { id: 'SO-3', status: 'Invoice Ready', statusUpdatedAt: old }, { id: 'SO-4', status: 'Custom Thing' }],
  purchaseOrders: [{ id: 'PO-1', status: 'Sent', statusUpdatedAt: old, due: '2020-01-01' }] };
const ctx = { console, Date, Math, Number, String, JSON, Promise, Intl, Object, Array,
  localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } },
  document: { addEventListener() {}, head: null, getElementById() { return null; } },
  __POOL_SHED_GET_DATA__: () => data, __POOL_SHED_CURRENT_USER__: () => ({ name: 'aaron boyer', role: 'Purchasing' }) };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync('public/back-office-frame.js', 'utf8'), ctx);
const F = ctx.PoolShedFrame;

// 1. Menu (v1.66): 11 areas; each page listed once; the open area shows its pages and a More list; unknown sections still reachable.
const tabs = ['dashboard','mywork','audits','crm','salesorders','quotes','jobs','products','locations','purchase','warehouse','fleet','fulfilment','accounting','analytics','automation','settings','newthing'].map(id => ({ id, label: id }));
const subs = id => ({ salesorders: ['Sales Orders', 'Contracts', 'Web Orders', 'Sales Credits', 'Invoices', 'Customer Orders'], crm: ['All Customers', 'Create Customer', 'Suppliers'], quotes: ['Quotes', 'Templates'] })[id] || [];
const html = F.navHtml(tabs, 'salesorders', { salesorders: 'Contracts' }, subs, () => '');
for (const label of ['Home','Sales','Customers','Projects','Purchasing','Stock','Warehouse','Team &amp; vans','Accounts','Reports','Settings','More']) assert(html.includes('>' + label + '</button>') || html.includes('<span>' + label + '</span></button>'), 'area ' + label);   // v1.91: labels sit beside an icon
assert(html.includes('data-nav-page="salesorders|Contracts" aria-current="page"'), 'current page marked');
for (const p of ['salesorders|Sales Orders', 'quotes|Quotes', 'salesorders|Web Orders', 'salesorders|Sales Credits']) assert(html.includes('data-nav-page="' + p + '"'), 'open area page ' + p);
assert(html.includes('data-nav-more="sales"') && !html.includes('data-nav-page="quotes|Templates"'), 'less-used pages folded under More');
assert(!html.includes('salesorders|Invoices') && !html.includes('crm|Suppliers'), 'duplicates are not listed');
assert(!html.includes('data-nav-page="purchase|Suppliers"'), 'closed areas stay folded');
assert(html.includes('data-nav-page="newthing|"'), 'unknown sections still reachable');
assert(html.includes('data-nav-new') && html.includes('data-nav-create="sales-order"') && html.includes('data-nav-create="purchase-order"'), '+ New');
assert(html.includes('data-menu-style="classic"'), 'classic menu switch');
const limited = F.navHtml(tabs.filter(t => ['dashboard','salesorders'].includes(t.id)), 'dashboard', {}, () => [], () => '');
assert(!/>(<span>)?Accounts(<\/span>)?<\/button>/.test(limited) && />(<span>)?Sales(<\/span>)?<\/button>/.test(limited), 'areas follow permissions');
const pagesListed = {}; F.MENU.forEach(m => m.pages.forEach(p => { const k = p[0] + '|' + p[1]; assert(!pagesListed[k], 'listed once: ' + k); pagesListed[k] = 1; }));
assert(F.MENU.every(m => m.pages.length <= 7), 'at most 7 pages per area');
assert.equal(F.enabled(), true); store['poolshed:menu-style'] = 'classic'; assert.equal(F.enabled(), false); delete store['poolshed:menu-style'];

// 2. Status chips and waiting too long.
assert.equal(F.isLate(data.salesOrders[0], 'sales'), true, 'past reminder'); assert.equal(F.isLate(data.salesOrders[1], 'sales'), false, 'within reminder');
assert.equal(F.isLate(data.salesOrders[2], 'sales'), false, 'reminder off'); assert.equal(F.isLate(data.purchaseOrders[0], 'purchase'), true, 'PO reminder');
const bar = F.statusBar('sales', data.salesOrders, 'Needs Review');
assert(/data-status-chip="sales\|Needs Review"[^>]*aria-pressed="true"/.test(bar) && />Needs Review <b>2<\/b>/.test(bar), 'chip with count, selected');
assert(/Custom Thing <b>1<\/b>/.test(bar), 'statuses not in settings still counted');
assert(!/On Hold/.test(bar), 'empty statuses hidden');
assert(/Waiting too long <b>1<\/b>/.test(bar), 'late chip');

// 3. Home: purchasing role sees deliveries overdue and late POs; zero tiles fold into "All clear"; name capitalised.
const home = F.homeHtml();
assert(/(Good morning|Good afternoon|Good evening), Aaron</.test(home), 'greeting (v1.81 Home)'); assert(/deliver(y|ies) overdue/.test(home) && /POs? waiting too long/.test(home), "purchasing tiles");
assert(!/ready to invoice/.test(home), 'no finance tiles for Purchasing'); assert(/data-home-filter="__late"/.test(home), 'late orders tile filters the list');

// 4. Wiring.
const legacy = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8'), index = fs.readFileSync('public/index.html', 'utf8');
assert(/window\.PoolShedFrame\.navHtml\(visibleTabs\(\), active, activeSubPage, sidebarSubGroups, defaultSubPage\)/.test(legacy), 'menu hook');
assert(/status === "__late"/.test(legacy) && /window\.__POOL_SHED_SALES_FILTER__ = function/.test(legacy) && /PoolShedFrame\.statusBar\("sales"/.test(legacy), 'sales chips and filter');
assert(/id="home-queues"/.test(legacy), 'Home queues on the dashboard');
assert(/PoolShedStatusAuthority\.colour\("purchase", name\)/.test(legacy), 'PO colours from settings');
assert(index.indexOf('back-office-frame.js') > 0 && index.indexOf('back-office-frame.js') < index.indexOf('01-legacy-01.js'), 'frame loads before the app');
const pw = fs.readFileSync('public/purchase-workspace.js', 'utf8'), sc = fs.readFileSync('public/settings-command-workspace.js', 'utf8');
assert(/window\.PoolShedPurchaseFilter=function/.test(pw) && /poListFilters\.status==='__late'/.test(pw), 'PO chips and filter');
assert(!/if\(kind==='sales'\)row\.remindDays/.test(sc) && /Reminder after days \(0 = off\)/.test(sc), 'purchase statuses have reminders');
console.log('Frame v1.55: menu grouped with nothing unreachable, status chips and reminders, Home queues by role, wiring correct.');
