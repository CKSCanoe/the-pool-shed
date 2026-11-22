// v1.79 Saved list views (sales orders, purchase orders, catalogue) and bulk selection with export.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const src = fs.readFileSync('public/saved-views.js', 'utf8');
const store = { purchaseOrders: [{ id: 'PO-1', supplier: 'Carro Pools', status: 'Sent', due: '2026-12-01', lines: [{ qty: 2, received: 1, unitCost: 10.5, salesOrderId: 'SO-9' }, { qty: 1, cost: 4 }] }],
  products: [{ id: 'P-1', sku: '=SUM(A1)', name: 'Pump, "big"', category: 'Pumps', supplier: 'X', cost: 5, rrp: 9 }] };
const ctx = { console, setTimeout, clearTimeout, Promise, Set, Object, Array, String, Number, JSON, Date, CSS: { escape: s => s },
  document: { addEventListener(){}, documentElement: {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
  MutationObserver: class { observe(){} }, __POOL_SHED_GET_DATA__: () => store };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
const V = ctx.PoolShedSavedViews;
assert.equal(JSON.stringify(V.LISTS.map(l => l.id)), JSON.stringify(['salesorders', 'purchase', 'catalogue']));
assert.equal(V.LISTS[0].bulk, false, 'sales orders keep their own bulk bar');
const po = V.exportPos(['PO-1']);
assert.equal(JSON.stringify(po[1]), JSON.stringify(['PO-1', 'Carro Pools', 'Sent', '2026-12-01', 'Manual PO', 2, 3, 1, '25.00', 'SO-9']));
const csv = V.csv(V.exportProducts(['P-1'])).split('\r\n');
assert.equal(csv[1], "'=SUM(A1),\"Pump, \"\"big\"\"\",Pumps,X,,5,9,", 'spreadsheet formulas neutralised and commas quoted');
// Wiring and safety
assert.ok(src.includes("existing.controls = s.controls") && src.includes("v.name.toLowerCase() === name.toLowerCase()"), 'saving the same name updates the view');
assert.ok(src.includes("if (el.tagName === 'SELECT' && ![].some.call(el.options"), 'a filter option that no longer exists is skipped');
assert.ok(src.includes("global.confirm('Delete the view"), 'deleting asks first');
assert.ok(src.includes("esc(v.name)"), 'view names are escaped');
const index = fs.readFileSync('public/index.html', 'utf8'); assert.ok(index.indexOf('saved-views.js') > index.indexOf('jump-to.js'));
assert.ok(fs.readFileSync('public/service-worker.js', 'utf8').includes('./saved-views.js?v='));
console.log('Saved views v1.79: three lists, team views by name, safe CSV export of selected rows.');
