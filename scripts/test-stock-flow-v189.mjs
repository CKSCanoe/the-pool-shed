// v1.89 stock flow: non-stock lines hold no allocation, stock is reserved on add, cancelling frees it, invoicing ships what has not gone.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';
const src = fs.readFileSync('public/stock-flow.js', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');
assert(index.indexOf('stock-flow.js') > index.indexOf('sales-order-flow.js') && index.indexOf('stock-flow.js') > index.indexOf('partial-fulfilment.js'), 'stock flow loads after the order and fulfilment layers');
assert(fs.readFileSync('public/service-worker.js', 'utf8').includes('./stock-flow.js?v='), 'stock flow is cached for offline use');
assert(/PoolShedStockFlow\.shipOnInvoice\(o\)/.test(fs.readFileSync('public/sales-invoicing-workspace.js', 'utf8')), 'ledger invoices ship the goods too');
assert(/data-sof-invoice="' \+ id \+ '">Or invoice now: the goods ship with it/.test(fs.readFileSync('public/sales-order-flow.js', 'utf8')), 'order bar offers invoice now');

const data = { salesOrders: [], stock: [], goodsNotes: [], movements: [] };
const ctx = { console, setTimeout: () => 0, clearTimeout() {}, data, toast() {}, saveAppData() {}, render() {}, currentUser: () => ({ name: 'Test' }),
  __POOL_SHED_GET_DATA__: () => data, __POOL_SHED_WORKSPACE_READY__: () => true,
  salesOrder: id => data.salesOrders.find(o => o.id === id),
  isNonStockSalesLine: l => l.lineType === 'custom' || l.lineType === 'shipping',
  allocationRowsForSalesOrder: pid => data.stock.filter(r => r.productId === pid && r.qty > 0),
  addMovement: (type, pid, qty) => data.movements.push({ type, pid, qty }),
  addSalesOrderNotification: (o, t, m) => (o.notes = (o.notes || []).concat(t + ': ' + m)),
  syncSalesOrderStatusFromGoodsNotes() {},
  releaseAllocatedStockForLine(order, line, qty) { let left = qty; data.stock.filter(r => r.productId === line.productId).forEach(r => { const t = Math.min(left, r.allocated); r.allocated -= t; left -= t; }); line.allocated -= qty - left; return qty - left; },
  allocateSalesOrderLine(orderId, pid) { const o = ctx.salesOrder(orderId), l = o.lines.find(x => x.productId === pid); if (ctx.isNonStockSalesLine(l)) { l.allocated = l.qty; return; }
    let need = l.qty - l.allocated; data.stock.filter(r => r.productId === pid).forEach(r => { const t = Math.min(need, r.qty - r.allocated); r.allocated += t; l.allocated += t; need -= t; }); o.status = 'Part Stock'; },
  addProductToSalesOrder(orderId) { ctx.salesOrder(orderId).lines.push({ productId: 'P1', qty: 2, allocated: 0 }); },
  updateSalesOrderLineNumber() {},
  completeSalesOrderAfterInvoice(o) { const p = ctx.salesOrderProgress(o); o.status = p.required > 0 && p.shipped >= p.required ? 'Completed' : 'Invoiced'; return o.status === 'Completed'; },
  salesOrderProgress: () => ({ required: 99, shipped: 0 }), applyGoodsNoteTotalsToOrder: () => false };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(src, ctx);
const F = ctx.PoolShedStockFlow;

data.stock.push({ productId: 'P1', locationId: 'L-WH-A1', qty: 5, allocated: 0 }, { productId: 'P1', locationId: 'L-QUARANTINE', qty: 9, allocated: 0 });
data.salesOrders.push({ id: 'SO-1', status: 'Needs Review', lines: [{ productId: 'C1', lineType: 'custom', qty: 3, allocated: 3 }, { productId: 'S1', lineType: 'shipping', qty: 1, allocated: 1 }] });
const o = data.salesOrders[0];

assert.equal(F.tidy(), 2, 'old allocations on custom and delivery lines are cleared');
assert(o.lines.every(l => l.allocated === 0), 'non-stock lines hold nothing');
ctx.allocateSalesOrderLine('SO-1', 'C1', true); assert.equal(o.lines[0].allocated, 0, 'allocating a custom line holds nothing');

ctx.addProductToSalesOrder('SO-1');
assert.equal(o.lines[2].allocated, 2, 'stock reserved as soon as the item is added');
assert.equal(data.stock[0].allocated, 2, 'shelf shows it reserved'); assert.equal(data.stock[1].allocated, 0, 'quarantine stock never reserved');
assert.equal(o.status, 'Needs Review', 'reserving stock leaves the order status alone');

o.status = 'Cancelled'; F.tidy();
assert.equal(o.lines[2].allocated, 0, 'cancelled order frees its stock'); assert.equal(data.stock[0].allocated, 0, 'shelf freed');
o.status = 'Needs Review'; F.autoAllocate(o); o.lines[2].qty = 7;   // 2 reserved, 7 sold, 5 on the shelf

const done = ctx.completeSalesOrderAfterInvoice(o);
const note = data.goodsNotes[0];
assert(note && note.shipped && note.shippedWithInvoice && note.shipmentLocked, 'a shipped goods note is kept so returns and credits work');
assert.equal(note.lines.length, 1, 'only stock lines ship');
assert.deepEqual([note.lines[0].shipped, note.lines[0].noStockQty], [7, 2], 'all 7 ship, 2 had no stock recorded');
assert.deepEqual([data.stock[0].qty, data.stock[0].allocated, o.lines[2].allocated], [0, 0, 0], 'shelf emptied, nothing left reserved');
assert.equal(data.stock[1].qty, 9, 'quarantine stock untouched');
assert(done && o.status === 'Completed', 'invoiced and fully shipped: complete (progress counts stock lines only)');
assert(/2 had no stock recorded/.test((o.notes || []).join(' ')), 'order notes the shortfall');
assert.equal(F.shipOnInvoice(o).units, 0, 'invoicing again ships nothing twice');
console.log('Stock flow v1.89: no allocation on non-stock lines, reserve on add, free on cancel, ship with invoice, stock-only progress.');
