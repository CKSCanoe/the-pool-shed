// v1.94 purchase orders: status follows what really happened, aligned list with tabs and chips, one add-item bar on the PO page.
import fs from 'node:fs';
import assert from 'node:assert';
const js = fs.readFileSync('public/purchase-workspace.js', 'utf8');
const css = fs.readFileSync('public/assets/css/system/80-purchase-orders.css', 'utf8');
assert(fs.readFileSync('scripts/css-modules.mjs', 'utf8').includes('80-purchase-orders.css'), 'styles built');
const grab = name => { const i = js.indexOf('  function ' + name + '('); assert(i >= 0, name); let d = 0, j = js.indexOf('{', i); for (; j < js.length; j++) { if (js[j] === '{') d++; else if (js[j] === '}' && --d === 0) break; } return js.slice(i, j + 1); };
const code = ['poStage', 'poSyncStatuses', 'poInTab'].map(grab).join('\n');
const sum = po => (po.lines || []).reduce((s, l) => { s.ordered += l.qty; s.received += l.received || 0; s.pending += Math.max(0, l.qty - (l.received || 0)); return s; }, { ordered: 0, received: 0, pending: 0 });
const data = { purchaseOrders: [
  { id: 'P1', status: 'Draft - Review', lines: [{ qty: 25, received: 17 }] },
  { id: 'P2', status: 'Draft - Review', lines: [{ qty: 2 }] },
  { id: 'P3', status: 'Sent', lines: [{ qty: 3, received: 3 }], paid: true },
  { id: 'P4', status: 'Supplier Confirmed', lines: [{ qty: 1 }] },
  { id: 'P5', status: 'Cancelled', lines: [{ qty: 4 }] },
  { id: 'P6', status: 'Ready to Order', lines: [{ qty: 1 }] }
] };
const f = new Function('data', 'poSummarySafe', 'poFinancialsSafe', 'poPaymentState', 'poFilterDateDistance', code + '; return { poStage, poSyncStatuses, poInTab };');
const P = f(data, sum, po => ({ balance: po.paid ? 0 : 100, gross: 120, net: 100 }), po => po.paid ? 'Paid' : 'Unpaid', () => null);
const st = id => P.poStage(data.purchaseOrders.find(p => p.id === id)).label;
assert.deepEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map(st), ['Part received', 'Draft', 'Closed', 'Confirmed', 'Cancelled', 'Approved'], 'stage from facts');
assert.equal(P.poSyncStatuses(), 2, 'stored status brought in step where goods were booked in');
assert.deepEqual(data.purchaseOrders.map(p => p.status), ['Part Received', 'Draft - Review', 'Received', 'Supplier Confirmed', 'Cancelled', 'Ready to Order'], 'drafts and cancelled left alone');
assert.equal(P.poSyncStatuses(), 0, 'runs once, then nothing to change');
const tab = t => data.purchaseOrders.filter(p => P.poInTab(p, t)).map(p => p.id).join(',');
assert.equal(tab('draft'), 'P2,P6'); assert.equal(tab('sent'), 'P4'); assert.equal(tab('part'), 'P1'); assert.equal(tab('closed'), 'P3,P5'); assert.equal(tab('topay'), 'P1');
assert(/data-open-po-detail="'\+poEsc\(po\.id\)\+'">'\+poEsc\(po\.id\)/.test(js) && /id="poListFilterSearch"/.test(js) && /po-list-table-wrap/.test(js), 'saved views and bulk export still find the list');
assert(/data-po-line-menu="'\+menuId\+'"/.test(js) && /class="danger-button" data-delete-po/.test(js), 'row actions in a menu, delete only when allowed');
assert(/date passed/.test(js) && / late<\/small>/.test(js), 'late only once sent');
assert(/placeholder="Add a product: name, SKU, supplier code or barcode"/.test(js) && /or add a custom item/.test(js) && !/\+ Add custom PO line/.test(js), 'one add-item bar with the custom item beside it');
assert(/<th>Item<\/th><th>For<\/th><th>Received<\/th>/.test(js) && !/<th>Supplier item<\/th>/.test(js), 'supplier code folded into the item cell');
assert(/\.pl-table/.test(css) && /\.pi-add/.test(css), 'styles');
assert(/button:not\(\.secondary\):not\(\.danger-button\)/.test(fs.readFileSync('public/assets/css/system/68-pool-shed-kit.css', 'utf8')), 'Delete PO is never the main button');
console.log('PO list v1.94: status from facts, aligned list with tabs and chips, tidy items area.');
