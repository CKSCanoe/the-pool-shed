// v1.84 Overhaul phase 4: in-app dialogs instead of browser prompts in the daily flows, and keyboard shortcuts.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = f => fs.readFileSync(f, 'utf8');
const dlg = read('public/ps-dialog.js'), keys = read('public/ps-shortcuts.js');
for (const s of ['ask: function(opts)', 'confirm: function(opts)', 'info: function(opts)', 'reason: function(title, message, label)']) assert.ok(dlg.includes(s), s);
assert.ok(dlg.includes("if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(fields.length ? null : false); return; }"), 'Esc cancels');
assert.ok(dlg.includes("var cancelBtn = form.querySelector('.psd-cancel'); if (cancelBtn)"), 'information box (no Cancel button) still wires Esc');
assert.ok(dlg.includes("'Fill in: ' + missing.map("), 'required answers are checked');
assert.ok(/esc\(opts\.title/.test(dlg) && /esc\(opts\.message\)/.test(dlg) && dlg.includes("never user or customer text"), 'titles and messages escaped; html only from our own code');
// My work: no browser prompts left in the action handler
const mw = read('public/my-work-workspace.js');
assert.ok(mw.includes("title:'Snooze until'") && mw.includes("['1','Tomorrow'],['3','In 3 days'],['7','In a week'],['14','In 2 weeks']"));
assert.ok(mw.includes("title:'Mark as waiting'") && mw.includes("r=a.complete(b.dataset.actionComplete,{note:''})"), 'Mark done without a note box');
assert.ok(!mw.includes("promptText('Snooze") && !mw.includes("promptText('Why is this action waiting") && !mw.includes("promptText('Completion note"));
// Sales and purchase order line removal, supplier returns, deletions: one dialog each
const sw = read('public/sales-workspace.js'), pw = read('public/purchase-workspace.js'), l1 = read('public/assets/js/01-legacy-01.js');
assert.ok(sw.includes('async function so2RemoveSalesOrderLine(') && sw.includes('async function so2RemoveSelectedSalesOrderLines(') && sw.includes("const reason=await so2AskRemoval("));
assert.ok(!/prompt\('Reason for removing “'\+label/.test(sw.replace('const reason=String(prompt(title', '')), 'old sales removal prompt gone');
assert.ok(pw.includes('async function removePurchaseOrderLine(') && pw.includes("title:'Remove line',message:warning"));
assert.ok(pw.includes("title:'Supplier credit received'") && pw.includes("{name:'amount',label:'Credit value, net (£)',type:'number'"), 'credit asks reference and amount together');
for (const fn of ['deleteSalesOrderPayment(orderId, paymentId)', 'deletePurchaseOrder(poId)', 'deletePurchaseOrderPayment(poId, paymentId)']) assert.ok(l1.includes('async function ' + fn), fn);
assert.equal((l1.match(/const reason = await deletionReason\(/g) || []).length, 3);
// Shortcuts
for (const s of ["key.toLowerCase() === 's'", "key === 'Enter'", "key === '/'", "key === '?'", "key === 'n' || key === 'N'"]) assert.ok(keys.includes(s), s);
assert.ok(keys.includes("if (mod || e.altKey || typing(e) || dialogOpen()) return;"), 'letters never fire while typing or with a box open');
assert.ok(keys.includes("h: ['dashboard', '', 'Home'], o: ['salesorders', 'Sales Orders'"));
assert.ok(read('public/sales-order-flow.js').includes('class="primary sof-next" title="Ctrl+Enter"') && read('public/purchase-order-flow.js').includes('title="Ctrl+Enter"'));
const index = read('public/index.html'); assert.ok(index.indexOf('ps-dialog.js') > 0 && index.indexOf('ps-shortcuts.js') > index.indexOf('ps-dialog.js'));
console.log('Overhaul 4 v1.84: in-app dialogs in the daily flows, keyboard shortcuts and sheet.');
