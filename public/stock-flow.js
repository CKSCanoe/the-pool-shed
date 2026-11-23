/* Pool Shed stock flow (from v1.89). Keeps stock connected to sales without extra clicks:
   - Stock is reserved for an order as soon as an item is added, when there is free stock (the order's status is left alone).
   - Custom lines, delivery charges and products that are not stock-controlled never hold an allocation: there is no stock to reserve.
   - A cancelled or completed order gives its reserved stock back.
   - Invoicing ships whatever has not gone yet: stock comes off the shelf and a shipped goods note is kept, so returns and credits work.
     If the shelf shows less than was sold, the goods still ship with the invoice and the order notes how many had no stock recorded.
   The warehouse steps (pick, pack, ship) still work exactly as before for orders that need them. */
(function(global){
'use strict';
if (typeof salesOrder !== 'function' || typeof isNonStockSalesLine !== 'function') return;
var num = function(v){ var n = Number(v); return isFinite(n) ? n : 0; };
var HOLD = ['L-QUARANTINE', 'L-RECEIVING', 'L-RETURNS-HOLD'];
var CLOSED = ['Cancelled', 'Completed'];
function D(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? global.__POOL_SHED_GET_DATA__() : (typeof data !== 'undefined' ? data : {}); }
function who(){ try { var u = typeof currentUser === 'function' ? currentUser() : null; return (u && (u.name || u.email)) || 'Office'; } catch (_) { return 'Office'; } }
function isStock(line){ return !!(line && line.productId && !isNonStockSalesLine(line)); }
function rows(productId, orderId){
  var list = typeof allocationRowsForSalesOrder === 'function' ? allocationRowsForSalesOrder(productId, orderId) : (D().stock || []).filter(function(r){ return r.productId === productId; });
  return (list || []).filter(function(r){ return r && HOLD.indexOf(r.locationId) < 0; });
}
function free(row){ return Math.max(0, num(row.qty) - num(row.allocated)); }
function freeFor(productId, orderId){ return rows(productId, orderId).reduce(function(t, r){ return t + free(r); }, 0); }
function shippedFor(order, productId){
  return (D().goodsNotes || []).filter(function(n){ return n && n.salesOrderId === order.id && n.shipped; }).reduce(function(t, n){
    return t + (n.lines || []).filter(function(l){ return l.productId === productId; }).reduce(function(s, l){ return s + num(l.shipped || l.qty); }, 0); }, 0);
}
function release(order, line, qty, reason){
  if (!(qty > 0)) return 0;
  if (typeof releaseAllocatedStockForLine === 'function') return releaseAllocatedStockForLine(order, line, qty, reason);
  var got = typeof releaseAllocatedStock === 'function' ? releaseAllocatedStock(line.productId, qty, order.id) : 0;
  line.allocated = Math.max(0, num(line.allocated) - got); return got;
}

// Reserve free stock for the stock lines that still need it. Never changes the order's status.
function autoAllocate(order){
  if (!order || CLOSED.indexOf(order.status) >= 0 || order.status === 'Invoiced' || typeof allocateSalesOrderLine !== 'function') return 0;
  var status = order.status, before = 0, after = 0;
  (order.lines || []).filter(isStock).forEach(function(line){
    var need = Math.max(0, num(line.qty) - shippedFor(order, line.productId) - num(line.allocated));
    if (!need || !freeFor(line.productId, order.id)) return;
    before += num(line.allocated); allocateSalesOrderLine(order.id, line.productId, true); after += num(line.allocated);
  });
  order.status = status;
  return after - before;
}

// The housekeeping that keeps reserved stock honest. Safe to run any time; only changes what is wrong.
function tidy(){
  var changed = 0;
  (D().salesOrders || []).forEach(function(order){
    (order.lines || []).forEach(function(line){
      if (!isStock(line) && num(line.allocated) > 0) { line.allocated = 0; changed++; }
      else if (isStock(line) && CLOSED.indexOf(order.status) >= 0 && num(line.allocated) > 0) { release(order, line, num(line.allocated), order.status === 'Cancelled' ? 'Order cancelled' : 'Order completed'); line.allocated = 0; changed++; }
    });
  });
  return changed;
}

function noteId(){
  var notes = D().goodsNotes || [], id = typeof nextGoodsNoteId === 'function' ? nextGoodsNoteId() : 'GN-' + String(55 + notes.length).padStart(4, '0'), n = 55 + notes.length;
  while (notes.some(function(x){ return x && x.id === id; })) { n++; id = 'GN-' + String(n).padStart(4, '0'); }
  return id;
}

// Ship everything on the order that has not shipped yet, as part of invoicing.
function shipOnInvoice(order){
  var out = { units: 0, noStock: 0, note: null };
  if (!order) return out;
  var d = D(); if (!Array.isArray(d.goodsNotes)) d.goodsNotes = [];
  var todo = (order.lines || []).filter(isStock).map(function(line){ return { line: line, qty: Math.max(0, num(line.qty) - shippedFor(order, line.productId)) }; }).filter(function(x){ return x.qty > 0; });
  if (!todo.length) return out;
  // Open pick/pack notes are replaced: the invoice ships everything still to go.
  var open = d.goodsNotes.filter(function(n){ return n && n.salesOrderId === order.id && !n.shipped; });
  if (open.length) d.goodsNotes = d.goodsNotes.filter(function(n){ return open.indexOf(n) < 0; });
  var now = new Date().toISOString(), id = noteId(), user = who();
  var note = { id: id, salesOrderId: order.id, template: 'Packing note', printed: true, picked: true, packed: true, shipped: true, priority: false,
    shippingMethod: order.carrier || '', courier: '', trackingRef: '', boxes: 1, weight: '', splitFrom: '', stockDeducted: true, shipmentLocked: true,
    shippedWithInvoice: true, pickedAt: now, packedAt: now, shippedAt: now, pickedBy: user, packedBy: user, shippedBy: user, lines: [] };
  todo.forEach(function(x){
    var line = x.line, left = x.qty;
    release(order, line, Math.min(num(line.allocated), x.qty), 'Allocation released');   // this order's own reservation becomes free, then comes off the shelf
    rows(line.productId, order.id).slice().sort(function(a, b){ return free(b) - free(a); }).forEach(function(row){
      if (!left) return; var take = Math.min(left, free(row)); if (!take) return;
      row.qty = num(row.qty) - take; left -= take;
      if (typeof addMovement === 'function') addMovement('Goods Out', line.productId, take, row.locationId, order.id, id, user, 'Shipped with invoice');
    });
    note.lines.push({ productId: line.productId, qty: x.qty, picked: x.qty, packed: x.qty, shipped: x.qty, noStockQty: left, pickLocations: [] });
    out.units += x.qty; out.noStock += left;
  });
  d.goodsNotes.push(note); out.note = note;
  if (typeof syncSalesOrderStatusFromGoodsNotes === 'function') try { syncSalesOrderStatusFromGoodsNotes(order); } catch (_) {}
  if (typeof addSalesOrderNotification === 'function') addSalesOrderNotification(order, 'Shipped with invoice', out.units + ' item' + (out.units === 1 ? '' : 's') + ' shipped on ' + id + ' when the order was invoiced' +
    (open.length ? '; open goods note ' + open.map(function(n){ return n.id; }).join(', ') + ' replaced' : '') +
    (out.noStock ? '. ' + out.noStock + ' had no stock recorded on the shelf: count that stock to put the figures right.' : '.'), 'Internal note');
  return out;
}

// Wire it in.
if (typeof allocateSalesOrderLine === 'function') {
  var baseAllocateLine = allocateSalesOrderLine;
  allocateSalesOrderLine = function(orderId, productId, quiet){
    var order = salesOrder(orderId), line = order && (order.lines || []).find(function(l){ return l.productId === productId; });
    if (line && !isStock(line)) { line.allocated = 0; if (!quiet && typeof toast === 'function') toast('No stock needed: this line is not stock-controlled.'); return; }
    return baseAllocateLine.apply(this, arguments);
  };
  global.allocateSalesOrderLine = allocateSalesOrderLine;
}
if (typeof addProductToSalesOrder === 'function') {
  var baseAdd = addProductToSalesOrder;
  addProductToSalesOrder = function(orderId){
    var r = baseAdd.apply(this, arguments), order = salesOrder(orderId);
    try { if (order && autoAllocate(order) > 0) { if (typeof saveAppData === 'function') saveAppData(); if (typeof render === 'function') render(); } } catch (e) { console.warn('Automatic allocation skipped', e); }
    return r;
  };
  global.addProductToSalesOrder = addProductToSalesOrder;
}
if (typeof updateSalesOrderLineNumber === 'function') {
  var baseQty = updateSalesOrderLineNumber;
  updateSalesOrderLineNumber = function(orderId, productId, field){
    var r = baseQty.apply(this, arguments);
    if (field === 'qty') try { var order = salesOrder(orderId); if (order && autoAllocate(order) > 0) { if (typeof saveAppData === 'function') saveAppData(); if (typeof render === 'function') render(); } } catch (e) { console.warn('Automatic allocation skipped', e); }
    return r;
  };
  global.updateSalesOrderLineNumber = updateSalesOrderLineNumber;
}
if (typeof completeSalesOrderAfterInvoice === 'function') {
  var baseComplete = completeSalesOrderAfterInvoice;
  completeSalesOrderAfterInvoice = function(order){
    var res = shipOnInvoice(order);
    if (res.units && typeof toast === 'function') setTimeout(function(){ toast(res.units + ' item' + (res.units === 1 ? '' : 's') + ' shipped with the invoice' + (res.noStock ? ' (' + res.noStock + ' had no stock recorded)' : '') + '.'); }, 400);
    return baseComplete.apply(this, arguments);
  };
  global.completeSalesOrderAfterInvoice = completeSalesOrderAfterInvoice;
}
// Progress and "all shipped" count stock lines only: custom lines and delivery charges never ship from stock,
// so before this an order with one of them could never reach Shipped or Completed.
if (typeof salesOrderProgress === 'function') {
  salesOrderProgress = function(order){
    var lines = (order && order.lines || []).filter(isStock);
    var sum = function(f){ return lines.reduce(function(t, l){ return t + num(l[f]); }, 0); };
    var shipped = (D().goodsNotes || []).filter(function(n){ return n && n.salesOrderId === order.id; }).reduce(function(t, n){ return t + (n.lines || []).reduce(function(s2, l){ return s2 + num(l.shipped); }, 0); }, 0);
    return { required: sum('qty'), picked: sum('picked'), packed: sum('packed'), shipped: shipped };
  };
  global.salesOrderProgress = salesOrderProgress;
}
if (typeof applyGoodsNoteTotalsToOrder === 'function') {
  var baseTotals = applyGoodsNoteTotalsToOrder;
  applyGoodsNoteTotalsToOrder = function(order){
    baseTotals.apply(this, arguments);
    var lines = (order.lines || []).filter(isStock);
    return lines.length > 0 && lines.every(function(l){ return shippedFor(order, l.productId) >= num(l.qty); });
  };
  global.applyGoodsNoteTotalsToOrder = applyGoodsNoteTotalsToOrder;
}
// Housekeeping after the page draws: saves only when something was actually put right.
var tidyTimer = 0;
if (typeof render === 'function') {
  var baseRender = render;
  render = function(){
    var r = baseRender.apply(this, arguments);
    clearTimeout(tidyTimer);
    tidyTimer = setTimeout(function(){
      try { if (typeof global.__POOL_SHED_WORKSPACE_READY__ === 'function' && !global.__POOL_SHED_WORKSPACE_READY__()) return;
        if (tidy() && typeof saveAppData === 'function') saveAppData(); } catch (e) { console.warn('Stock housekeeping skipped', e); }
    }, 600);
    return r;
  };
  global.render = render;
}
global.PoolShedStockFlow = { shipOnInvoice: shipOnInvoice, autoAllocate: autoAllocate, tidy: tidy, isStock: isStock };
})(typeof window !== 'undefined' ? window : globalThis);
