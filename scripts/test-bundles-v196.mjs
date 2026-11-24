// v1.96 bundles: one engine for what a bundle is, its parts, price per price list, can-make, adding to an order,
// quantities that follow, one money rule (bundle line carries price and cost; parts carry neither), orphans tidied.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';
const src = fs.readFileSync('public/bundles.js', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');
assert(index.indexOf('bundles.js') > index.indexOf('stock-flow.js') && index.indexOf('bundles.js') > index.indexOf('bundle-engine.js'), 'loads after stock flow and the older bundle code');
assert(!index.includes('bundle-sales-intelligence.js') && !fs.existsSync('public/bundle-sales-intelligence.js'), 'the switched-off duplicate is retired');
assert(fs.readFileSync('public/service-worker.js', 'utf8').includes('./bundles.js?v='), 'cached for offline use');
assert(/unitPrice:0,unitCost:0\/\* v1\.96/.test(fs.readFileSync('public/quote-studio-engine.js', 'utf8')), 'quotes follow the same money rule');
assert(/l\.bundleRole === 'component'\) return;   \/\/ v1\.96/.test(fs.readFileSync('public/monthly-pack.js', 'utf8')), 'monthly pack counts the bundle once');
const ws = fs.readFileSync('public/sales-workspace.js', 'utf8');
assert(/function so2OrderedLines\(order\)/.test(ws) && /function so2BundlePartRow\(order, line\)/.test(ws) && /parts reserved<\/span>/.test(ws), 'order lines fold parts under the bundle');
const pe = fs.readFileSync('public/product-editor.js', 'utf8');
assert(/function bundleCards\(p\)/.test(pe) && /Sell as a bundle/.test(pe) && /data-pe-bmode=/.test(pe) && /Parts total less a %/.test(pe), 'product editor builds bundles');
assert(/cl-bundle/.test(fs.readFileSync('public/catalogue-list.js', 'utf8')) && /Part of ' \+ \(l\.bundleParentName/.test(fs.readFileSync('public/po-receive.js', 'utf8')), 'catalogue badge and To order reason');

const products = {
  KIT: { id: 'KIT', sku: 'KIT', name: 'Starter Kit', bundleEnabled: true, rrp: 34.99, trade: 27.99, wholesale: 0, bundleItems: [{ productId: 'A', qty: 1 }, { productId: 'B', qty: 2 }, { productId: 'S', qty: 1 }] },
  A: { id: 'A', name: 'Tabs', cost: 9.1, rrp: 15.5, trade: 12.4 }, B: { id: 'B', name: 'Strips', cost: 3.1, rrp: 7.99, trade: 6.4 }, S: { id: 'S', name: 'Leaflet', cost: 0.2, rrp: 0, productType: 'Service' },
  OLD: { id: 'OLD', productType: 'Bundle / Kit', bundleItems: [] }, PLAIN: { id: 'PLAIN', name: 'Pump' }
};
const free = { A: 7, B: 9 };
const order = { id: 'SO-1', status: 'Needs Review', lines: [] };
const released = [];
const ctx = { console, setTimeout: () => 0, clearTimeout() {}, data: { products: Object.values(products), salesOrders: [order] }, product: id => products[id] || null,
  PoolShedProductHub: { isStocked: p => p.productType !== 'Service', stockSummary: id => ({ available: free[id] || 0 }) },
  releaseAllocatedStockForLine: (o, l, q) => { released.push(l.productId + ':' + q); l.allocated -= q; return q; }, addSalesOrderNotification() {} };
ctx.window = ctx; ctx.__POOL_SHED_GET_DATA__ = () => ctx.data;
vm.createContext(ctx); vm.runInContext(src, ctx);
const B = ctx.PoolShedBundleEngine;

assert(B.isBundle(products.KIT) && B.isBundle(products.OLD) && !B.isBundle(products.PLAIN), 'one definition: flagged or typed as a bundle');
assert.equal(B.parts(products.KIT).length, 3);
assert.equal(B.partsCost(products.KIT), 15.5, 'cost is the parts total: 9.10 + 2 × 3.10 + 0.20');
assert.equal(Math.round(B.partsTotal(products.KIT, 'trade') * 100) / 100, 25.2, 'parts total at trade (a part with no trade price uses RRP)');
const cm = B.canMake(products.KIT); assert.deepEqual([cm.qty, cm.limit.productId], [4, 'B'], 'can make 4: strips (9 free, 2 each) limit it; non-stock parts ignored');
assert.equal(B.price(products.KIT, 'wholesale'), 34.99, 'no wholesale price set: falls back to RRP');
const d = { id: 'D', bundleEnabled: true, bundlePriceMode: 'discount', bundleDiscountPct: 10, bundleItems: [{ productId: 'A', qty: 2 }] }; B.refresh(d);
assert.deepEqual([d.rrp, d.trade, d.bundleComponentCost, d.stockTracked], [27.9, 22.32, 18.2, false], 'parts total less 10% at each price list');

let r = B.addToOrder(order, products.KIT, 2);
assert(r.ok); const head = order.lines[0];
assert.deepEqual([head.bundleRole, head.lineType, head.qty, head.unitCost, head.unitPrice], ['head', 'bundle', 2, 15.5, undefined], 'bundle line carries the cost; its price comes from the customer price list');
assert.deepEqual(order.lines.slice(1).map(l => l.productId + ':' + l.qty + ':' + l.unitPrice + ':' + l.unitCost), ['A:2:0:0', 'B:4:0:0', 'S:2:0:0'], 'parts carry neither price nor cost');
assert(order.lines.slice(1).every(l => l.bundleInstanceId === head.bundleInstanceId && l.bundleParentName === 'Starter Kit'), 'parts know their bundle');
r = B.addToOrder(order, products.KIT, 1); assert(r.merged && head.qty === 3 && order.lines.length === 4 && order.lines[2].qty === 6, 'adding the same bundle again raises the quantity');
order.lines[2].allocated = 6; B.setQty(order, head, 1);
assert.deepEqual([order.lines[1].qty, order.lines[2].qty, order.lines[2].allocated], [1, 2, 2], 'quantity down: parts follow and spare reservations are released');
assert.deepEqual(released, ['B:4']);
const st = B.partStatus(order, head); assert.deepEqual([st.ready, st.total], [1, 3], 'parts reserved summary');
assert.equal(B.addToOrder(order, products.OLD, 1).ok, false, 'a bundle with no parts cannot be sold');
order.lines = order.lines.filter(l => l.bundleRole !== 'head');
assert.equal(B.tidyOrphans(), 2, 'parts left behind by a removed bundle are tidied (the reserved one is kept)');
assert.deepEqual(order.lines.map(l => l.productId), ['B'], 'the part with stock reserved stays until someone deals with it');
// a part reserves stock on its own line, even when another line on the order has the same product
const o2 = { id: 'SO-2', status: 'Needs Review', lines: [{ productId: 'A', qty: 1, allocated: 1 }] };
ctx.data.stock = [{ productId: 'A', locationId: 'L-WH-A1', qty: 5, allocated: 1 }, { productId: 'A', locationId: 'L-QUARANTINE', qty: 9, allocated: 0 }];
ctx.allocationRowsForSalesOrder = pid => ctx.data.stock.filter(r => r.productId === pid);
B.addToOrder(o2, products.KIT, 2);
const partA = o2.lines.find(l => l.bundleRole === 'component' && l.productId === 'A');
assert.equal(B.allocatePart(o2, partA), 2, 'bundle part reserved on its own line');
assert.deepEqual([o2.lines[0].allocated, partA.allocated, ctx.data.stock[0].allocated, ctx.data.stock[1].allocated], [1, 2, 3, 0], 'the other line is untouched and quarantine is never used');
console.log('Bundles v1.96: one definition, parts cost and price lists, can make, one line on orders, quantities follow, orphans tidied.');
