/* Pool Shed fulfilment tab (from v1.90), laid out like Brightpearl's goods-out notes.
   On the order's Fulfilment tab:
   - every item with what was ordered, allocated, put on a goods-out note and shipped, and a plain status;
   - one button that puts everything allocated onto a goods-out note (or choose quantities for a part shipment);
   - each goods-out note as a card with its Printed → Picked → Packed → Shipped steps and the next step as a button.
   The rules for picking, packing, shipping and stock deduction are the existing ones (partial-fulfilment.js and the
   warehouse functions); this file only lays them out and presses them. */
(function(global){
'use strict';
if (typeof salesOrderTabContent !== 'function' || typeof salesOrder !== 'function') return;
var num = function(v){ var n = Number(v); return isFinite(n) ? n : 0; };
var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var PF = function(){ return global.PoolShedPartialFulfilment || null; };
function D(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? global.__POOL_SHED_GET_DATA__() : (typeof data !== 'undefined' ? data : {}); }
function notesFor(order){ return (D().goodsNotes || []).filter(function(n){ return n && n.salesOrderId === order.id; }); }
function isStock(line){ return !!(line && line.productId && !isNonStockSalesLine(line)); }
function prod(id){ try { return typeof product === 'function' ? product(id) : null; } catch (_) { return null; } }
function lineName(line){ var p = prod(line.productId) || {}; return line.description || line.customProductName || p.name || line.productId; }
function lineSku(line){ var p = prod(line.productId) || {}; return line.lineType === 'shipping' ? 'Delivery' : line.lineType === 'custom' ? 'Custom' : (p.sku || ''); }
function state(order, line){
  var pf = PF();
  if (pf && pf.lineShipmentState) return pf.lineShipmentState(order, line);
  var shipped = notesFor(order).filter(function(n){ return n.shipped; }).reduce(function(t, n){ return t + (n.lines || []).filter(function(l){ return l.productId === line.productId; }).reduce(function(s, l){ return s + num(l.shipped); }, 0); }, 0);
  var remaining = Math.max(0, num(line.qty) - shipped), allocated = Math.min(remaining, num(line.allocated));
  var onOpen = notesFor(order).filter(function(n){ return !n.shipped; }).reduce(function(t, n){ return t + (n.lines || []).filter(function(l){ return l.productId === line.productId; }).reduce(function(s, l){ return s + num(l.qty); }, 0); }, 0);
  return { ordered: num(line.qty), shipped: shipped, remaining: remaining, allocated: allocated, onOpenNotes: Math.min(allocated, onOpen), availableForNewNote: Math.max(0, Math.min(remaining, allocated - onOpen)) };
}
function freeStock(order, line){
  var rows = typeof allocationRowsForSalesOrder === 'function' ? allocationRowsForSalesOrder(line.productId, order.id) : [];
  return (rows || []).reduce(function(t, r){ return t + (typeof available === 'function' ? available(r) : Math.max(0, num(r.qty) - num(r.allocated))); }, 0);
}
function pill(cls, text){ return '<span class="ft-pill ' + cls + '">' + esc(text) + '</span>'; }
function lineStatus(order, line, s){
  if (!isStock(line)) return pill('muted', 'No stock needed');
  if (s.remaining <= 0) return pill('good', 'Shipped');
  if (s.onOpenNotes >= s.remaining) return pill('info', 'On goods-out note');
  if (s.allocated >= s.remaining) return pill('good', s.onOpenNotes ? 'Rest ready for a note' : 'Allocated: ready');
  if (s.allocated > 0) return pill('warn', 'Part allocated');
  return freeStock(order, line) > 0 ? pill('warn', 'Not allocated') : pill('bad', 'No free stock');
}
function lineAction(order, line, s){
  if (!isStock(line) || s.remaining <= 0) return '';
  var need = s.remaining - s.allocated;
  if (need > 0 && freeStock(order, line) > 0) return '<button type="button" class="secondary ft-mini" data-ft-allocate="' + esc(order.id + '|' + line.productId) + '">Allocate</button>';
  if (need > 0) return '<button type="button" class="link ft-link" data-ft-raise-po="' + esc(order.id) + '">Order from supplier</button>';
  return '';
}

var STEPS = [['printed', 'Printed'], ['picked', 'Picked'], ['packed', 'Packed'], ['shipped', 'Shipped']];
function noteCard(order, note){
  var id = esc(note.id), units = (note.lines || []).reduce(function(t, l){ return t + num(l.qty); }, 0);
  var rail = STEPS.map(function(s){ return '<li class="' + (note[s[0]] ? 'done' : '') + '">' + s[1] + '</li>'; }).join('');
  var lines = (note.lines || []).map(function(l){ var p = prod(l.productId) || {}; return '<li><span>' + esc(p.name || l.productId) + (p.sku ? ' <small>' + esc(p.sku) + '</small>' : '') + '</span><b>× ' + num(l.qty) + '</b></li>'; }).join('');
  var next = '', more = '';
  if (note.hold) next = '<span class="ft-note-msg">On hold' + (note.holdReason ? ': ' + esc(note.holdReason) : '') + '</span>';
  else if (note.shipped) {
    var how = [note.dispatchMode === 'collection' ? 'Collected' : (note.courier || note.dispatchMode || note.shippingMethod || ''), note.trackingRef ? 'tracking ' + note.trackingRef : ''].filter(Boolean).join(' · ');
    next = '<span class="ft-note-msg good">Shipped' + (note.shippedAt ? ' ' + esc(String(note.shippedAt).slice(0, 10)) : '') + (note.shippedBy ? ' by ' + esc(note.shippedBy) : '') + (note.shippedWithInvoice ? ' with the invoice' : '') + (how ? ' · ' + esc(how) : '') + '</span>';
  } else if (!note.printed && !note.picked) { next = '<button type="button" class="primary ft-next" data-ft-print="' + id + '">Print picking list</button>'; more = '<button type="button" class="link ft-link" data-ft-pick="' + id + '">Mark picked without printing</button>'; }
  else if (!note.picked) next = '<button type="button" class="primary ft-next" data-ft-pick="' + id + '">Mark picked</button>';
  else if (!note.packed) { next = '<button type="button" class="primary ft-next" data-ft-pack="' + id + '">Mark packed</button>'; more = '<button type="button" class="link ft-link" data-ft-unpick="' + id + '">Undo picked</button>'; }
  else { next = '<button type="button" class="primary ft-next" data-ft-ship="' + id + '">Ship…</button>'; more = '<button type="button" class="link ft-link" data-ft-unpack="' + id + '">Undo packed</button>'; }
  if (!note.shipped) more += '<button type="button" class="link ft-link danger" data-ft-cancel="' + id + '">Cancel note</button>';
  if (!note.shipped && note.printed) more += '<button type="button" class="link ft-link" data-ft-reprint="' + id + '">Print again</button>';
  return '<article class="ft-note' + (note.shipped ? ' shipped' : '') + '"><header><div><strong>' + id + '</strong><small>' + units + ' unit' + (units === 1 ? '' : 's') + (note.createdAt ? ' · created ' + esc(String(note.createdAt).slice(0, 10)) : '') + '</small></div>' +
    '<ol class="ft-steps" aria-label="Goods-out note progress">' + rail + '</ol></header><ul class="ft-note-lines">' + lines + '</ul>' +
    '<footer><div class="ft-note-next">' + next + '</div><div class="ft-note-more">' + more + '<button type="button" class="link ft-link" data-ft-open="' + id + '">Open note</button></div></footer></article>';
}

function panel(order){
  var lines = order.lines || [], stock = lines.filter(isStock), states = {};
  stock.forEach(function(l){ states[l.productId] = state(order, l); });
  var t = stock.reduce(function(a, l){ var s = states[l.productId]; a.ordered += s.ordered; a.allocated += s.allocated; a.onNotes += s.onOpenNotes; a.shipped += s.shipped; a.ready += s.availableForNewNote; a.short += Math.max(0, s.remaining - s.allocated); a.canAlloc += Math.max(0, s.remaining - s.allocated) > 0 && freeStock(order, l) > 0 ? 1 : 0; return a; }, { ordered: 0, allocated: 0, onNotes: 0, shipped: 0, ready: 0, short: 0, canAlloc: 0 });
  var notes = notesFor(order).slice().sort(function(a, b){ return (a.shipped ? 1 : 0) - (b.shipped ? 1 : 0) || String(b.createdAt || b.id).localeCompare(String(a.createdAt || a.id)); });
  var actions = '';
  if (t.ready) actions += '<button type="button" class="primary ft-create" data-ft-create="' + esc(order.id) + '">Create goods-out note (' + t.ready + ' unit' + (t.ready === 1 ? '' : 's') + ')</button><button type="button" class="link ft-link" data-ft-partial="' + esc(order.id) + '">Choose quantities</button>';
  if (t.canAlloc) actions += '<button type="button" class="secondary" data-allocate-order="' + esc(order.id) + '">Allocate all</button>';
  var summary = !stock.length ? 'No stock items on this order: nothing to pick or ship.'
    : t.shipped >= t.ordered ? 'Everything has shipped.'
    : [t.allocated + ' of ' + (t.ordered - t.shipped) + ' allocated', t.onNotes ? t.onNotes + ' on goods-out notes' : '', t.shipped ? t.shipped + ' shipped' : '', t.short ? t.short + ' still to allocate' : ''].filter(Boolean).join(' · ');
  var rows = lines.map(function(l){
    var s = isStock(l) ? states[l.productId] : null;
    return '<tr class="' + (s ? '' : 'ft-nonstock') + '"><td><strong>' + esc(lineName(l)) + '</strong><small>' + esc(lineSku(l)) + '</small></td>' +
      '<td class="num">' + num(l.qty) + '</td><td class="num">' + (s ? s.allocated : '—') + '</td><td class="num">' + (s ? s.onOpenNotes : '—') + '</td><td class="num">' + (s ? s.shipped : '—') + '</td>' +
      '<td>' + lineStatus(order, l, s) + '</td><td class="ft-act">' + (s ? lineAction(order, l, s) : '') + '</td></tr>';
  }).join('');
  return '<section class="ft-panel">' +
    '<div class="ft-head"><div><span class="so2-kicker">Fulfilment</span><strong>Goods out</strong><small>' + esc(summary) + '</small></div><div class="ft-actions">' + actions + '</div></div>' +
    '<div class="ft-table-wrap"><table class="ft-table"><thead><tr><th>Item</th><th class="num">Ordered</th><th class="num">Allocated</th><th class="num">On notes</th><th class="num">Shipped</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="ft-notes-head"><strong>Goods-out notes</strong><small>' + (notes.length ? notes.length + ' for this order' : 'None yet. Create one from the allocated stock above; stock only leaves when a note is shipped (or the order is invoiced).') + '</small></div>' +
    (notes.length ? '<div class="ft-notes">' + notes.map(function(n){ return noteCard(order, n); }).join('') + '</div>' : '') +
  '</section>';
}

var baseTab = salesOrderTabContent;
salesOrderTabContent = function(order){
  if (typeof salesOrderTab !== 'undefined' && salesOrderTab === 'fulfilment') { try { return panel(order); } catch (e) { console.warn('Fulfilment tab fell back', e); } }
  return baseTab.apply(this, arguments);
};
global.salesOrderTabContent = salesOrderTabContent;

// Create a goods-out note for everything allocated and not yet on a note.
function createNote(order){
  var lines = (order.lines || []).filter(isStock).map(function(l){ return { productId: l.productId, qty: state(order, l).availableForNewNote, picked: 0, packed: 0, shipped: 0 }; }).filter(function(l){ return l.qty > 0; });
  if (!lines.length) return null;
  var d = D(), notes = d.goodsNotes || (d.goodsNotes = []), id = typeof nextGoodsNoteId === 'function' ? nextGoodsNoteId() : 'GN-' + String(55 + notes.length).padStart(4, '0'), n = 55 + notes.length;
  while (notes.some(function(x){ return x && x.id === id; })) { n++; id = 'GN-' + String(n).padStart(4, '0'); }
  var remaining = (order.lines || []).filter(isStock).reduce(function(t, l){ return t + state(order, l).remaining; }, 0), units = lines.reduce(function(t, l){ return t + l.qty; }, 0);
  var who = ''; try { who = (currentUser() || {}).name || ''; } catch (_) {}
  var note = { id: id, salesOrderId: order.id, template: units < remaining ? 'Partial shipment' : 'Packing note', printed: false, picked: false, packed: false, shipped: false, priority: false,
    shippingMethod: order.carrier || '', courier: '', trackingRef: '', boxes: 1, weight: 'To confirm', splitFrom: '', stockDeducted: false, partialShipment: units < remaining,
    shipmentSequence: notesFor(order).length + 1, createdAt: new Date().toISOString(), createdBy: who, lines: lines };
  notes.push(note);
  if (typeof syncSalesOrderStatusFromGoodsNotes === 'function') syncSalesOrderStatusFromGoodsNotes(order);
  if (typeof addNotification === 'function') addNotification(note, 'Create', 'Goods-out note ' + id + ' created for ' + units + ' unit' + (units === 1 ? '' : 's'), 'Internal only');
  return note;
}
function after(order, msg){ if (order && typeof syncSalesOrderStatusFromGoodsNotes === 'function') syncSalesOrderStatusFromGoodsNotes(order); if (typeof saveAppData === 'function') saveAppData(); if (msg && typeof toast === 'function') toast(msg); if (typeof render === 'function') render(); }
function noteById(id){ return (D().goodsNotes || []).find(function(n){ return n && n.id === id; }) || null; }
function ask(opts){ return global.PoolShedDialog ? global.PoolShedDialog.ask(opts) : Promise.resolve(null); }
function confirmBox(opts){ return global.PoolShedDialog ? global.PoolShedDialog.confirm(opts) : Promise.resolve(global.confirm(opts.message || opts.title)); }

// "Fulfil" (order header and the order bar) now creates the goods-out note straight away and opens this tab.
if (typeof fulfilSalesOrder === 'function') {
  fulfilSalesOrder = function(orderId){
    var order = salesOrder(orderId); if (!order) return;
    salesOrderTab = 'fulfilment';
    var note = createNote(order);
    if (note) return after(order, note.id + ' created: print the picking list when you are ready.');
    var open = notesFor(order).some(function(n){ return !n.shipped; });
    after(null, open ? 'Everything allocated is already on a goods-out note.' : 'Nothing is allocated yet: allocate stock first, or invoice and the goods ship with it.');
  };
  global.fulfilSalesOrder = fulfilSalesOrder;
}

if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', function(e){
  var t = e.target && e.target.closest ? e.target.closest('[data-ft-create],[data-ft-partial],[data-ft-allocate],[data-ft-print],[data-ft-reprint],[data-ft-pick],[data-ft-unpick],[data-ft-pack],[data-ft-unpack],[data-ft-ship],[data-ft-cancel],[data-ft-open],[data-ft-raise-po]') : null;
  if (!t) return;
  e.preventDefault(); e.stopImmediatePropagation();
  var ds = t.dataset, note, order;
  if (ds.ftCreate) { order = salesOrder(ds.ftCreate); note = order && createNote(order); return after(order, note ? note.id + ' created.' : 'Nothing allocated is waiting for a note.'); }
  if (ds.ftPartial) { if (PF() && PF().open) PF().open(ds.ftPartial, []); return; }
  if (ds.ftAllocate) { var p = ds.ftAllocate.split('|'); if (typeof allocateSalesOrderLine === 'function') allocateSalesOrderLine(p[0], p.slice(1).join('|')); return; }
  if (ds.ftRaisePo) { salesOrderTab = 'connections'; if (typeof render === 'function') render(); if (typeof toast === 'function') toast('Raise or link a purchase order for the missing stock here.'); return; }
  if (ds.ftOpen) { selectedGoodsNoteId = ds.ftOpen; salesOrderView = 'goodsnote'; if (typeof render === 'function') render(); return; }
  note = noteById(ds.ftPrint || ds.ftReprint || ds.ftPick || ds.ftUnpick || ds.ftPack || ds.ftUnpack || ds.ftShip || ds.ftCancel);
  if (!note) return;
  order = salesOrder(note.salesOrderId);
  if (ds.ftPrint || ds.ftReprint) { if (typeof printBulkPickingList === 'function' && printBulkPickingList([note]) !== false) { if (typeof markGoodsNotePrinted === 'function') markGoodsNotePrinted(note, true, !ds.ftReprint, false); } return after(order, 'Picking list for ' + note.id + ' printed.'); }
  if (ds.ftPick) { var ok = typeof markGoodsNotePicked === 'function' && markGoodsNotePicked(note, true, true); return after(order, ok ? note.id + ' picked.' : 'Could not mark picked: the allocated stock no longer covers this note.'); }
  if (ds.ftUnpick) { if (typeof markGoodsNotePicked === 'function') markGoodsNotePicked(note, false, false); return after(order, note.id + ' set back to not picked.'); }
  if (ds.ftPack) { var okp = typeof markGoodsNotePacked === 'function' && markGoodsNotePacked(note, true); return after(order, okp ? note.id + ' packed: ready to ship.' : 'Pick everything on the note before packing.'); }
  if (ds.ftUnpack) { if (typeof unmarkGoodsNotePacked === 'function') unmarkGoodsNotePacked(note); return after(order, note.id + ' set back to not packed.'); }
  if (ds.ftShip) {
    var method = String(note.dispatchMode || '').toLowerCase(), carrier = String(order && order.carrier || note.shippingMethod || '').toLowerCase();
    var guess = ['collection', 'van', 'courier', 'post'].indexOf(method) >= 0 ? method : /collect/.test(carrier) ? 'collection' : /van|pool bros|local/.test(carrier) ? 'van' : /post|royal mail/.test(carrier) ? 'post' : 'courier';
    return ask({ title: 'Ship ' + note.id, message: 'Stock comes off the shelf when you confirm.', confirmLabel: 'Ship',
      fields: [{ name: 'mode', label: 'How is it going?', type: 'choice', value: guess, options: [['collection', 'Customer collecting'], ['van', 'Our van'], ['courier', 'Courier'], ['post', 'Post']] },
        { name: 'courier', label: 'Courier or service', value: note.courier || '', placeholder: 'e.g. DPD next day' },
        { name: 'tracking', label: 'Tracking number', value: note.trackingRef || '' }] }).then(function(v){
      if (!v) return;
      note.dispatchMode = v.mode; note.courier = String(v.courier || '').trim() || (v.mode === 'van' ? 'Our van' : v.mode === 'collection' ? 'Collection' : v.mode === 'post' ? 'Post' : ''); note.trackingRef = String(v.tracking || '').trim();
      var shipped = typeof shipGoodsNote === 'function' && shipGoodsNote(note);
      after(order, shipped ? note.id + ' shipped. Stock has been taken off.' : null);
    });
  }
  if (ds.ftCancel) return confirmBox({ title: 'Cancel ' + note.id + '?', message: 'The items go back to allocated and can go on a new note. Nothing has left the shelf yet.', confirmLabel: 'Cancel note', cancelLabel: 'Keep it', danger: true }).then(function(yes){
    if (!yes) return; var d = D(); d.goodsNotes = (d.goodsNotes || []).filter(function(n){ return n !== note; });
    if (typeof addSalesOrderNotification === 'function' && order) addSalesOrderNotification(order, 'Goods-out note cancelled', note.id + ' cancelled before shipping; items back to allocated.', 'Internal note');
    after(order, note.id + ' cancelled.');
  });
}, true);

global.PoolShedFulfilmentTab = { panel: panel, createNote: createNote, state: state };
})(typeof window !== 'undefined' ? window : globalThis);
