// v1.95 receiving on the PO (arrived, damaged, wrong item; damage decisions) and the To order list.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';
const src = fs.readFileSync('public/po-receive.js', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');
assert(index.indexOf('po-receive.js') > index.indexOf('purchase-workspace.js') && index.indexOf('po-receive.js') > index.indexOf('warehouse-workspace.js'), 'loads after purchasing and warehouse');
assert(fs.readFileSync('public/service-worker.js', 'utf8').includes('./po-receive.js?v='), 'cached for offline use');
assert(/\['purchase', 'To Order', 'To order'\]/.test(fs.readFileSync('public/back-office-frame.js', 'utf8')), 'To order on the Purchasing menu');

const today = new Date().toISOString().slice(0, 10);
const data = {
  purchaseOrders: [{ id: 'PO-1', supplier: 'Carro', status: 'Sent', due: today, lines: [
    { productId: 'A', qty: 3, received: 0, unitCost: 10, salesOrderId: 'SO-1' }, { productId: 'B', qty: 2, received: 0, unitCost: 5 }, { productId: 'C', qty: 1, received: 0, unitCost: 7 }] }],
  salesOrders: [
    { id: 'SO-1', status: 'Needs Review', due: today, lines: [{ productId: 'A', qty: 3, allocated: 0 }, { productId: 'E', qty: 4, allocated: 1 }, { productId: 'CUST-1', lineType: 'custom', qty: 1, customProductName: 'Crane hire', unitCost: 300 }, { productId: 'SHIP', lineType: 'shipping', qty: 1 }] },
    { id: 'SO-9', status: 'Invoiced', lines: [{ productId: 'E', qty: 50, allocated: 0 }, { productId: 'CUST-9', lineType: 'custom', qty: 1 }] }],
  stock: [{ productId: 'E', locationId: 'L-WH-A1', qty: 1, allocated: 1 }, { productId: 'A', locationId: 'L-QUARANTINE', qty: 1, allocated: 0 }],
  goodsNotes: [], purchaseReturns: [], suppliers: [{ name: 'Carro', ordersEmail: 'o@carro.test' }]
};
const products = { A: { name: 'Pump', sku: 'PMP', supplier: 'Carro', cost: 10 }, B: { name: 'Valve', sku: 'VLV' }, C: { name: 'Pipe', sku: 'PIP' }, E: { name: 'Elbow', sku: 'ELB', supplier: 'Certikin', cost: 2 }, K: { name: 'Chlorine', sku: 'CHL' } };
let booked = null, removed = [], returned = null;
const ctx = { console, data, Blob, URL, setTimeout: () => 0, saveAppData() {}, render() {}, toast() {}, currentUser: () => ({ name: 'Test' }), product: id => products[id] || null,
  purchaseOrderDetailPage: po => '<header>x</header><section class="pof-bar">bar</section><div>body</div>', renderPurchase: () => 'base', selectedSubPage: () => 'To Order', activeSubPage: {}, purchaseOrderView: 'list', selectedPurchaseOrderId: 'PO-1', active: 'purchase',
  warehouseBookDelivery: (id, rows, ref) => { booked = { id, rows, ref }; return { ok: true, accepted: 4, damaged: 1, allocated: 2, wrongItem: 1 }; },
  removeStock: (pid, loc, q) => { removed.push(pid + '@' + loc + ':' + q); return true; }, addStock() {}, addMovement() {},
  purchaseCreateSupplierReturn: input => { returned = input; return { ok: true, return: { id: 'PR-1', expectedGrossCredit: 12 } }; },
  allocationRowsForSalesOrder: pid => data.stock.filter(r => r.productId === pid),
  PoolShedStockFlow: { isStock: l => !!(l && l.productId && !l.lineType) },
  PoolShedProductHub: { replenishmentRows: () => [{ productId: 'K', product: { name: 'Chlorine', sku: 'CHL' }, supplier: 'CPC', projectedAvailable: 1, reorderPoint: 4, available: 1, inbound: 0, suggestedQty: 9, unitCost: 3 }], _resetCache() {} },
  nextPurchaseOrderId: () => 'PO-2', document: undefined };
ctx.window = ctx; ctx.__POOL_SHED_GET_DATA__ = () => data;
vm.createContext(ctx); vm.runInContext(src, ctx);
const R = ctx.PoolShedReceive, st = R.state;

// receive panel: everything still to come filled in; damaged and wrong item are changes
st.open = 'PO-1';
let html = ctx.purchaseOrderDetailPage(data.purchaseOrders[0]);
assert(/<section class="pof-bar">bar<\/section><section class="rx-card" id="rxPanel">/.test(html), 'panel sits under the progress bar');
assert(/value="3"/.test(html) && /Confirm delivery · 6 items/.test(html), 'arrived defaults to what is still to come');
st.rows['PO-1|A'] = { arrived: 3, damaged: 1, wrong: false }; st.rows['PO-1|B'] = { arrived: 1, damaged: 0, wrong: false }; st.rows['PO-1|C'] = { arrived: 0, damaged: 0, wrong: true };
assert.equal(R.goesTo(data.purchaseOrders[0].lines[0], st.rows['PO-1|A']), '2 to Main Warehouse, reserved for SO-1 · 1 to Quarantine');
assert.equal(R.goesTo(data.purchaseOrders[0].lines[1], st.rows['PO-1|B']), '1 to Main Warehouse · 1 still to come');
st.ref = 'DN-1'; R.confirmDelivery('PO-1');
assert.deepEqual(booked.rows.map(r => r.lineKey + ':' + r.qty + ':' + r.decision), ['A:2:Accepted', 'A:1:Damaged', 'B:1:Accepted', 'C:0:Wrong item'], 'booking-in rows');
assert.equal(booked.ref, 'DN-1'); assert.equal(st.open, '', 'panel closes'); assert.equal(st.damage.length, 1, 'damaged item waits for a decision');
st.rows['PO-1|A'] = { arrived: 9, damaged: 0 }; st.open = 'PO-1'; booked = null; R.confirmDelivery('PO-1'); assert.equal(booked, null, 'more than still to come is refused'); st.open = ''; st.rows = {};
html = ctx.purchaseOrderDetailPage(data.purchaseOrders[0]);
assert(/1 damaged on delivery/.test(html) && /data-rx-damage="replace\|0"/.test(html) && /data-rx-damage="credit\|0"/.test(html) && /data-rx-damage="writeoff\|0"/.test(html), 'three choices');
st.damage.push(Object.assign({}, st.damage[0]), Object.assign({}, st.damage[0]));
R.damageAction('replace', 0);
const rpl = data.purchaseOrders[0].lines.find(l => l.replacementFor === 'A');
assert(rpl && rpl.qty === 1 && rpl.unitCost === 0 && rpl.salesOrderId === 'SO-1' && /^RPL-/.test(rpl.receiptLineId), 'replacement stays on order at no cost, still for SO-1');
R.damageAction('credit', 0); assert.deepEqual([returned.productId, returned.qty, returned.reason, returned.locationId], ['A', 1, 'Damaged on delivery', 'L-RETURNS-HOLD'], 'credit raises a supplier return');
assert(removed.includes('A@L-QUARANTINE:1'), 'damaged stock leaves Quarantine');
R.damageAction('writeoff', 0); assert.equal(removed.filter(x => x === 'A@L-QUARANTINE:1').length, 2, 'write-off removes it'); assert.equal(st.damage.length, 0);

// To order
const rows = R.toOrderRows(), by = rows.map(r => r.why + ':' + r.productId + ':' + r.qty + ':' + (r.soId || '')).sort();
assert.deepEqual(by, ['custom:CUST-1:1:SO-1', 'customer:E:3:SO-1', 'reorder:K:9:'], 'kept stock below reorder, customer shortfall (after free and on order), custom item not on a PO; invoiced orders, shipping and covered lines left out');
let page = R.toOrderPage();
assert(/Choose a supplier/.test(page) && /data-to-create="CPC"/.test(page) && /data-to-create="Certikin"/.test(page) && /Not bought in/.test(page), 'grouped by supplier; custom items pick a supplier or are marked not bought in');
st.sup['c|SO-1|CUST-1'] = 'Certikin'; st.qty['s|SO-1|E'] = 5;
R.createFrom('Certikin');
const po2 = data.purchaseOrders.find(p => p.id === 'PO-2');
assert(po2 && po2.supplier === 'Certikin' && po2.status === 'Draft - Review' && po2.source === 'To order', 'draft PO for the supplier');
assert.deepEqual(po2.lines.map(l => l.productId + ':' + l.qty + ':' + l.salesOrderId).sort(), ['CUST-1:1:SO-1', 'E:5:SO-1'], 'lines keep the sales order link and the edited quantity');
assert.equal(ctx.purchaseOrderView, 'detail', 'opens the new PO to approve and email');
assert.equal(ctx.renderPurchase(), 'base', 'other purchasing pages untouched while a PO is open');
console.log('PO receiving v1.95: receive on the PO, damage decisions, To order from customer orders, reorder points and custom items.');
