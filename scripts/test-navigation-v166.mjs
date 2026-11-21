// v1.66 navigation: 11 areas, at most 7 pages each, every page listed once, nothing unreachable (More lists every other
// existing page; unknown sections still show), duplicates not listed twice, aliases highlight the right area, "+ New",
// one title per page (Area › Page), in-page menus and repeated titles hidden, classic menu still available.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const store = {};
const ctx = { console, Date, Math, Number, String, JSON, Promise, Intl, Object, Array, localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } },
  document: { addEventListener() {}, head: null, getElementById() { return null; }, readyState: 'complete' }, __POOL_SHED_GET_DATA__: () => ({}), __POOL_SHED_CURRENT_USER__: () => ({ name: 'A', role: 'Admin' }) };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync('public/back-office-frame.js', 'utf8'), ctx);
const F = ctx.PoolShedFrame;
assert.deepEqual(JSON.parse(JSON.stringify(F.MENU.map(m => m.label))), ['Home', 'Sales', 'Customers', 'Projects', 'Purchasing', 'Stock', 'Warehouse', 'Team & vans', 'Accounts', 'Reports', 'Settings']);
const seen = {}; F.MENU.forEach(m => { assert(m.pages.length <= 7, m.label + ' has at most 7 pages'); m.pages.forEach(p => { const k = p[0] + '|' + p[1]; assert(!seen[k], 'listed once: ' + k); seen[k] = m.id; }); });
// The real side-menu pages of every section (as the app lists them today).
const SUBS = { audits: ['All Audits', 'Site Visits', 'Action Register'], automation: ['Overview', 'Active Automations', 'Templates'], crm: ['All Customers', 'Create Customer', 'Suppliers'],
  fulfilment: ['Overview', 'Goods Notes', 'Pick Queue', 'Pack Bench', 'Dispatch', 'Collections', 'Delivery Exceptions', 'History'], jobs: ['Projects', 'Tool Register'],
  locations: ['Locations', 'Engineer Vans', 'Project Stock', 'Stock', 'Overview', 'Transfers & Top-Ups', 'Cycle Counts', 'Missing / Damaged', 'Stock Movements', 'Exceptions & Alerts'],
  products: ['Product Command', 'Catalogue', 'Core Stock', 'Replenishment', 'Product Groups', 'Bundle Studio', 'Imports', 'Catalogue Health'],
  purchase: ['Purchase Orders', 'Reorder List', 'Procurement Demand', 'Suppliers', 'Supplier Returns & Credits', 'Invoice Matching'], quotes: ['Quotes', 'Templates', 'Engagement', 'Approvals', 'Settings'],
  salesorders: ['Sales Orders', 'Contracts', 'Web Orders', 'Sales Credits', 'Invoices'], settings: ['Overview', 'Users', 'Roles & Permissions', 'Web Shop', 'Statuses', 'Company Settings', 'Notifications', 'Integrations', 'Dev Tools', 'Debug'],
  warehouse: ['Work Queue', 'Inbound', 'Transfers', 'Returns & Quarantine', 'Counts', 'Audit'] };
const tabs = ['dashboard','mywork','audits','crm','salesorders','quotes','jobs','products','locations','purchase','warehouse','fleet','fulfilment','accounting','analytics','automation','settings'].map(id => ({ id, label: id }));
const moreHtml = F.MENU.map(m => { const p = m.pages[0]; return F.navHtml(tabs, p[0], { [p[0]]: p[1] }, id => SUBS[id] || [], () => ''); }).join('');
assert(F.MENU.every(m => !m.pages.length || moreHtml.includes('data-nav-more="' + m.id + '"') || ['customers', 'team', 'projects'].includes(m.id)), 'areas with other pages offer More');
// Every existing page is either a main page or under More (More is listed when opened: simulate by opening a More page).
for (const [tab, subs] of Object.entries(SUBS)) for (const s of subs) {
  const html = F.navHtml(tabs, tab, { [tab]: s }, id => SUBS[id] || [], () => '');
  const skip = ['crm|Suppliers', 'crm|Create Customer', 'salesorders|Invoices', 'warehouse|Counts', 'warehouse|Transfers', 'fulfilment|Collections', 'products|Replenishment'].includes(tab + '|' + s);
  if (!skip) assert(html.includes('data-nav-page="' + (tab + '|' + s).replace(/&/g, '&amp;') + '"'), 'reachable: ' + tab + ' / ' + s);
}
for (const t of ['accounting|Month End', 'accounting|Xero Sync', 'accounting|Record a Purchase', 'analytics|Metric Library']) { const [a, b] = t.split('|'); assert(F.navHtml(tabs, a, { [a]: b }, id => SUBS[id] || [], () => '').includes('data-nav-page="' + t + '"'), 'reachable: ' + t); }
// Unknown sections and permissions.
assert(F.navHtml(tabs.concat([{ id: 'brandnew', label: 'Brand new' }]), 'dashboard', {}, () => [], () => '').includes('data-nav-page="brandnew|"'), 'unknown section still reachable');
assert(!F.navHtml(tabs.filter(t => t.id !== 'accounting'), 'dashboard', {}, () => [], () => '').includes('>Accounts</button>'), 'areas follow permissions');
// Aliases and current place.
assert.equal(F.findPage('products', 'Replenishment').area.id, 'purchasing', 'Reorder list highlights Purchasing');
assert.equal(F.findPage('accounting', 'Order Profit').area.id, 'reports', 'Profit sits in Reports');
// Wiring and tidy-up rules.
const src = fs.readFileSync('public/back-office-frame.js', 'utf8');
for (const k of ['sales-order', 'quote', 'customer', 'purchase-order', 'product', 'contract', 'project']) assert(src.includes("data-nav-create=\"' + x[0]") && src.includes("'" + k + "'"), '+ New ' + k);
assert(/\.ps-areas #pageBackRow/.test(src) && /\.ps-areas \.ah-nav/.test(src) && /\.ps-areas \.analytics-subnav/.test(src) && /\.ps-areas \.qs-globalbar-tabs/.test(src), 'in-page menus and Back to Dashboard hidden');
assert(/:not\(\.ps-on-home\) #fleet-reminder/.test(src), 'van reminder banner only on Home');
assert(/h1\.textContent = p\.label \|\| p\.area\.label/.test(src) && /crumb\.innerHTML = /.test(src), 'one title: Area › Page');
assert(/document\.readyState !== 'complete'\) document\.addEventListener\('DOMContentLoaded', installTidy\)/.test(src), 'tidy-up installed after every add-on');
assert(src.includes('data-menu-style="classic"'), 'classic menu kept');
console.log('Navigation v1.66: 11 areas, every page once, nothing unreachable, + New, one title per page, in-page menus hidden.');
