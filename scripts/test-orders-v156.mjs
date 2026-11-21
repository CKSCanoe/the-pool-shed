// v1.56 sales order flow: where the order is, the one next step, money summary, quick add, copy order and in-place invoice/payment wiring.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const products = { P1: { name: 'Pump', sku: 'PMP' }, P2: { name: 'Chlorine', sku: 'CHL-5' }, P3: { name: 'Chlorine', sku: 'CHL-10' } };
const ctx = { console, Date, Math, Number, String, JSON, Object, Array, document: { addEventListener() {}, head: null },
  money: v => '£' + Number(v).toFixed(2), isNonStockSalesLine: l => !!l.lineType, product: id => products[id],
  salesOrderProgress: o => ({ shipped: o._shipped || 0 }),
  salesOrderTotals: o => ({ gross: o._gross || 120, paid: (o.payments || []).reduce((t, p) => t + p.amount, 0), net: 100 }),
  salesOrderCostSummary: () => ({ sell: 100, margin: 35 }),
  __POOL_SHED_GET_DATA__: () => ({ salesOrders: [{ lines: [{ productId: 'P2' }, { productId: 'P3' }] }, { lines: [{ productId: 'P2' }, { productId: 'P1' }] }] }) };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext('var salesOrderDetail = function(o){ return "<header>"+o.id+"</header><div class=\\"so3-command-accent\\" aria-hidden=\\"true\\"></div><button class=\\"secondary so3-invoice\\" data-open-invoice-confirm=\\"x\\">Invoice</button>"; };', ctx);
vm.runInContext(fs.readFileSync('public/sales-order-flow.js', 'utf8'), ctx);
const F = ctx.PoolShedOrderFlow;
const o = (x) => Object.assign({ id: 'SO-1', status: 'New Order', lines: [{ productId: 'P1', qty: 2, allocated: 0, packed: 0 }], payments: [] }, x);
const cur = x => (F.flow(o(x)).current || {}).key || 'complete';
assert.equal(cur({ lines: [] }), 'ordered', 'empty order: add items');
assert.equal(cur({}), 'allocated', 'stock lines not allocated');
assert.equal(cur({ lines: [{ productId: 'P1', qty: 2, allocated: 2, packed: 0 }] }), 'packed', 'allocated, not packed');
assert.equal(cur({ lines: [{ productId: 'P1', qty: 2, allocated: 2, packed: 2 }] }), 'delivered', 'packed, not shipped');
assert.equal(cur({ status: 'Invoice Ready' }), 'invoiced', 'delivered status skips earlier steps');
assert.equal(cur({ status: 'Invoiced', xeroRef: 'INV-2049', invoiceSource: 'Ledger' }), 'paid', 'invoiced: take payment');
assert.equal(cur({ status: 'Invoiced', xeroRef: 'INV-2049', payments: [{ amount: 120 }] }), 'complete', 'paid in full');
assert.equal(cur({ lines: [{ productId: 'S', lineType: 'custom', qty: 1 }] }), 'delivered', 'service-only order: mark as done');
let html = ctx.salesOrderDetail(o({}));
assert(/so3-command-accent[^]*sof-bar/.test(html), 'bar sits under the header');
assert(/data-allocate-order="SO-1"[^>]*>Allocate stock</.test(html), 'next step reuses the existing allocate action');
assert(/sof-quiet/.test(html), 'old Invoice button steps back');
assert(/Order total[^]*£120\.00[^]*Balance[^]*£120\.00[^]*Margin[^]*35%/.test(html), 'money summary');
assert(/data-sof-copy="SO-1"/.test(html), 'copy order');
assert(/Quick add:/.test(html) && /Chlorine · CHL-5/.test(html) && /Chlorine · CHL-10/.test(html) && />\+ Pump</.test(html), 'quick add, same names told apart');
html = ctx.salesOrderDetail(o({ status: 'Invoice Ready' }));
assert(/data-sof-invoice="SO-1"[^>]*>Invoice £120\.00/.test(html) && !/Quick add/.test(html), 'invoice step, no quick add once delivered');
html = ctx.salesOrderDetail(o({ status: 'Invoiced', invoiceSource: 'Ledger', xeroRef: 'INV-2049', payments: [{ amount: 20 }] }));
assert(/data-sof-pay="SO-1"[^>]*>Record payment £100\.00/.test(html) && /INV-2049/.test(html), 'payment step shows what is left');
html = ctx.salesOrderDetail(o({ status: 'On Hold' }));
assert(/On hold: change the status/.test(html), 'on hold says so');

// Wiring.
const legacy = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8'), si = fs.readFileSync('public/sales-invoicing-workspace.js', 'utf8'), index = fs.readFileSync('public/index.html', 'utf8');
assert(/window\.__POOL_SHED_COPY_SALES_ORDER__ = function/.test(legacy) && /copy\.allocated = line\.lineType === "shipping"[^;]*; copy\.picked = 0; copy\.packed = 0/.test(legacy), 'copy resets allocation, picking and packing');
assert(/status: "Needs Review"[^}]*tags: \["Manual", "Copied"\]/.test(legacy), 'copied order starts in review');
assert(/window\.__POOL_SHED_SET_ORDER_STATUS__ = function/.test(legacy), 'status hook');
assert(/inlineInvoice: inlineInvoice, inlinePayment: inlinePayment/.test(si) && /if \(s\.modal\) \{ closeModal\(\); return; \}/.test(si), 'invoice and payment in place');
assert(/if \(r\.state !== 'ready'\)/.test(si), 'in-place invoice only for delivered orders');
assert(index.indexOf('sales-order-flow.js') > index.indexOf('sales-workspace.js'), 'flow layer loads after the order page');
console.log('Orders v1.56: status rail, one next step, money summary, quick add, copy order and in-place invoice/payment correct.');
