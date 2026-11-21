// v1.58 van stock: engineer view and count form, office view (value, shortfalls, counts waiting), applying a count
// (stock adjusted and logged), minimums from the supplies list, top-up transfers; plus the 031 guard.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const data = { locations: [], stock: [{ productId: 'P1', locationId: 'L-VAN-PB21VAN', qty: 5, allocated: 0 }], restockRules: [], stockTakes: [], movements: [] };
let role = 'Engineer'; const rpcCalls = []; let rpcResult = {};
const fleet = { _state: { view: 'list', vans: [{ id: 'V1', registration: 'PB21 VAN', assigned_name: 'Dave', location_id: 'L-VAN-PB21VAN' }, { id: 'V2', registration: 'PB22 VAN', assigned_name: 'Mitch', location_id: null }] }, render: () => '<div>fleet</div>' };
const inv = { locationSummary: () => ({ onHand: 5, stockValue: 1840 }), vanReadiness: () => ({ belowMin: 2, totalCore: 6 }),
  locationRows: () => [{ productId: 'P1', name: 'Chlorine 5kg', sku: 'CHL-5', available: 1, min: 4, suggestedTopUp: 3, belowMin: true, warehouseAvailable: 10 }],
  createTopUpTransfer: (loc, pid, qty) => { rpcCalls.push(['transfer', loc, pid, qty]); return { ok: true }; } };
const ctx = { console, Date, Math, Number, String, JSON, Object, Array, Promise, Intl, setTimeout: () => 0,
  document: { addEventListener() {}, head: null, querySelectorAll: () => [], querySelector: () => null },
  PoolShedFleetUI: fleet, PoolShedInventoryControl: inv, __POOL_SHED_GET_DATA__: () => data, __POOL_SHED_CURRENT_USER__: () => ({ role, name: 'Office' }),
  __POOL_SHED_SAVE_APP_DATA__: () => true, addMovement: (...a) => data.movements.push(a),
  __POOL_SHED_DB__: () => ({ rpc: async (n, a) => { rpcCalls.push([n, a]); return { data: rpcResult[n], error: null }; } }) };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync('public/van-stock.js', 'utf8'), ctx);
const VS = ctx.PoolShedVanStock;
// Engineer.
VS.state.mine.V1 = { location_id: 'L-VAN-PB21VAN', items: [{ product_id: 'P1', name: 'Chlorine 5kg', sku: 'CHL-5', expected: 5, min: 6 }], last_count: null };
VS.state.mine.V2 = { location_id: null, items: [] };
let html = fleet.render();
assert(/My van stock/.test(html) && /1 items · 1 below minimum · Not counted yet/.test(html) && /Count my van/.test(html), 'engineer sees own van stock');
assert(/vs-low/.test(html) && !/£/.test(html), 'below minimum marked; no money shown to engineers');
assert(/stock is not set up yet/.test(html), 'unset van explained');
VS.state.counting = 'V1'; html = fleet.render();
assert(/data-vs-qty="0" data-pid="P1" value="5"/.test(html) && /Send count to the office/.test(html), 'count starts at what should be there');
VS.state.counting = null; VS.state.mine.V1.last_count = { status: 'submitted', counted_at: new Date().toISOString() };
html = fleet.render(); assert(/is waiting for the office/.test(html) && !/Count my van/.test(html), 'no second count while one waits');
// Office.
role = 'Admin';
VS.state.counts = [{ id: 'C1', van_id: 'V1', registration: 'PB21 VAN', location_id: 'L-VAN-PB21VAN', engineer: 'Dave', counted_at: new Date().toISOString(), status: 'submitted', note: 'used 2',
  lines: [{ product_id: 'P1', name: 'Chlorine 5kg', expected: 5, counted: 3 }, { product_id: 'P2', name: 'Tabs', expected: 2, counted: 2 }] }];
html = fleet.render();
assert(/Van counts to check/.test(html) && /PB21 VAN<\/b> counted by Dave/.test(html) && />-2</.test(html) && !/>Tabs</.test(html), 'only differences listed');
assert(/£1,840/.test(html) && /2 short/.test(html) && /Count waiting/.test(html), 'value, shortfalls, waiting count');
assert(/Stock not set up/.test(html) && /data-vs="setup" data-van="V2"/.test(html), 'set up van stock');
assert(/Van top-ups/.test(html) && /CHL-5/.test(html) && /Create top-up transfers/.test(html), 'top-up list');
// Applying a count adjusts stock and logs a movement and a stock take.
VS.applyCount(VS.state.counts[0]);
assert.equal(data.stock[0].qty, 3, 'stock adjusted'); assert.equal(data.movements[0][0], 'Van Count Down'); assert.equal(data.movements[0][2], 2);
assert.equal(data.stockTakes.length, 1); assert.equal(data.stockTakes[0].locationId, 'L-VAN-PB21VAN');
// Not shown away from the list view.
fleet._state.view = 'report'; assert.equal(fleet.render(), '<div>fleet</div>', 'report view untouched');
// 031 guard.
const sql = fs.readFileSync('database/031-van-stock.sql', 'utf8').replace(/--.*$/gm, '');
for (const [re, why] of [[/You can only see the van assigned to you/, 'own van only'], [/is already waiting for the office/, 'one count at a time'],
  [/Counts must be whole numbers, 0 or more/, 'whole numbers'], [/A different person must apply a count with differences that you counted yourself/, 'no self-approval'],
  [/That count has already been dealt with/, 'decide once'], [/That location is already linked to another van/, 'one location per van'],
  [/revoke all on public\.ps_van_counts from anon, authenticated/, 'counts private'], [/reason text default null/, 'no name clash']]) assert(re.test(sql), why);
assert(!/'cost'/.test(sql.slice(sql.indexOf('function public.ps_van_stock'), sql.indexOf('function public.ps_van_count_submit'))), 'van stock never returns costs');
const index = fs.readFileSync('public/index.html', 'utf8'); assert(index.indexOf('van-stock.js') > index.indexOf('fleet-workspace.js'), 'loads after fleet');
console.log('Van stock v1.58: engineer view and count, office view, apply count, top-ups and 031 rules correct.');
