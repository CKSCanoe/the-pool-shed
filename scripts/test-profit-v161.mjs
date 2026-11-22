// v1.61 project billing and profit: stage invoices on the ledger (one per stage), average and landed cost on goods in,
// profit by order / project / customer / month with stock at average cost, and the wiring.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// ---------- Migration 033 ----------
const sql = fs.readFileSync('database/033-project-stage-billing.sql', 'utf8').replace(/--.*$/gm, '');
assert(/create trigger ps_job_phase_guard before insert on public\.ps_ledger_documents/.test(sql), 'stage guard runs on every new document');
assert(/This stage is already invoiced/.test(sql) && /\(b->>'net'\)::numeric > 0/.test(sql), 'a stage still billed cannot be invoiced again');
assert(/doc_type = 'sales_credit'[\s\S]*\(c\.meta->>'credits'\)::uuid = i\.id/.test(sql), 'credit notes free the stage');
assert(/'billed_net', \(b->>'net'\)::numeric, 'invoices', b->'documents'/.test(sql), 'each stage lists its invoices');
assert(/v->>'status' = 'Approved'/.test(sql), 'contract still counts approved extras only');
const billing = sql.slice(sql.indexOf('function public.ps_job_billing('), sql.indexOf('end $$;', sql.indexOf('function public.ps_job_billing(')));
assert(/ps_ledger_require_finance\(w\)/.test(billing), 'project billing is for finance roles only');
for (const fn of ['ps_job_phase_billed\\(text,text,text\\)', 'ps_job_contract\\(text,text\\)', 'ps_job_phase_guard\\(\\)'])
  assert(new RegExp('revoke all on function public\\.' + fn + ' from public, anon, authenticated;').test(sql), fn + ' is internal only');
assert(/grant execute on function public\.ps_job_billing\(text,text\) to authenticated/.test(sql));

// ---------- Average and landed cost on goods in ----------
const data = {
  products: [{ id: 'P1', sku: 'PUMP', cost: 100 }, { id: 'P2', sku: 'CHL', cost: 10 }, { id: 'P3', sku: 'NEW', cost: 0 }, { id: 'P4', sku: 'NOCOST' }],
  stock: [{ productId: 'P1', locationId: 'A', qty: 2 }, { productId: 'P1', locationId: 'B', qty: -1 }],
  purchaseOrders: [], salesOrders: [], customers: [{ id: 'C1', name: 'Smith' }, { id: 'C2', name: 'Jones' }], jobs: []
};
let calls = 0;
const ctx = { console, Date, Math, Number, String, JSON, Object, Array, Map, Set, Intl, RegExp,
  __POOL_SHED_GET_DATA__: () => data,
  recordPurchaseReceipt(po, line, qty) { calls++; const row = data.stock.find(s => s.productId === line.productId && s.locationId === 'A'); if (row) row.qty += qty; else data.stock.push({ productId: line.productId, locationId: 'A', qty }); return { id: 'E' + calls, qty }; } };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/stock-costing.js', 'utf8'), ctx);
const SC = ctx.PoolShedStockCost;
const po = { id: 'PO1', lines: [
  { productId: 'P1', receiptLineId: 'L1', qty: 4, unitCost: 120 },
  { productId: 'P2', receiptLineId: 'L2', qty: 20, unitCost: 16 },
  { productId: 'POCUSTOM-1', lineType: 'custom-purchase', nonStockPurchase: true, customProductName: 'Pallet delivery', qty: 1, unitCost: 80 },
  { productId: 'POCUSTOM-2', lineType: 'custom-purchase', nonStockPurchase: true, customProductName: 'Crane hire', qty: 1, unitCost: 500 },
  { productId: 'POCUSTOM-3', lineType: 'custom-purchase', nonStockPurchase: true, customProductName: 'Delivery to site', qty: 1, unitCost: 40, projectId: 'J1' } ] };
// Stock value 4×120 + 20×16 = 800; landed charges 80 (crane hire is not a delivery charge, site delivery is a project cost) -> +10%.
const c = SC.landedUnit(po, po.lines[0], data);
assert.equal(c.unit, 120); assert.equal(c.landed, 132); assert.equal(c.charges, 80);
assert.equal(SC.isCharge(po.lines[3]), false); assert.equal(SC.isCharge(po.lines[4]), false, 'charges on a project stay project costs');
// Receive 4 pumps with 2 on hand (negative bins ignored) at cost 100: (2×100 + 4×132) ÷ 6 = 121.3333
const ev = ctx.recordPurchaseReceipt(po, po.lines[0], 4, 'A', 0, {});
assert.equal(calls, 1, 'the original receipt still runs');
assert.equal(data.products[0].avgCost, 121.3333); assert.equal(data.products[0].cost, 100, 'the cost price is never changed');
assert.equal(ev.landedUnitCost, 132); assert.equal(ev.avgCostBefore, 100); assert.equal(ev.avgCostAfter, 121.3333); assert.equal(ev.onHandBefore, 2);
// Nothing on hand: average is the landed cost. No usable earlier cost: same.
ctx.recordPurchaseReceipt(po, po.lines[1], 20, 'A', 0, {}); assert.equal(data.products[1].avgCost, 17.6);
assert.equal(SC.unitCost(data.products[1]), 17.6); assert.equal(SC.unitCost(data.products[3]), null, 'no cost at all stays unknown');
// Non-stock lines and refused receipts are left alone.
const before = JSON.stringify(data.products);
ctx.recordPurchaseReceipt(po, po.lines[2], 1, 'A', 0, {}); assert.equal(JSON.stringify(data.products), before);
ctx.recordPurchaseReceipt = (function(orig){ return orig; })(ctx.recordPurchaseReceipt);

// ---------- Profit ----------
data.salesOrders = [
  { id: 'SO-1', customerId: 'C1', status: 'Shipped', date: new Date().toISOString().slice(0, 10), lines: [{ productId: 'P1', qty: 1 }, { productId: 'P2', qty: 5 }, { lineType: 'shipping', productId: 'SHIP', qty: 1 }] },
  { id: 'SO-2', customerId: 'C2', status: 'Invoiced', date: '2026-01-05', lines: [{ productId: 'P4', qty: 2 }] },
  { id: 'SO-5', customerId: 'C2', status: 'Completed', date: new Date().toISOString().slice(0, 10), lines: [{ lineType: 'custom', productId: 'CUSTOM-A', qty: 1, unitCost: 175 }, { lineType: 'custom', productId: 'CUSTOM-B', qty: 2, unitCost: 0 }] },
  { id: 'SO-3', customerId: 'C1', status: 'Open', date: new Date().toISOString().slice(0, 10), lines: [{ productId: 'P2', qty: 1 }] },
  { id: 'SO-4', customerId: 'C1', status: 'Cancelled', date: new Date().toISOString().slice(0, 10), lines: [{ productId: 'P2', qty: 1 }] } ];
data.purchaseOrders = [{ id: 'PO9', status: 'Received', lines: [{ productId: 'P2', qty: 2, unitCost: 15, salesOrderId: 'SO-1' }] }];
ctx.PoolShedFinanceCommand = { orderProfitRows: () => [
  { orderId: 'SO-1', customerId: 'C1', customerName: 'Smith', status: 'Shipped', revenueNet: 300, linkedCostNet: 30, linkedPOs: ['PO9'] },
  { orderId: 'SO-2', customerId: 'C2', customerName: 'Jones', status: 'Invoiced', revenueNet: 50, linkedCostNet: 0, linkedPOs: [] },
  { orderId: 'SO-5', customerId: 'C2', customerName: 'Jones', status: 'Completed', revenueNet: 400, linkedCostNet: 0, linkedPOs: [] },
  { orderId: 'SO-3', customerId: 'C1', customerName: 'Smith', status: 'Open', revenueNet: 20, linkedCostNet: 0, linkedPOs: [] },
  { orderId: 'SO-4', customerId: 'C1', customerName: 'Smith', status: 'Cancelled', revenueNet: 20, linkedCostNet: 0, linkedPOs: [] } ] };
ctx.isNonStockSalesLine = l => !!l.lineType;
ctx.psProjectSummary = () => ({ revenue: 1000000, actual: 250000, forecast: 700000, profit: 300000, margin: 30, missingCosts: 0 });
data.jobs = [{ id: 'J1', name: 'Pool build', customerId: 'C1', status: 'Open', project: {} }, { id: 'J2', name: 'Old', status: 'Cancelled', project: {} }];
ctx.document = { addEventListener() {}, head: null };
vm.runInContext(fs.readFileSync('public/profit-report.js', 'utf8'), ctx);
const P = ctx.PoolShedProfit, rows = P.orderRows();
assert.deepEqual(rows.map(r => r.id), ['SO-1', 'SO-2', 'SO-5', 'SO-3'], 'cancelled orders left out');
assert.equal(rows[2].stockCost, 175, 'custom lines use the cost on the line'); assert.equal(rows[2].missing, 1, 'a custom line with no cost is flagged, not 100% profit');
const so1 = rows[0];
// 1 pump from stock at 121.3333 + 3 chlorine from stock at 17.6 (2 bought in on PO9 for £30); shipping is not stock.
assert.equal(so1.stockCost, 174.13); assert.equal(so1.cost, 204.13); assert.equal(so1.profit, 95.87); assert.equal(so1.basis, 'Bought in + stock');
assert.equal(rows[1].missing, 1, 'a line with no cost is flagged'); assert(/Cost missing/.test(rows[1].basis));
P._ui.period = 'all';
const cust = P.byCustomer(); assert.equal(cust[0].label, 'Smith', 'customers include their projects');
assert.equal(cust[0].sales, 10300, 'Smith: delivered order 300 + project 10,000 (open order left out)');
P._ui.done = false; assert.equal(P.byCustomer()[0].sales, 10320, 'open orders counted when asked');
P._ui.done = true; P._ui.period = 'month';
assert.equal(P.byMonth().length, 1, 'only this month'); assert.equal(P.byMonth()[0].count, 2, 'this month: SO-1 and SO-5'); assert.equal(P.projectRows().length, 1, 'cancelled projects left out');
let html = P.page(); assert(/By project/.test(html) && /Download CSV/.test(html) && /SO-1/.test(html) && !/SO-2/.test(html));
P._ui.view = 'project'; html = P.page(); assert(/Pool build/.test(html) && /£3,000\.00/.test(html));
P._ui.view = 'order'; P._ui.period = 'all'; html = P.page(); assert(/check cost/.test(html), 'missing cost shown, not 100% margin');

// ---------- Wiring ----------
const pb = fs.readFileSync('public/project-billing.js', 'utf8'), pw = fs.readFileSync('public/project-workspace.js', 'utf8'), si = fs.readFileSync('public/sales-invoicing-workspace.js', 'utf8'),
  fc = fs.readFileSync('public/finance-command-workspace.js', 'utf8'), pe = fs.readFileSync('public/project-engine.js', 'utf8'), index = fs.readFileSync('public/index.html', 'utf8'), sw = fs.readFileSync('public/service-worker.js', 'utf8');
assert(!/psFinanceRequest\('queue'/.test(pb), 'stage invoices no longer queue Xero drafts');
assert(/PoolShedSalesUI\.inlineStage\(jobId,phaseId\)/.test(pb) && /recommendation\?\.ready/.test(pb), 'ready check kept, then the ledger form');
assert(/rpc\('ps_job_billing'/.test(pb) && /psProjectLedgerSummary/.test(pw) && /Raise invoice/.test(pw), 'project page shows the ledger position');
assert(/inlineStage: inlineStage/.test(si) && /markPhase\(p\.id, String\(fd\.get\('phase'\)/.test(si) && /ph\.ledgerInvoice = docNumber/.test(si), 'stage marked with its invoice number');
assert(/' disabled' : ''\) \+ \(pick && pick\.id === ph\.id/.test(si), 'invoiced stages cannot be picked again');
assert(/!!ph\.ledgerInvoice\|\|docs\.some/.test(pe), 'close-out accepts ledger stage invoices');
assert(/global\.PoolShedProfit\.page\(\)/.test(fc), 'Accounts → Order Profit shows the new Profit page');
assert(index.indexOf('stock-costing.js') > index.indexOf('01-legacy-01.js') && index.indexOf('profit-report.js') > 0, 'loaded');
assert(/stock-costing\.js\?v=1\.69\.0/.test(sw) && /profit-report\.js\?v=1\.69\.0/.test(sw), 'available offline');
console.log('Project billing and profit v1.61: one invoice per stage, average + landed cost on goods in, profit by order/project/customer/month.');
