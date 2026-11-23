/* Pool Shed v1.88.0 — sales order flow (blueprint step 2).
   Adds to the existing order page, without replacing it:
   - a status rail showing where the order is: Ordered → Allocated → Picked & packed → Delivered → Invoiced → Paid;
   - one highlighted next-step button that runs the existing action (allocate, fulfil, mark delivered, invoice, payment);
   - a money summary: order total, invoiced, paid, balance and margin;
   - "Copy order" to start a new order from this one.
   Invoice and payment open in place on the order (sales-invoicing-workspace.js). Every rule stays where it was. */
(function(global){
  'use strict';
  if (typeof global.salesOrderDetail !== 'function' && typeof salesOrderDetail !== 'function') return;
  var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); };
  var DELIVERED = ['Shipped', 'Invoice Ready', 'Invoiced', 'Completed'];
  var cash = function(v){ return typeof money === 'function' ? money(Number(v || 0)) : '£' + Number(v || 0).toFixed(2); };

  function stockLines(order){ return (order.lines || []).filter(function(l){ return !(typeof isNonStockSalesLine === 'function' ? isNonStockSalesLine(l) : l.lineType); }); }
  // Where the order is, worked out from the order itself (never stored separately).
  function flow(order){
    var lines = stockLines(order), need = lines.reduce(function(t, l){ return t + Number(l.qty || 0); }, 0);
    var alloc = lines.reduce(function(t, l){ return t + Math.min(Number(l.qty || 0), Number(l.allocated || 0)); }, 0);
    var packed = lines.reduce(function(t, l){ return t + Math.min(Number(l.qty || 0), Number(l.packed || 0)); }, 0);
    var prog = typeof salesOrderProgress === 'function' ? salesOrderProgress(order) : { shipped: 0 };
    var totals = typeof salesOrderTotals === 'function' ? salesOrderTotals(order) : { gross: 0, paid: 0, net: 0 };
    var delivered = DELIVERED.indexOf(order.status) >= 0 || order.isCompleted === true || (need > 0 && Number(prog.shipped || 0) >= need);
    var invoiced = order.invoiceSource === 'Ledger' || /^INV-/.test(String(order.xeroRef || '')) || order.status === 'Invoiced';
    if (invoiced) delivered = true;   // an order is only fully invoiced once delivered
    var paid = totals.gross > 0 && Number(totals.paid || 0) >= totals.gross - 0.005;
    var steps = [
      { key: 'ordered', label: 'Ordered', done: (order.lines || []).length > 0 },
      { key: 'allocated', label: 'Allocated', done: need === 0 || alloc >= need || delivered, na: need === 0 },
      { key: 'packed', label: 'Picked & packed', done: need === 0 || packed >= need || delivered, na: need === 0 },
      { key: 'delivered', label: 'Delivered', done: delivered },
      { key: 'invoiced', label: 'Invoiced', done: invoiced },
      { key: 'paid', label: 'Paid', done: paid }
    ];
    var current = steps.filter(function(x){ return !x.done; })[0] || null;
    return { steps: steps, current: current, need: need, alloc: alloc, totals: totals, delivered: delivered, invoiced: invoiced, paid: paid };
  }
  function nextButton(order, f){
    var id = esc(order.id), cur = f.current && f.current.key;
    if (order.status === 'On Hold') return '<span class="sof-note">On hold: change the status to carry on.</span>';
    if (!cur) return '<span class="sof-done">Complete: delivered, invoiced and paid.</span>';
    if (cur === 'ordered') return '<span class="sof-note">Add items below to start the order.</span>';
    if (cur === 'allocated') return '<button type="button" class="primary sof-next" title="Ctrl+Enter" data-allocate-order="' + id + '">Allocate stock</button>';
    if (cur === 'packed') return '<button type="button" class="primary sof-next" title="Ctrl+Enter" data-fulfil-order="' + id + '">Pick, pack and ship</button>';
    if (cur === 'delivered') return f.need > 0 ? '<button type="button" class="primary sof-next" title="Ctrl+Enter" data-fulfil-order="' + id + '">Ship remaining items</button>'
                                               : '<button type="button" class="primary sof-next" title="Ctrl+Enter" data-sof-delivered="' + id + '">Mark as done</button>';
    if (cur === 'invoiced') return '<button type="button" class="primary sof-next" title="Ctrl+Enter" data-sof-invoice="' + id + '">Invoice ' + esc(cash(f.totals.gross - Number(f.totals.paid || 0) > 0 ? f.totals.gross : f.totals.gross)) + '</button>';
    if (cur === 'paid') return '<button type="button" class="primary sof-next" title="Ctrl+Enter" data-sof-pay="' + id + '">Record payment ' + esc(cash(f.totals.gross - Number(f.totals.paid || 0))) + '</button>';
    return '';
  }
  // The items sold most often across all orders, for one-tap adding while an order is being built.
  var oftenCache = { at: 0, list: [] };
  function oftenSold(){
    if (Date.now() - oftenCache.at < 60000) return oftenCache.list;
    var d = typeof global.__POOL_SHED_GET_DATA__ === 'function' ? global.__POOL_SHED_GET_DATA__() : {}, count = {};
    (d.salesOrders || []).forEach(function(o){ (o.lines || []).forEach(function(l){ if (!l.productId || l.lineType) return; count[l.productId] = (count[l.productId] || 0) + 1; }); });
    oftenCache.list = Object.keys(count).sort(function(a, b){ return count[b] - count[a]; }).slice(0, 8)
      .map(function(id){ var p = typeof product === 'function' ? product(id) : null; return p ? { id: id, name: p.name || p.sku || id, sku: p.sku || '' } : null; }).filter(Boolean);
    oftenCache.at = Date.now(); return oftenCache.list;
  }
  function bar(order){
    var f = flow(order), t = f.totals;
    var cost = typeof salesOrderCostSummary === 'function' ? salesOrderCostSummary(order) : null;
    var margin = cost && cost.sell > 0 ? Math.round((cost.margin / cost.sell) * 100) : null;
    var rail = f.steps.map(function(x){ var cls = x.done ? (x.na ? 'na' : 'done') : (f.current && f.current.key === x.key ? 'now' : '');
      return '<li class="' + cls + '"><span>' + esc(x.label) + (x.na ? ' <small>n/a</small>' : '') + '</span></li>'; }).join('');
    var invoiceRef = /^INV-/.test(String(order.xeroRef || '')) ? order.xeroRef : '';
    return '<section class="sof-bar" aria-label="Where this order is">' +
      '<ol class="sof-rail">' + rail + '</ol>' +
      '<div class="sof-row"><div class="sof-next-wrap">' + nextButton(order, f) + '</div>' +
      '<dl class="sof-money"><div><dt>Order total</dt><dd>' + esc(cash(t.gross)) + '</dd></div>' +
      '<div><dt>Invoiced</dt><dd>' + (f.invoiced ? esc(invoiceRef || 'Yes') : '—') + '</dd></div>' +
      '<div><dt>Paid</dt><dd>' + esc(cash(t.paid)) + '</dd></div>' +
      '<div><dt>Balance</dt><dd class="' + (t.gross - Number(t.paid || 0) > 0.005 ? 'owed' : '') + '">' + esc(cash(Math.max(0, t.gross - Number(t.paid || 0)))) + '</dd></div>' +
      (margin == null ? '' : '<div><dt>Margin</dt><dd class="' + (margin < 20 ? 'low' : '') + '">' + margin + '%</dd></div>') + '</dl>' +
      '<button type="button" class="secondary sof-copy" data-sof-copy="' + esc(order.id) + '">Copy order</button></div></section>';
  }

  var previous = salesOrderDetail;
  salesOrderDetail = function(order){
    var html = previous.apply(this, arguments);
    try {
      var marker = '<div class="so3-command-accent" aria-hidden="true"></div>';
      var flowHtml = bar(order);
      html = html.indexOf(marker) >= 0 ? html.replace(marker, marker + flowHtml) : flowHtml + html;
      // The old row of equal buttons: the next step is now highlighted above, so the duplicates step back.
      html = html.replace('class="secondary so3-invoice" data-open-invoice-confirm=', 'class="secondary so3-invoice sof-quiet" data-open-invoice-confirm=');
    } catch (e) { console.warn('Order flow bar skipped', e); }
    return html;
  };
  global.salesOrderDetail = salesOrderDetail;

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function(e){
      var t = e.target && e.target.closest ? e.target : null; if (!t) return;
      var add = t.closest('[data-sof-add]');
      if (add) { e.preventDefault(); var parts = add.dataset.sofAdd.split('|'), search = document.getElementById('salesOrderProductSearch'), qty = document.getElementById('salesOrderProductQty');
        if (typeof addProductToSalesOrder === 'function' && search) { search.dataset.selectedProductId = parts[1]; if (qty) qty.value = 1; addProductToSalesOrder(parts[0]); }
        else if (typeof global.toast === 'function') global.toast('Open the Items tab to add products.');
        return; }
      var inv = t.closest('[data-sof-invoice]'), pay = t.closest('[data-sof-pay]'), cp = t.closest('[data-sof-copy]'), dl = t.closest('[data-sof-delivered]');
      if (inv) { e.preventDefault(); if (global.PoolShedSalesUI && global.PoolShedSalesUI.inlineInvoice) global.PoolShedSalesUI.inlineInvoice(inv.dataset.sofInvoice); return; }
      if (pay) { e.preventDefault(); var o = typeof salesOrder === 'function' ? salesOrder(pay.dataset.sofPay) : null;
        if (o && o.invoiceSource !== 'Ledger') { var b = document.querySelector('[data-open-payment="' + o.id + '"]'); if (b) { b.click(); return; } }
        if (o && global.PoolShedSalesUI && global.PoolShedSalesUI.inlinePayment) global.PoolShedSalesUI.inlinePayment(o); return; }
      if (cp) { e.preventDefault(); if (typeof global.__POOL_SHED_COPY_SALES_ORDER__ === 'function') global.__POOL_SHED_COPY_SALES_ORDER__(cp.dataset.sofCopy); return; }
      if (dl) { e.preventDefault(); if (typeof global.__POOL_SHED_SET_ORDER_STATUS__ === 'function') global.__POOL_SHED_SET_ORDER_STATUS__(dl.dataset.sofDelivered, 'Invoice Ready', 'Marked as done: ready to invoice'); return; }
    }, true);
  }
  if (typeof document !== 'undefined' && document.head && !document.getElementById('sof-styles')) {
    var st = document.createElement('style'); st.id = 'sof-styles';
    st.textContent =
      '.sof-bar{margin:12px 0 4px;padding:14px 16px;border:1px solid var(--color-border-default);border-radius:12px;background:var(--color-surface-default)}' +
      '.sof-rail{display:flex;gap:4px;list-style:none;margin:0 0 12px;padding:0;flex-wrap:wrap}.sof-rail li{flex:1 1 100px;text-align:center;font-size:13px;font-weight:700;padding:8px 4px;border-radius:8px;background:var(--color-surface-subtle);color:var(--color-text-secondary)}' +
      '.sof-rail li.done{background:var(--color-status-success-bg);color:var(--color-status-success-text)}.sof-rail li.na{background:var(--color-surface-subtle);color:var(--color-text-muted)}.sof-rail li.now{background:var(--color-action-primary);color:var(--color-action-contrast)}.sof-rail small{font-weight:500}' +
      '.sof-row{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center}.sof-next-wrap{min-width:200px}.sof-next{font-size:15px!important;padding:10px 18px!important}' +
      '.sof-note,.sof-done{font-weight:600;opacity:.8}.sof-done{color:var(--color-status-success-text);opacity:1}' +
      '.sof-money{display:flex;flex-wrap:wrap;gap:6px 22px;margin:0;flex:1}.sof-money div{min-width:84px}.sof-money dt{font-size:12.5px;opacity:.7}.sof-money dd{margin:0;font-weight:700;font-size:16px;white-space:nowrap;font-variant-numeric:tabular-nums}.sof-money dd.owed{color:var(--color-status-danger-text)}.sof-money dd.low{color:var(--color-status-attention-text)}' +
      '.sof-copy{margin-left:auto}.sof-quiet{opacity:.7}' +
      '';
    document.head.appendChild(st);
  }
  global.PoolShedOrderFlow = { flow: flow, bar: bar, oftenSold: oftenSold };  // v1.88: Quick add now sits under the product search
})(typeof window !== 'undefined' ? window : globalThis);
