// v1.83 Overhaul phase 3: record pages. Purchase order flow bar with next step, line pictures with icon fallback,
// one header card for every record, palette colours in the sales order flow bar.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const read = f => fs.readFileSync(f, 'utf8');
const src = read('public/purchase-order-flow.js');
const ctx = { console, document: { addEventListener(){} }, purchaseOrderDetailPage: po => '<div><header>H</header><main>M</main></div>', purchaseOrderPaymentStatus: po => po.pay || 'Unpaid' };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
const F = ctx.PoolShedPurchaseFlow, cur = po => (F.flow(po).current || {}).key || 'done';
const lines = [{ qty: 4, received: 0 }];
assert.equal(cur({ status: 'Draft - Review', lines }), 'approved');
assert.equal(cur({ status: 'Ready to Order', lines }), 'sent');
assert.equal(cur({ status: 'Sent', lines }), 'confirmed');
assert.equal(cur({ status: 'Sent', supplierReference: 'S-1', lines }), 'received', 'a supplier reference counts as confirmed');
assert.equal(cur({ status: 'Part Received', lines: [{ qty: 4, received: 2 }] }), 'received');
assert.equal(cur({ status: 'Received', lines: [{ qty: 4, received: 4 }] }), 'paid');
assert.equal(cur({ status: 'Received', lines: [{ qty: 4, received: 4 }], pay: 'Paid' }), 'done');
assert.equal(cur({ status: 'Draft - Review', lines: [{ qty: 4, received: 1 }] }), 'received', 'goods already in means it was approved and sent');
const html = ctx.purchaseOrderDetailPage({ id: 'PO-1', status: 'Draft - Review', lines });
assert.ok(html.indexOf('</header><section class="pof-bar"') > 0, 'bar sits under the header');
assert.ok(html.includes('data-pof-status="PO-1|Ready to Order">Approve order<'));
assert.ok(F.bar({ id: 'PO-2', status: 'Cancelled', lines }).includes('Cancelled.'));
assert.ok(src.includes("[].some.call(sel.options, function(o){ return o.value === status; })"), 'only statuses that exist are set');
assert.ok(src.includes("'[data-po-save-action=\"email|' + em.dataset.pofEmail + '\"]'") && src.includes("'[data-po-open-receiving=\"' + rc.dataset.pofReceive + '\"]'"), 'uses the existing Email / Print and Book delivery');
const index = read('public/index.html'); assert.ok(index.indexOf('purchase-order-flow.js') > index.indexOf('purchase-workspace.js'));
// Line pictures
const sw = read('public/sales-workspace.js'), pw = read('public/purchase-workspace.js');
assert.ok(sw.includes("if (!source) return '<span class=\"so5-line-thumb is-icon\">' + icon('package') + '</span>';") && sw.includes("PI.markup(p, { mode: 'variant', className: 'line-thumb-img'"));
assert.ok(pw.includes("if (!source) return '<span class=\"po-line-thumb is-icon\">' + icon('package') + '</span>';") && pw.includes('po-custom-thumb is-icon'));
// Header card and palette
const css = read('public/assets/css/system/75-overhaul-records.css');
assert.ok(css.includes(':is(.so3-command-header,.po-command-head,.crm-hero,.ph-product-hero,.pl-heading,.sc-profile-hero){background:var(--color-surface-default) !important;background-image:none !important'));
const sof = read('public/sales-order-flow.js'); assert.ok(!/#[0-9a-fA-F]{3,6}\b|rgba\(/.test(sof), 'sales order flow bar uses the palette');
console.log('Overhaul 3 v1.83: purchase order flow and next step, line pictures, one header card, palette colours.');
