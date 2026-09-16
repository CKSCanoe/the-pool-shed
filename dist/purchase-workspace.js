/* Pool Shed Purchase Order Supplier Command authority layer.
   Supplier-side mirror of Sales Order Command.
   Purchasing owns commercial intent; Warehouse owns physical stock truth.
   v1.9.0 */
(function () {
  let purchaseCommandTab = 'items';
  const legacyPurchaseOrderDetailPage = typeof purchaseOrderDetailPage === 'function' ? purchaseOrderDetailPage : null;
  const legacyPurchaseOrderListPage = typeof purchaseOrderListPage === 'function' ? purchaseOrderListPage : null;
  const legacyBindPurchase = typeof bindPurchase === 'function' ? bindPurchase : null;
  const legacyRenderPurchase = typeof renderPurchase === 'function' ? renderPurchase : null;
  const legacySidebarSubGroups = typeof sidebarSubGroups === 'function' ? sidebarSubGroups : null;
  const legacyDefaultSubPage = typeof defaultSubPage === 'function' ? defaultSubPage : null;
  const legacyOpenSidebarSubGroup = typeof openSidebarSubGroup === 'function' ? openSidebarSubGroup : null;

  function poEsc(value) {
    return typeof escapeHtml === 'function' ? escapeHtml(String(value == null ? '' : value)) : String(value == null ? '' : value);
  }

  function poMoney(value) {
    return typeof money === 'function' ? money(Number(value || 0)) : '£' + Number(value || 0).toFixed(2);
  }

  function poProduct(id) {
    return typeof product === 'function' ? product(id) : ((data.products || []).find(function (item) { return item.id === id; }) || null);
  }

  function poSupplier(name) {
    if (typeof supplierProfile === 'function') return supplierProfile(name);
    return (data.suppliers || []).find(function (item) { return item.name === name; }) || { name:name || 'Supplier to confirm' };
  }

  function poLineCost(line) {
    const p = poProduct(line.productId) || {};
    return Number(line.unitCost != null ? line.unitCost : p.cost || 0);
  }

  function poSummarySafe(po) {
    if (typeof poSummary === 'function') return poSummary(po);
    return (po.lines || []).reduce(function (summary, line) {
      const ordered = Number(line.qty || 0);
      const received = Number(line.received || 0);
      summary.ordered += ordered;
      summary.received += received;
      summary.pending += Math.max(0, ordered - received);
      summary.pendingCost += Math.max(0, ordered - received) * poLineCost(line);
      return summary;
    }, { ordered:0, received:0, pending:0, pendingCost:0 });
  }

  function poOrderValue(po) {
    return (po.lines || []).reduce(function (total, line) { return total + Number(line.qty || 0) * poLineCost(line); }, 0);
  }

  function poConfirmedValue(po) {
    return (po.lines || []).reduce(function (total, line) {
      const qty = Number(line.confirmedQty != null ? line.confirmedQty : line.qty || 0);
      const cost = Number(line.confirmedUnitCost != null ? line.confirmedUnitCost : poLineCost(line));
      return total + qty * cost;
    }, 0);
  }

  function poToday() {
    return typeof todayIso === 'function' ? todayIso() : new Date().toISOString().slice(0,10);
  }

  function purchaseOrderHealth(po) {
    const summary = poSummarySafe(po);
    const late = summary.pending > 0 && po.due && String(po.due) < poToday();
    const exceptionLines = (po.lines || []).filter(function (line) {
      const confirmedQty = Number(line.confirmedQty != null ? line.confirmedQty : line.qty || 0);
      const ordered = Number(line.qty || 0);
      const expected = poLineCost(line);
      const confirmedCost = Number(line.confirmedUnitCost != null ? line.confirmedUnitCost : expected);
      return line.warehouseException || line.backorder || confirmedQty < ordered || (expected > 0 && Math.abs(confirmedCost - expected) / expected >= 0.05);
    }).length;
    if (late) return { label:'At risk', tone:'bad', detail:'Outstanding stock is past the requested date.' };
    if (exceptionLines) return { label:'Exception', tone:'warn', detail:exceptionLines + ' line exception' + (exceptionLines === 1 ? '' : 's') + ' need review.' };
    if (['Draft - Review','Ready To Email'].includes(po.status)) return { label:'Needs attention', tone:'info', detail:'PO has not completed supplier commitment.' };
    if (summary.pending === 0 && summary.ordered > 0) return { label:'Complete', tone:'good', detail:'All ordered units have been physically received.' };
    return { label:'Healthy', tone:'good', detail:'Supplier commitment and inbound position are within plan.' };
  }

  function purchaseDemandSources(po) {
    const sources = [];
    (po.lines || []).forEach(function (line) {
      const p = poProduct(line.productId) || { sku:line.productId, name:line.productId };
      if (line.salesOrderId) sources.push({ type:'Sales Order', ref:line.salesOrderId, productId:line.productId, sku:p.sku, name:p.name, qty:Number(line.qty || 0), note:'Demand source only. FIFO decides physical allocation after QC.' });
      else if (line.projectId || po.projectId || po.jobId) sources.push({ type:'Project', ref:line.projectId || po.projectId || po.jobId, productId:line.productId, sku:p.sku, name:p.name, qty:Number(line.qty || 0), note:'Project procurement demand.' });
      else sources.push({ type:'Replenishment / stock', ref:'General stock', productId:line.productId, sku:p.sku, name:p.name, qty:Number(line.qty || 0), note:'Warehouse or replenishment demand.' });
    });
    return sources;
  }

  function poPill(text, tone) {
    return '<span class="po-command-pill ' + (tone || 'info') + '">' + poEsc(text) + '</span>';
  }

  function poStatusText(po) {
    return po.status === 'Draft - Review' ? 'Draft' : po.status === 'Ready To Email' ? 'Ready to Send' : po.status || 'Draft';
  }

  function poCommandTabs(po) {
    const tabs = [
      ['items','Items & Costing'],
      ['demand','Demand Sources'],
      ['confirmation','Supplier Confirmation'],
      ['receipts','Deliveries & Receipts'],
      ['costs','Costs & Invoice Match'],
      ['returns','Returns & Credits'],
      ['activity','Activity']
    ];
    return '<nav class="po-command-tabs" aria-label="Purchase Order sections">' + tabs.map(function (tab) {
      return '<button type="button" class="' + (purchaseCommandTab === tab[0] ? 'active' : '') + '" data-po-command-tab="' + tab[0] + '|' + poEsc(po.id) + '">' + tab[1] + '</button>';
    }).join('') + '</nav>';
  }

  function poSupplierCard(po, supplier) {
    const openPos = (data.purchaseOrders || []).filter(function (other) { return other.supplier === po.supplier && !['Received','Cancelled'].includes(other.status); }).length;
    return '<section class="po-command-card po-supplier-card"><div class="po-command-card-head"><div><span>Supplier</span><h3>' + poEsc(supplier.name || po.supplier || 'Supplier to confirm') + '</h3></div><button type="button" class="secondary" data-open-supplier-profile="' + poEsc(po.supplier || '') + '">Open supplier</button></div><div class="po-supplier-identity"><div class="po-supplier-avatar">' + poEsc((po.supplier || 'S').slice(0,2).toUpperCase()) + '</div><div><strong>' + poEsc(supplier.contact || 'Purchasing') + '</strong><small>' + poEsc(supplier.ordersEmail || supplier.email || 'No ordering email') + '</small><small>' + poEsc(supplier.phone || 'No telephone') + '</small></div>' + poPill((supplier.preferred ? 'Preferred' : 'Active'), supplier.preferred ? 'good' : 'info') + '</div><div class="po-mini-grid"><div><span>Account</span><strong>' + poEsc(supplier.accountNumber || supplier.code || 'Not set') + '</strong></div><div><span>Terms</span><strong>' + poEsc(supplier.terms || 'Not set') + '</strong></div><div><span>Lead time</span><strong>' + Number(supplier.leadTimeDays || 0) + ' days</strong></div><div><span>Open POs</span><strong>' + openPos + '</strong></div></div></section>';
  }

  function poDetailsCard(po) {
    return '<section class="po-command-card"><div class="po-command-card-head"><div><span>Purchase Order</span><h3>Order details</h3></div></div><div class="po-fields"><label>Created<input type="date" data-po-field="' + poEsc(po.id) + '|created" value="' + poEsc(po.created || po.orderedDate || poToday()) + '"></label><label>Expected<input type="date" data-po-field="' + poEsc(po.id) + '|due" value="' + poEsc(po.due || '') + '"></label><label>Supplier reference<input data-po-field="' + poEsc(po.id) + '|supplierReference" value="' + poEsc(po.supplierReference || po.supplierRef || '') + '" placeholder="Supplier confirmation / order ref"></label><label>Delivery<select data-po-field="' + poEsc(po.id) + '|deliveryMethod"><option' + ((po.deliveryMethod || 'Warehouse') === 'Warehouse' ? ' selected' : '') + '>Warehouse</option><option' + (po.deliveryMethod === 'Direct to Project/Site' ? ' selected' : '') + '>Direct to Project/Site</option><option' + (po.deliveryMethod === 'Drop Ship to Customer' ? ' selected' : '') + '>Drop Ship to Customer</option></select></label></div></section>';
  }

  function poInboundCard(po) {
    const summary = poSummarySafe(po);
    const receipts = (data.receiptEvents || []).filter(function (event) { return event.poId === po.id; });
    const qc = (data.warehouseQcEvents || []).filter(function (event) { return event.poId === po.id; });
    const accepted = qc.filter(function (event) { return event.type === 'QC_RELEASE' && event.decision === 'Accepted'; }).reduce(function (n,event) { return n + Number(event.qty || 0); }, 0);
    const quarantine = qc.filter(function (event) { return event.type === 'QC_RELEASE' && ['Damaged','Wrong item'].includes(event.decision); }).reduce(function (n,event) { return n + Number(event.qty || 0); }, 0);
    const confirmed = (po.lines || []).reduce(function (n,line) { return n + Number(line.confirmedQty != null ? line.confirmedQty : line.qty || 0); }, 0);
    return '<section class="po-command-card"><div class="po-command-card-head"><div><span>Inbound & Receiving</span><h3>Supplier commitment</h3></div><button type="button" class="secondary" data-po-open-receiving="' + poEsc(po.id) + '">Book delivery</button></div><div class="po-inbound-progress"><div><span>Ordered</span><strong>' + summary.ordered + '</strong></div><div><span>Confirmed</span><strong>' + confirmed + '</strong></div><div><span>Received</span><strong>' + summary.received + '</strong></div><div><span>QC Passed</span><strong>' + accepted + '</strong></div><div><span>Quarantine</span><strong>' + quarantine + '</strong></div><div><span>Outstanding</span><strong>' + summary.pending + '</strong></div></div><p class="po-command-note">' + receipts.length + ' receipt' + (receipts.length === 1 ? '' : 's') + '. Physical quantities are written only by Warehouse booking-in.</p></section>';
  }

  function poItemsTab(po) {
    const rows = (po.lines || []).map(function (line, index) {
      const p = poProduct(line.productId) || { sku:line.productId, name:'Missing product' };
      const pending = Math.max(0, Number(line.qty || 0) - Number(line.received || 0));
      const demand = line.salesOrderId ? line.salesOrderId : (line.projectId || po.projectId || po.jobId || 'Stock');
      const cost = poLineCost(line);
      const confirmed = Number(line.confirmedQty != null ? line.confirmedQty : line.qty || 0);
      return '<tr><td><strong>' + poEsc(p.sku || '') + '</strong><small>' + poEsc(p.name || '') + '</small></td><td>' + poEsc(line.supplierSku || p.supplierSku || '—') + '</td><td><button type="button" class="link-button" data-po-command-tab="demand|' + poEsc(po.id) + '">' + poEsc(demand) + '</button></td><td><input class="po-qty" data-po-line-qty="' + poEsc(po.id) + '|' + poEsc(line.productId) + '" type="number" min="' + Number(line.received || 0) + '" value="' + Number(line.qty || 0) + '"></td><td>' + confirmed + '</td><td>' + Number(line.received || 0) + '</td><td>' + poPill(String(pending), pending ? 'warn' : 'good') + '</td><td class="right"><input class="po-cost-input" type="number" step="0.01" min="0" data-po-line-cost="' + poEsc(po.id) + '|' + index + '" value="' + cost.toFixed(2) + '"></td><td class="right"><strong>' + poMoney(cost * Number(line.qty || 0)) + '</strong></td></tr>';
    }).join('') || '<tr><td colspan="9" class="po-empty">No supplier lines yet. Select a supplier and add products.</td></tr>';
    const total = poOrderValue(po);
    return '<section class="po-work-card"><div class="po-work-card-head"><div><h3>Supplier order lines</h3><p>Supplier-specific product search, exact supplier SKU, source demand and negotiated unit cost.</p></div><div class="po-line-add"><input id="poProductSearch" data-po-id="' + poEsc(po.id) + '" placeholder="Search supplier product, Pool Shed SKU, supplier SKU or barcode"><input id="poProductQty" type="number" min="1" value="1"><button type="button" class="primary" data-add-po-selected="' + poEsc(po.id) + '">Add line</button><div id="poProductResults" class="po-product-results" hidden></div></div></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>Item</th><th>Supplier SKU</th><th>Demand</th><th>Ordered</th><th>Confirmed</th><th>Received</th><th>Outstanding</th><th class="right">Unit cost</th><th class="right">Line total</th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="po-total-strip"><span>PO net value</span><strong>' + poMoney(total) + '</strong></div></section>';
  }

  function poDemandTab(po) {
    const sources = purchaseDemandSources(po);
    const rows = sources.map(function (source) { return '<tr><td>' + poPill(source.type, source.type === 'Sales Order' ? 'info' : source.type === 'Project' ? 'warn' : 'good') + '</td><td><strong>' + poEsc(source.ref) + '</strong></td><td><strong>' + poEsc(source.sku) + '</strong><small>' + poEsc(source.name) + '</small></td><td>' + source.qty + '</td><td>' + poEsc(source.note) + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="po-empty">No demand source links recorded.</td></tr>';
    return '<section class="po-work-card"><div class="po-work-card-head"><div><h3>Demand sources</h3><p>Shows why stock was purchased without granting ownership of the physical receipt.</p></div>' + poPill('FIFO protected','good') + '</div><div class="po-rule-banner"><strong>Demand source ≠ allocation ownership</strong><p>When stock passes Warehouse QC, exact-SKU FIFO allocates to the oldest eligible Sales Orders first. The PO link remains traceability only.</p></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>Source</th><th>Reference</th><th>Item</th><th>Qty</th><th>Allocation rule</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
  }

  function poConfirmationTab(po) {
    const rows = (po.lines || []).map(function (line,index) {
      const p = poProduct(line.productId) || {sku:line.productId,name:line.productId};
      const ordered = Number(line.qty || 0);
      const confirmed = Number(line.confirmedQty != null ? line.confirmedQty : ordered);
      const baseCost = poLineCost(line);
      const confirmedCost = Number(line.confirmedUnitCost != null ? line.confirmedUnitCost : baseCost);
      const qtyIssue = confirmed < ordered;
      const costPct = baseCost > 0 ? ((confirmedCost-baseCost)/baseCost)*100 : 0;
      return '<tr><td><strong>' + poEsc(p.sku) + '</strong><small>' + poEsc(p.name) + '</small></td><td>' + ordered + '</td><td><input class="po-qty" data-po-confirmed-qty="' + poEsc(po.id) + '|' + index + '" type="number" min="0" value="' + confirmed + '"></td><td><input type="date" data-po-confirmed-eta="' + poEsc(po.id) + '|' + index + '" value="' + poEsc(line.confirmedEta || po.due || '') + '"></td><td class="right"><input class="po-cost-input" type="number" step="0.01" min="0" data-po-confirmed-cost="' + poEsc(po.id) + '|' + index + '" value="' + confirmedCost.toFixed(2) + '"></td><td>' + (qtyIssue ? poPill((ordered-confirmed) + ' backordered','warn') : costPct >= 5 ? poPill('Cost +' + costPct.toFixed(1) + '%','warn') : poPill('Confirmed','good')) + '</td><td><input data-po-confirmation-note="' + poEsc(po.id) + '|' + index + '" value="' + poEsc(line.supplierConfirmationNote || '') + '" placeholder="Supplier note / substitution"></td></tr>';
    }).join('') || '<tr><td colspan="7" class="po-empty">Add PO lines before recording supplier confirmation.</td></tr>';
    return '<section class="po-work-card"><div class="po-work-card-head"><div><h3>Supplier Confirmation</h3><p>Record what the supplier actually committed to: quantity, ETA, cost and any backorder/substitution.</p></div><button type="button" class="secondary" data-po-mark-confirmed="' + poEsc(po.id) + '">Mark supplier confirmed</button></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>Item</th><th>Ordered</th><th>Confirmed</th><th>ETA</th><th class="right">Confirmed cost</th><th>Exception</th><th>Supplier note</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
  }

  function poReceiptsTab(po) {
    const receipts = (data.receiptEvents || []).filter(function (event) { return event.poId === po.id; }).slice().sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''));});
    const rows = receipts.map(function (event) {
      const p=poProduct(event.productId)||{sku:event.productId,name:event.productId};
      const qc=(data.warehouseQcEvents||[]).filter(function(q){return q.receiptId===event.id;}).slice(-1)[0];
      return '<tr><td><strong>' + poEsc(event.id) + '</strong><small>' + poEsc(event.date || '') + '</small></td><td><strong>' + poEsc(p.sku) + '</strong><small>' + poEsc(p.name) + '</small></td><td>' + Number(event.qty || 0) + '</td><td>' + poEsc(event.supplierReference || '—') + '</td><td>' + poPill(qc ? qc.decision : 'Awaiting QC', qc && qc.decision === 'Accepted' ? 'good' : qc && ['Damaged','Wrong item'].includes(qc.decision) ? 'bad' : 'warn') + '</td><td>' + poEsc(event.locationId || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="po-empty">No physical deliveries have been booked in yet.</td></tr>';
    return '<section class="po-work-card"><div class="po-work-card-head"><div><h3>Deliveries & Receipts</h3><p>Read-only physical receipt history from Warehouse. One PO can have multiple deliveries.</p></div><button type="button" class="primary" data-po-open-receiving="' + poEsc(po.id) + '">Book delivery in Warehouse</button></div><div class="po-rule-banner"><strong>Warehouse owns stock truth</strong><p>Purchasing can see receipts, QC and outstanding quantities but cannot type received stock manually.</p></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>Receipt / GRN</th><th>Item</th><th>Qty</th><th>Supplier ref</th><th>QC</th><th>Location</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
  }

  function poCostsTab(po) {
    const ordered = poOrderValue(po);
    const confirmed = poConfirmedValue(po);
    const receivedValue = (po.lines || []).reduce(function(total,line){return total + Number(line.received||0) * Number(line.confirmedUnitCost != null ? line.confirmedUnitCost : poLineCost(line));},0);
    const invoice = Number(po.supplierInvoiceTotal || 0);
    const variance = invoice ? invoice - receivedValue : 0;
    return '<div class="po-cost-layout"><section class="po-work-card"><div class="po-work-card-head"><div><h3>Three-way invoice match</h3><p>Compare the Purchase Order, physical receipts and supplier invoice before Accounting export.</p></div></div><div class="po-match-grid"><div><span>PO ordered</span><strong>' + poMoney(ordered) + '</strong></div><div><span>Supplier confirmed</span><strong>' + poMoney(confirmed) + '</strong></div><div><span>Physically received</span><strong>' + poMoney(receivedValue) + '</strong></div><div><span>Supplier invoice</span><strong>' + (invoice ? poMoney(invoice) : 'Not entered') + '</strong></div><div><span>Variance</span><strong class="' + (Math.abs(variance) > 0.01 ? 'bad-text' : 'good-text') + '">' + poMoney(variance) + '</strong></div></div><div class="po-fields"><label>Supplier invoice reference<input data-po-field="' + poEsc(po.id) + '|supplierInvoiceRef" value="' + poEsc(po.supplierInvoiceRef || '') + '"></label><label>Supplier invoice total<input type="number" step="0.01" min="0" data-po-field="' + poEsc(po.id) + '|supplierInvoiceTotal" value="' + Number(po.supplierInvoiceTotal || 0).toFixed(2) + '"></label><label>Match status<select data-po-field="' + poEsc(po.id) + '|invoiceMatchStatus"><option' + ((po.invoiceMatchStatus||'Needs review')==='Needs review'?' selected':'') + '>Needs review</option><option' + (po.invoiceMatchStatus==='Matched'?' selected':'') + '>Matched</option><option' + (po.invoiceMatchStatus==='Approved variance'?' selected':'') + '>Approved variance</option></select></label></div></section></div>';
  }

  function ensureReturnsHoldLocation() {
    data.locations = data.locations || [];
    if (!data.locations.some(function(loc){return loc.id === 'L-RETURNS-HOLD';})) data.locations.push({id:'L-RETURNS-HOLD',name:'Supplier Returns Hold',type:'Returns Hold',owner:'Warehouse',barcode:'LOC-RETURNS-HOLD'});
  }

  function nextPurchaseReturnId() {
    data.purchaseReturns = data.purchaseReturns || [];
    const next = data.purchaseReturns.reduce(function(max,row){const m=String(row.id||'').match(/(\d+)/);return Math.max(max,m?Number(m[1]):0);},0)+1;
    return 'PR-' + String(next).padStart(5,'0');
  }

  function purchaseCreateSupplierReturn(input) {
    input = input || {};
    const po = typeof purchaseOrderById === 'function' ? purchaseOrderById(input.poId) : (data.purchaseOrders || []).find(function(row){return row.id===input.poId;});
    if (!po) return {ok:false,error:'Purchase Order not found.'};
    const line = (po.lines || []).find(function(row){return row.productId===input.productId;});
    if (!line) return {ok:false,error:'Product is not on this Purchase Order.'};
    const qty = Math.max(0,Math.floor(Number(input.qty||0)));
    if (!qty) return {ok:false,error:'Enter a return quantity.'};
    const reason = String(input.reason || '').trim();
    if (!reason) return {ok:false,error:'Choose a return reason.'};
    const sourceLocation = input.locationId || 'L-WH-A1';
    const stockRow = (data.stock || []).find(function(row){return row.productId===input.productId && row.locationId===sourceLocation;});
    const free = stockRow ? (typeof available === 'function' ? Number(available(stockRow)||0) : Math.max(0,Number(stockRow.qty||0)-Number(stockRow.allocated||0))) : 0;
    if (free < qty) return {ok:false,error:'Only ' + free + ' free unit(s) are available to return from this location.'};
    ensureReturnsHoldLocation();
    if (typeof removeStock === 'function') {
      if (!removeStock(input.productId, sourceLocation, qty)) return {ok:false,error:'Stock could not be moved to Returns Hold.'};
    } else {
      stockRow.qty = Number(stockRow.qty||0)-qty;
    }
    if (typeof addStock === 'function') addStock(input.productId,'L-RETURNS-HOLD',qty,0);
    else {
      let hold=(data.stock||[]).find(function(row){return row.productId===input.productId&&row.locationId==='L-RETURNS-HOLD';});
      if(!hold){hold={productId:input.productId,locationId:'L-RETURNS-HOLD',qty:0,allocated:0};data.stock.push(hold);} hold.qty+=qty;
    }
    data.purchaseReturns = data.purchaseReturns || [];
    const record={id:nextPurchaseReturnId(),poId:po.id,receiptId:input.receiptId||'',supplier:po.supplier,productId:input.productId,supplierSku:line.supplierSku || (poProduct(input.productId)||{}).supplierSku || '',qty:qty,unitCost:poLineCost(line),expectedCredit:poLineCost(line)*qty,reason:reason,status:'Awaiting Supplier Authorisation',sourceLocationId:sourceLocation,holdLocationId:'L-RETURNS-HOLD',createdAt:new Date().toISOString(),createdBy:(typeof currentUser==='function'&&currentUser()&&(currentUser().name||currentUser().email))||'Purchasing',rma:''};
    data.purchaseReturns.push(record);
    if (typeof addMovement === 'function') addMovement('Supplier Return Hold',input.productId,qty,sourceLocation,'L-RETURNS-HOLD',record.id,record.createdBy,po.id + ' · ' + reason);
    return {ok:true,return:record};
  }

  function purchaseReturnStatusSummary(po) {
    const rows=(data.purchaseReturns||[]).filter(function(row){return !po || row.poId===po.id;});
    return {count:rows.length,open:rows.filter(function(row){return row.status!=='Closed';}).length,expectedCredit:rows.reduce(function(n,row){return n+Number(row.expectedCredit||0);},0)};
  }

  function poReturnsTab(po) {
    const returns=(data.purchaseReturns||[]).filter(function(row){return row.poId===po.id;});
    const rows=returns.map(function(row){const p=poProduct(row.productId)||{sku:row.productId,name:row.productId};return '<tr><td><strong>' + poEsc(row.id) + '</strong><small>' + poEsc(row.createdAt||'') + '</small></td><td><strong>' + poEsc(p.sku) + '</strong><small>' + poEsc(p.name) + '</small></td><td>' + row.qty + '</td><td>' + poEsc(row.reason) + '</td><td>' + poPill(row.status,row.status==='Closed'?'good':'warn') + '</td><td class="right">' + poMoney(row.expectedCredit) + '</td></tr>';}).join('') || '<tr><td colspan="6" class="po-empty">No supplier returns have been created for this PO.</td></tr>';
    const returnable=(po.lines||[]).filter(function(line){return Number(line.received||0)>0;});
    const productOptions=returnable.map(function(line){const p=poProduct(line.productId)||{sku:line.productId,name:line.productId};return '<option value="' + poEsc(line.productId) + '">' + poEsc(p.sku + ' · ' + p.name) + '</option>';}).join('');
    const locationOptions=(data.locations||[]).filter(function(loc){return !['L-RECEIVING','L-QUARANTINE','L-RETURNS-HOLD'].includes(loc.id);}).map(function(loc){return '<option value="' + poEsc(loc.id) + '">' + poEsc(loc.name) + '</option>';}).join('');
    const receipts=(data.receiptEvents||[]).filter(function(event){return event.poId===po.id;}).map(function(event){return '<option value="' + poEsc(event.id) + '">' + poEsc(event.id + ' · ' + (event.supplierReference||'No supplier ref')) + '</option>';}).join('');
    return '<div class="po-returns-layout"><section class="po-work-card"><div class="po-work-card-head"><div><h3>Supplier Returns & Credits</h3><p>Mis-orders, supplier errors, damage, warranty and duplicate deliveries remain linked to the original PO and receipt.</p></div></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>Return</th><th>Item</th><th>Qty</th><th>Reason</th><th>Status</th><th class="right">Expected credit</th></tr></thead><tbody>' + rows + '</tbody></table></div></section><aside class="po-work-card po-return-create"><div class="po-work-card-head"><div><h3>Create supplier return</h3><p>Only free stock can be moved to Returns Hold.</p></div></div><div class="po-return-form" data-po-return-form="' + poEsc(po.id) + '"><label>Product<select data-po-return-product>' + productOptions + '</select></label><label>Quantity<input type="number" min="1" value="1" data-po-return-qty></label><label>Reason<select data-po-return-reason><option>Mis-ordered by Pool Bros</option><option>Wrong quantity ordered</option><option>Supplier sent wrong item</option><option>Supplier sent excess quantity</option><option>Damaged on arrival</option><option>Faulty / warranty</option><option>Duplicate delivery</option><option>No longer required</option><option>Incorrect specification</option><option>Other</option></select></label><label>Current location<select data-po-return-location>' + locationOptions + '</select></label><label>Receipt / GRN<select data-po-return-receipt><option value="">Not specified</option>' + receipts + '</select></label><button type="button" class="primary" data-po-create-return="' + poEsc(po.id) + '">Move to Returns Hold</button></div><div class="po-rule-banner"><strong>Stock effect</strong><p>On Hand remains physical stock. Returned quantity is removed from Available and moved to Supplier Returns Hold until dispatched/credited.</p></div></aside></div>';
  }

  function poActivityTab(po) {
    const events=[];
    events.push({date:po.createdAt||po.created||po.orderedDate||'',type:'Created',detail:'Purchase Order created'});
    if(po.reviewedAt)events.push({date:po.reviewedAt,type:'Reviewed',detail:'Reviewed by ' + (po.reviewedBy||'Purchasing')});
    if(po.supplierEmailSentAt)events.push({date:po.supplierEmailSentAt,type:'Sent',detail:'Supplier PO sent'});
    (data.receiptEvents||[]).filter(function(event){return event.poId===po.id;}).forEach(function(event){events.push({date:event.date||'',type:'Receipt',detail:event.id + ' · ' + event.productId + ' × ' + event.qty});});
    (data.warehouseQcEvents||[]).filter(function(event){return event.poId===po.id;}).forEach(function(event){events.push({date:event.date||'',type:'QC',detail:(event.decision||'') + ' · ' + (event.productId||'') + ' × ' + Number(event.qty||0)});});
    (data.purchaseReturns||[]).filter(function(row){return row.poId===po.id;}).forEach(function(row){events.push({date:row.createdAt||'',type:'Return',detail:row.id + ' · ' + row.reason + ' · ' + row.qty + ' unit(s)'});});
    events.sort(function(a,b){return String(b.date).localeCompare(String(a.date));});
    return '<section class="po-work-card"><div class="po-work-card-head"><div><h3>Purchase Order Activity</h3><p>Supplier, receiving, QC and returns events in one permanent chronology.</p></div></div><div class="po-activity">' + (events.map(function(event){return '<div><span></span><section><strong>' + poEsc(event.type) + '</strong><small>' + poEsc(event.date||'') + '</small><p>' + poEsc(event.detail) + '</p></section></div>';}).join('') || '<p class="po-empty">No activity recorded.</p>') + '</div></section>';
  }

  function poTabContent(po) {
    if (purchaseCommandTab === 'demand') return poDemandTab(po);
    if (purchaseCommandTab === 'confirmation') return poConfirmationTab(po);
    if (purchaseCommandTab === 'receipts') return poReceiptsTab(po);
    if (purchaseCommandTab === 'costs') return poCostsTab(po);
    if (purchaseCommandTab === 'returns') return poReturnsTab(po);
    if (purchaseCommandTab === 'activity') return poActivityTab(po);
    return poItemsTab(po);
  }

  purchaseOrderDetailPage = function (po) {
    if (!po) return legacyPurchaseOrderListPage ? legacyPurchaseOrderListPage() : '<div class="po-empty">No Purchase Order selected.</div>';
    const supplier=poSupplier(po.supplier);
    const summary=poSummarySafe(po);
    const health=purchaseOrderHealth(po);
    return '<div class="purchase-command-page"><header class="po-command-head"><div class="po-command-title"><button type="button" class="secondary" data-back-po-list="true">← Purchase Orders</button><div><div class="po-command-kicker">SUPPLIER ORDER COMMAND</div><h1>' + poEsc(po.id) + ' ' + poPill(poStatusText(po), po.status === 'Received' ? 'good' : po.status === 'Cancelled' ? 'bad' : 'info') + '</h1><p>' + poEsc(po.supplier || 'Supplier to confirm') + ' · Expected ' + poEsc(po.due || 'not set') + ' · ' + summary.pending + ' units outstanding</p></div></div><div class="po-command-actions"><button type="button" class="secondary" data-po-save-action="email|' + poEsc(po.id) + '">Email / Print</button><button type="button" class="secondary" data-po-mark-confirmed="' + poEsc(po.id) + '">Supplier confirmed</button><button type="button" class="secondary" data-po-open-receiving="' + poEsc(po.id) + '">Book delivery</button><button type="button" class="primary" data-po-save-action="save|' + poEsc(po.id) + '">Save PO</button></div></header><section class="po-health-bar"><div><span>PO health</span><strong>' + poEsc(health.label) + '</strong><small>' + poEsc(health.detail) + '</small></div><div><span>Ordered</span><strong>' + summary.ordered + '</strong><small>' + poMoney(poOrderValue(po)) + '</small></div><div><span>Received</span><strong>' + summary.received + '</strong><small>' + summary.pending + ' pending</small></div><div><span>Demand links</span><strong>' + purchaseDemandSources(po).filter(function(s){return s.type!=='Replenishment / stock';}).length + '</strong><small>traceability only</small></div></section><section class="po-command-summary">' + poSupplierCard(po,supplier) + poDetailsCard(po) + poInboundCard(po) + '</section>' + poCommandTabs(po) + '<main class="po-command-body">' + poTabContent(po) + '</main></div>';
  };

  purchaseOrderListPage = function () {
    const rows=(data.purchaseOrders||[]).slice().sort(function(a,b){const ha=purchaseOrderHealth(a),hb=purchaseOrderHealth(b);const rank={bad:0,warn:1,info:2,good:3};return rank[ha.tone]-rank[hb.tone] || String(a.due||'9999').localeCompare(String(b.due||'9999'));}).map(function(po){const summary=poSummarySafe(po),health=purchaseOrderHealth(po);return '<tr><td><button class="link-button" data-open-po-detail="' + poEsc(po.id) + '"><strong>' + poEsc(po.id) + '</strong></button><small>' + poEsc(po.source||'Manual PO') + '</small></td><td><strong>' + poEsc(po.supplier||'Supplier to confirm') + '</strong><small>' + poEsc((poSupplier(po.supplier).ordersEmail||poSupplier(po.supplier).email||'')) + '</small></td><td>' + poPill(health.label,health.tone) + '<small>' + poEsc(health.detail) + '</small></td><td>' + poEsc(poStatusText(po)) + '</td><td>' + summary.received + '/' + summary.ordered + '<small>' + summary.pending + ' outstanding</small></td><td>' + poEsc(po.due||'Not set') + '</td><td class="right">' + poMoney(poOrderValue(po)) + '</td><td><button type="button" class="primary" data-open-po-detail="' + poEsc(po.id) + '">Open</button></td></tr>';}).join('') || '<tr><td colspan="8" class="po-empty">No Purchase Orders yet.</td></tr>';
    const open=(data.purchaseOrders||[]).filter(function(po){return !['Received','Cancelled'].includes(po.status);});
    const pending=open.reduce(function(n,po){return n+poSummarySafe(po).pending;},0);
    const risks=open.filter(function(po){return ['bad','warn'].includes(purchaseOrderHealth(po).tone);}).length;
    return '<div class="purchase-command-page purchase-command-list"><header class="po-command-head"><div><div class="po-command-kicker">PURCHASING</div><h1>Purchase Orders</h1><p>Supplier orders, commitments, receipts, exceptions, returns and invoice matching.</p></div><div class="po-command-actions"><button type="button" class="secondary" data-purchase-view="suppliers">Suppliers</button><button type="button" class="primary" data-create-po-draft="true">New Purchase Order</button></div></header><section class="po-health-bar"><div><span>Open POs</span><strong>' + open.length + '</strong><small>not complete</small></div><div><span>Inbound units</span><strong>' + pending + '</strong><small>still expected</small></div><div><span>Needs attention</span><strong>' + risks + '</strong><small>late or exception</small></div><div><span>Suppliers</span><strong>' + (data.suppliers||[]).length + '</strong><small>supplier accounts</small></div></section><section class="po-work-card"><div class="po-work-card-head"><div><h3>Procurement work queue</h3><p>Exceptions and due commitments first. Open a PO for the full Supplier Order Command.</p></div></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>PO</th><th>Supplier</th><th>Health</th><th>Status</th><th>Receiving</th><th>Expected</th><th class="right">Value</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></section></div>';
  };

  function saveLineField(datasetValue, fieldName, value) {
    const parts=String(datasetValue||'').split('|');
    const po=typeof purchaseOrderById==='function'?purchaseOrderById(parts[0]):(data.purchaseOrders||[]).find(function(row){return row.id===parts[0];});
    const index=Number(parts[1]);
    const line=po && po.lines && po.lines[index];
    if(!line)return;
    line[fieldName]=value;
    if(typeof saveAppData==='function')saveAppData();
  }

  const purchaseWorkspaceSections = ['Purchase Orders','Procurement Demand','Suppliers','Supplier Returns & Credits','Invoice Matching'];

  function purchasePendingLinkedQty(orderId, productId) {
    return (data.purchaseOrders || []).reduce(function(total, po) {
      if (['Cancelled','Received'].includes(po.status)) return total;
      return total + (po.lines || []).filter(function(line){return line.productId === productId && String(line.salesOrderId || po.originalSalesOrderId || '') === String(orderId);}).reduce(function(n,line){return n + Math.max(0,Number(line.qty||0)-Number(line.received||0));},0);
    },0);
  }

  function procurementDemandRows() {
    const rows=[];
    (data.salesOrders || []).forEach(function(order){
      if (['Cancelled','Completed','Shipped','Invoiced'].includes(order.status)) return;
      (order.lines || []).forEach(function(line){
        const shortage=Math.max(0,Number(line.qty||0)-Number(line.allocated||0));
        if(!shortage)return;
        const inbound=purchasePendingLinkedQty(order.id,line.productId);
        const toBuy=Math.max(0,shortage-inbound);
        if(!toBuy)return;
        const p=poProduct(line.productId)||{sku:line.productId,name:line.productId,supplier:'Supplier to confirm'};
        rows.push({order:order,line:line,p:p,shortage:shortage,inbound:inbound,toBuy:toBuy,supplier:p.supplier||'Supplier to confirm'});
      });
    });
    rows.sort(function(a,b){return String(a.order.created||'9999').localeCompare(String(b.order.created||'9999')) || String(a.order.due||'9999').localeCompare(String(b.order.due||'9999'));});
    return rows;
  }

  function purchaseCreateOrMergeDemandPo(orderId, productId, qty) {
    const order=(data.salesOrders||[]).find(function(row){return row.id===orderId;});
    const p=poProduct(productId);
    const amount=Math.max(0,Math.floor(Number(qty||0)));
    if(!order||!p||!amount)return {ok:false,error:'Demand line is no longer available.'};
    const supplier=p.supplier||'Supplier to confirm';
    let po=(data.purchaseOrders||[]).find(function(row){return row.supplier===supplier && row.status==='Draft - Review';});
    if(!po){
      const id=typeof nextPurchaseOrderId==='function'?nextPurchaseOrderId():'PO-'+String(1000+(data.purchaseOrders||[]).length+1);
      po={id:id,supplier:supplier,status:'Draft - Review',due:order.due||'',source:'Consolidated procurement demand',reviewStatus:'Needs review',supplierEmailStatus:'Blocked until reviewed',lines:[]};
      data.purchaseOrders.unshift(po);
    }
    let line=(po.lines||[]).find(function(row){return row.productId===productId && row.salesOrderId===orderId;});
    if(line) line.qty=Number(line.qty||0)+amount;
    else po.lines.push({productId:productId,qty:amount,received:0,salesOrderId:orderId,supplierSku:p.supplierSku||'',unitCost:Number(p.cost||0),orderedDate:poToday(),dueDate:order.due||'',chaseStatus:'Waiting',supplierNotes:'Consolidated from Procurement Demand'});
    return {ok:true,po:po};
  }

  function purchaseProcurementDemandPage() {
    const demand=procurementDemandRows();
    const rows=demand.map(function(row){return '<tr><td><strong>' + poEsc(row.order.id) + '</strong><small>' + poEsc(row.order.due||'No due date') + '</small></td><td><strong>' + poEsc(row.p.sku) + '</strong><small>' + poEsc(row.p.name) + '</small></td><td>' + poEsc(row.supplier) + '</td><td>' + row.shortage + '</td><td>' + row.inbound + '</td><td><strong>' + row.toBuy + '</strong></td><td><button type="button" class="primary" data-po-create-demand="' + poEsc(row.order.id + '|' + row.productId) + '" data-po-create-demand-qty="' + row.toBuy + '">Add to supplier PO</button></td></tr>';}).join('') || '<tr><td colspan="7" class="po-empty">No uncovered Sales Order shortages need purchasing.</td></tr>';
    const units=demand.reduce(function(n,row){return n+row.toBuy;},0);
    return '<div class="purchase-command-page"><header class="po-command-head"><div><div class="po-command-kicker">PURCHASING / PROCUREMENT DEMAND</div><h1>Procurement Demand</h1><p>Uncovered customer demand after current allocation and linked inbound stock.</p></div></header><section class="po-health-bar"><div><span>Demand lines</span><strong>' + demand.length + '</strong><small>need purchasing</small></div><div><span>Units to buy</span><strong>' + units + '</strong><small>after linked inbound</small></div><div><span>Allocation rule</span><strong>FIFO</strong><small>on physical receipt</small></div><div><span>PO creation</span><strong>Consolidated</strong><small>by supplier draft</small></div></section><section class="po-work-card"><div class="po-work-card-head"><div><h3>Demand needing purchase</h3><p>Adding demand merges it into an existing Draft PO for the same supplier where possible.</p></div></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>Sales Order</th><th>Item</th><th>Supplier</th><th>Shortage</th><th>Already inbound</th><th>To buy</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></section></div>';
  }

  function purchaseReturnsOverviewPage() {
    const rows=(data.purchaseReturns||[]).slice().sort(function(a,b){return String(b.createdAt||'').localeCompare(String(a.createdAt||''));}).map(function(row){const p=poProduct(row.productId)||{sku:row.productId,name:row.productId};return '<tr><td><strong>' + poEsc(row.id) + '</strong><small>' + poEsc(row.poId) + '</small></td><td>' + poEsc(row.supplier) + '</td><td><strong>' + poEsc(p.sku) + '</strong><small>' + poEsc(p.name) + '</small></td><td>' + row.qty + '</td><td>' + poEsc(row.reason) + '</td><td>' + poPill(row.status,row.status==='Closed'?'good':'warn') + '</td><td class="right">' + poMoney(row.expectedCredit) + '</td></tr>';}).join('') || '<tr><td colspan="7" class="po-empty">No supplier returns or credits recorded.</td></tr>';
    const summary=purchaseReturnStatusSummary();
    return '<div class="purchase-command-page"><header class="po-command-head"><div><div class="po-command-kicker">PURCHASING / RETURNS</div><h1>Supplier Returns & Credits</h1><p>Mis-orders, supplier errors, damage, warranties and outstanding supplier credits.</p></div></header><section class="po-health-bar"><div><span>Return records</span><strong>' + summary.count + '</strong><small>all time</small></div><div><span>Open returns</span><strong>' + summary.open + '</strong><small>not closed</small></div><div><span>Expected credits</span><strong>' + poMoney(summary.expectedCredit) + '</strong><small>supplier value</small></div><div><span>Stock location</span><strong>Returns Hold</strong><small>excluded from Available</small></div></section><section class="po-work-card"><div class="po-work-card-head"><div><h3>Return & credit queue</h3><p>Create a return from the original Purchase Order so cost, receipt and stock history remain linked.</p></div></div><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>Return / PO</th><th>Supplier</th><th>Item</th><th>Qty</th><th>Reason</th><th>Status</th><th class="right">Expected credit</th></tr></thead><tbody>' + rows + '</tbody></table></div></section></div>';
  }

  function purchaseInvoiceMatchingPage() {
    const rows=(data.purchaseOrders||[]).filter(function(po){return po.supplierInvoiceRef || Number(po.supplierInvoiceTotal||0)>0 || poSummarySafe(po).received>0;}).map(function(po){const received=(po.lines||[]).reduce(function(n,line){return n+Number(line.received||0)*Number(line.confirmedUnitCost!=null?line.confirmedUnitCost:poLineCost(line));},0);const invoice=Number(po.supplierInvoiceTotal||0);const variance=invoice?invoice-received:0;return '<tr><td><button class="link-button" data-open-po-detail="' + poEsc(po.id) + '"><strong>' + poEsc(po.id) + '</strong></button></td><td>' + poEsc(po.supplier) + '</td><td>' + poMoney(received) + '</td><td>' + (invoice?poMoney(invoice):'Not entered') + '</td><td class="right"><strong class="' + (Math.abs(variance)>.01?'bad-text':'good-text') + '">' + poMoney(variance) + '</strong></td><td>' + poPill(po.invoiceMatchStatus||'Needs review',po.invoiceMatchStatus==='Matched'?'good':'warn') + '</td></tr>';}).join('') || '<tr><td colspan="6" class="po-empty">No received Purchase Orders are waiting for invoice matching.</td></tr>';
    return '<div class="purchase-command-page"><header class="po-command-head"><div><div class="po-command-kicker">PURCHASING / ACCOUNTS CONTROL</div><h1>Invoice Matching</h1><p>Three-way view of Purchase Order value, received stock and supplier invoice.</p></div></header><section class="po-work-card"><div class="po-table-wrap"><table class="po-command-table"><thead><tr><th>PO</th><th>Supplier</th><th>Received value</th><th>Supplier invoice</th><th class="right">Variance</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div></section></div>';
  }

  sidebarSubGroups = function(tabId){
    if(tabId==='purchase') return purchaseWorkspaceSections.slice();
    return legacySidebarSubGroups ? legacySidebarSubGroups(tabId) : [];
  };
  defaultSubPage = function(tabId){
    if(tabId==='purchase') return 'Purchase Orders';
    return legacyDefaultSubPage ? legacyDefaultSubPage(tabId) : '';
  };
  openSidebarSubGroup = function(tabId,subgroup){
    if(tabId!=='purchase') return legacyOpenSidebarSubGroup ? legacyOpenSidebarSubGroup(tabId,subgroup) : undefined;
    active='purchase'; activeSubPage.purchase=subgroup;
    if(subgroup==='Purchase Orders') purchaseOrderView='list';
    if(subgroup==='Suppliers') purchaseOrderView='suppliers';
    if(typeof render==='function') render();
  };

  renderPurchase = function(){
    const sub=typeof selectedSubPage==='function'?selectedSubPage('purchase'):(activeSubPage.purchase||'Purchase Orders');
    const selectedPo=typeof purchaseOrderById==='function'?purchaseOrderById(selectedPurchaseOrderId):(data.purchaseOrders||[])[0];
    let content;
    if(purchaseOrderView==='detail' && selectedPo) content=purchaseOrderDetailPage(selectedPo);
    else if(purchaseOrderView==='supplier-profile' && typeof supplierProfilePage==='function') content=supplierProfilePage(selectedSupplierName);
    else if(purchaseOrderView==='supplier-catalogue' && typeof supplierCataloguePage==='function') content=supplierCataloguePage(selectedSupplierName);
    else if(sub==='Procurement Demand') content=purchaseProcurementDemandPage();
    else if(sub==='Supplier Returns & Credits') content=purchaseReturnsOverviewPage();
    else if(sub==='Invoice Matching') content=purchaseInvoiceMatchingPage();
    else if(sub==='Suppliers' || purchaseOrderView==='suppliers') content=typeof supplierManagementPage==='function'?supplierManagementPage():purchaseOrderListPage();
    else content=purchaseOrderListPage();
    const screen=document.getElementById('screen-purchase'); if(screen) screen.innerHTML=content;
    bindPurchase();
  };

  globalThis.openPurchaseOrderTab = function(poId, tab){
    selectedPurchaseOrderId=poId;
    purchaseOrderView='detail';
    purchaseCommandTab=tab||'items';
    active='purchase';
    activeSubPage.purchase='Purchase Orders';
    if(typeof render==='function') render();
  };
  globalThis.purchaseCreateOrMergeDemandPo = purchaseCreateOrMergeDemandPo;

  function bindPurchaseCommand() {
    document.querySelectorAll('[data-po-create-demand]').forEach(function(button){button.addEventListener('click',function(){const parts=button.dataset.poCreateDemand.split('|');const result=purchaseCreateOrMergeDemandPo(parts[0],parts[1],button.dataset.poCreateDemandQty);if(!result.ok)return typeof toast==='function'?toast(result.error):undefined;selectedPurchaseOrderId=result.po.id;purchaseOrderView='detail';activeSubPage.purchase='Purchase Orders';if(typeof saveAppData==='function')saveAppData();if(typeof toast==='function')toast('Demand added to ' + result.po.id + '.');if(typeof render==='function')render();});});
    document.querySelectorAll('[data-po-command-tab]').forEach(function(button){button.addEventListener('click',function(){purchaseCommandTab=button.dataset.poCommandTab.split('|')[0];if(typeof render==='function')render();});});
    document.querySelectorAll('[data-po-open-receiving]').forEach(function(button){button.addEventListener('click',function(){selectedGoodsInPoId=button.dataset.poOpenReceiving;warehousePoView='list';active='warehouse';activeSubPage.warehouse='Inbound';if(typeof toast==='function')toast('Opened easy booking-in for ' + selectedGoodsInPoId + '.');if(typeof render==='function')render();});});
    document.querySelectorAll('[data-po-line-cost]').forEach(function(input){input.addEventListener('change',function(){saveLineField(input.dataset.poLineCost,'unitCost',Math.max(0,Number(input.value||0)));if(typeof render==='function')render();});});
    document.querySelectorAll('[data-po-confirmed-qty]').forEach(function(input){input.addEventListener('change',function(){saveLineField(input.dataset.poConfirmedQty,'confirmedQty',Math.max(0,Math.floor(Number(input.value||0))));});});
    document.querySelectorAll('[data-po-confirmed-cost]').forEach(function(input){input.addEventListener('change',function(){saveLineField(input.dataset.poConfirmedCost,'confirmedUnitCost',Math.max(0,Number(input.value||0)));});});
    document.querySelectorAll('[data-po-confirmed-eta]').forEach(function(input){input.addEventListener('change',function(){saveLineField(input.dataset.poConfirmedEta,'confirmedEta',input.value);});});
    document.querySelectorAll('[data-po-confirmation-note]').forEach(function(input){input.addEventListener('change',function(){saveLineField(input.dataset.poConfirmationNote,'supplierConfirmationNote',input.value);});});
    document.querySelectorAll('[data-po-mark-confirmed]').forEach(function(button){button.addEventListener('click',function(){const po=typeof purchaseOrderById==='function'?purchaseOrderById(button.dataset.poMarkConfirmed):null;if(!po)return;po.status='Supplier Confirmed';po.supplierConfirmedAt=new Date().toISOString();po.lines.forEach(function(line){if(line.confirmedQty==null)line.confirmedQty=Number(line.qty||0);if(line.confirmedUnitCost==null)line.confirmedUnitCost=poLineCost(line);if(!line.confirmedEta)line.confirmedEta=po.due||'';});if(typeof saveAppData==='function')saveAppData();if(typeof toast==='function')toast(po.id + ' marked Supplier Confirmed.');if(typeof render==='function')render();});});
    document.querySelectorAll('[data-po-create-return]').forEach(function(button){button.addEventListener('click',function(){const form=button.closest('[data-po-return-form]');if(!form)return;const result=purchaseCreateSupplierReturn({poId:button.dataset.poCreateReturn,productId:form.querySelector('[data-po-return-product]').value,qty:form.querySelector('[data-po-return-qty]').value,reason:form.querySelector('[data-po-return-reason]').value,locationId:form.querySelector('[data-po-return-location]').value,receiptId:form.querySelector('[data-po-return-receipt]').value});if(!result.ok)return typeof toast==='function'?toast(result.error):undefined;if(typeof saveAppData==='function')saveAppData();if(typeof toast==='function')toast(result.return.id + ' created and stock moved to Supplier Returns Hold.');if(typeof render==='function')render();});});
  }

  bindPurchase = function () {
    if (legacyBindPurchase) legacyBindPurchase();
    bindPurchaseCommand();
  };

  globalThis.purchaseOrderHealth = purchaseOrderHealth;
  globalThis.purchaseDemandSources = purchaseDemandSources;
  globalThis.purchaseCreateSupplierReturn = purchaseCreateSupplierReturn;
  globalThis.purchaseReturnStatusSummary = purchaseReturnStatusSummary;
  globalThis.bindPurchaseCommand = bindPurchaseCommand;
})();
