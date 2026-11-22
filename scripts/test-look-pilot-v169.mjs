// v1.69 look pilot: one design kit (module 68, loaded last) built on the existing colour and size tokens; no new
// hard-coded colours; applied only to Sales › Orders, Purchasing › Purchase orders and Stock › Products (list views)
// until approved; status colours from Settings are kept; dark theme followed; "New look: on/off" switch in the menu.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const kit = fs.readFileSync('public/assets/css/system/68-pool-shed-kit.css', 'utf8'), mods = fs.readFileSync('scripts/css-modules.mjs', 'utf8'), app = fs.readFileSync('public/assets/css/app.css', 'utf8');
assert(!/#[0-9a-f]{3,6}\b/i.test(kit.replace(/\/\*[\s\S]*?\*\//g, '')), 'no hard-coded colours in the kit');
assert(/--k-brand: var\(--color-action-primary\)/.test(kit) && /--k-bad: var\(--color-status-danger-text\)/.test(kit), 'kit colours come from the colour tokens');
assert(/body\.ps-kit, \.ps-kit-scope \{/.test(kit) && !/:root \{/.test(kit), 'kit names defined where the dark theme applies');
assert(/\.pill:not\(\[style\]\)/.test(kit), 'status badges keep their Settings colours');
assert(/button\.danger-button/.test(kit) && /button\.ghost/.test(kit), 'delete stays red; link buttons stay links');
assert(mods.trim().endsWith('"system/68-pool-shed-kit.css",\n]);') && app.indexOf('MODULE: system/68-pool-shed-kit.css') > app.indexOf('MODULE: system/67-sales-order-xero-lines.css'), 'kit loads last');
// Scoping and switch.
const store = {}, body = { cls: new Set(), classList: { add: c => body.cls.add(c), remove: c => body.cls.delete(c), toggle: (c, on) => on ? body.cls.add(c) : body.cls.delete(c), contains: c => body.cls.has(c) } };
const screens = {}; const mk = id => (screens[id] = { cls: new Set(), classList: { add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, _s: null }, querySelectorAll: () => [] });
['salesorders', 'purchase', 'products', 'accounting'].forEach(id => { const s = mk('screen-' + id); s.classList._s = s.cls; });
const ctx = { console, Date, Math, Number, String, JSON, Object, Array, Promise, localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } },
  document: { body, readyState: 'complete', addEventListener() {}, head: null, title: '', getElementById: id => screens[id] || null, querySelector: () => null,
    querySelectorAll: sel => sel === '.ps-kit-scope' ? Object.values(screens).filter(s => s.cls.has('ps-kit-scope')) : [] },
  __POOL_SHED_GET_DATA__: () => ({}), __POOL_SHED_CURRENT_USER__: () => ({ role: 'Admin' }) };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync('public/back-office-frame.js', 'utf8'), ctx);
vm.runInContext('var active = "salesorders", activeSubPage = { salesorders: "Sales Orders" }, salesOrderView = "list", purchaseOrderView = "list"; function defaultSubPage(){ return ""; }', ctx);
ctx.PoolShedFrame.tidy();
assert(body.cls.has('ps-kit') && screens['screen-salesorders'].cls.has('ps-kit-scope'), 'Orders list gets the kit');
vm.runInContext('salesOrderView = "detail"', ctx); ctx.PoolShedFrame.tidy(); assert(!body.cls.has('ps-kit') && !screens['screen-salesorders'].cls.has('ps-kit-scope'), 'an order page is not part of the pilot');
vm.runInContext('active = "accounting"; activeSubPage.accounting = "Overview"', ctx); ctx.PoolShedFrame.tidy(); assert(!body.cls.has('ps-kit'), 'other pages unchanged');
vm.runInContext('active = "products"; activeSubPage.products = "Product Command"', ctx); ctx.PoolShedFrame.tidy(); assert(screens['screen-products'].cls.has('ps-kit-scope'), 'Products gets the kit');
store['poolshed:new-look'] = 'off'; ctx.PoolShedFrame.tidy(); assert(!body.cls.has('ps-kit') && !screens['screen-products'].cls.has('ps-kit-scope'), 'switch off restores the old look');
const nav = ctx.PoolShedFrame.navHtml([{ id: 'dashboard', label: 'd' }], 'dashboard', {}, () => [], () => '');
assert(/data-new-look="on">New look: off/.test(nav), 'menu switch shows the current state');
console.log('Look pilot v1.69: kit on tokens, three pages only, status colours kept, dark theme followed, on/off switch.');
