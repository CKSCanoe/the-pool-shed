// v1.64 monthly management pack: month maths, sales and profit by month with comparisons, best customers and
// products, stock value by place (vans separately), purchasing, quotes, contracts, ledger money (finance roles
// only), things to look at, and the wiring into Reports.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const data = {
  customers: [{ id: 'C1', name: 'Smith' }, { id: 'C2', name: 'Hotel' }],
  products: [{ id: 'P1', sku: 'PUMP', name: 'Pump', rrp: 500, cost: 300, avgCost: 320 }, { id: 'P2', sku: 'CHL', name: 'Chlorine', rrp: 20, cost: 8 }, { id: 'P3', sku: 'OLD', name: 'Old heater', cost: 400 }, { id: 'P4', sku: 'NOC', name: 'No cost' }],
  locations: [{ id: 'L-WH', name: 'Main', type: 'Warehouse' }, { id: 'L-VAN-1', name: 'Van PB21', type: 'Engineer Van' }, { id: 'L-Q', name: 'Quarantine Hold', type: 'Quarantine' }],
  stock: [{ productId: 'P1', locationId: 'L-WH', qty: 2 }, { productId: 'P2', locationId: 'L-VAN-1', qty: 10 }, { productId: 'P3', locationId: 'L-Q', qty: 1 }, { productId: 'P2', locationId: 'L-WH', qty: -3 }, { productId: 'P4', locationId: 'L-WH', qty: 5 }],
  salesOrders: [{ id: 'SO-1', created: '2026-10-05', lines: [{ productId: 'P1', qty: 1, specialPrice: 450 }, { productId: 'P2', qty: 5 }] }, { id: 'SO-2', created: '2026-10-20', lines: [{ lineType: 'custom', customProductName: 'Service', qty: 1, unitPrice: 200, productId: 'CUSTOM-1' }] }, { id: 'SO-3', created: '2026-09-10', lines: [{ productId: 'P2', qty: 2 }] }],
  purchaseOrders: [{ id: 'PO-1', status: 'Sent', orderedDate: '2026-10-02', due: '2026-10-10', lines: [{ productId: 'P1', receiptLineId: 'R1', qty: 2, unitCost: 310 }] }, { id: 'PO-2', status: 'Draft - Review', created: '2026-10-03', lines: [{ productId: 'P2', qty: 1, unitCost: 8 }] }, { id: 'PO-3', status: 'Cancelled', orderedDate: '2026-10-04', lines: [{ qty: 9, unitCost: 9 }] }],
  receiptEvents: [{ poId: 'PO-1', lineId: 'R1', qty: 1, date: '2026-10-12T10:00:00Z' }, { poId: 'PO-1', lineId: 'R1', qty: 1, date: '2026-09-12T10:00:00Z', unitCost: 300 }],
  quotes: [{ id: 'Q1', createdAt: '2026-10-01T09:00:00Z', status: 'Accepted', acceptance: { at: '2026-10-09T09:00:00Z' }, deliveries: [{ sentAt: '2026-10-02T09:00:00Z' }] }, { id: 'Q2', createdAt: '2026-10-03T09:00:00Z', status: 'Draft' }],
  salesOrderSubscriptions: [{ id: 'SUB-1', status: 'Active', createdAt: '2026-10-01T00:00:00Z', history: [{ date: '2026-10-01' }, { date: '2026-11-01' }] }, { id: 'SUB-2', status: 'Ended', endedAt: '2026-10-30' }]
};
const profitRows = [
  { id: 'SO-1', customerId: 'C1', customer: 'Smith', date: '2026-10-05', done: true, sales: 550, cost: 360, profit: 190, missing: 0 },
  { id: 'SO-2', customerId: 'C2', customer: 'Hotel', date: '2026-10-20', done: true, sales: 200, cost: 0, profit: 200, missing: 1 },
  { id: 'SO-3', customerId: 'C1', customer: 'Smith', date: '2026-09-10', done: true, sales: 40, cost: 16, profit: 24, missing: 0 },
  { id: 'SO-4', customerId: 'C1', customer: 'Smith', date: '2026-10-25', done: false, sales: 999, cost: 0, profit: 999, missing: 0 },
  { id: 'SO-5', customerId: 'C2', customer: 'Hotel', date: '2025-10-15', done: true, sales: 300, cost: 100, profit: 200, missing: 0 } ];
let finance = false;
const ctx = { console, Date, Math, Number, String, JSON, Object, Array, Map, Intl, RegExp, Promise, setTimeout,
  __POOL_SHED_GET_DATA__: () => data, __POOL_SHED_CAN_ACCESS__: t => t === 'accounting' && finance,
  PoolShedProfit: { orderRows: () => profitRows, projectRows: () => [{ name: 'Pool build', status: 'Open', sales: 10000, profit: 1000, margin: 10 }, { name: 'Done', status: 'Completed', sales: 5000, profit: 2000, margin: 40 }] },
  PoolShedStockCost: { unitCost: p => p.avgCost != null ? p.avgCost : p.cost == null ? null : p.cost },
  PoolShedCoreStock: { needsOrder: () => [1, 2] },
  PoolShedQuoteStudio: { totals: q => ({ net: q.id === 'Q1' ? 4000 : 100 }) },
  PoolShedContracts: { monthly: () => 120, due: () => [1] },
  document: { addEventListener() {}, head: null } };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync('public/monthly-pack.js', 'utf8'), ctx);
const M = ctx.PoolShedMonthlyPack;
// Month maths.
assert.equal(M.shift('2026-01', -1), '2025-12'); assert.equal(M.shift('2026-10', -12), '2025-10'); assert.equal(M.shift('2026-12', 1), '2027-01');
assert.equal(M.label('2026-10'), 'October 2026');
assert.equal(M.defaultMonth(new Date('2026-11-21T10:00:00Z')), '2026-11', 'after the 7th: this month so far');
assert.equal(M.defaultMonth(new Date('2026-11-03T10:00:00Z')), '2026-10', 'first week: last month');
// Sales and profit: delivered or invoiced only (SO-4 is open), by order date.
const rows = profitRows.filter(r => r.done), oct = M.salesFor('2026-10', rows);
assert.equal(oct.count, 2); assert.equal(oct.sales, 750); assert.equal(oct.profit, 390); assert.equal(Math.round(oct.margin * 10) / 10, 52); assert.equal(oct.missing, 1);
assert.equal(M.salesFor('2025-10', rows).sales, 300, 'same month last year');
// Best customers and products.
const tc = M.topCustomers(oct.rows); assert.equal(tc[0].name, 'Hotel'); assert.equal(tc[0].profit, 200);
const tp = M.topProducts(oct.rows); assert.equal(tp[0].name, 'Pump'); assert.equal(tp[0].sales, 450, 'agreed price used'); assert(tp.some(p => p.name === 'Service' && p.sales === 200), 'custom lines counted');
assert.equal(tp.find(p => p.name === 'Chlorine').sales, 100, 'list price when no special price');
// Stock: average cost, vans listed, negative bins ignored, lines with no cost left out and counted.
const st = M.stock();
assert.equal(st.total, 2 * 320 + 10 * 8 + 400); assert.equal(st.byType.Vans, 80); assert.equal(st.vans['Van PB21'], 80); assert.equal(st.byType['Quarantine & returns'], 400);
assert.equal(st.noCost, 1); assert.equal(st.slow, 400, 'the old heater has not sold in 12 months'); assert.equal(st.reorder, 2);
// Purchasing: drafts and cancelled not counted as placed; receipts at line cost or recorded cost; late today.
const pu = M.purchasing('2026-10'); assert.equal(pu.raised, 1); assert.equal(pu.raisedValue, 620); assert.equal(pu.received, 310); assert.equal(pu.late, 1);
assert.equal(M.purchasing('2026-09').received, 300, 'recorded receipt cost used');
// Quotes and contracts.
const qu = M.quotes('2026-10'); assert.equal(qu.made, 2); assert.equal(qu.sent, 1); assert.equal(qu.won, 1); assert.equal(qu.wonValue, 4000); assert.equal(qu.open, 1);
const ct = M.contracts('2026-10'); assert.equal(ct.active, 1); assert.equal(ct.monthly, 120); assert.equal(ct.created, 1); assert.equal(ct.started, 1); assert.equal(ct.ended, 1); assert.equal(ct.due, 1);
// Ledger money: invoices less credits in the month, receipts, aged buckets, bills.
M._state.ledger = { docs: [{ doc_type: 'sales_invoice', doc_date: '2026-10-03', net: 1000 }, { doc_type: 'sales_credit', doc_date: '2026-10-08', net: 100 }, { doc_type: 'customer_receipt', doc_date: '2026-10-09', gross: 600 }, { doc_type: 'sales_invoice', doc_date: '2026-09-03', net: 50 }],
  aged: [{ customer: 'Smith', total: 500, not_due: 100, d1_30: 100, d31_60: 300, d61_90: 0, d90_plus: 0 }], bills: [{ outstanding: 80, due_date: '2020-01-01' }, { outstanding: 20, due_date: '2099-01-01' }, { outstanding: 0 }] };
const L = M.ledgerFor('2026-10'); assert.equal(L.invoiced, 900); assert.equal(L.invoices, 1); assert.equal(L.received, 600); assert.equal(L.aged.total, 500); assert.equal(L.weOwe, 100); assert.equal(L.weOweOverdue, 80);
// Page: money only for finance roles.
M._state.month = '2026-10';
let html = M.body(); assert(/October 2026/.test(html) && /Worth a look/.test(html) && /Best sellers/.test(html) && !/Customers owe us/.test(html), 'no money section without finance access');
assert(/1 order this month has a line with no cost, so profit is overstated for it/.test(html)); assert(/core stock lines need reordering/.test(html)); assert(/Pool build/.test(html), 'low-margin project flagged');
finance = true; M._state.loadedAt = Date.now(); html = M.body();
assert(/Customers owe us \(ledger\)/.test(html) && /£300/.test(html) && /more than 30 days overdue/.test(html), 'money section and overdue note for finance roles');
// Wiring.
const ac = fs.readFileSync('public/analytics-command-workspace.js', 'utf8'), index = fs.readFileSync('public/index.html', 'utf8'), sw = fs.readFileSync('public/service-worker.js', 'utf8');
assert(/const pages=\['Overview','Monthly Pack',/.test(ac) && /p==='Monthly Pack'&&global\.PoolShedMonthlyPack\?layout\('Monthly Pack'/.test(ac) && /data-ac-page=\\?"Monthly Pack\\?"/.test(ac), 'Reports → Monthly Pack');
assert(index.indexOf('monthly-pack.js') > index.indexOf('profit-report.js') && /monthly-pack\.js\?v=1\.71\.0/.test(sw), 'loaded and offline');
console.log('Monthly pack v1.64: sales, profit, comparisons, best sellers, stock by place, purchasing, quotes, contracts, ledger money for finance roles.');
