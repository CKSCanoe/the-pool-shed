/* Pool Shed Warehouse Precision Desk authority layer.
   Owns Warehouse FIFO allocation and the selected Concept C presentation.
   v1.8.0 */

(function () {
  function warehouseNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function warehouseText(value) {
    return String(value == null ? '' : value);
  }

  function warehouseIsoDate(value, fallback) {
    const text = warehouseText(value).trim();
    return text || fallback || '9999-12-31';
  }

  function warehouseAllocationEventId(prefix) {
    try {
      if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch (error) {}
    return (prefix || 'ALLOC') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  function warehouseOrderTerminal(order) {
    return !order || ['Cancelled', 'Completed', 'Shipped', 'Invoiced'].includes(order.status);
  }

  function warehouseEligibleShortages(productId) {
    const rows = [];
    (data.salesOrders || []).forEach(function (order) {
      if (warehouseOrderTerminal(order)) return;
      (order.lines || []).forEach(function (line, lineIndex) {
        if (line.productId !== productId) return;
        const shortage = Math.max(0, warehouseNumber(line.qty) - warehouseNumber(line.allocated));
        if (!shortage) return;
        rows.push({ order: order, line: line, shortage: shortage, lineIndex: lineIndex });
      });
    });
    rows.sort(function (a, b) {
      const createdA = warehouseIsoDate(a.order.created);
      const createdB = warehouseIsoDate(b.order.created);
      if (createdA !== createdB) return createdA.localeCompare(createdB);
      const dueA = warehouseIsoDate(a.order.due);
      const dueB = warehouseIsoDate(b.order.due);
      if (dueA !== dueB) return dueA.localeCompare(dueB);
      const idCompare = warehouseText(a.order.id).localeCompare(warehouseText(b.order.id), undefined, { numeric: true, sensitivity: 'base' });
      if (idCompare) return idCompare;
      return a.lineIndex - b.lineIndex;
    });
    return rows;
  }

  function warehouseAllocationUser() {
    try {
      if (typeof currentUser === 'function') {
        const user = currentUser();
        return (user && (user.name || user.email)) || 'Warehouse';
      }
    } catch (error) {}
    return 'Warehouse';
  }

  function warehouseRecordAllocationEvent(event) {
    data.allocationEvents = data.allocationEvents || [];
    data.allocationEvents.push(Object.assign({
      id: warehouseAllocationEventId('ALLOC'),
      date: new Date().toISOString(),
      user: warehouseAllocationUser()
    }, event));
  }

  function warehouseAllocateAcceptedStock(po, line, qty, targetLocation) {
    const requested = Math.max(0, warehouseNumber(qty));
    if (!po || !line || !line.productId || !requested) return { allocated: 0, remaining: requested, allocations: [] };
    if (['L-RECEIVING', 'L-QUARANTINE'].includes(targetLocation)) return { allocated: 0, remaining: requested, allocations: [] };

    const stockRow = (data.stock || []).find(function (row) {
      return row.productId === line.productId && row.locationId === targetLocation;
    });
    const freeAtLocation = stockRow && typeof available === 'function' ? Math.max(0, warehouseNumber(available(stockRow))) : 0;
    let remaining = Math.min(requested, freeAtLocation);
    const allocations = [];
    const demandSourceSalesOrderId = line.salesOrderId || '';

    line.salesOrderAllocations = line.salesOrderAllocations || [];

    warehouseEligibleShortages(line.productId).some(function (shortage) {
      if (remaining <= 0) return true;
      const allocateQty = Math.min(shortage.shortage, remaining);
      if (!allocateQty) return false;

      shortage.line.allocated = warehouseNumber(shortage.line.allocated) + allocateQty;
      stockRow.allocated = warehouseNumber(stockRow.allocated) + allocateQty;
      remaining -= allocateQty;

      const allocation = {
        salesOrderId: shortage.order.id,
        qty: allocateQty,
        date: typeof todayIso === 'function' ? todayIso() : new Date().toISOString().slice(0, 10),
        method: 'FIFO',
        poId: po.id || '',
        receiptLineId: line.receiptLineId || '',
        demandSourceSalesOrderId: demandSourceSalesOrderId
      };
      line.salesOrderAllocations.push(allocation);
      allocations.push(allocation);

      warehouseRecordAllocationEvent({
        type: 'AUTO_FIFO',
        method: 'FIFO',
        productId: line.productId,
        qty: allocateQty,
        poId: po.id || '',
        receiptLineId: line.receiptLineId || '',
        salesOrderId: shortage.order.id,
        demandSourceSalesOrderId: demandSourceSalesOrderId,
        locationId: targetLocation
      });

      if (typeof updateSalesOrderStatusAfterAllocation === 'function') updateSalesOrderStatusAfterAllocation(shortage.order);
      if (typeof addSalesOrderNotification === 'function') {
        const sourceCopy = demandSourceSalesOrderId && demandSourceSalesOrderId !== shortage.order.id
          ? ' PO demand originated from ' + demandSourceSalesOrderId + '; FIFO priority allocated this receipt here.'
          : '';
        addSalesOrderNotification(shortage.order, 'FIFO goods-in allocation', allocateQty + ' x ' + (typeof product === 'function' && product(line.productId) ? product(line.productId).sku : line.productId) + ' received from ' + (po.id || 'PO') + ' and allocated automatically.' + sourceCopy, 'Internal note');
      }
      if (typeof addMovement === 'function') {
        addMovement('FIFO Sales Allocation', line.productId, allocateQty, po.id || 'Goods In', shortage.order.id, line.receiptLineId || po.id || 'FIFO', warehouseAllocationUser(), 'Exact-SKU automatic allocation. Oldest eligible Sales Order first.' + (demandSourceSalesOrderId ? ' PO demand source: ' + demandSourceSalesOrderId + '.' : ''));
      }
      return false;
    });

    return { allocated: requested - remaining, remaining: remaining, allocations: allocations };
  }

  function warehouseReallocateSalesStock(productId, fromOrderId, toOrderId, qty, reason) {
    const quantity = warehouseNumber(qty);
    const rationale = warehouseText(reason).trim();
    if (!rationale) return { ok: false, error: 'A reallocation reason is required.' };
    if (!productId || !fromOrderId || !toOrderId || fromOrderId === toOrderId || !Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: 'Choose two different Sales Orders and a valid quantity.' };

    const sourceOrder = typeof salesOrder === 'function' ? salesOrder(fromOrderId) : (data.salesOrders || []).find(function (order) { return order.id === fromOrderId; });
    const targetOrder = typeof salesOrder === 'function' ? salesOrder(toOrderId) : (data.salesOrders || []).find(function (order) { return order.id === toOrderId; });
    if (!sourceOrder || !targetOrder || warehouseOrderTerminal(sourceOrder) || warehouseOrderTerminal(targetOrder)) return { ok: false, error: 'Both Sales Orders must be open and allocatable.' };

    const sourceLine = (sourceOrder.lines || []).find(function (line) { return line.productId === productId; });
    const targetLine = (targetOrder.lines || []).find(function (line) { return line.productId === productId; });
    if (!sourceLine || !targetLine) return { ok: false, error: 'The exact product must exist on both Sales Orders.' };

    const sourceAllocated = warehouseNumber(sourceLine.allocated);
    const targetShortage = Math.max(0, warehouseNumber(targetLine.qty) - warehouseNumber(targetLine.allocated));
    if (sourceAllocated < quantity) return { ok: false, error: 'The source Sales Order does not own enough allocated stock.' };
    if (targetShortage < quantity) return { ok: false, error: 'The destination Sales Order does not need that quantity.' };

    sourceLine.allocated = sourceAllocated - quantity;
    targetLine.allocated = warehouseNumber(targetLine.allocated) + quantity;

    if (typeof updateSalesOrderStatusAfterAllocation === 'function') {
      updateSalesOrderStatusAfterAllocation(sourceOrder);
      updateSalesOrderStatusAfterAllocation(targetOrder);
    }

    warehouseRecordAllocationEvent({
      type: 'MANUAL_REALLOCATION',
      method: 'Manual override',
      productId: productId,
      qty: quantity,
      fromSalesOrderId: sourceOrder.id,
      salesOrderId: targetOrder.id,
      reason: rationale
    });

    if (typeof addMovement === 'function') addMovement('Allocation Reallocation', productId, quantity, sourceOrder.id, targetOrder.id, 'Manual allocation override', warehouseAllocationUser(), rationale);
    if (typeof addSalesOrderNotification === 'function') {
      addSalesOrderNotification(sourceOrder, 'Allocation reallocated', quantity + ' x ' + (typeof product === 'function' && product(productId) ? product(productId).sku : productId) + ' moved from this order to ' + targetOrder.id + '. Reason: ' + rationale, 'Internal note');
      addSalesOrderNotification(targetOrder, 'Allocation received', quantity + ' x ' + (typeof product === 'function' && product(productId) ? product(productId).sku : productId) + ' reallocated from ' + sourceOrder.id + '. Reason: ' + rationale, 'Internal note');
    }

    return {
      ok: true,
      productId: productId,
      qty: quantity,
      fromOrderId: sourceOrder.id,
      toOrderId: targetOrder.id,
      reason: rationale,
      sourceStatus: sourceOrder.status,
      destinationStatus: targetOrder.status
    };
  }

  // Existing receipt/putaway code calls this name. Replace linked-order-first logic with FIFO authority.
  autoAllocateReceivedStock = function (po, line, qty, targetLocation) {
    return warehouseAllocateAcceptedStock(po, line, qty, targetLocation);
  };

  globalThis.warehouseEligibleShortages = warehouseEligibleShortages;
  globalThis.warehouseAllocateAcceptedStock = warehouseAllocateAcceptedStock;
  globalThis.warehouseReallocateSalesStock = warehouseReallocateSalesStock;
  globalThis.warehouseAllocationEventId = warehouseAllocationEventId;
  globalThis.warehouseAllocationUser = warehouseAllocationUser;
})();

(function () {
  const whEventId = globalThis.warehouseAllocationEventId;
  const whAllocationUser = globalThis.warehouseAllocationUser;
  const warehouseViews = ['Work Queue', 'Inbound', 'Transfers', 'Returns & Quarantine', 'Counts', 'Audit'];
  const warehouseLegacySidebarSubGroups = typeof sidebarSubGroups === 'function' ? sidebarSubGroups : null;
  const warehouseLegacyDefaultSubPage = typeof defaultSubPage === 'function' ? defaultSubPage : null;
  const warehouseLegacyOpenSidebarSubGroup = typeof openSidebarSubGroup === 'function' ? openSidebarSubGroup : null;

  function whEsc(value) {
    return typeof escapeHtml === 'function' ? escapeHtml(String(value == null ? '' : value)) : String(value == null ? '' : value);
  }

  function whMoney(value) {
    return typeof money === 'function' ? money(Number(value || 0)) : '£' + Number(value || 0).toFixed(2);
  }

  function whProduct(id) {
    return typeof product === 'function' ? product(id) : (data.products || []).find(function (item) { return item.id === id; });
  }

  function whLocation(id) {
    return typeof locationById === 'function' ? locationById(id) : (data.locations || []).find(function (item) { return item.id === id; });
  }

  function whPending(line) {
    return typeof poLinePending === 'function' ? poLinePending(line) : Math.max(0, Number(line.qty || 0) - Number(line.received || 0));
  }

  function whReceiptRemaining(event) {
    if (typeof receiptRemaining === 'function') return receiptRemaining(event, typeof putawayTransferTotals === 'function' ? putawayTransferTotals() : undefined);
    if (!event || event.locationId !== 'L-RECEIVING') return 0;
    const moved = (data.putawayTransfers || []).filter(function (row) { return row.receiptId === event.id; }).reduce(function (sum, row) { return sum + Number(row.qty || 0); }, 0);
    return Math.max(0, Number(event.qty || 0) - moved);
  }

  function whNormaliseView(view) {
    const map = {
      'Goods In': 'Inbound',
      'QC Checks': 'Inbound',
      'Guided Putaway': 'Inbound',
      'Label Printing': 'Inbound',
      'Returns': 'Returns & Quarantine',
      'Damaged': 'Returns & Quarantine',
      'Stock Counts': 'Counts'
    };
    const normal = map[view] || view;
    return warehouseViews.includes(normal) ? normal : 'Work Queue';
  }

  sidebarSubGroups = function (tabId) {
    if (tabId === 'warehouse') return warehouseViews.slice();
    return warehouseLegacySidebarSubGroups ? warehouseLegacySidebarSubGroups(tabId) : [];
  };

  defaultSubPage = function (tabId) {
    if (tabId === 'warehouse') return 'Work Queue';
    return warehouseLegacyDefaultSubPage ? warehouseLegacyDefaultSubPage(tabId) : '';
  };

  openSidebarSubGroup = function (tabId, subgroup) {
    if (tabId !== 'warehouse') return warehouseLegacyOpenSidebarSubGroup ? warehouseLegacyOpenSidebarSubGroup(tabId, subgroup) : undefined;
    const mapped = whNormaliseView(subgroup);
    active = 'warehouse';
    activeSubPage.warehouse = mapped;
    if (mapped === 'Inbound') warehousePoView = 'list';
    if (typeof toast === 'function') toast(mapped + ' opened.');
    if (typeof render === 'function') render();
  };

  function whEnsureReceivingLocation() {
    data.locations = data.locations || [];
    if (!data.locations.some(function (loc) { return loc.id === 'L-RECEIVING'; })) {
      data.locations.push({ id: 'L-RECEIVING', name: 'Goods In / Receiving Bay', type: 'Receiving Bay', owner: 'Warehouse', barcode: 'LOC-RECEIVING' });
    }
  }

  function whStockKpis() {
    const openPos = (data.purchaseOrders || []).filter(function (po) { return !['Received', 'Cancelled', 'Draft - Review', 'Ready To Email'].includes(po.status); });
    const inbound = openPos.reduce(function (sum, po) { return sum + (po.lines || []).reduce(function (n, line) { return n + whPending(line); }, 0); }, 0);
    const receiving = (data.receiptEvents || []).reduce(function (sum, event) { return sum + whReceiptRemaining(event); }, 0);
    const quarantine = (data.stock || []).filter(function (row) { return row.locationId === 'L-QUARANTINE'; }).reduce(function (sum, row) { return sum + Number(row.qty || 0); }, 0);
    const allocated = (data.stock || []).reduce(function (sum, row) { return sum + Number(row.allocated || 0); }, 0);
    const availableUnits = (data.stock || []).reduce(function (sum, row) { return sum + (typeof available === 'function' ? Number(available(row) || 0) : Math.max(0, Number(row.qty || 0) - Number(row.allocated || 0))); }, 0);
    return { openPos: openPos.length, inbound: inbound, receiving: receiving, quarantine: quarantine, allocated: allocated, available: availableUnits };
  }

  function whTabs(activeView) {
    return '<div class="warehouse-precision-tabs" role="tablist" aria-label="Warehouse workspace">' + warehouseViews.map(function (view) {
      return '<button type="button" role="tab" class="' + (view === activeView ? 'active' : '') + '" data-wh-view="' + whEsc(view) + '">' + whEsc(view) + '</button>';
    }).join('') + '</div>';
  }

  function whCommandStrip() {
    const kpi = whStockKpis();
    return '<section class="wh-command-strip"><div class="wh-command-head"><div><span class="wh-eyebrow">WAREHOUSE CONTROL</span><h2>Precision stock control</h2><p>Physical stock, FIFO allocation and exceptions are controlled from one stock truth.</p></div><div class="wh-command-actions"><button type="button" class="secondary" data-wh-view="Inbound">Receive delivery</button><button type="button" data-wh-view="Transfers">New transfer</button></div></div><div class="wh-metrics">' +
      '<div><span>OPEN POs</span><strong>' + kpi.openPos + '</strong><small>' + kpi.inbound + ' units inbound</small></div>' +
      '<div><span>RECEIVING / QC</span><strong>' + kpi.receiving + '</strong><small>not yet allocatable</small></div>' +
      '<div><span>QUARANTINE</span><strong>' + kpi.quarantine + '</strong><small>blocked stock</small></div>' +
      '<div><span>ALLOCATED</span><strong>' + kpi.allocated + '</strong><small>hard reservations</small></div>' +
      '<div><span>AVAILABLE</span><strong>' + kpi.available + '</strong><small>free accepted stock</small></div>' +
      '<div><span>ALLOCATION RULE</span><strong>FIFO</strong><small>oldest order first</small></div>' +
    '</div></section>';
  }

  function whQueueItems() {
    const items = [];
    (data.purchaseOrders || []).forEach(function (po) {
      if (['Cancelled', 'Received', 'Draft - Review', 'Ready To Email'].includes(po.status)) return;
      const pending = (po.lines || []).reduce(function (sum, line) { return sum + whPending(line); }, 0);
      if (!pending) return;
      const overdue = po.due && po.due < (typeof todayIso === 'function' ? todayIso() : new Date().toISOString().slice(0,10));
      items.push({ priority: overdue ? 1 : 2, type: 'Receive', ref: po.id, title: po.supplier || 'Supplier PO', detail: pending + ' unit' + (pending === 1 ? '' : 's') + ' outstanding · due ' + (po.due || 'not set'), status: overdue ? 'Overdue' : 'Inbound', tone: overdue ? 'bad' : 'info', action: 'Inbound' });
    });
    (data.receiptEvents || []).forEach(function (event) {
      const remaining = whReceiptRemaining(event);
      if (!remaining) return;
      const p = whProduct(event.productId) || { sku: event.productId, name: event.productId };
      items.push({ priority: 1, type: 'QC / Putaway', ref: event.poId || event.id, title: p.sku + ' · ' + p.name, detail: remaining + ' physically received · awaiting QC release', status: 'Action now', tone: 'warn', action: 'Inbound' });
    });
    (data.stock || []).filter(function (row) { return row.locationId === 'L-QUARANTINE' && Number(row.qty || 0) > 0; }).forEach(function (row) {
      const p = whProduct(row.productId) || { sku: row.productId, name: row.productId };
      items.push({ priority: 2, type: 'Quarantine', ref: row.productId, title: p.sku + ' · ' + p.name, detail: row.qty + ' unit' + (row.qty === 1 ? '' : 's') + ' blocked from allocation', status: 'Review', tone: 'bad', action: 'Returns & Quarantine' });
    });
    (data.stockTakes || []).filter(function (take) { return ['Submitted','Approved','In progress'].includes(take.status); }).forEach(function (take) {
      const loc = whLocation(take.locationId);
      items.push({ priority: take.status === 'Submitted' ? 2 : 3, type: 'Count', ref: take.id || take.locationId, title: loc ? loc.name : take.locationId, detail: 'Stock count ' + take.status, status: take.status, tone: 'warn', action: 'Counts' });
    });
    return items.sort(function (a, b) { return a.priority - b.priority || a.type.localeCompare(b.type) || a.ref.localeCompare(b.ref); });
  }

  function whPill(text, tone) {
    return '<span class="wh-pill ' + (tone || 'info') + '">' + whEsc(text) + '</span>';
  }

  function whWorkQueuePage() {
    const items = whQueueItems();
    const rows = items.map(function (item, index) {
      return '<tr class="' + (index === 0 ? 'selected' : '') + '" data-wh-inspect-row="true" data-wh-inspect-type="' + whEsc(item.type) + '" data-wh-inspect-ref="' + whEsc(item.ref) + '" data-wh-inspect-title="' + whEsc(item.title) + '" data-wh-inspect-detail="' + whEsc(item.detail) + '" data-wh-inspect-action="' + whEsc(item.action) + '"><td>' + whPill('P' + item.priority, item.priority === 1 ? 'bad' : item.priority === 2 ? 'warn' : 'info') + '</td><td><strong>' + whEsc(item.type) + '</strong><small>' + whEsc(item.ref) + '</small></td><td><strong>' + whEsc(item.title) + '</strong><small>' + whEsc(item.detail) + '</small></td><td>' + whPill(item.status, item.tone) + '</td><td><button type="button" class="link-button" data-wh-view="' + whEsc(item.action) + '">Open</button></td></tr>';
    }).join('') || '<tr><td colspan="5" class="wh-empty">No Warehouse exceptions. Receiving, allocation and counts are clear.</td></tr>';
    const first = items[0] || { type: 'Warehouse clear', ref: 'No action', title: 'No urgent work', detail: 'No receiving, quarantine or count exceptions are waiting.', action: 'Inbound' };
    return '<div class="wh-work-layout"><section class="wh-card"><div class="wh-card-head"><div><h3>Priority work queue</h3><p>Exceptions first. Click a row to inspect it without leaving Warehouse.</p></div><span>' + items.length + ' active</span></div><div class="wh-table-wrap"><table class="wh-table"><thead><tr><th>Priority</th><th>Stage</th><th>Record</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></section>' +
      '<aside class="wh-card wh-inspector" id="whInspector"><div class="wh-card-head"><div><h3>Selected work item</h3><p id="whInspectType">' + whEsc(first.type) + ' · ' + whEsc(first.ref) + '</p></div></div><div class="wh-inspector-body"><span class="wh-eyebrow">CURRENT ACTION</span><h3 id="whInspectTitle">' + whEsc(first.title) + '</h3><p id="whInspectDetail">' + whEsc(first.detail) + '</p><div class="wh-process"><span class="done">Receive</span><span>QC</span><span>Putaway</span></div><button type="button" class="primary" id="whInspectOpen" data-wh-view="' + whEsc(first.action) + '">Open workspace</button><div class="wh-rule-note"><strong>Automatic allocation rule</strong><p>Accepted exact-SKU stock allocates to the <b>oldest eligible Sales Order first</b>. A PO link records where demand originated, but it cannot jump an older order.</p></div></div></aside></div>' + whReallocationPanel();
  }

  function whReallocationPanel() {
    const products = (data.products || []).filter(function (p) {
      return (data.salesOrders || []).some(function (order) { return (order.lines || []).some(function (line) { return line.productId === p.id && (Number(line.allocated || 0) > 0 || Number(line.qty || 0) > Number(line.allocated || 0)); }); });
    });
    const productOptions = products.map(function (p) { return '<option value="' + whEsc(p.id) + '">' + whEsc(p.sku + ' · ' + p.name) + '</option>'; }).join('');
    const orderOptions = (data.salesOrders || []).filter(function (order) { return !['Cancelled','Completed','Shipped','Invoiced'].includes(order.status); }).map(function (order) { return '<option value="' + whEsc(order.id) + '">' + whEsc(order.id + ' · ' + (order.due || 'No due date')) + '</option>'; }).join('');
    return '<section class="wh-card wh-reallocation"><div class="wh-card-head"><div><h3>Allocation review</h3><p>FIFO always runs first. Use this only when a deliberate move can complete another order while the source remains blocked.</p></div>' + whPill('Manual override', 'warn') + '</div><div class="wh-reallocate-form"><label>Exact product<select data-wh-reallocate-product>' + productOptions + '</select></label><label>From Sales Order<select data-wh-reallocate-from>' + orderOptions + '</select></label><label>To Sales Order<select data-wh-reallocate-to>' + orderOptions + '</select></label><label>Qty<input type="number" min="1" value="1" data-wh-reallocate-qty></label><label class="reason">Reason<input data-wh-reallocate-reason placeholder="Why does this improve fulfilment?" required></label><button type="button" class="primary" data-wh-reallocate>Review & reallocate</button></div><div class="wh-rule-note"><strong>Controlled override</strong><p>The physical stock total does not change. Pool Shed records who moved the allocation, the exact SKU, both Sales Orders, quantity and reason.</p></div></section>';
  }

  function whOpenPoRows() {
    const today = typeof todayIso === 'function' ? todayIso() : new Date().toISOString().slice(0,10);
    return (data.purchaseOrders || []).filter(function (po) { return !['Cancelled','Received','Draft - Review','Ready To Email'].includes(po.status) && (po.lines || []).some(function (line) { return whPending(line) > 0; }); }).sort(function (a,b) { return String(a.due || '9999').localeCompare(String(b.due || '9999')) || String(a.id).localeCompare(String(b.id), undefined, {numeric:true}); }).map(function (po) {
      const pending = (po.lines || []).reduce(function (sum, line) { return sum + whPending(line); }, 0);
      const received = (po.lines || []).reduce(function (sum, line) { return sum + Number(line.received || 0); }, 0);
      const ordered = (po.lines || []).reduce(function (sum, line) { return sum + Number(line.qty || 0); }, 0);
      const linked = Array.from(new Set((po.lines || []).map(function (line) { return line.salesOrderId; }).filter(Boolean))).join(', ') || 'General stock';
      const overdue = po.due && po.due < today;
      return '<tr><td><button type="button" class="link-button" data-wh-select-po="' + whEsc(po.id) + '"><strong>' + whEsc(po.id) + '</strong></button></td><td>' + whEsc(po.supplier || '') + '</td><td>' + (overdue ? whPill('Overdue','bad') : whPill(po.status || 'Sent','info')) + '</td><td>' + received + '/' + ordered + '</td><td>' + pending + '</td><td>' + whEsc(po.due || 'Not set') + '</td><td>' + whEsc(linked) + '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="wh-empty">No supplier deliveries are waiting to be received.</td></tr>';
  }

  function whDemandCopy(line) {
    const queue = warehouseEligibleShortages(line.productId);
    const total = queue.reduce(function (sum, item) { return sum + item.shortage; }, 0);
    const origin = line.salesOrderId ? 'Demand source ' + line.salesOrderId + '. ' : '';
    if (!queue.length) return origin + 'No open Sales Order shortage. Accepted stock becomes available.';
    return origin + queue.length + ' open order' + (queue.length === 1 ? '' : 's') + ' need ' + total + '. FIFO: ' + queue.slice(0,3).map(function (item) { return item.order.id + ' needs ' + item.shortage; }).join(' → ');
  }

  function whInboundLines(po) {
    if (!po) return '<div class="wh-empty">Select a Purchase Order to receive.</div>';
    const rows = (po.lines || []).map(function (line) {
      const p = whProduct(line.productId) || { sku: line.productId, name: line.productId };
      const pending = whPending(line);
      return '<tr><td><strong>' + whEsc(p.sku) + '</strong><small>' + whEsc(p.name) + '</small></td><td>' + Number(line.qty || 0) + '</td><td>' + Number(line.received || 0) + '</td><td>' + pending + '</td><td><input class="wh-qty" type="number" min="0" max="' + pending + '" value="' + (pending ? pending : 0) + '" data-wh-receive-qty="' + whEsc(po.id + '|' + (line.receiptLineId || line.productId)) + '" ' + (pending ? '' : 'disabled') + '></td><td><small>' + whEsc(whDemandCopy(line)) + '</small></td><td><div class="wh-row-actions"><button type="button" class="primary" data-wh-receive-line="' + whEsc(po.id + '|' + (line.receiptLineId || line.productId)) + '" ' + (pending ? '' : 'disabled') + '>Book into Receiving</button><button type="button" class="secondary" data-wh-shortage-line="' + whEsc(po.id + '|' + (line.receiptLineId || line.productId)) + '" ' + (pending ? '' : 'disabled') + '>Record shortage</button><button type="button" class="secondary" data-wh-wrong-line="' + whEsc(po.id + '|' + (line.receiptLineId || line.productId)) + '" ' + (pending ? '' : 'disabled') + '>Wrong item</button></div></td></tr>';
    }).join('');
    return '<div class="wh-inline-meta"><label>Supplier delivery reference<input id="whSupplierReference" placeholder="Delivery note / parcel ref"></label><label>Receiving note<input id="whReceivingNote" placeholder="Optional receiving note"></label></div><div class="wh-table-wrap"><table class="wh-table"><thead><tr><th>Item</th><th>Ordered</th><th>Received</th><th>Outstanding</th><th>Book now</th><th>Demand / FIFO</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function whDestinationOptions(selected) {
    return (data.locations || []).filter(function (loc) { return !['L-RECEIVING','L-QUARANTINE'].includes(loc.id); }).map(function (loc) { return '<option value="' + whEsc(loc.id) + '"' + (loc.id === selected ? ' selected' : '') + '>' + whEsc(loc.name) + '</option>'; }).join('');
  }

  function whReceiptStagingRows() {
    const rows = [];
    (data.receiptEvents || []).forEach(function (event) {
      const remaining = whReceiptRemaining(event);
      if (!remaining) return;
      const po = (data.purchaseOrders || []).find(function (item) { return item.id === event.poId; });
      const line = po && (po.lines || []).find(function (item) { return item.receiptLineId === event.lineId; });
      const p = whProduct(event.productId) || { sku: event.productId, name: event.productId };
      const defaultDestination = line && line.preferredLocationId ? line.preferredLocationId : 'L-WH-A1';
      rows.push('<tr><td><strong>' + whEsc(event.poId || 'Receipt') + '</strong><small>' + whEsc(event.supplier || '') + '</small></td><td><strong>' + whEsc(p.sku) + '</strong><small>' + whEsc(p.name) + '</small></td><td>' + remaining + '</td><td>' + whEsc(line ? whDemandCopy(line) : 'FIFO allocation runs after acceptance.') + '</td><td><select data-wh-putaway-dest="' + whEsc(event.id) + '">' + whDestinationOptions(defaultDestination) + '</select></td><td><input class="wh-qty" type="number" min="1" max="' + remaining + '" value="' + remaining + '" data-wh-putaway-qty="' + whEsc(event.id) + '"></td><td><div class="wh-row-actions"><button type="button" class="primary" data-wh-putaway-receipt="' + whEsc(event.id) + '">Accept & put away</button><button type="button" class="danger" data-wh-quarantine-receipt="' + whEsc(event.id) + '">Damaged / quarantine</button></div></td></tr>');
    });
    return rows.join('') || '<tr><td colspan="7" class="wh-empty">Nothing is waiting in Receiving/QC.</td></tr>';
  }

  function whBatchBookingRows(po) {
    if (!po) return '<tr><td colspan="7" class="wh-empty">Select a Purchase Order above to start booking in.</td></tr>';
    return (po.lines || []).map(function (line) {
      const p = whProduct(line.productId) || { sku:line.productId, name:line.productId };
      const pending = whPending(line);
      const key = po.id + '|' + (line.receiptLineId || line.productId);
      const destination = line.preferredLocationId || 'L-WH-A1';
      return '<tr data-wh-book-row="' + whEsc(key) + '"><td><strong>' + whEsc(p.sku) + '</strong><small>' + whEsc(p.name) + '</small></td><td>' + Number(line.qty || 0) + '</td><td>' + Number(line.received || 0) + '</td><td>' + pending + '</td><td><input class="wh-qty" type="number" min="0" max="' + pending + '" value="0" data-wh-book-qty ' + (pending ? '' : 'disabled') + '></td><td><select data-wh-book-decision ' + (pending ? '' : 'disabled') + '><option>Accepted</option><option>Damaged</option><option>Shortage</option><option>Wrong item</option></select><select data-wh-book-destination ' + (pending ? '' : 'disabled') + '>' + whDestinationOptions(destination) + '</select></td><td><small>' + whEsc(whDemandCopy(line)) + '</small></td></tr>';
    }).join('');
  }

  function whEasyBookingPanel(po) {
    const disabled = po ? '' : ' disabled';
    return '<section class="wh-card wh-easy-booking"><div class="wh-card-head"><div><h3>Easy booking-in · ' + whEsc(po ? po.id : 'Select a PO') + '</h3><p>One delivery, one confirmation. Enter what arrived and choose the QC decision for each line.</p></div>' + whPill('No manual SO allocation','good') + '</div><div class="wh-inline-meta"><label>Supplier delivery reference<input id="whBatchSupplierReference" placeholder="Delivery note / parcel reference"></label><label>Receiving note<input id="whBatchReceivingNote" placeholder="Optional note for this delivery"></label><div class="wh-book-actions"><button type="button" class="secondary" data-wh-fill-outstanding' + disabled + '>Fill all outstanding</button><button type="button" class="primary" data-wh-confirm-booking="' + whEsc(po ? po.id : '') + '"' + disabled + '>Confirm booking-in</button></div></div><div class="wh-table-wrap"><table class="wh-table"><thead><tr><th>Item</th><th>Ordered</th><th>Received</th><th>Outstanding</th><th>Arrived now</th><th>QC decision / destination</th><th>FIFO demand</th></tr></thead><tbody>' + whBatchBookingRows(po) + '</tbody></table></div><div class="wh-rule-note"><strong>What happens when you confirm</strong><p><b>Accepted</b> stock is received, released to the selected/recommended location and FIFO allocated automatically. <b>Damaged</b> stock moves to Quarantine. <b>Shortage</b> and <b>Wrong item</b> stay outstanding and create an exception. Nothing asks the warehouse user to choose a Sales Order.</p></div></section>';
  }

  function whInboundPage() {
    const selectedPo = (data.purchaseOrders || []).find(function (po) { return po.id === selectedGoodsInPoId; }) || (data.purchaseOrders || []).find(function (po) { return !['Cancelled','Received','Draft - Review','Ready To Email'].includes(po.status); }) || null;
    if (selectedPo) selectedGoodsInPoId = selectedPo.id;
    return '<div class="wh-process-banner"><div class="active"><span>1</span><strong>Book delivery</strong><small>Confirm what physically arrived</small></div><div><span>2</span><strong>QC decision</strong><small>Accepted, damaged, shortage or wrong item</small></div><div><span>3</span><strong>Automatic stock control</strong><small>Putaway + exact-SKU FIFO allocation</small></div></div>' +
      '<section class="wh-card"><div class="wh-card-head"><div><h3>Supplier deliveries</h3><p>Select the PO that matches the supplier delivery note.</p></div><span>PO link = demand source, not allocation ownership</span></div><div class="wh-table-wrap"><table class="wh-table"><thead><tr><th>PO</th><th>Supplier</th><th>Status</th><th>Received</th><th>Pending</th><th>Due</th><th>Demand source</th></tr></thead><tbody>' + whOpenPoRows() + '</tbody></table></div></section>' +
      whEasyBookingPanel(selectedPo) +
      '<section class="wh-card"><div class="wh-card-head"><div><h3>Receiving / QC exceptions</h3><p>Anything intentionally left in Receiving still appears here for a later QC or putaway decision.</p></div>' + whPill('FIFO automatic','good') + '</div><div class="wh-table-wrap"><table class="wh-table"><thead><tr><th>Receipt</th><th>Item</th><th>Qty</th><th>Demand queue</th><th>Destination</th><th>Qty</th><th>Decision</th></tr></thead><tbody>' + whReceiptStagingRows() + '</tbody></table></div></section>' +
      '<section class="wh-rule-note"><strong>Booking-in is deliberately simple</strong><p>The warehouse confirms the physical delivery once. Pool Shed then preserves the GRN/receipt, QC outcome, putaway movement and FIFO allocation trail automatically. Allocation Review remains available only after the automatic run.</p></section>';
  }

  function whTransferRows() {
    return (data.movements || []).filter(function (move) { return move.type === 'Transfer'; }).slice().reverse().slice(0,20).map(function (move) {
      const p = whProduct(move.productId) || { sku: move.productId, name: move.productId };
      return '<tr><td>' + whEsc(move.date || '') + '</td><td><strong>' + whEsc(p.sku) + '</strong><small>' + whEsc(p.name) + '</small></td><td>' + Number(move.qty || 0) + '</td><td>' + whEsc(move.from || '') + '</td><td>' + whEsc(move.to || '') + '</td><td>' + whEsc(move.ref || '') + '</td><td>' + whEsc(move.user || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="wh-empty">No transfers recorded yet.</td></tr>';
  }

  function whTransfersPage() {
    const locOptions = typeof locationOptions === 'function' ? locationOptions() : '';
    const manual = typeof transferForm === 'function' ? transferForm(locOptions) : '<p class="wh-empty">Transfer form unavailable.</p>';
    const barcode = typeof barcodeTransferForm === 'function' ? barcodeTransferForm(locOptions) : '';
    return '<div class="wh-two-col"><section class="wh-card"><div class="wh-card-head"><div><h3>New transfer</h3><p>One movement engine for warehouse bins, vans, project stock and returns.</p></div></div><div class="wh-pad">' + manual + '</div></section><section class="wh-card"><div class="wh-card-head"><div><h3>Scan transfer</h3><p>Barcode-first movement for fast bin and van transfers.</p></div></div><div class="wh-pad">' + barcode + '</div></section></div><section class="wh-card"><div class="wh-card-head"><div><h3>Recent transfer audit</h3><p>Every posted movement remains traceable.</p></div></div><div class="wh-table-wrap"><table class="wh-table"><thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>From</th><th>To</th><th>Reference</th><th>User</th></tr></thead><tbody>' + whTransferRows() + '</tbody></table></div></section>';
  }

  function whReturnsPage() {
    const returnRows = typeof returnsRows === 'function' ? returnsRows() : '<tr><td colspan="6" class="wh-empty">No returns.</td></tr>';
    const quarantineRows = (data.stock || []).filter(function (row) { return row.locationId === 'L-QUARANTINE' && Number(row.qty || 0) > 0; }).map(function (row) {
      const p = whProduct(row.productId) || { sku: row.productId, name: row.productId };
      return '<tr><td><strong>' + whEsc(p.sku) + '</strong><small>' + whEsc(p.name) + '</small></td><td>' + Number(row.qty || 0) + '</td><td>' + whPill('Blocked','bad') + '</td><td>Cannot be allocated while held</td><td><button type="button" class="secondary" data-safe-open-sub="locations|Locations">Open Inventory</button></td></tr>';
    }).join('') || '<tr><td colspan="5" class="wh-empty">No stock is held in Quarantine.</td></tr>';
    return '<div class="wh-two-col"><section class="wh-card"><div class="wh-card-head"><div><h3>Returns queue</h3><p>Customer and credit-linked returns remain tied to their financial record.</p></div></div><div class="wh-table-wrap"><table class="wh-table"><thead><tr><th>Return</th><th>Customer</th><th>Product</th><th>Qty</th><th>Decision</th><th>Action</th></tr></thead><tbody>' + returnRows + '</tbody></table></div></section><section class="wh-card"><div class="wh-card-head"><div><h3>Quarantine control</h3><p>Held stock is physically visible but excluded from Available.</p></div></div><div class="wh-table-wrap"><table class="wh-table"><thead><tr><th>Item</th><th>Qty</th><th>Status</th><th>Rule</th><th>Action</th></tr></thead><tbody>' + quarantineRows + '</tbody></table></div></section></div>';
  }

  function whCountsPage() {
    const queue = typeof stockTakeApprovalQueue === 'function' ? stockTakeApprovalQueue() : '<p class="wh-empty">No count queue available.</p>';
    return '<section class="wh-card"><div class="wh-card-head"><div><h3>Cycle count control</h3><p>Submitted variances require approval, recount or rejection before posting.</p></div><button type="button" class="secondary" data-safe-open-sub="locations|Stock Take">Open full Stock Take</button></div><div class="wh-pad">' + queue + '</div></section>';
  }

  function whAuditRows() {
    const rows = [];
    (data.receiptEvents || []).forEach(function (event) { rows.push({ date:event.date || '', type:'Receipt', ref:event.poId || event.id, detail:(event.productId || '') + ' × ' + Number(event.qty || 0) + ' → ' + (event.locationId || ''), user:event.user || 'Warehouse' }); });
    (data.warehouseQcEvents || []).forEach(function (event) { rows.push({ date:event.date || '', type:'QC', ref:event.poId || event.receiptId || '', detail:(event.decision || '') + ' · ' + (event.productId || '') + ' × ' + Number(event.qty || 0) + (event.reason ? ' · ' + event.reason : ''), user:event.user || 'Warehouse' }); });
    (data.allocationEvents || []).forEach(function (event) { rows.push({ date:event.date || '', type:event.type === 'MANUAL_REALLOCATION' ? 'Reallocation' : 'FIFO Allocation', ref:event.poId || event.fromSalesOrderId || '', detail:(event.productId || '') + ' × ' + Number(event.qty || 0) + ' → ' + (event.salesOrderId || '') + (event.reason ? ' · ' + event.reason : ''), user:event.user || 'Warehouse' }); });
    (data.movements || []).forEach(function (move) { rows.push({ date:move.date || '', type:move.type || 'Movement', ref:move.ref || '', detail:(move.productId || '') + ' × ' + Number(move.qty || 0) + ' · ' + (move.from || '') + ' → ' + (move.to || '') + (move.note ? ' · ' + move.note : ''), user:move.user || '' }); });
    rows.sort(function (a,b) { return String(b.date).localeCompare(String(a.date)); });
    return rows.slice(0,100).map(function (row) { return '<tr><td>' + whEsc(row.date) + '</td><td>' + whPill(row.type, row.type.indexOf('Reallocation')>=0 ? 'warn' : row.type.indexOf('FIFO')>=0 ? 'good' : 'info') + '</td><td>' + whEsc(row.ref) + '</td><td>' + whEsc(row.detail) + '</td><td>' + whEsc(row.user) + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="wh-empty">No warehouse activity has been recorded yet.</td></tr>';
  }

  function whAuditPage() {
    return '<section class="wh-card"><div class="wh-card-head"><div><h3>Warehouse audit trail</h3><p>Receipt, QC, FIFO allocation, manual reallocation, transfer and stock movements in one chronology.</p></div></div><div class="wh-table-wrap"><table class="wh-table"><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Detail</th><th>User</th></tr></thead><tbody>' + whAuditRows() + '</tbody></table></div></section>';
  }

  function whPageBody(view) {
    if (view === 'Inbound') return whInboundPage();
    if (view === 'Transfers') return whTransfersPage();
    if (view === 'Returns & Quarantine') return whReturnsPage();
    if (view === 'Counts') return whCountsPage();
    if (view === 'Audit') return whAuditPage();
    return whWorkQueuePage();
  }

  function warehouseRecordQcEvent(payload) {
    data.warehouseQcEvents = data.warehouseQcEvents || [];
    data.warehouseQcEvents.push(Object.assign({ id: whEventId('QC'), date: new Date().toISOString(), user: whAllocationUser() }, payload));
  }

  function warehouseReceiveLineToStaging(poId, lineKey, qty, supplierReference, note) {
    const po = (data.purchaseOrders || []).find(function (item) { return item.id === poId; });
    if (!po) return { ok:false, error:'Purchase Order not found.' };
    const line = (po.lines || []).find(function (item) { return item.receiptLineId === lineKey || item.productId === lineKey; });
    if (!line) return { ok:false, error:'Purchase Order line not found.' };
    const amount = Math.max(0, Math.floor(Number(qty || 0)));
    if (!amount || amount > whPending(line)) return { ok:false, error:'Enter a quantity no greater than the outstanding quantity.' };
    if (typeof recordPurchaseReceipt !== 'function') return { ok:false, error:'Receipt engine is unavailable.' };
    const event = recordPurchaseReceipt(po, line, amount, 'L-RECEIVING', Number(line.received || 0), { supplierReference:supplierReference || '', note:note || '' });
    if (!event) return { ok:false, error:'Receipt was not saved. Check the PO status and stock-count locks.' };
    warehouseRecordQcEvent({ type:'RECEIVED', decision:'Awaiting QC', poId:po.id, receiptId:event.id, lineId:line.receiptLineId || '', productId:line.productId, qty:amount });
    return { ok:true, event:event };
  }

  function warehousePutawayReceipt(receiptId, qty, destination, decision, reason) {
    const event = (data.receiptEvents || []).find(function (item) { return item.id === receiptId; });
    if (!event) return { ok:false, error:'Receipt not found.' };
    const remaining = whReceiptRemaining(event);
    const amount = Math.max(0, Math.floor(Number(qty || 0)));
    if (!amount || amount > remaining) return { ok:false, error:'Quantity exceeds the stock still held in Receiving.' };
    const finalDecision = decision || 'Accepted';
    const target = ['Damaged','Wrong item'].includes(finalDecision) ? 'L-QUARANTINE' : destination;
    if (!target || target === 'L-RECEIVING') return { ok:false, error:'Choose a final location.' };
    if (typeof removeStock !== 'function' || typeof addStock !== 'function') return { ok:false, error:'Stock movement engine is unavailable.' };
    if (!removeStock(event.productId, 'L-RECEIVING', amount)) return { ok:false, error:'Receiving stock is no longer available.' };
    addStock(event.productId, target, amount, 0);
    data.putawayTransfers = data.putawayTransfers || [];
    data.putawayTransfers.push({ id:whEventId('PUT'), receiptId:event.id, qty:amount, to:target, date:new Date().toISOString(), decision:finalDecision });
    const po = (data.purchaseOrders || []).find(function (item) { return item.id === event.poId; });
    const line = po && (po.lines || []).find(function (item) { return item.receiptLineId === event.lineId; });
    if (line) line.receiveLocationId = target;
    warehouseRecordQcEvent({ type:'QC_RELEASE', decision:finalDecision, poId:event.poId || '', receiptId:event.id, lineId:event.lineId || '', productId:event.productId, qty:amount, destination:target, reason:reason || '' });
    if (typeof addMovement === 'function') addMovement(finalDecision === 'Accepted' ? 'QC Release / Putaway' : 'QC Quarantine', event.productId, amount, 'L-RECEIVING', target, event.poId || event.id, whAllocationUser(), (reason || finalDecision) + '.');
    const allocation = finalDecision === 'Accepted' && po && line ? warehouseAllocateAcceptedStock(po, line, amount, target) : {allocated:0,remaining:amount,allocations:[]};
    return { ok:true, allocation:allocation, destination:target };
  }

  function warehouseRecordPoException(poId, lineKey, decision, reason) {
    const po = (data.purchaseOrders || []).find(function (item) { return item.id === poId; });
    const line = po && (po.lines || []).find(function (item) { return item.receiptLineId === lineKey || item.productId === lineKey; });
    if (!po || !line) return {ok:false,error:'PO line not found.'};
    warehouseRecordQcEvent({ type:'PO_EXCEPTION', decision:decision, poId:po.id, lineId:line.receiptLineId || '', productId:line.productId, qty:whPending(line), reason:reason || '' });
    line.warehouseException = decision;
    line.warehouseExceptionNote = reason || '';
    return {ok:true};
  }


  function warehouseBookDelivery(poId, receiptRows, supplierReference, note) {
    const po = (data.purchaseOrders || []).find(function (item) { return item.id === poId; });
    if (!po) return {ok:false,error:'Purchase Order not found.'};
    const rows = Array.isArray(receiptRows) ? receiptRows : [];
    const work = [];
    for (const row of rows) {
      const line = (po.lines || []).find(function (item) { return item.receiptLineId === row.lineKey || item.productId === row.lineKey; });
      if (!line) return {ok:false,error:'A Purchase Order line could not be matched.'};
      const decision = String(row.decision || 'Accepted');
      const qty = Math.max(0,Math.floor(Number(row.qty || 0)));
      if (['Accepted','Damaged'].includes(decision)) {
        if (!qty) continue;
        if (qty > whPending(line)) return {ok:false,error:'Received quantity is greater than the outstanding PO quantity.'};
      }
      if (!['Accepted','Damaged','Shortage','Wrong item'].includes(decision)) return {ok:false,error:'Unknown booking-in decision.'};
      work.push({line:line,lineKey:row.lineKey,qty:qty,decision:decision,destination:row.destination || line.preferredLocationId || 'L-WH-A1'});
    }
    if (!work.length) return {ok:false,error:'Enter at least one received quantity or exception decision.'};
    const summary = {ok:true,accepted:0,damaged:0,shortage:0,wrongItem:0,allocated:0,receipts:[],exceptions:[]};
    for (const item of work) {
      if (item.decision === 'Shortage' || item.decision === 'Wrong item') {
        const ex = warehouseRecordPoException(po.id,item.lineKey,item.decision,(note || '') + (note ? ' · ' : '') + item.decision + ' recorded during booking-in');
        if (!ex.ok) return ex;
        if (item.decision === 'Shortage') summary.shortage += whPending(item.line); else summary.wrongItem += 1;
        summary.exceptions.push({productId:item.line.productId,decision:item.decision});
        continue;
      }
      const received = warehouseReceiveLineToStaging(po.id,item.lineKey,item.qty,supplierReference || '',note || '');
      if (!received.ok) return received;
      summary.receipts.push(received.event.id);
      if (item.decision === 'Damaged') {
        const put = warehousePutawayReceipt(received.event.id,item.qty,'L-QUARANTINE','Damaged','Damaged during booking-in');
        if (!put.ok) return put;
        summary.damaged += item.qty;
      } else {
        const put = warehousePutawayReceipt(received.event.id,item.qty,item.destination,'Accepted','Accepted during booking-in');
        if (!put.ok) return put;
        summary.accepted += item.qty;
        summary.allocated += Number((put.allocation && put.allocation.allocated) || 0);
      }
    }
    po.lastBookingInAt = new Date().toISOString();
    po.lastSupplierDeliveryReference = supplierReference || po.lastSupplierDeliveryReference || '';
    return summary;
  }

  function bindWarehousePrecision() {
    document.querySelectorAll('[data-wh-view]').forEach(function (button) {
      button.addEventListener('click', function () {
        activeSubPage.warehouse = whNormaliseView(button.dataset.whView);
        warehousePoView = 'list';
        if (typeof render === 'function') render();
      });
    });

    document.querySelectorAll('[data-wh-inspect-row]').forEach(function (row) {
      row.addEventListener('click', function (event) {
        if (event.target.closest('button')) return;
        document.querySelectorAll('[data-wh-inspect-row]').forEach(function (item) { item.classList.remove('selected'); });
        row.classList.add('selected');
        const type = document.getElementById('whInspectType');
        const title = document.getElementById('whInspectTitle');
        const detail = document.getElementById('whInspectDetail');
        const open = document.getElementById('whInspectOpen');
        if (type) type.textContent = row.dataset.whInspectType + ' · ' + row.dataset.whInspectRef;
        if (title) title.textContent = row.dataset.whInspectTitle;
        if (detail) detail.textContent = row.dataset.whInspectDetail;
        if (open) open.dataset.whView = row.dataset.whInspectAction;
      });
    });

    document.querySelectorAll('[data-wh-select-po]').forEach(function (button) {
      button.addEventListener('click', function () { selectedGoodsInPoId = button.dataset.whSelectPo; activeSubPage.warehouse='Inbound'; if (typeof render==='function') render(); });
    });


    const fillOutstanding = document.querySelector('[data-wh-fill-outstanding]');
    if (fillOutstanding) fillOutstanding.addEventListener('click', function () {
      document.querySelectorAll('[data-wh-book-row]').forEach(function (row) {
        const input = row.querySelector('[data-wh-book-qty]');
        if (input && !input.disabled) input.value = input.max || '0';
      });
    });

    const confirmBooking = document.querySelector('[data-wh-confirm-booking]');
    if (confirmBooking) confirmBooking.addEventListener('click', function () {
      const poId = confirmBooking.dataset.whConfirmBooking;
      const rows = Array.from(document.querySelectorAll('[data-wh-book-row]')).map(function (row) {
        const parts = row.dataset.whBookRow.split('|');
        const qty = row.querySelector('[data-wh-book-qty]');
        const decision = row.querySelector('[data-wh-book-decision]');
        const destination = row.querySelector('[data-wh-book-destination]');
        return {lineKey:parts.slice(1).join('|'),qty:qty ? qty.value : 0,decision:decision ? decision.value : 'Accepted',destination:destination ? destination.value : ''};
      }).filter(function (row) { return Number(row.qty || 0) > 0 || ['Shortage','Wrong item'].includes(row.decision); });
      const ref = document.getElementById('whBatchSupplierReference');
      const note = document.getElementById('whBatchReceivingNote');
      const result = warehouseBookDelivery(poId,rows,ref ? ref.value : '',note ? note.value : '');
      if (!result.ok) return typeof toast === 'function' ? toast(result.error) : undefined;
      if (typeof saveAppData === 'function') saveAppData();
      if (typeof toast === 'function') toast(result.accepted + ' accepted, ' + result.damaged + ' quarantined, ' + result.allocated + ' FIFO allocated.');
      if (typeof render === 'function') render();
    });

    document.querySelectorAll('[data-wh-receive-line]').forEach(function (button) {
      button.addEventListener('click', function () {
        const parts = button.dataset.whReceiveLine.split('|');
        const input = document.querySelector('[data-wh-receive-qty="' + button.dataset.whReceiveLine + '"]');
        const ref = document.getElementById('whSupplierReference');
        const note = document.getElementById('whReceivingNote');
        const result = warehouseReceiveLineToStaging(parts[0], parts[1], input ? input.value : 0, ref ? ref.value : '', note ? note.value : '');
        if (!result.ok) return typeof toast === 'function' ? toast(result.error) : undefined;
        if (typeof saveAppData === 'function') saveAppData();
        if (typeof toast === 'function') toast('Stock booked into Receiving/QC. It is not available or allocated until QC release.');
        if (typeof render === 'function') render();
      });
    });

    document.querySelectorAll('[data-wh-putaway-receipt]').forEach(function (button) {
      button.addEventListener('click', function () {
        const id = button.dataset.whPutawayReceipt;
        const qty = document.querySelector('[data-wh-putaway-qty="' + id + '"]');
        const dest = document.querySelector('[data-wh-putaway-dest="' + id + '"]');
        const result = warehousePutawayReceipt(id, qty ? qty.value : 0, dest ? dest.value : '', 'Accepted', 'QC accepted');
        if (!result.ok) return typeof toast === 'function' ? toast(result.error) : undefined;
        if (typeof saveAppData === 'function') saveAppData();
        if (typeof toast === 'function') toast((result.allocation.allocated || 0) + ' unit(s) FIFO allocated after QC release.');
        if (typeof render === 'function') render();
      });
    });

    document.querySelectorAll('[data-wh-quarantine-receipt]').forEach(function (button) {
      button.addEventListener('click', function () {
        const id = button.dataset.whQuarantineReceipt;
        const qty = document.querySelector('[data-wh-putaway-qty="' + id + '"]');
        const result = warehousePutawayReceipt(id, qty ? qty.value : 0, 'L-QUARANTINE', 'Damaged', 'QC damage hold');
        if (!result.ok) return typeof toast === 'function' ? toast(result.error) : undefined;
        if (typeof saveAppData === 'function') saveAppData();
        if (typeof toast === 'function') toast('Damaged stock moved to Quarantine and excluded from allocation.');
        if (typeof render === 'function') render();
      });
    });

    document.querySelectorAll('[data-wh-shortage-line],[data-wh-wrong-line]').forEach(function (button) {
      button.addEventListener('click', function () {
        const raw = button.dataset.whShortageLine || button.dataset.whWrongLine;
        const parts = raw.split('|');
        const decision = button.dataset.whWrongLine ? 'Wrong item' : 'Shortage';
        const result = warehouseRecordPoException(parts[0],parts[1],decision,decision + ' recorded at goods-in');
        if (!result.ok) return typeof toast === 'function' ? toast(result.error) : undefined;
        if (typeof saveAppData === 'function') saveAppData();
        if (typeof toast === 'function') toast(decision + ' recorded. Outstanding PO quantity remains controlled.');
        if (typeof render === 'function') render();
      });
    });

    document.querySelectorAll('[data-wh-reallocate]').forEach(function (button) {
      button.addEventListener('click', function () {
        const form = button.closest('.wh-reallocate-form');
        const productId = form.querySelector('[data-wh-reallocate-product]').value;
        const fromId = form.querySelector('[data-wh-reallocate-from]').value;
        const toId = form.querySelector('[data-wh-reallocate-to]').value;
        const qty = form.querySelector('[data-wh-reallocate-qty]').value;
        const reason = form.querySelector('[data-wh-reallocate-reason]').value;
        const result = warehouseReallocateSalesStock(productId,fromId,toId,qty,reason);
        if (!result.ok) return typeof toast === 'function' ? toast(result.error) : undefined;
        if (typeof saveAppData === 'function') saveAppData();
        if (typeof toast === 'function') toast(result.qty + ' unit(s) reallocated from ' + result.fromOrderId + ' to ' + result.toOrderId + '.');
        if (typeof render === 'function') render();
      });
    });

    if (typeof bindTransferForm === 'function') bindTransferForm();
  }

  renderWarehouse = function () {
    whEnsureReceivingLocation();
    if (typeof normalizeReceiptLedger === 'function') normalizeReceiptLedger(data);
    const raw = typeof selectedSubPage === 'function' ? selectedSubPage('warehouse') : (activeSubPage.warehouse || 'Work Queue');
    const view = whNormaliseView(raw);
    activeSubPage.warehouse = view;
    const screen = document.getElementById('screen-warehouse');
    if (!screen) return;
    screen.innerHTML = '<div class="warehouse-precision-page"><header class="wh-page-head"><div><span class="wh-eyebrow">POOL SHED / WAREHOUSE</span><h1>Warehouse Operations Desk</h1><p>One controlled workspace for receipts, QC, FIFO allocation, putaway, transfers, returns, counts and audit.</p></div><div class="wh-page-actions"><button type="button" class="secondary" data-wh-view="Audit">Audit trail</button><button type="button" class="primary" data-wh-view="Inbound">Receive delivery</button></div></header>' + whTabs(view) + '<main class="wh-body">' + whCommandStrip() + whPageBody(view) + '</main></div>';
    bindWarehousePrecision();
  };

  globalThis.warehouseReceiveLineToStaging = warehouseReceiveLineToStaging;
  globalThis.warehousePutawayReceipt = warehousePutawayReceipt;
  globalThis.warehouseRecordPoException = warehouseRecordPoException;
  globalThis.warehouseBookDelivery = warehouseBookDelivery;
  globalThis.bindWarehousePrecision = bindWarehousePrecision;
})();
