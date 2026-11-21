// v1.60 core stock: suggested levels from sales, keep / stop keeping (single and bulk), only kept lines can need
// ordering, non-stock lines excluded, wiring into Product Hub, Purchasing and Home.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const day = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const data = { products: [
  { id: 'P1', sku: 'CHL', name: 'Chlorine', productType: 'Pool / Spa Chemical', supplier: 'S1', cost: 10, packQty: 6 },
  { id: 'P2', sku: 'TAB', name: 'Tablets', productType: 'Water Testing', supplier: 'S2', cost: 5 },
  { id: 'P3', sku: 'FIT', name: 'Fitting', productType: 'Custom charge', supplier: 'S1' },
  { id: 'P4', sku: 'OLD', name: 'Old line', productType: 'Stocked Product', supplier: 'S1', reorder: 3 } ],
  salesOrders: [{ created: day(10), lines: [{ productId: 'P1', qty: 45 }] }, { created: day(200), lines: [{ productId: 'P2', qty: 73 }] }, { created: day(500), lines: [{ productId: 'P1', qty: 999 }] }] };
let saves = 0;
const ctx = { console, Date, Math, Number, String, JSON, Object, Array, Intl, document: { addEventListener() {}, head: null },
  __POOL_SHED_GET_DATA__: () => data, __POOL_SHED_SAVE_APP_DATA__: () => { saves++; },
  PoolShedProductHub: { isBundle: () => false, supplierOffer: () => ({}), stockSummary: () => ({ onHand: 0 }),
    replenishmentRow: p => ({ product: p, needsOrder: (p.replenishmentEnabled === true || (p.replenishmentEnabled == null && Number(p.reorderPoint ?? p.reorder) > 0)), suggestedCost: 10 }) } };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync('public/core-stock.js', 'utf8'), ctx);
const C = ctx.PoolShedCoreStock;
// Suggestions: 45 sold in 90 days -> 0.5/day -> reorder 7 (14 days), up to 21 (42 days) rounded to the pack of 6 -> 24.
assert.deepEqual(JSON.parse(JSON.stringify(C.suggest(data.products[0]))), { reorder: 7, upTo: 24 });
// 73 sold in the year only -> 0.2/day -> reorder 3, up to 9.
assert.deepEqual(JSON.parse(JSON.stringify(C.suggest(data.products[1]))), { reorder: 3, upTo: 9 });
assert.equal(C._sales().P1.d365, 45, 'sales older than a year ignored');
// Existing reorder field counts as kept (records entered before this page).
assert.equal(C.kept(data.products[3]), true); assert.equal(C.kept(data.products[0]), false);
let html = C.page();
assert(!/FIT/.test(html), 'custom charges are not stock'); assert(/1 <\/b>|<b>1<\/b><span>lines kept in stock/.test(html), 'kept count');
assert(/<b>1<\/b><span>at or below reorder point/.test(html), 'only kept lines can need ordering');
assert(/placeholder="7"/.test(html) && /placeholder="24"/.test(html), 'suggestions shown as placeholders');
assert.equal(C.needsOrder().length, 1);
// Keep in bulk.
['P1', 'P2'].forEach(id => { const p = data.products.find(x => x.id === id); p.replenishmentEnabled = true; p.reorderPoint = C.suggest(p).reorder; p.targetStock = C.suggest(p).upTo; });
assert.equal(C.needsOrder().length, 3, 'kept lines now checked');
html = C.page(); assert(/<b>3<\/b><span>lines kept in stock/.test(html));
// Wiring.
const ph = fs.readFileSync('public/product-hub-workspace.js', 'utf8'), frame = fs.readFileSync('public/back-office-frame.js', 'utf8'), index = fs.readFileSync('public/index.html', 'utf8');
assert(/'Core Stock','Replenishment'/.test(ph) && /section==='Core Stock'\)content=\(global\.PoolShedCoreStock/.test(ph), 'Core Stock section');
assert(/subgroup==='Reorder List'\)\{tabId='products';subgroup='Replenishment';\}/.test(ph) && /'Reorder List'/.test(ph), 'Purchasing → Reorder List');
assert(/PoolShedCoreStock\.needsOrder\(\)/.test(frame) && /core stock lines to reorder/.test(frame), 'Home tile, kept lines only');
assert(index.indexOf('core-stock.js') > index.indexOf('product-hub-workspace.js'), 'loaded');
console.log('Core stock v1.60: suggestions from sales, kept lines only on the reorder list, wiring correct.');
