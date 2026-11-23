// v1.90 Fulfilment tab: items with ordered / allocated / on notes / shipped, one-click goods-out note, note cards with their steps.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';
const src = fs.readFileSync('public/fulfilment-tab.js', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');
assert(index.indexOf('fulfilment-tab.js') > index.indexOf('sales-workspace.js') && index.indexOf('fulfilment-tab.js') > index.indexOf('partial-fulfilment.js'), 'loads after the order page and partial fulfilment');
assert(fs.readFileSync('public/service-worker.js', 'utf8').includes('./fulfilment-tab.js?v='), 'cached for offline use');

const data = { goodsNotes: [], stock: [{ productId: 'P1', locationId: 'L-WH-A1', qty: 5, allocated: 3 }, { productId: 'P2', locationId: 'L-WH-A1', qty: 0, allocated: 0 }] };
const order = { id: 'SO-1', carrier: '', lines: [{ productId: 'P1', qty: 4, allocated: 3 }, { productId: 'P2', qty: 2, allocated: 0 }, { productId: 'S1', lineType: 'shipping', qty: 1, allocated: 0 }] };
const products = { P1: { name: 'Chlorine', sku: 'CHL' }, P2: { name: 'Pump', sku: 'PMP' } };
const ctx = { console, data, salesOrderTab: 'fulfilment', document: undefined,
  __POOL_SHED_GET_DATA__: () => data, salesOrder: id => (id === 'SO-1' ? order : null), product: id => products[id],
  isNonStockSalesLine: l => !!l.lineType, available: r => Math.max(0, r.qty - r.allocated),
  allocationRowsForSalesOrder: pid => data.stock.filter(r => r.productId === pid),
  salesOrderTabContent: () => 'base', currentUser: () => ({ name: 'Test' }), syncSalesOrderStatusFromGoodsNotes() {}, addNotification() {}, fulfilSalesOrder() {} };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(src, ctx);
const T = ctx.PoolShedFulfilmentTab;

let html = ctx.salesOrderTabContent(order);
assert(/class="ft-panel"/.test(html), 'fulfilment tab is the new goods-out panel');
assert(/3 of 6 allocated · 3 still to allocate/.test(html), 'summary line: ' + html.match(/<small>([^<]*)<\/small>/)[1]);
assert(/Part allocated/.test(html) && /No free stock/.test(html) && /No stock needed/.test(html), 'line statuses: part allocated, no free stock, no stock needed');
assert(/data-ft-create="SO-1">Create goods-out note \(3 units\)/.test(html), 'one button puts the allocated units on a note');
assert(/Order from supplier/.test(html), 'missing stock points to purchasing');
ctx.salesOrderTab = 'products'; assert.equal(ctx.salesOrderTabContent(order), 'base', 'other tabs untouched'); ctx.salesOrderTab = 'fulfilment';

const note = T.createNote(order);
assert(note && note.lines.length === 1 && note.lines[0].qty === 3 && !note.shipped, 'note holds the 3 allocated units only');
assert.equal(T.createNote(order), null, 'nothing allocated is left for a second note');
html = T.panel(order);
assert(/On notes[^]*>3</.test(html) && /data-ft-print="GN-/.test(html), 'note card offers the picking list first');
assert(/<li class="">Printed<\/li><li class="">Picked<\/li><li class="">Packed<\/li><li class="">Shipped<\/li>/.test(html), 'four steps shown, none done yet');
note.printed = note.picked = true; html = T.panel(order); assert(/data-ft-pack="GN-/.test(html), 'picked: next is pack');
note.packed = true; html = T.panel(order); assert(/data-ft-ship="GN-[^"]*">Ship…/.test(html), 'packed: next is ship');
note.shipped = true; note.shippedBy = 'Test'; note.lines[0].shipped = 3; html = T.panel(order); assert(/Shipped [^<]*by Test/.test(html) && !/data-ft-cancel/.test(html), 'shipped note is locked');
assert(/data-ft-cancel|Cancel note/.test(src) && /items go back to allocated/.test(src), 'unshipped notes can be cancelled');
console.log('Fulfilment tab v1.90: item statuses, one-click goods-out note, Printed → Picked → Packed → Shipped cards.');
