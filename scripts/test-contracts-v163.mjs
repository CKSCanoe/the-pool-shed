// v1.63 contracts: calendar frequencies, period labels, fixed fee / per visit / repeat order, one click for what is
// due, no period created twice, end dates, renewals with a price change, older subscriptions still work, wiring.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const data = { customers: [{ id: 'C1', name: 'Smith', priceList: 'trade' }, { id: 'C2', name: 'Hotel' }],
  products: [{ id: 'P1', sku: 'CHL-5', name: 'Chlorine 5kg', rrp: 30 }], salesOrders: [], salesOrderSubscriptions: [
    { id: 'SUB-0001', name: 'Old repeat', customerId: 'C2', status: 'Active', cadenceDays: 30, nextOrderDate: '2026-01-01', lines: [{ productId: 'P1', qty: 2, specialPrice: null, taxCode: '20% VAT' }] } ] };
let saves = 0, n = 2100, notes = [];
const ctx = { console, Date, Math, Number, String, JSON, Object, Array, Intl, RegExp, FormData: class {},
  __POOL_SHED_GET_DATA__: () => data, __POOL_SHED_SAVE_APP_DATA__: () => { saves++; },
  nextSalesOrderId: () => 'SO-' + (n++), addressText: () => '1 Pool Lane', addSalesOrderNotification: (o, t, s) => notes.push(s),
  createNonStockProduct: (type, name, price, cost) => { const p = { id: 'CUSTOM-' + name.length + '-' + data.products.length, name, rrp: price, cost, productType: 'Custom charge', stockTracked: false }; data.products.push(p); return p; },
  salesOrderSubscriptionsPage: () => 'old page', bindSalesOrderSubscriptions: () => 'old bind', document: { addEventListener() {}, head: null } };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync('public/contracts.js', 'utf8'), ctx);
const K = ctx.PoolShedContracts;
assert.equal(ctx.salesOrderSubscriptionsPage, K.page, 'Contracts page replaces the old Subscriptions page');

// Calendar dates.
assert.equal(K.addPeriod('2026-01-31', 'monthly'), '2026-02-28', 'month end clamps');
assert.equal(K.addPeriod('2028-01-31', 'monthly'), '2028-02-29', 'leap year');
assert.equal(K.addPeriod('2026-11-30', 'quarterly'), '2027-02-28');
assert.equal(K.addPeriod('2026-12-28', 'weekly'), '2027-01-04');
assert.equal(K.addPeriod('2026-03-01', 'monthly', -1), '2026-02-01', 'arrears looks back');
assert.equal(K.addPeriod('2026-01-01', '30'), '2026-01-31', 'older records: every N days');

// Validation.
let r = K.saveContract({ customerId: '', name: '', frequency: 'monthly', nextOrderDate: '2026-12-01', lines: [] });
assert(!r.ok && /choose the customer/.test(r.error) && /name/.test(r.error) && /at least one line/.test(r.error));
r = K.saveContract({ customerId: 'C1', name: 'X', frequency: 'monthly', nextOrderDate: '2026-12-01', lines: [{ type: 'product', sku: 'NOPE', qty: 1 }] });
assert(!r.ok && /no product with SKU NOPE/.test(r.error));

// Fixed monthly fee in advance, service only.
r = K.saveContract({ customerId: 'C1', name: 'Weekly pool care', kind: 'Maintenance', billing: 'fixed', frequency: 'monthly', invoiceTiming: 'advance', nextOrderDate: '2026-12-01', renewalDate: '2027-01-15',
  lines: [{ type: 'service', name: 'Pool maintenance (4 visits)', qty: 1, price: '120', cost: '45', taxCode: '20% VAT' }] });
assert(r.ok && r.isNew && r.id === 'SUB-0002');
const fixed = data.salesOrderSubscriptions.find(c => c.id === r.id);
assert.equal(fixed.lines[0].lineType, 'custom'); assert(fixed.lines[0].productId.startsWith('CUSTOM-'), 'service line backed by a custom charge product');
assert.equal(fixed.autoCreate, false); assert.equal(fixed.approvalRequired, true);
assert.equal(K.periodLabel(fixed, '2026-12-01'), 'December 2026');
assert.equal(K.monthly(fixed), 120);
// Per visit, fortnightly, with a product.
r = K.saveContract({ customerId: 'C2', name: 'Hot tub service', kind: 'Maintenance', billing: 'visit', frequency: 'fortnightly', nextOrderDate: '2026-11-20', endDate: '2026-12-10',
  lines: [{ type: 'service', name: 'Hot tub visit', qty: 1, price: '65' }, { type: 'product', sku: 'chl-5', qty: 1, price: '' }] });
assert(r.ok); const visit = data.salesOrderSubscriptions.find(c => c.id === r.id);
assert.equal(visit.lines[1].productId, 'P1', 'product found by SKU, any case'); assert.equal(visit.lines[1].specialPrice, null, 'blank price uses the list price');
assert.equal(K.monthly(visit), Math.round(95 * 26 / 12 * 100) / 100);

// Due list on 1 Dec 2026 (fixed clock).
const RealDate = Date; ctx.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : ['2026-12-01T09:00:00Z'])); } static now() { return new RealDate('2026-12-01T09:00:00Z').getTime(); } };
vm.runInContext(fs.readFileSync('public/contracts.js', 'utf8'), ctx); const K2 = ctx.PoolShedContracts;
assert.deepEqual(K2.due().map(c => c.id).sort(), ['SUB-0001', 'SUB-0002', 'SUB-0003']);
const res = K2.createDue(['SUB-0002', 'SUB-0003', 'SUB-0001']);
assert.equal(res.made.length, 3, JSON.stringify(res.errors)); assert.equal(saves > 0, true);
const [oFixed, oVisit, oOld] = ['SUB-0002', 'SUB-0003', 'SUB-0001'].map(id => data.salesOrders.find(o => o.contractId === id));
assert.equal(oFixed.status, 'Invoice Ready', 'fixed fee with no products is ready to invoice');
assert.equal(oFixed.lines[0].description, 'Pool maintenance (4 visits) (December 2026)'); assert.equal(oFixed.lines[0].specialPrice, 120);
assert.equal(oFixed.lines[0].customerDiscountExempt, true, 'contract price is not discounted'); assert.equal(oFixed.lines[0].allocated, 1);
assert.equal(oFixed.source, 'Contract'); assert.equal(oFixed.due, '2026-12-01');
assert.equal(oVisit.status, 'New Order', 'per visit waits for the visit'); assert.equal(oVisit.lines[0].customVariant, 'visit 20 Nov 2026'); assert.equal(oVisit.lines[1].allocated, 0, 'products still to pick');
assert.equal(oOld.status, 'New Order', 'older repeat orders still work'); assert.equal(oOld.lines[0].productId, 'P1');
assert.equal(fixed.nextOrderDate, '2027-01-01'); assert.equal(visit.nextOrderDate, '2026-12-04', 'fortnightly moves on 14 days');
assert.equal(data.salesOrderSubscriptions[0].nextOrderDate, '2026-01-31');
assert.equal(fixed.history.length, 1); assert(notes.some(s => /created from contract SUB-0002 for December 2026/.test(s)));
// The same period is never created twice.
fixed.nextOrderDate = '2026-12-01';
let again = K2.createOrder(fixed); assert(!again.ok && /already created \(SO-/.test(again.error));
fixed.nextOrderDate = '2027-01-01';
// End date: the visit after 4 Dec is 18 Dec, past the 10 Dec end, so the contract ends.
assert(K2.createOrder(visit).ok); assert.equal(visit.status, 'Ended'); assert.equal(visit.nextOrderDate, '');
assert(!K2.createOrder(visit).ok, 'ended contracts create nothing');
// Paused contracts are not due.
K2.setStatus('SUB-0001', 'Paused'); assert(!K2.due().some(c => c.id === 'SUB-0001'));
// Renewal with a 5% price change.
assert.equal(K2.renewalSoon(fixed), true);
K2.renew('SUB-0002', '5'); assert.equal(fixed.renewalDate, '2028-01-15'); assert.equal(fixed.lines[0].specialPrice, 126);
assert.equal(data.products.find(p => p.id === fixed.lines[0].productId).rrp, 126, 'the charge product follows the new price');
// Editing keeps the service product (no duplicates).
const before = data.products.length, e = K2._editFrom(fixed); e.lines[0].price = '130';
assert(K2.saveContract(e).ok); assert.equal(data.products.length, before, 'no new product on edit'); assert.equal(fixed.lines[0].specialPrice, 130);
// Arrears label.
fixed.invoiceTiming = 'arrears'; assert.equal(K2.periodLabel(fixed, '2027-01-01'), 'December 2026');
// Page.
const html = K2.page(); assert(/Contracts/.test(html) && /A MONTH/.test(html) && /New contract/.test(html) && /Nothing is created until you click/.test(html));

// Wiring.
const legacy = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8'), frame = fs.readFileSync('public/back-office-frame.js', 'utf8'), index = fs.readFileSync('public/index.html', 'utf8'), sw = fs.readFileSync('public/service-worker.js', 'utf8');
assert(/salesorders: \["Sales Orders", "Contracts"/.test(legacy) && /subgroup === "Contracts" \|\| subgroup === "Subscriptions"/.test(legacy), 'menu renamed, old name still opens it');
assert(/PoolShedContracts\.due\(\)/.test(frame) && /'contracts due'/.test(frame), 'Home tile');
assert(index.indexOf('contracts.js') > index.indexOf('01-legacy-01.js') && /contracts\.js\?v=1\.97\.0/.test(sw), 'loaded and offline');
assert(!/setInterval|setTimeout\([^)]*createDue/.test(fs.readFileSync('public/contracts.js', 'utf8').replace(/setTimeout\(function\(\)\{ var el = document\.getElementById\('ct-form'\)[^;]*;/g, '')), 'nothing created on a timer');
console.log('Contracts v1.63: calendar frequencies, fixed fee / per visit / repeat order, one click for what is due, no double periods, renewals.');
