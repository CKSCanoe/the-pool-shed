/* Pool Shed receiving and "To order" (from v1.95).
   Receive delivery, on the PO itself: everything still to come is filled in; change only what is different (arrived,
   damaged, wrong item). Good stock goes to the shelf and is reserved for waiting orders, damaged stock goes to Quarantine,
   using the existing booking-in rules (warehouseBookDelivery). Then each damaged item gets a decision on the spot:
   the supplier sends a replacement (it stays on order at no cost), ask for a credit (raises a supplier return), or write it off.
   To order (Purchasing › To order): one list of everything to buy and why, grouped by supplier:
   customer orders waiting on stock, ◆ kept-in-stock products below their reorder point, and custom items on customer orders
   that are not on a PO yet. Create the PO from it (linked to the sales order), or export the list. */
(function(global){
'use strict';
if (typeof purchaseOrderDetailPage !== 'function' || typeof renderPurchase !== 'function') return;
var num = function(v){ var n = Number(v); return isFinite(n) ? n : 0; };
var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var gbp = function(v){ return typeof money === 'function' ? money(num(v)) : '£' + num(v).toFixed(2); };
var rs = global.poolShedReceiveState || { open: '', rows: {}, ref: '', note: '', damage: [], qty: {}, sup: {} };
global.poolShedReceiveState = rs;
function D(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? global.__POOL_SHED_GET_DATA__() : (typeof data !== 'undefined' ? data : {}); }
function toast2(m){ try { (global.toast || console.log)(m); } catch (_) {} }
function who(){ try { return (currentUser() || {}).name || 'Office'; } catch (_) { return 'Office'; } }
function poById(id){ return (D().purchaseOrders || []).find(function(p){ return p && p.id === id; }) || null; }
function keyOf(line){ return line.receiptLineId || line.productId; }
function pending(line){ return Math.max(0, num(line.qty) - num(line.received)); }
function nonStock(line){ return !!(line.nonStockPurchase || line.lineType === 'custom-purchase'); }
function prod(id){ try { return (typeof product === 'function' ? product(id) : null) || {}; } catch (_) { return {}; } }
function lineName(line){ var p = prod(line.productId); return line.customProductName || line.description || p.name || line.productId; }
function save(){ try { if (global.PoolShedPoList && global.PoolShedPoList.sync) global.PoolShedPoList.sync(); } catch (_) {} if (typeof saveAppData === 'function') saveAppData(); }
function draw(){ if (typeof render === 'function') render(); }

// ---------- receive delivery ----------
function row(po, line){ var k = po.id + '|' + keyOf(line); return rs.rows[k] || (rs.rows[k] = { arrived: pending(line), damaged: 0, wrong: false }); }
function goesTo(line, r){
  if (r.wrong) return 'Not booked in: wrong item recorded';
  var a = Math.max(0, num(r.arrived)), d = Math.min(a, Math.max(0, num(r.damaged))), good = a - d, out = [];
  if (!a) return pending(line) ? 'Stays on order' : '';
  if (nonStock(line)) return 'Cost only: not a stock item';
  if (good) out.push(good + ' to Main Warehouse' + (line.salesOrderId ? ', reserved for ' + line.salesOrderId : ''));
  if (d) out.push(d + ' to Quarantine');
  if (a < pending(line)) out.push((pending(line) - a) + ' still to come');
  return out.join(' · ');
}
function receivePanel(po){
  var lines = (po.lines || []).filter(function(l){ return pending(l) > 0; });
  if (!lines.length) return '<section class="rx-card"><header><div><h3>Receive delivery</h3><p>Everything on this order has been received.</p></div><button type="button" class="secondary" data-rx-close>Close</button></header></section>';
  var total = 0;
  var rows = lines.map(function(l){ var r = row(po, l), k = esc(po.id + '|' + keyOf(l)); if (!r.wrong) total += Math.max(0, num(r.arrived));
    return '<tr class="' + (r.wrong ? 'rx-wrong' : num(r.damaged) > 0 ? 'rx-dmg' : '') + '"><td><strong>' + esc(lineName(l)) + '</strong><small>' + esc([prod(l.productId).sku, l.supplierSku].filter(function(x){ return x && !/^CUSTOM/i.test(x); }).join(' · ')) + '</small></td>' +
      '<td class="num">' + pending(l) + '</td>' +
      '<td class="num"><input type="number" min="0" max="' + pending(l) + '" step="' + (nonStock(l) ? '0.01' : '1') + '" class="rx-in" data-rx="' + k + '|arrived" value="' + esc(r.arrived) + '"' + (r.wrong ? ' disabled' : '') + ' aria-label="Arrived"></td>' +
      '<td class="num"><input type="number" min="0" step="1" class="rx-in" data-rx="' + k + '|damaged" value="' + esc(r.damaged) + '"' + (r.wrong ? ' disabled' : '') + ' aria-label="Damaged"></td>' +
      '<td><label class="rx-check"><input type="checkbox" data-rx="' + k + '|wrong"' + (r.wrong ? ' checked' : '') + '> Wrong item</label></td>' +
      '<td class="rx-goes">' + esc(goesTo(l, r)) + '</td></tr>'; }).join('');
  return '<section class="rx-card" id="rxPanel"><header><div><h3>Receive delivery for ' + esc(po.id) + '</h3><p>Everything still to come is filled in: change only what is different.</p></div>' +
    '<div class="rx-meta"><input class="rx-ref" data-rx-ref value="' + esc(rs.ref) + '" placeholder="Delivery note number" aria-label="Delivery note number"><input class="rx-ref" data-rx-note value="' + esc(rs.note) + '" placeholder="Note (optional)" aria-label="Note"></div></header>' +
    '<div class="rx-wrap"><table class="rx-table"><thead><tr><th>Item</th><th class="num">Still to come</th><th class="num">Arrived</th><th class="num">Damaged</th><th></th><th>Goes to</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<footer><button type="button" class="secondary" data-rx-close>Cancel</button><button type="button" class="primary" data-rx-confirm="' + esc(po.id) + '">Confirm delivery · ' + total + ' item' + (total === 1 ? '' : 's') + '</button></footer></section>';
}
function damagePanel(po){
  var list = rs.damage.filter(function(x){ return x.poId === po.id; }); if (!list.length) return '';
  return '<section class="rx-card rx-damage"><header><div><h3>' + list.reduce(function(t, x){ return t + x.qty; }, 0) + ' damaged on delivery</h3><p>What should happen to each? The damaged stock is held in Quarantine until you decide.</p></div></header>' +
    list.map(function(x, i){ return '<div class="rx-dmg-row"><div><strong>' + esc(x.name) + '</strong><small>' + x.qty + ' damaged' + (x.ref ? ' · delivery ' + esc(x.ref) : '') + '</small></div><div class="rx-dmg-actions">' +
      '<button type="button" class="secondary" data-rx-damage="replace|' + i + '">Supplier sends a replacement</button><button type="button" class="secondary" data-rx-damage="credit|' + i + '">Ask for a credit</button><button type="button" class="secondary" data-rx-damage="writeoff|' + i + '">Keep it, write it off</button></div></div>'; }).join('') + '</section>';
}
function confirmDelivery(poId){
  var po = poById(poId); if (!po) return;
  var rows = [], dmg = [], err = '';
  (po.lines || []).filter(function(l){ return pending(l) > 0; }).forEach(function(l){
    var r = row(po, l), a = Math.max(0, num(r.arrived)), d = Math.max(0, Math.floor(num(r.damaged))), k = keyOf(l);
    if (r.wrong) { rows.push({ lineKey: k, qty: 0, decision: 'Wrong item' }); return; }
    if (a > pending(l) + 1e-9) err = err || lineName(l) + ': more arrived than is still to come (' + pending(l) + ').';
    if (d > a) err = err || lineName(l) + ': damaged can’t be more than arrived.';
    if (a - d > 0) rows.push({ lineKey: k, qty: a - d, decision: 'Accepted', destination: l.preferredLocationId || 'L-WH-A1' });
    if (d > 0) { rows.push({ lineKey: k, qty: d, decision: 'Damaged' }); dmg.push({ poId: po.id, lineKey: k, productId: l.productId, qty: d, name: lineName(l), nonStock: nonStock(l), ref: rs.ref }); }
  });
  if (err) return toast2(err);
  if (!rows.length) return toast2('Nothing to book in: enter what arrived.');
  if (typeof global.warehouseBookDelivery !== 'function') return toast2('Booking-in is not available on this screen.');
  var res = global.warehouseBookDelivery(po.id, rows, rs.ref, rs.note);
  if (!res || !res.ok) return toast2((res && res.error) || 'The delivery could not be booked in.');
  rs.damage = rs.damage.concat(dmg); rs.open = ''; rs.rows = {}; rs.ref = ''; rs.note = '';
  save();
  toast2(res.accepted + ' booked in' + (res.allocated ? ', ' + res.allocated + ' reserved for waiting orders' : '') + (res.damaged ? ', ' + res.damaged + ' to Quarantine' : '') + (res.wrongItem ? ', wrong item recorded' : '') + '.');
  draw();
}
function damageAction(kind, i){
  var x = rs.damage.filter(function(d){ return d.poId === selectedPoId(); })[i]; if (!x) return;
  var po = poById(x.poId), line = po && (po.lines || []).find(function(l){ return keyOf(l) === x.lineKey; }); if (!po || !line) return;
  var user = who(), done = '';
  if (kind === 'replace') {
    po.lines.push({ productId: line.productId, qty: x.qty, received: 0, unitCost: 0, supplierSku: line.supplierSku || '', salesOrderId: line.salesOrderId || '', projectId: line.projectId || '',
      customProductName: line.customProductName, description: line.description, lineType: line.lineType, nonStockPurchase: line.nonStockPurchase, uom: line.uom,
      receiptLineId: 'RPL-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), replacementFor: x.lineKey, orderedDate: new Date().toISOString().slice(0, 10), dueDate: po.due || '', supplierNotes: 'Replacement for ' + x.qty + ' damaged on delivery' + (x.ref ? ' ' + x.ref : '') });
    if (String(po.status) === 'Received') po.status = 'Part Received';
    done = 'Replacement for ' + x.qty + ' added to ' + po.id + ' at no cost: it shows as still to come. The damaged one stays in Quarantine to send back.';
  } else if (kind === 'credit') {
    if (!x.nonStock) {
      if (typeof removeStock !== 'function' || !removeStock(line.productId, 'L-QUARANTINE', x.qty)) return toast2('The damaged stock is no longer in Quarantine.');
      if (typeof addStock === 'function') addStock(line.productId, 'L-RETURNS-HOLD', x.qty, 0);
      if (typeof addMovement === 'function') addMovement('Quarantine to Returns Hold', line.productId, x.qty, 'L-QUARANTINE', 'L-RETURNS-HOLD', po.id, user, 'Damaged on delivery');
    }
    var r = typeof global.purchaseCreateSupplierReturn === 'function' ? global.purchaseCreateSupplierReturn({ poId: po.id, productId: x.lineKey, qty: x.qty, reason: 'Damaged on delivery', locationId: 'L-RETURNS-HOLD' }) : { ok: false, error: 'Supplier returns are not available.' };
    if (!r.ok) return toast2(r.error);
    done = r.return.id + ' raised for ' + gbp(r.return.expectedGrossCredit || 0) + ' credit. If a customer still needs it, it appears in To order.';
  } else if (kind === 'writeoff') {
    if (!x.nonStock) {
      if (typeof removeStock !== 'function' || !removeStock(line.productId, 'L-QUARANTINE', x.qty)) return toast2('The damaged stock is no longer in Quarantine.');
      if (typeof addMovement === 'function') addMovement('Write-off', line.productId, x.qty, 'L-QUARANTINE', '', po.id, user, 'Damaged on delivery, written off');
    }
    done = x.qty + ' written off.';
  }
  rs.damage.splice(rs.damage.indexOf(x), 1);
  save(); toast2(done); draw();
}
function selectedPoId(){ try { return selectedPurchaseOrderId; } catch (_) { return ''; } }

var baseDetail = purchaseOrderDetailPage;
purchaseOrderDetailPage = function(po){
  var html = baseDetail.apply(this, arguments);
  try {
    var extra = (rs.open === po.id ? receivePanel(po) : '') + damagePanel(po);
    if (extra) { var at = html.indexOf('</section>', html.indexOf('pof-bar')); html = at > 0 ? html.slice(0, at + 10) + extra + html.slice(at + 10) : extra + html; }
  } catch (e) { console.warn('Receive panel skipped', e); }
  return html;
};
global.purchaseOrderDetailPage = purchaseOrderDetailPage;

// ---------- To order ----------
function isStock(line){ return global.PoolShedStockFlow ? global.PoolShedStockFlow.isStock(line) : !!(line && line.productId && !line.lineType); }
function shippedQty(o, pid){ return (D().goodsNotes || []).filter(function(n){ return n && n.salesOrderId === o.id && n.shipped; }).reduce(function(t, n){ return t + (n.lines || []).filter(function(l){ return l.productId === pid; }).reduce(function(s, l){ return s + num(l.shipped || l.qty); }, 0); }, 0); }
function openPos(){ return (D().purchaseOrders || []).filter(function(po){ return !['Cancelled', 'Received'].includes(String(po.status || '')); }); }
function onOrderFor(pid, soId){ return openPos().reduce(function(t, po){ return t + (po.lines || []).filter(function(l){ return l.productId === pid && (soId === undefined || String(l.salesOrderId || '') === String(soId || '')); }).reduce(function(s, l){ return s + pending(l); }, 0); }, 0); }
function freeFor(pid){ var rows = typeof allocationRowsForSalesOrder === 'function' ? allocationRowsForSalesOrder(pid) : (D().stock || []).filter(function(r){ return r.productId === pid; }); return (rows || []).filter(function(r){ return !['L-QUARANTINE', 'L-RECEIVING', 'L-RETURNS-HOLD'].includes(r.locationId); }).reduce(function(t, r){ return t + Math.max(0, num(r.qty) - num(r.allocated)); }, 0); }
// delivered or closed orders never create buying: Invoice Ready means delivered, and invoicing ships what is left
function openOrder(o){ return !['Cancelled', 'Completed', 'Shipped', 'Invoiced', 'Invoice Ready', 'Quote'].includes(String(o.status || '')) && o.isCompleted !== true; }
function damagedCase(pid){ return (D().purchaseReturns || []).some(function(r){ return r.productId === pid && /damag/i.test(r.reason || '') && !['Closed', 'Cancelled'].includes(r.status); }); }
function toOrderRows(){
  var hub = global.PoolShedProductHub, out = [], kept = {};
  // 1. kept in stock, below the reorder point (already allows for orders waiting and stock on order)
  try { (hub ? hub.replenishmentRows({ needsOrder: true }) : []).forEach(function(r){ kept[r.productId] = 1;
    out.push({ key: 'k|' + r.productId, productId: r.productId, name: r.product.name, sku: r.product.sku, supplier: r.supplier, why: 'reorder', label: 'Below reorder point ' + r.projectedAvailable + ' ≤ ' + r.reorderPoint, free: r.available, onOrder: r.inbound, needed: r.suggestedQty, qty: r.suggestedQty, cost: num(r.unitCost) }); }); } catch (_) {}
  // 2. customer orders waiting on stock (products not kept in stock)
  var cover = {};
  (D().salesOrders || []).filter(openOrder).sort(function(a, b){ return String(a.due || '9').localeCompare(String(b.due || '9')); }).forEach(function(o){
    (o.lines || []).forEach(function(l){
      if (!l.productId) return;
      if (isStock(l)) {
        if (kept[l.productId]) return;
        var need = Math.max(0, num(l.qty) - shippedQty(o, l.productId) - num(l.allocated) - onOrderFor(l.productId, o.id)); if (!need) return;
        if (cover[l.productId] == null) cover[l.productId] = freeFor(l.productId) + onOrderFor(l.productId, '');
        var use = Math.min(need, cover[l.productId]); cover[l.productId] -= use; need -= use; if (!need) return;
        var p = prod(l.productId);
        out.push({ key: 's|' + o.id + '|' + l.productId, productId: l.productId, name: p.name || l.productId, sku: p.sku, supplier: p.preferredSupplier || p.supplier || '', why: damagedCase(l.productId) ? 'damage' : 'customer', label: (damagedCase(l.productId) ? 'Replacing damaged · ' : l.bundleRole === 'component' ? 'Part of ' + (l.bundleParentName || 'a bundle') + ' for ' : 'Customer order ') + o.id, soId: o.id, free: freeFor(l.productId), onOrder: onOrderFor(l.productId), needed: need, qty: need, cost: num(p.cost) });
      } else if (l.lineType === 'custom' && !l.noPurchaseNeeded) {
        // 3. custom items sold on an order that are not on any PO yet
        var bought = (D().purchaseOrders || []).filter(function(po){ return String(po.status) !== 'Cancelled'; }).reduce(function(t, po){ return t + (po.lines || []).filter(function(x){ return x.productId === l.productId; }).reduce(function(s, x){ return s + num(x.qty); }, 0); }, 0);
        var left = Math.max(0, num(l.qty) - bought); if (!left) return;
        out.push({ key: 'c|' + o.id + '|' + l.productId, productId: l.productId, name: l.customProductName || l.description || 'Custom item', sku: '', supplier: l.supplier || '', why: 'custom', label: 'Custom item for ' + o.id, soId: o.id, free: 0, onOrder: 0, needed: left, qty: left, cost: num(l.unitCost), custom: true, line: l, order: o });
      }
    });
  });
  out.forEach(function(r){ if (rs.qty[r.key] != null) r.qty = rs.qty[r.key]; if (rs.sup[r.key]) r.supplier = rs.sup[r.key]; });
  return out;
}
function suppliersList(){ var s = {}; (D().suppliers || []).forEach(function(x){ var n = x && (x.name || x.supplier); if (n) s[n] = 1; }); return Object.keys(s).sort(); }
function toOrderPage(){
  var rows = toOrderRows(), groups = {}, order = [];
  rows.forEach(function(r){ var g = r.supplier || ''; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(r); });
  order.sort(function(a, b){ return (a ? 0 : 1) - (b ? 0 : 1) || a.localeCompare(b); });
  var total = rows.reduce(function(t, r){ return t + r.qty * r.cost; }, 0), sups = suppliersList();
  var chip = { reorder: 'to-s2', customer: 'to-s1', damage: 'to-s3', custom: 'to-s4' };
  var body = order.map(function(g){
    var list = groups[g], sum = list.reduce(function(t, r){ return t + r.qty * r.cost; }, 0);
    var sup = (D().suppliers || []).find(function(s){ return s && (s.name === g || s.supplier === g); }) || {};
    return '<section class="to-sup"><header><b>' + (g ? esc(g) : 'Choose a supplier') + '</b><small>' + esc(g ? [sup.ordersEmail || sup.email || '', sup.leadTimeDays ? sup.leadTimeDays + ' days' : ''].filter(Boolean).join(' · ') : 'Pick the supplier on each line, then create the order') + '</small><span class="to-total">' + list.length + ' line' + (list.length === 1 ? '' : 's') + ' · ' + gbp(sum) + '</span>' +
      (g ? '<button type="button" class="primary" data-to-create="' + esc(g) + '">Create PO</button>' : '') + '</header>' +
      '<div class="to-wrap"><table class="to-table"><thead><tr><th>Item</th><th>Why</th><th class="num">Free</th><th class="num">On order</th><th class="num">Needed</th><th class="num">Order qty</th><th class="num">Cost</th>' + (g ? '' : '<th>Supplier</th>') + '<th></th></tr></thead><tbody>' +
      list.map(function(r){ return '<tr><td><strong>' + esc(r.name) + '</strong>' + (r.sku && !/^CUSTOM/i.test(r.sku) ? '<small>' + esc(r.sku) + '</small>' : '') + '</td><td><span class="to-why ' + chip[r.why] + '">' + esc(r.label) + '</span></td><td class="num">' + (r.custom ? '—' : r.free) + '</td><td class="num">' + (r.custom ? '—' : r.onOrder) + '</td><td class="num">' + r.needed + '</td>' +
        '<td class="num"><input type="number" min="0" step="1" class="to-qty" data-to-qty="' + esc(r.key) + '" value="' + r.qty + '" aria-label="Order quantity"></td><td class="num">' + gbp(r.qty * r.cost) + '</td>' +
        (g ? '' : '<td><select class="to-sel" data-to-sup="' + esc(r.key) + '"><option value="">Choose…</option>' + sups.map(function(n){ return '<option>' + esc(n) + '</option>'; }).join('') + '</select></td>') +
        '<td>' + (r.custom ? '<button type="button" class="link to-link" data-to-skip="' + esc(r.key) + '">Not bought in</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
  }).join('');
  var named = order.filter(Boolean).length;
  return '<div class="to-page"><header class="pl-head"><div><h2>To order</h2><p>' + rows.length + ' line' + (rows.length === 1 ? '' : 's') + ' · ' + named + ' supplier' + (named === 1 ? '' : 's') + ' · ' + gbp(total) + ' · updated as orders, deliveries and damage come in</p></div>' +
    '<div class="pl-head-actions"><button type="button" class="secondary" data-to-export>Export report</button>' + (named ? '<button type="button" class="primary" data-to-create="*">Create ' + named + ' purchase order' + (named === 1 ? '' : 's') + '</button>' : '') + '</div></header>' +
    (rows.length ? '<section class="pl-card">' + body + '</section>' : '<section class="pl-card to-empty"><strong>Nothing to order right now</strong><span>Customer orders waiting on stock, ◆ kept-in-stock products below their reorder point and custom items not yet on a PO appear here.</span></section>') +
    '<p class="pl-foot">Customer orders count stock that is free or already on order first, so only what is really short shows. Kept-in-stock products use their reorder levels.</p></div>';
}
function nextPoId(){ var d = D(); if (typeof nextPurchaseOrderId === 'function') return nextPurchaseOrderId(); var n = (d.purchaseOrders || []).map(function(p){ var m = String(p.id || '').match(/(\d+)/g); return m ? Number(m[m.length - 1]) : 0; }); return 'PO-' + String(Math.max.apply(null, [1000].concat(n)) + 1).padStart(4, '0'); }
function createFrom(supplier){
  var d = D(), rows = toOrderRows().filter(function(r){ return r.supplier && (supplier === '*' || r.supplier === supplier) && r.qty > 0; });
  if (!rows.length) return toast2('Nothing to order for that supplier.');
  var made = {}, today = new Date().toISOString().slice(0, 10);
  rows.forEach(function(r){
    var po = made[r.supplier] || (d.purchaseOrders || []).find(function(p){ return p.supplier === r.supplier && String(p.status) === 'Draft - Review' && p.source === 'To order'; });
    if (!po) { po = { id: nextPoId(), supplier: r.supplier, status: 'Draft - Review', source: 'To order', reviewStatus: 'Needs review', supplierEmailStatus: 'Blocked until reviewed', created: today, due: '', lines: [] }; (d.purchaseOrders = d.purchaseOrders || []).unshift(po); }
    made[r.supplier] = po;
    var line = (po.lines || []).find(function(x){ return x.productId === r.productId && String(x.salesOrderId || '') === String(r.soId || ''); });
    if (line) line.qty = num(line.qty) + r.qty;
    else { var p = prod(r.productId);
      po.lines.push({ productId: r.productId, qty: r.qty, received: 0, salesOrderId: r.soId || '', supplierSku: p.supplierSku || '', unitCost: r.cost, orderedDate: today, dueDate: r.order ? r.order.due || '' : '',
        customProductName: r.custom ? r.name : undefined, description: r.custom && r.line ? r.line.description : undefined, supplierNotes: r.label }); }
    delete rs.qty[r.key]; delete rs.sup[r.key];
  });
  try { if (global.PoolShedProductHub && global.PoolShedProductHub._resetCache) global.PoolShedProductHub._resetCache(); } catch (_) {}
  save();
  var ids = Object.keys(made).map(function(s){ return made[s].id; });
  toast2(ids.join(', ') + ' ready: approve it, then Send to supplier emails it.');
  if (ids.length === 1) { try { selectedPurchaseOrderId = ids[0]; purchaseOrderView = 'detail'; } catch (_) {} }
  draw();
}
function exportToOrder(){
  var out = [['Supplier', 'Item', 'SKU', 'Why', 'Sales order', 'Free', 'On order', 'Needed', 'Order qty', 'Unit cost', 'Line cost']];
  toOrderRows().forEach(function(r){ out.push([r.supplier || 'Choose a supplier', r.name, r.sku || '', r.label, r.soId || '', r.custom ? '' : r.free, r.custom ? '' : r.onOrder, r.needed, r.qty, r.cost.toFixed(2), (r.qty * r.cost).toFixed(2)]); });
  var csv = out.map(function(row){ return row.map(function(v){ v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = 'pool-shed-to-order-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  return out.length - 1;
}

var baseRender = renderPurchase;
renderPurchase = function(){
  try {
    var sub = typeof selectedSubPage === 'function' ? selectedSubPage('purchase') : (activeSubPage.purchase || '');
    if (sub === 'To Order' && (typeof purchaseOrderView === 'undefined' || purchaseOrderView === 'list')) {
      var screen = document.getElementById('screen-purchase'), html = toOrderPage(); if (screen) screen.innerHTML = html; return html;
    }
  } catch (e) { console.warn('To order fell back', e); }
  return baseRender.apply(this, arguments);
};
global.renderPurchase = renderPurchase;
if (typeof sidebarSubGroups === 'function') { var baseSubs = sidebarSubGroups; sidebarSubGroups = function(tabId){ var g = baseSubs.apply(this, arguments); if (tabId === 'purchase' && Array.isArray(g) && g.indexOf('To Order') < 0) g = ['To Order'].concat(g); return g; }; global.sidebarSubGroups = sidebarSubGroups; }

if (typeof document !== 'undefined') {
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('[data-po-open-receiving],[data-rx-close],[data-rx-confirm],[data-rx-damage],[data-to-create],[data-to-export],[data-to-skip]'); if (!t) return;
    var ds = t.dataset;
    if (ds.poOpenReceiving !== undefined) { var po = poById(ds.poOpenReceiving); if (!po) return; e.preventDefault(); e.stopImmediatePropagation();
      rs.open = po.id; rs.rows = {}; try { active = 'purchase'; selectedPurchaseOrderId = po.id; purchaseOrderView = 'detail'; } catch (_) {} draw();
      setTimeout(function(){ var p = document.getElementById('rxPanel'); if (p && p.scrollIntoView) p.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60); return; }
    e.preventDefault(); e.stopImmediatePropagation();
    if (ds.rxClose !== undefined) { rs.open = ''; rs.rows = {}; return draw(); }
    if (ds.rxConfirm) return confirmDelivery(ds.rxConfirm);
    if (ds.rxDamage) { var p2 = ds.rxDamage.split('|'); return damageAction(p2[0], Number(p2[1])); }
    if (ds.toCreate) return createFrom(ds.toCreate);
    if (ds.toExport !== undefined) { var n = exportToOrder(); return toast2(n + ' line' + (n === 1 ? '' : 's') + ' exported.'); }
    if (ds.toSkip) { var parts = ds.toSkip.split('|'), o = (D().salesOrders || []).find(function(x){ return x.id === parts[1]; }), l = o && (o.lines || []).find(function(x){ return x.productId === parts.slice(2).join('|'); });
      if (l) { l.noPurchaseNeeded = true; save(); toast2('Marked as not bought in: it won’t show here again.'); } return draw(); }
  }, true);
  document.addEventListener('input', function(e){
    var t = e.target.closest && e.target.closest('[data-rx],[data-rx-ref],[data-rx-note],[data-to-qty]'); if (!t) return;
    if (t.hasAttribute('data-rx-ref')) { rs.ref = t.value; return; } if (t.hasAttribute('data-rx-note')) { rs.note = t.value; return; }
    if (t.dataset.toQty) { rs.qty[t.dataset.toQty] = Math.max(0, Math.floor(num(t.value))); return; }
    var p = t.dataset.rx.split('|'), field = p.pop(), k = p.join('|'); if (field === 'wrong') return; var r = rs.rows[k] || (rs.rows[k] = { arrived: 0, damaged: 0, wrong: false }); r[field] = t.value;
    var tr = t.closest('tr'), cell = tr && tr.querySelector('.rx-goes'), po = poById(p[0]), line = po && (po.lines || []).find(function(l){ return keyOf(l) === p.slice(1).join('|'); }); if (cell && line) cell.textContent = goesTo(line, r);
    var btn = document.querySelector('[data-rx-confirm]'); if (btn) { var tot = 0; Object.keys(rs.rows).forEach(function(kk){ if (kk.indexOf(p[0] + '|') === 0 && !rs.rows[kk].wrong) tot += Math.max(0, num(rs.rows[kk].arrived)); }); btn.textContent = 'Confirm delivery · ' + tot + ' item' + (tot === 1 ? '' : 's'); }
  });
  document.addEventListener('change', function(e){
    var t = e.target.closest && e.target.closest('[data-rx],[data-to-qty],[data-to-sup]'); if (!t) return;
    if (t.dataset.toQty) { rs.qty[t.dataset.toQty] = Math.max(0, Math.floor(num(t.value))); return draw(); }
    if (t.dataset.toSup) { rs.sup[t.dataset.toSup] = t.value; return draw(); }
    var p = t.dataset.rx.split('|'), field = p.pop(), k = p.join('|'); if (field !== 'wrong') return; var r = rs.rows[k] || (rs.rows[k] = { arrived: 0, damaged: 0, wrong: false }); r.wrong = t.checked; draw();
  });
}
global.PoolShedReceive = { receivePanel: receivePanel, confirmDelivery: confirmDelivery, damageAction: damageAction, toOrderRows: toOrderRows, toOrderPage: toOrderPage, createFrom: createFrom, state: rs, goesTo: goesTo };
})(typeof window !== 'undefined' ? window : globalThis);
