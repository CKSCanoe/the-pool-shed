// v1.68 speed: lookups built once per screen draw instead of per product (the cause of 1-6 s pages), the same
// answers as before, cleared at the start of every draw so nothing is stale; Stock levels paged; My work rescans at
// most once a minute (it also saved every draw); no "… opened." message on every menu click.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
// Product engine: same results with the index, and a reset picks up changes.
const data = { products: [], supplierProducts: [], stock: [], purchaseOrders: [], salesOrders: [], locations: [{ id: 'L-WH-MAIN', type: 'Warehouse', isMaster: true }], restockRules: [] };
for (let i = 0; i < 3000; i++) { data.products.push({ id: 'P' + i, sku: 'S' + i, name: 'Product ' + i, cost: 10, supplier: 'Sup' + (i % 7), productType: 'Stocked Product', reorderPoint: i % 2 ? 5 : 0, targetStock: 10 });
  data.supplierProducts.push({ productId: 'P' + i, supplier: 'Sup' + (i % 7), cost: 9, packQty: 2, available: true }); }
data.supplierProducts.push({ productId: 'P1', supplier: 'Other', cost: 7, available: true });
data.purchaseOrders.push({ id: 'PO1', status: 'Supplier Confirmed', lines: [{ productId: 'P1', qty: 4, received: 1 }] });
data.salesOrders.push({ id: 'SO1', status: 'New Order', lines: [{ productId: 'P1', qty: 6, allocated: 1 }, { productId: 'P1', qty: 9, bundleRole: 'head' }] });
data.restockRules.push({ productId: 'P3', locationId: 'L-WH-MAIN', min: 2, max: 8 });
const ctx = { console, Date, Math, Number, String, JSON, Object, Array, Map, Set, Promise, queueMicrotask, __POOL_SHED_GET_DATA__: () => data };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync('public/product-hub-engine.js', 'utf8'), ctx);
const H = ctx.PoolShedProductHub;
assert.equal(H.supplierOffer(data.products[1]).supplier, 'Sup1', 'preferred supplier offer chosen'); assert.equal(H.supplierOffer(data.products[1]).cost, 9);
assert.equal(H.confirmedInbound('P1'), 3); assert.equal(H.uncoveredDemand('P1'), 5, 'bundle heads ignored');
const r1 = H.replenishmentRow('P1'); assert.equal(r1.inbound, 3); assert.equal(r1.demand, 5);
const t0 = Date.now(); const rows = H.replenishmentRows(); const ms = Date.now() - t0;
assert.equal(rows.length, 3000); assert(ms < 1500, 'all 3,000 products in well under a second and a half (took ' + ms + ' ms)');
// Change data in the same task: stale until reset; reset (done at the start of every draw) picks it up.
data.purchaseOrders[0].lines[0].received = 4; H._resetCache(); assert.equal(H.confirmedInbound('P1'), 0, 'reset reads fresh data');
await Promise.resolve(); data.salesOrders[0].lines[0].allocated = 6; assert.equal(H.uncoveredDemand('P1'), 0, 'cleared after the task by itself');
// Source guards.
const legacy = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8'), frame = fs.readFileSync('public/back-office-frame.js', 'utf8'), inv = fs.readFileSync('public/inventory-workspace.js', 'utf8'),
  ana = fs.readFileSync('public/analytics-command-engine.js', 'utf8'), sup = fs.readFileSync('public/supplier-command-engine.js', 'utf8'), ice = fs.readFileSync('public/inventory-control-engine.js', 'utf8'),
  mw = fs.readFileSync('public/my-work-workspace.js', 'utf8'), wh = fs.readFileSync('public/warehouse-workspace.js', 'utf8'), css = fs.readFileSync('public/assets/css/app.css', 'utf8');
assert(/const productIndex = \{ list: null, len: -1, map: null \};/.test(legacy) && /return list\.find\(function\(item\) \{ return item\.id === id; \}\)( \|\| oneOffProduct\(id\))?;/.test(legacy), 'product() indexed, falls back to a full search');
assert(/const knownOffers = new Set\(/.test(legacy) && !/data\.supplierProducts\.some\(function\(row\) \{ return row\.productId === p\.id/.test(legacy), 'supplier price check uses a set');
assert(/PoolShedProductHub\._resetCache\(\)/.test(frame), 'lookups reset at the start of every draw');
assert(/function lookups\(\)/.test(ana) && /function product\(id\)\{return lookups\(\)\.p\.get/.test(ana), 'reports engine lookups indexed');
assert(/function product\(id\)\{return productIndex\(\)\.get\(id\)\|\|null;\}/.test(sup) && /function product\(id\)\{return productIndex\(\)\.get\(id\)\|\|null;\}/.test(ice), 'supplier and inventory engines indexed');
assert(/const size=100,pages=Math\.max\(1,Math\.ceil\(products\.length\/size\)\)/.test(inv) && /data-inv-stock-page/.test(inv) && /state\.stockPage=1;/.test(inv) && /\.inventory-pager\{/.test(css), 'Stock levels paged');
assert(/Date\.now\(\)-\(global\.__psMyWorkScanAt\|\|0\)>60000/.test(mw), 'My work rescans at most once a minute');
assert(!/toast\(subgroup \+ " opened\."\)/.test(legacy) && !/toast\(mapped \+ ' opened\.'\)/.test(wh), 'no "… opened." messages');
console.log('Speed v1.68: lookups once per draw (same answers, never stale), Stock levels paged, My work throttled, no opened messages.');
