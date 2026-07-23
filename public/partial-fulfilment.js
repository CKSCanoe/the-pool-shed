/* Pool Shed v1.10.9 partial shipment and premium sales-order workflow */
(function () {
  'use strict';

  const VERSION = '1.10.9';
  let fulfilOrderId = '';
  let fulfilProductIds = [];

  function num(value) {
    return Math.max(0, Number(value) || 0);
  }

  function esc(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(String(value == null ? '' : value));
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function orderStockLines(order) {
    return (order && Array.isArray(order.lines) ? order.lines : []).filter(function (line) {
      return !isNonStockSalesLine(line);
    });
  }

  function noteLineQuantity(note, productId, field) {
    if (!note || !Array.isArray(note.lines)) return 0;
    return note.lines.filter(function (line) {
      return line.productId === productId;
    }).reduce(function (total, line) {
      if (field === 'shipped') return total + num(note.shipped ? line.qty : line.shipped);
      return total + num(line[field] == null ? line.qty : line[field]);
    }, 0);
  }

  function shippedQuantity(orderId, productId) {
    return goodsNotesForOrder(orderId).reduce(function (total, note) {
      return total + noteLineQuantity(note, productId, 'shipped');
    }, 0);
  }

  function openGoodsNoteQuantity(orderId, productId) {
    return goodsNotesForOrder(orderId).filter(function (note) {
      return !note.shipped;
    }).reduce(function (total, note) {
      return total + noteLineQuantity(note, productId, 'qty');
    }, 0);
  }

  function lineShipmentState(order, line) {
    const ordered = num(line.qty);
    const shipped = Math.min(ordered, shippedQuantity(order.id, line.productId));
    const remaining = Math.max(0, ordered - shipped);
    const allocated = Math.min(remaining, num(line.allocated));
    const onOpenNotes = Math.min(allocated, openGoodsNoteQuantity(order.id, line.productId));
    const availableForNewNote = Math.max(0, Math.min(remaining, allocated - onOpenNotes));
    return {
      ordered: ordered,
      shipped: shipped,
      remaining: remaining,
      allocated: allocated,
      onOpenNotes: onOpenNotes,
      availableForNewNote: availableForNewNote
    };
  }

  function orderShipmentSummary(order) {
    const lines = orderStockLines(order);
    return lines.reduce(function (summary, line) {
      const state = lineShipmentState(order, line);
      summary.ordered += state.ordered;
      summary.shipped += state.shipped;
      summary.remaining += state.remaining;
      summary.allocated += state.allocated;
      summary.open += state.onOpenNotes;
      summary.available += state.availableForNewNote;
      return summary;
    }, { ordered: 0, shipped: 0, remaining: 0, allocated: 0, open: 0, available: 0 });
  }

  function ensureFulfilmentModal() {
    let modal = document.getElementById('partialFulfilmentModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'partialFulfilmentModal';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }
    return modal;
  }

  function closePartialFulfilment() {
    fulfilOrderId = '';
    fulfilProductIds = [];
    const modal = ensureFulfilmentModal();
    modal.className = 'modal-backdrop';
    modal.innerHTML = '';
  }

  function existingNoteCards(order) {
    const notes = goodsNotesForOrder(order.id).filter(function (note) { return !note.shipped; });
    if (!notes.length) return '';
    return '<section class="partial-open-notes"><div><strong>Open goods notes</strong><p>These quantities are already committed and cannot be added twice.</p></div><div class="partial-open-note-list">' + notes.map(function (note) {
      const total = (note.lines || []).reduce(function (sum, line) { return sum + num(line.qty); }, 0);
      return '<button type="button" class="partial-open-note" data-open-existing-goods-note="' + esc(note.id) + '"><span><strong>' + esc(note.id) + '</strong><small>' + esc(goodsNoteStatus(note)) + '</small></span><b>' + total + ' unit' + (total === 1 ? '' : 's') + '</b></button>';
    }).join('') + '</div></section>';
  }

  function partialLineCard(order, line) {
    const p = product(line.productId) || { sku: line.productId, name: 'Product' };
    const state = lineShipmentState(order, line);
    const selected = !fulfilProductIds.length || fulfilProductIds.includes(line.productId);
    const canAdd = state.availableForNewNote > 0 && selected;
    const progress = state.ordered ? Math.min(100, Math.round((state.shipped / state.ordered) * 100)) : 0;
    let availabilityCopy = state.availableForNewNote + ' available for this shipment';
    if (!state.remaining) availabilityCopy = 'Fully shipped';
    else if (!state.allocated) availabilityCopy = 'Allocate stock before creating a shipment';
    else if (state.onOpenNotes >= state.allocated) availabilityCopy = 'All allocated stock is already on an open goods note';
    return '<article class="partial-line-card' + (canAdd ? '' : ' is-unavailable') + '" data-partial-line-card="' + esc(line.productId) + '">' +
      '<div class="partial-line-identity"><span class="partial-line-mark">PB</span><div><strong>' + esc(p.name) + '</strong><small>' + esc(p.sku || p.id) + '</small></div></div>' +
      '<div class="partial-line-metrics"><span><small>Ordered</small><strong>' + state.ordered + '</strong></span><span><small>Shipped</small><strong>' + state.shipped + '</strong></span><span><small>Remaining</small><strong>' + state.remaining + '</strong></span><span><small>Allocated</small><strong>' + state.allocated + '</strong></span></div>' +
      '<div class="partial-line-progress"><div><span style="width:' + progress + '%"></span></div><small>' + esc(availabilityCopy) + '</small></div>' +
      '<label class="partial-line-quantity"><span>Quantity on this goods note</span><div><button type="button" class="partial-qty-step" data-partial-step="-1" data-partial-product="' + esc(line.productId) + '"' + (canAdd ? '' : ' disabled') + '>−</button><input name="shipmentQty_' + esc(line.productId) + '" data-partial-qty="' + esc(line.productId) + '" type="number" inputmode="numeric" min="0" max="' + state.availableForNewNote + '" value="0"' + (canAdd ? '' : ' disabled') + '><button type="button" class="partial-qty-step" data-partial-step="1" data-partial-product="' + esc(line.productId) + '"' + (canAdd ? '' : ' disabled') + '>+</button></div><button type="button" class="partial-use-all" data-partial-use-all="' + esc(line.productId) + '"' + (canAdd ? '' : ' disabled') + '>Use all ' + state.availableForNewNote + '</button></label>' +
    '</article>';
  }

  function renderPartialFulfilmentModal() {
    const modal = ensureFulfilmentModal();
    const order = fulfilOrderId ? salesOrder(fulfilOrderId) : null;
    if (!order) {
      closePartialFulfilment();
      return;
    }
    const customerRecord = customer(order.customerId) || {};
    const summary = orderShipmentSummary(order);
    const lines = orderStockLines(order).filter(function (line) {
      return !fulfilProductIds.length || fulfilProductIds.includes(line.productId);
    });
    const existingShipments = goodsNotesForOrder(order.id).filter(function (note) { return note.shipped; }).length;
    modal.className = 'modal-backdrop show partial-fulfilment-backdrop';
    modal.innerHTML = '<form id="partialFulfilmentForm" class="modal partial-fulfilment-modal" aria-label="Create partial shipment for ' + esc(order.id) + '">' +
      '<header class="partial-fulfilment-head"><div><span class="partial-kicker">Pool Bros fulfilment control</span><strong>Create a partial shipment</strong><p>' + esc(order.id) + ' for ' + esc(customerRecord.name || customerRecord.companyName || 'Customer') + '. Create one goods note now and leave the balance on the sales order.</p></div><button type="button" class="secondary" data-close-partial-fulfilment="true">Close</button></header>' +
      '<div class="modal-body partial-fulfilment-body">' +
        '<section class="partial-summary-strip"><div><small>Ordered</small><strong>' + summary.ordered + '</strong></div><div><small>Already shipped</small><strong>' + summary.shipped + '</strong></div><div><small>Remaining</small><strong>' + summary.remaining + '</strong></div><div><small>Allocated now</small><strong>' + summary.allocated + '</strong></div><div><small>Open goods notes</small><strong>' + summary.open + '</strong></div></section>' +
        '<div class="partial-guidance"><span>1</span><div><strong>Choose only what is leaving now</strong><p>Each goods note gets its own picking, packing, courier and tracking history. After shipping, stock and allocation reduce only by that note quantity.</p></div></div>' +
        existingNoteCards(order) +
        '<section class="partial-line-list">' + lines.map(function (line) { return partialLineCard(order, line); }).join('') + '</section>' +
        '<section class="partial-shipment-note"><label><span>Shipment note (optional)</span><textarea name="shipmentNote" rows="2" placeholder="Example: First pallet, four drums sent today"></textarea></label><div><strong>Shipment ' + (existingShipments + 1) + '</strong><small>The remaining ' + summary.remaining + ' unit' + (summary.remaining === 1 ? '' : 's') + ' stay linked to ' + esc(order.id) + ' until later goods notes are shipped.</small></div></section>' +
      '</div>' +
      '<footer class="partial-fulfilment-footer"><div><strong id="partialSelectedTotal">0 units selected</strong><small>Nothing is deducted from stock until this goods note is marked shipped.</small></div><div class="action-row"><button type="button" class="secondary" data-close-partial-fulfilment="true">Cancel</button><button type="submit" id="createPartialGoodsNote" disabled>Create goods note</button></div></footer>' +
    '</form>';
    bindPartialFulfilmentModal();
  }

  function selectedModalQuantities(order) {
    const selected = [];
    orderStockLines(order).forEach(function (line) {
      const input = document.querySelector('[data-partial-qty="' + CSS.escape(line.productId) + '"]');
      if (!input) return;
      const state = lineShipmentState(order, line);
      const qty = Math.max(0, Math.min(state.availableForNewNote, Math.floor(num(input.value))));
      input.value = String(qty);
      if (qty > 0) selected.push({ productId: line.productId, qty: qty, picked: 0, packed: 0, shipped: 0 });
    });
    return selected;
  }

  function updatePartialSelectionSummary() {
    const order = fulfilOrderId ? salesOrder(fulfilOrderId) : null;
    if (!order) return;
    const selected = selectedModalQuantities(order);
    const total = selected.reduce(function (sum, line) { return sum + line.qty; }, 0);
    const label = document.getElementById('partialSelectedTotal');
    const submit = document.getElementById('createPartialGoodsNote');
    if (label) label.textContent = total + ' unit' + (total === 1 ? '' : 's') + ' selected';
    if (submit) submit.disabled = total <= 0;
  }

  function bindPartialFulfilmentModal() {
    const modal = ensureFulfilmentModal();
    modal.querySelectorAll('[data-close-partial-fulfilment]').forEach(function (button) {
      button.addEventListener('click', closePartialFulfilment);
    });
    modal.addEventListener('click', function (event) {
      if (event.target === modal) closePartialFulfilment();
    }, { once: true });
    modal.querySelectorAll('[data-partial-use-all]').forEach(function (button) {
      button.addEventListener('click', function () {
        const input = modal.querySelector('[data-partial-qty="' + CSS.escape(button.dataset.partialUseAll) + '"]');
        if (input) input.value = input.max;
        updatePartialSelectionSummary();
      });
    });
    modal.querySelectorAll('[data-partial-step]').forEach(function (button) {
      button.addEventListener('click', function () {
        const input = modal.querySelector('[data-partial-qty="' + CSS.escape(button.dataset.partialProduct) + '"]');
        if (!input) return;
        const next = Math.max(0, Math.min(num(input.max), num(input.value) + Number(button.dataset.partialStep || 0)));
        input.value = String(next);
        updatePartialSelectionSummary();
      });
    });
    modal.querySelectorAll('[data-partial-qty]').forEach(function (input) {
      input.addEventListener('input', updatePartialSelectionSummary);
      input.addEventListener('change', updatePartialSelectionSummary);
    });
    modal.querySelectorAll('[data-open-existing-goods-note]').forEach(function (button) {
      button.addEventListener('click', function () {
        selectedGoodsNoteId = button.dataset.openExistingGoodsNote;
        active = 'salesorders';
        salesOrderView = 'goodsnote';
        closePartialFulfilment();
        render();
      });
    });
    const form = modal.querySelector('#partialFulfilmentForm');
    if (form) form.addEventListener('submit', createPartialGoodsNoteFromModal);
    updatePartialSelectionSummary();
  }

  function createPartialGoodsNoteFromModal(event) {
    event.preventDefault();
    const order = fulfilOrderId ? salesOrder(fulfilOrderId) : null;
    if (!order) return closePartialFulfilment();
    const selected = selectedModalQuantities(order);
    if (!selected.length) return toast('Choose at least one quantity for this shipment.');
    const validationFailed = selected.some(function (selectedLine) {
      const orderLine = order.lines.find(function (line) { return line.productId === selectedLine.productId; });
      return !orderLine || selectedLine.qty > lineShipmentState(order, orderLine).availableForNewNote;
    });
    if (validationFailed) {
      toast('One of the shipment quantities is no longer available. Review the latest allocation and try again.');
      renderPartialFulfilmentModal();
      return;
    }
    const noteNumber = goodsNotesForOrder(order.id).length + 1;
    const noteText = String(new FormData(event.currentTarget).get('shipmentNote') || '').trim();
    const note = {
      id: nextGoodsNoteId(),
      salesOrderId: order.id,
      template: selected.reduce(function (sum, line) { return sum + line.qty; }, 0) < orderShipmentSummary(order).remaining ? 'Partial shipment' : 'Packing note',
      printed: false,
      picked: false,
      packed: false,
      shipped: false,
      priority: false,
      shippingMethod: order.carrier,
      courier: '',
      trackingRef: '',
      boxes: 1,
      weight: 'To confirm',
      splitFrom: '',
      stockDeducted: false,
      partialShipment: true,
      shipmentSequence: noteNumber,
      shipmentNote: noteText,
      createdAt: new Date().toISOString(),
      createdBy: currentUser().name,
      lines: selected
    };
    data.goodsNotes.push(note);
    selectedGoodsNoteId = note.id;
    active = 'salesorders';
    salesOrderView = 'goodsnote';
    syncSalesOrderStatusFromGoodsNotes(order);
    addNotification(note, 'Create', 'Partial goods note ' + note.id + ' created for ' + selected.reduce(function (sum, line) { return sum + line.qty; }, 0) + ' unit(s)', 'Internal only');
    saveAppData();
    closePartialFulfilment();
    toast(note.id + ' created. Only these quantities will be picked, packed and shipped.');
    render();
  }

  function openPartialFulfilment(orderId, productIds) {
    const order = salesOrder(orderId);
    if (!order) return toast('Sales order not found.');
    const stockLines = orderStockLines(order);
    if (!stockLines.length) return toast('This order contains no stock-controlled items to ship.');
    const available = stockLines.some(function (line) {
      return lineShipmentState(order, line).availableForNewNote > 0;
    });
    if (!available) {
      const openNotes = goodsNotesForOrder(order.id).filter(function (note) { return !note.shipped; });
      if (openNotes.length) {
        selectedGoodsNoteId = openNotes[0].id;
        active = 'salesorders';
        salesOrderView = 'goodsnote';
        toast('All currently allocated stock is already on open goods notes. Opening ' + openNotes[0].id + '.');
        render();
        return;
      }
      return toast('No allocated stock is available for another goods note. Allocate the remaining items first.');
    }
    fulfilOrderId = orderId;
    fulfilProductIds = Array.isArray(productIds) ? productIds.filter(Boolean) : (productIds ? [productIds] : []);
    renderPartialFulfilmentModal();
  }

  function releaseShipmentAllocation(order, line, qty) {
    const releaseQty = Math.min(num(qty), num(line.allocated));
    if (!releaseQty) return 0;
    let left = releaseQty;
    stockRowsForProduct(line.productId).slice().sort(function (a, b) {
      return num(b.allocated) - num(a.allocated);
    }).forEach(function (row) {
      if (!left) return;
      const amount = Math.min(left, num(row.allocated));
      row.allocated = Math.max(0, num(row.allocated) - amount);
      left -= amount;
    });
    line.allocated = Math.max(0, num(line.allocated) - releaseQty);
    return releaseQty;
  }

  function shipmentDeductionPlan(order, note) {
    const plans = [];
    for (const noteLine of note.lines || []) {
      const orderLine = order.lines.find(function (line) { return line.productId === noteLine.productId; });
      if (!orderLine || num(orderLine.allocated) < num(noteLine.qty)) return null;
      const rows = stockRowsForProduct(noteLine.productId).slice().sort(function (a, b) {
        const allocationDifference = num(b.allocated) - num(a.allocated);
        if (allocationDifference) return allocationDifference;
        return num(b.qty) - num(a.qty);
      });
      const physical = rows.reduce(function (sum, row) { return sum + num(row.qty); }, 0);
      if (physical < num(noteLine.qty)) return null;
      let left = num(noteLine.qty);
      const deductions = [];
      rows.forEach(function (row) {
        if (!left) return;
        const allocatedTake = Math.min(left, num(row.qty), num(row.allocated));
        if (allocatedTake > 0) {
          deductions.push({ row: row, qty: allocatedTake });
          left -= allocatedTake;
        }
      });
      rows.forEach(function (row) {
        if (!left) return;
        const already = deductions.filter(function (entry) { return entry.row === row; }).reduce(function (sum, entry) { return sum + entry.qty; }, 0);
        const freePhysical = Math.max(0, num(row.qty) - already);
        const take = Math.min(left, freePhysical);
        if (take > 0) {
          deductions.push({ row: row, qty: take });
          left -= take;
        }
      });
      if (left > 0) return null;
      plans.push({ noteLine: noteLine, orderLine: orderLine, deductions: deductions });
    }
    return plans;
  }

  const originalSalesLineCoverage = salesLineCoverage;
  salesLineCoverage = function (line, orderId) {
    if (isNonStockSalesLine(line)) return originalSalesLineCoverage(line, orderId);
    const order = salesOrder(orderId || selectedSalesOrderId);
    if (!order) return originalSalesLineCoverage(line, orderId);
    const state = lineShipmentState(order, line);
    const availability = lineAvailability(line, order.id);
    const allocated = Math.min(state.remaining, num(line.allocated));
    const free = Math.min(Math.max(0, state.remaining - allocated), num(availability.free));
    const onPo = Math.min(Math.max(0, state.remaining - allocated - free), num(availability.linkedPoQty));
    const toRaise = Math.max(0, state.remaining - allocated - free - onPo);
    return {
      availability: availability,
      allocated: allocated,
      free: free,
      onPo: onPo,
      toRaise: toRaise,
      covered: allocated + free + onPo,
      required: state.remaining,
      ordered: state.ordered,
      shipped: state.shipped,
      remaining: state.remaining,
      onOpenNotes: state.onOpenNotes
    };
  };

  salesLineHealth = function (line, orderId) {
    if (isNonStockSalesLine(line)) return { className: line.lineType === 'shipping' ? 'shipping-row' : 'non-stock-row', pillClass: 'info', label: line.lineType === 'shipping' ? 'Shipping' : 'Non-stock', action: 'None', reason: 'This sales line does not allocate or deduct stock.' };
    const coverage = salesLineCoverage(line, orderId);
    if (coverage.required <= 0) return { className: 'line-row-shipped', pillClass: 'good', label: 'Shipped', action: 'Complete', reason: 'All ' + coverage.ordered + ' units have shipped across the linked goods notes.' };
    if (coverage.shipped > 0 && coverage.allocated >= coverage.required) return { className: 'line-row-part-shipped', pillClass: 'good', label: 'Part shipped', action: 'Create shipment', reason: coverage.shipped + ' shipped, ' + coverage.remaining + ' remaining and fully allocated.' };
    const stockCoverage = coverage.allocated + coverage.free;
    if (coverage.allocated >= coverage.required || stockCoverage >= coverage.required) return { className: 'line-row-ok', pillClass: 'good', label: coverage.shipped > 0 ? 'Part shipped' : 'In stock', action: 'Allocate', reason: coverage.allocated >= coverage.required ? 'Allocated stock covers the remaining quantity.' : 'Free stock can cover the remaining quantity.' };
    if (!coverage.toRaise && (coverage.allocated > 0 || coverage.onPo > 0 || coverage.free > 0)) return { className: 'line-row-warn', pillClass: 'warn', label: coverage.shipped > 0 ? 'Part shipped / due in' : 'Partial / goods-in', action: 'Link PO', reason: 'The remaining quantity is covered when stock and incoming PO/goods-in are combined.' };
    return { className: 'line-row-bad', pillClass: 'bad', label: coverage.shipped > 0 ? 'Part shipped / short' : 'Raise PO', action: 'Create PO', reason: 'The remaining quantity is short after stock and PO coverage.' };
  };

  goodsNoteAvailableLines = function (order) {
    return orderStockLines(order).map(function (line) {
      const state = lineShipmentState(order, line);
      return { productId: line.productId, qty: state.availableForNewNote, picked: 0, packed: 0, shipped: 0 };
    }).filter(function (line) { return line.qty > 0; });
  };

  applyGoodsNoteTotalsToOrder = function (order) {
    const totals = goodsNoteTotalsForOrder(order.id);
    order.lines.forEach(function (line) {
      if (isNonStockSalesLine(line)) return;
      const row = totals[line.productId] || { picked: 0, packed: 0, shipped: 0 };
      line.picked = Math.min(num(line.qty), num(row.picked));
      line.packed = Math.min(num(line.qty), num(row.packed));
      line.shipped = Math.min(num(line.qty), num(row.shipped));
    });
    const stockLines = orderStockLines(order);
    return stockLines.length > 0 && stockLines.every(function (line) {
      return shippedQuantity(order.id, line.productId) >= num(line.qty);
    });
  };

  syncSalesOrderStatusFromGoodsNotes = function (order) {
    if (!order) return false;
    const notes = goodsNotesForOrder(order.id);
    const allShipped = applyGoodsNoteTotalsToOrder(order);
    const stockLines = orderStockLines(order);
    const shippedUnits = stockLines.reduce(function (sum, line) { return sum + shippedQuantity(order.id, line.productId); }, 0);
    const hasPrinted = notes.some(function (note) { return note.printed && !note.shipped; });
    const hasPicked = notes.some(function (note) { return note.picked && !note.shipped; });
    const hasPacked = notes.some(function (note) { return note.packed && !note.shipped; });
    const allRemainingAllocated = stockLines.length > 0 && stockLines.every(function (line) {
      const state = lineShipmentState(order, line);
      return state.remaining <= 0 || num(line.allocated) >= state.remaining;
    });
    if (allShipped) {
      order.status = 'Shipped';
      order.tags = Array.from(new Set((order.tags || []).concat(['Invoice Ready']))).filter(function (tag) { return tag !== 'Ready to fulfil'; });
    } else if (shippedUnits > 0) {
      order.status = 'Part Shipped';
      order.tags = Array.from(new Set((order.tags || []).concat(['Part shipment'])));
    } else if (hasPacked) order.status = 'Ready To Ship';
    else if (hasPicked || hasPrinted) order.status = 'Picking';
    else order.status = allRemainingAllocated ? 'Ready To Pick' : 'Part Stock';
    return allShipped;
  };

  updateSalesOrderStatusAfterAllocation = function (order) {
    if (!order || !orderStockLines(order).length) return false;
    if (['Picking', 'Ready To Ship', 'Part Shipped', 'Shipped', 'Invoiced', 'Completed', 'Cancelled'].includes(order.status)) return false;
    const allAllocated = orderStockLines(order).every(function (line) {
      const state = lineShipmentState(order, line);
      return state.remaining <= 0 || num(line.allocated) >= state.remaining;
    });
    const nextStatus = allAllocated ? 'Ready To Pick' : 'Part Stock';
    if (order.status === nextStatus) return false;
    const previous = order.status;
    order.status = nextStatus;
    if (allAllocated) {
      order.tags = Array.from(new Set((order.tags || []).concat(['Ready to fulfil'])));
      addSalesOrderNotification(order, 'Allocation complete', 'All remaining product quantities are allocated. Order moved from ' + previous + ' to Ready To Pick.', 'Internal note');
    }
    return true;
  };

  const originalAllocateSalesOrderLine = allocateSalesOrderLine;
  allocateSalesOrderLine = function (orderId, productId, quiet) {
    const order = salesOrder(orderId);
    const line = order && order.lines.find(function (item) { return item.productId === productId; });
    if (!order || !line) return originalAllocateSalesOrderLine(orderId, productId, quiet);
    if (isNonStockSalesLine(line)) {
      line.allocated = num(line.qty);
      if (!quiet) { toast('Non-stock lines do not require allocation.'); render(); }
      return;
    }
    const state = lineShipmentState(order, line);
    const needed = Math.max(0, state.remaining - num(line.allocated));
    if (!needed) {
      if (!quiet) toast(state.remaining ? 'The remaining quantity is fully allocated.' : 'This line is fully shipped.');
      return;
    }
    let left = needed;
    stockRowsForProduct(productId).slice().sort(function (a, b) { return available(b) - available(a); }).forEach(function (row) {
      if (!left) return;
      const take = Math.min(left, Math.max(0, available(row)));
      if (!take) return;
      row.allocated = num(row.allocated) + take;
      line.allocated = num(line.allocated) + take;
      left -= take;
      addMovement('Allocation', productId, take, row.locationId, order.id, order.id, 'Office');
    });
    if (left > 0) {
      order.tags = Array.from(new Set((order.tags || []).concat(['Backorder'])));
      order.status = 'Part Stock';
    }
    updateSalesOrderStatusAfterAllocation(order);
    saveAppData();
    if (!quiet) { toast((needed - left) + ' allocated to the remaining quantity on ' + order.id + '.'); render(); }
  };

  allocateSalesOrder = function (orderId) {
    const order = salesOrder(orderId);
    if (!order) return;
    orderStockLines(order).forEach(function (line) { allocateSalesOrderLine(orderId, line.productId, true); });
    syncSalesOrderStatusFromGoodsNotes(order);
    saveAppData();
    const summary = orderShipmentSummary(order);
    toast(order.id + (summary.allocated >= summary.remaining ? ' remaining quantity fully allocated.' : ' partially allocated.'));
    render();
  };

  const originalUpdateSalesOrderLineNumber = updateSalesOrderLineNumber;
  updateSalesOrderLineNumber = function (orderId, productId, field, value) {
    const order = salesOrder(orderId);
    const line = order && order.lines.find(function (item) { return item.productId === productId; });
    if (!order || !line || isNonStockSalesLine(line) || !['qty', 'allocated'].includes(field)) return originalUpdateSalesOrderLineNumber(orderId, productId, field, value);
    const next = Math.max(0, Math.floor(num(value)));
    const stateBefore = lineShipmentState(order, line);
    if (field === 'qty') {
      if (next < stateBefore.shipped) {
        toast('Quantity cannot be lower than the ' + stateBefore.shipped + ' units already shipped. Use a sales credit or return for shipped goods.');
        render();
        return;
      }
      line.qty = next;
      const remaining = Math.max(0, next - stateBefore.shipped);
      if (num(line.allocated) > remaining) releaseAllocatedStockForLine(order, line, num(line.allocated) - remaining, 'Allocation Release');
      syncSalesOrderStatusFromGoodsNotes(order);
      saveAppData();
      toast('Order quantity updated. ' + remaining + ' units remain to fulfil.');
      render();
      return;
    }
    const state = lineShipmentState(order, line);
    const target = Math.min(next, state.remaining);
    const difference = target - num(line.allocated);
    if (difference > 0) {
      let left = difference;
      stockRowsForProduct(productId).slice().sort(function (a, b) { return available(b) - available(a); }).forEach(function (row) {
        if (!left) return;
        const take = Math.min(left, Math.max(0, available(row)));
        if (!take) return;
        row.allocated = num(row.allocated) + take;
        line.allocated = num(line.allocated) + take;
        left -= take;
        addMovement('Allocation', productId, take, row.locationId, order.id, order.id, 'Office');
      });
      if (left) toast('Only ' + (difference - left) + ' additional units were free to allocate.');
    } else if (difference < 0) releaseAllocatedStockForLine(order, line, Math.abs(difference), 'Unallocation');
    syncSalesOrderStatusFromGoodsNotes(order);
    saveAppData();
    toast('Allocation updated for the remaining shipment quantity.');
    render();
  };

  shipGoodsNote = function (note) {
    if (!note || note.shipped || !note.packed) return false;
    const order = salesOrder(note.salesOrderId);
    if (!order) return false;
    const plans = shipmentDeductionPlan(order, note);
    if (!plans) {
      toast('This goods note cannot ship because its allocated or physical stock no longer covers the note quantity. Review allocation first.');
      return false;
    }
    plans.forEach(function (plan) {
      plan.deductions.forEach(function (entry) {
        const row = entry.row;
        const quantity = entry.qty;
        row.qty = Math.max(0, num(row.qty) - quantity);
        row.allocated = Math.max(0, num(row.allocated) - Math.min(quantity, num(row.allocated)));
        addMovement('Goods Out', plan.noteLine.productId, quantity, row.locationId, order.id, note.id, currentUser().name);
      });
      plan.orderLine.allocated = Math.max(0, num(plan.orderLine.allocated) - num(plan.noteLine.qty));
      plan.noteLine.shipped = num(plan.noteLine.qty);
    });
    note.shipped = true;
    note.shippedAt = new Date().toISOString();
    note.shippedBy = currentUser().name;
    note.stockDeducted = true;
    syncSalesOrderStatusFromGoodsNotes(order);
    addNotification(note, 'Ship', 'Your order has shipped with ' + (note.courier || 'Courier') + ' tracking ' + (note.trackingRef || 'Tracking pending'), 'Sent');
    saveAppData();
    return true;
  };

  fulfilSalesOrder = function (orderId) {
    openPartialFulfilment(orderId, []);
  };

  createSelectedLineGoodsNote = function (order, lines) {
    const ids = (lines || []).filter(function (line) { return !isNonStockSalesLine(line); }).map(function (line) { return line.productId; });
    if (!ids.length) return toast('Non-stock and shipping lines do not require fulfilment.');
    openPartialFulfilment(order.id, ids);
  };

  const originalRunBulkGoodsOutAction = runBulkGoodsOutAction;
  runBulkGoodsOutAction = function (action) {
    if (action !== 'pickList') return originalRunBulkGoodsOutAction(action);
    const notes = selectedGoodsOutQueueNotes();
    if (!notes.length) return toast('Select one or more goods-out notes first.');
    if (!printBulkPickingList(notes)) return;
    let changed = 0;
    notes.forEach(function (note) {
      changed += markGoodsNotePrinted(note, true, true, false) ? 1 : 0;
    });
    saveAppData();
    toast(changed + ' picking list' + (changed === 1 ? '' : 's') + ' printed. Picked quantities remain unconfirmed until warehouse staff mark them picked.');
    render();
  };

  const originalGoodsNoteWorkspace = goodsNoteWorkspace;
  goodsNoteWorkspace = function (note) {
    const html = originalGoodsNoteWorkspace(note);
    const order = salesOrder(note.salesOrderId);
    if (!order) return html;
    const noteUnits = (note.lines || []).reduce(function (sum, line) { return sum + num(line.qty); }, 0);
    const summary = orderShipmentSummary(order);
    const sequence = note.shipmentSequence || Math.max(1, goodsNotesForOrder(order.id).indexOf(note) + 1);
    const banner = '<section class="goods-note-partial-banner"><div><span>Shipment ' + sequence + '</span><strong>' + noteUnits + ' unit' + (noteUnits === 1 ? '' : 's') + ' on this goods note</strong><small>' + summary.shipped + ' shipped across the order · ' + summary.remaining + ' remaining</small></div><button type="button" class="secondary" data-create-another-shipment="' + esc(order.id) + '">Create another shipment</button></section>';
    return html.replace('<div class="stage-grid">', banner + '<div class="stage-grid">');
  };

  const originalSplitOrderControl = splitOrderControl;
  splitOrderControl = function (note) {
    const order = salesOrder(note.salesOrderId);
    if (!order) return originalSplitOrderControl(note);
    const rows = orderStockLines(order).map(function (line) {
      const p = product(line.productId) || {};
      const state = lineShipmentState(order, line);
      return '<tr><td><strong>' + esc(p.name || 'Product') + '</strong><br><span class="muted">' + esc(p.sku || '') + '</span></td><td>' + state.ordered + '</td><td>' + state.shipped + '</td><td>' + state.remaining + '</td><td>' + state.allocated + '</td><td>' + state.availableForNewNote + '</td></tr>';
    }).join('');
    return '<div class="partial-balance-panel"><div><strong>Multiple goods notes supported</strong><p>Create a separate goods note for each collection, pallet, courier or delivery date. Shipped quantities reduce stock and allocation while the balance stays on the sales order.</p></div><button type="button" data-create-another-shipment="' + esc(order.id) + '">Create next shipment</button></div><div class="order-lines-scroll compact"><table><thead><tr><th>Item</th><th>Ordered</th><th>Shipped</th><th>Remaining</th><th>Allocated</th><th>Available for next note</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  };

  const originalSalesOrderDetail = salesOrderDetail;
  salesOrderDetail = function (order) {
    const html = originalSalesOrderDetail(order);
    const template = document.createElement('template');
    template.innerHTML = html;
    const table = template.content.querySelector('.order-lines-table');
    if (table && !table.closest('.order-lines-scroll')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'order-lines-scroll';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
    const stockLines = orderStockLines(order);
    const summary = orderShipmentSummary(order);
    if (table && stockLines.length) {
      const overview = document.createElement('section');
      overview.className = 'order-shipment-summary';
      overview.innerHTML = '<div><span>Order fulfilment</span><strong>' + summary.shipped + ' of ' + summary.ordered + ' shipped</strong><small>' + summary.remaining + ' remaining · ' + summary.allocated + ' allocated · ' + summary.open + ' on open goods notes</small></div><div class="order-shipment-progress"><span style="width:' + (summary.ordered ? Math.min(100, Math.round(summary.shipped / summary.ordered * 100)) : 0) + '%"></span></div><button type="button" data-create-another-shipment="' + esc(order.id) + '"' + (summary.available > 0 ? '' : ' disabled') + '>Create shipment</button>';
      const wrapper = template.content.querySelector('.order-lines-scroll');
      if (wrapper) wrapper.parentNode.insertBefore(overview, wrapper);
    }
    stockLines.forEach(function (line) {
      const selector = '[data-line-field="' + CSS.escape(order.id + '|' + line.productId + '|qty') + '"]';
      const qtyInput = template.content.querySelector(selector);
      if (!qtyInput) return;
      const row = qtyInput.closest('tr');
      if (!row) return;
      const state = lineShipmentState(order, line);
      row.classList.toggle('has-partial-shipment', state.shipped > 0 && state.remaining > 0);
      row.classList.toggle('is-fully-shipped', state.remaining <= 0);
      const qtyCell = qtyInput.closest('td');
      if (qtyCell && !qtyCell.querySelector('.shipment-progress-inline')) {
        qtyCell.insertAdjacentHTML('beforeend', '<div class="shipment-progress-inline"><span><b>' + state.shipped + '</b> shipped</span><span><b>' + state.remaining + '</b> remaining</span><div><i style="width:' + (state.ordered ? Math.min(100, Math.round(state.shipped / state.ordered * 100)) : 0) + '%"></i></div></div>');
      }
      const allocationInput = row.querySelector('[data-line-field="' + CSS.escape(order.id + '|' + line.productId + '|allocated') + '"]');
      if (allocationInput) {
        allocationInput.max = String(state.remaining);
        allocationInput.value = String(Math.min(state.remaining, num(line.allocated)));
        allocationInput.disabled = state.remaining <= 0;
        allocationInput.insertAdjacentHTML('afterend', '<small class="remaining-allocation-copy">Reserved against ' + state.remaining + ' remaining</small>');
      }
      const actionCell = row.querySelector('td:last-child .line-actions');
      if (actionCell && state.remaining > 0) actionCell.insertAdjacentHTML('afterbegin', '<button type="button" class="ship-part-button" data-partial-fulfil-line="' + esc(order.id) + '|' + esc(line.productId) + '"' + (state.availableForNewNote > 0 ? '' : ' disabled') + '>Ship part</button>');
    });
    const fulfilButton = template.content.querySelector('[data-fulfil-order]');
    if (fulfilButton) fulfilButton.textContent = 'Create shipment';
    const advancedButton = template.content.querySelector('[data-selected-line-action="advancedFulfil"]');
    if (advancedButton) advancedButton.textContent = 'Create selected shipment';
    const container = document.createElement('div');
    container.appendChild(template.content.cloneNode(true));
    return container.innerHTML;
  };

  document.addEventListener('click', function (event) {
    const rowButton = event.target.closest && event.target.closest('[data-partial-fulfil-line]');
    if (rowButton) {
      event.preventDefault();
      const parts = rowButton.dataset.partialFulfilLine.split('|');
      openPartialFulfilment(parts[0], [parts.slice(1).join('|')]);
      return;
    }
    const another = event.target.closest && event.target.closest('[data-create-another-shipment]');
    if (another) {
      event.preventDefault();
      openPartialFulfilment(another.dataset.createAnotherShipment, []);
    }
  });

  document.addEventListener('click', function (event) {
    const createNote = event.target.closest && event.target.closest('[data-create-note]');
    const splitNote = event.target.closest && event.target.closest('[data-split-note]');
    if (!createNote && !splitNote) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (createNote) openPartialFulfilment(createNote.dataset.createNote, []);
    if (splitNote) {
      const note = goodsNote(splitNote.dataset.splitNote);
      if (note) openPartialFulfilment(note.salesOrderId, []);
    }
  }, true);

  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && fulfilOrderId) closePartialFulfilment();
  });

  window.PoolShedPartialFulfilment = {
    version: VERSION,
    lineShipmentState: lineShipmentState,
    orderShipmentSummary: orderShipmentSummary,
    shippedQuantity: shippedQuantity,
    openGoodsNoteQuantity: openGoodsNoteQuantity,
    open: openPartialFulfilment
  };
})();
