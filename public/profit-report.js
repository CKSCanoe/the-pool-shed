/* Pool Shed v1.81.0 — Profit: by order, project, customer and month (blueprint step 7).
   Order cost = the purchase order lines linked to the order (bought in for it) plus, for anything sold from stock,
   the quantity × the product's average cost from goods in (or its cost price until goods have been received).
   Projects use the project's own budget-against-actual (sales, actual cost, forecast final cost).
   Orders with a line that has no cost at all are flagged, never counted as 100% profit. */
(function(global){
  'use strict';
  var DELIVERED = ['Shipped', 'Invoice Ready', 'Invoiced', 'Completed'];
  var DATA = function(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? (global.__POOL_SHED_GET_DATA__() || {}) : {}; };
  var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); };
  var num = function(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; };
  var r2 = function(n){ return Math.round(n * 100) / 100; };
  var cash = function(v){ return (v < 0 ? '−£' : '£') + Math.abs(num(v)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var pct = function(p){ return p == null ? '—' : (Math.round(p * 10) / 10).toFixed(1) + '%'; };
  var ui = { view: 'order', period: 'year', from: '', to: '', done: true };

  function stockCost(p){ return global.PoolShedStockCost ? global.PoolShedStockCost.unitCost(p) : (p && p.cost != null && p.cost !== '' ? num(p.cost) : null); }
  function orderDate(o){ return String(o.date || o.orderDate || o.created || o.createdAt || '').slice(0, 10); }
  function isDone(o){ return DELIVERED.indexOf(o.status) >= 0 || o.isCompleted === true || o.invoiceSource === 'Ledger' || /^INV-/.test(String(o.xeroRef || '')); }
  function nonStockLine(l){ return typeof global.isNonStockSalesLine === 'function' ? global.isNonStockSalesLine(l) : !!l.lineType; }

  // Every non-project order: sales, cost (linked POs, then stock at average cost) and what is still missing.
  function orderRows(){
    var d = DATA(), engine = global.PoolShedFinanceCommand, products = new Map((d.products || []).map(function(p){ return [String(p.id), p]; }));
    if (!engine || typeof engine.orderProfitRows !== 'function') return [];
    var linkedQty = new Map();
    (d.purchaseOrders || []).filter(function(po){ return ['Cancelled', 'Canceled'].indexOf(po.status) < 0; }).forEach(function(po){
      (po.lines || []).forEach(function(l){ var so = String(l.salesOrderId != null ? l.salesOrderId : po.originalSalesOrderId || ''); if (!so) return;
        var k = so + '|' + l.productId; linkedQty.set(k, (linkedQty.get(k) || 0) + num(l.qty)); });
    });
    var orders = new Map((d.salesOrders || []).map(function(o){ return [String(o.id), o]; }));
    return engine.orderProfitRows().map(function(x){
      var o = orders.get(String(x.orderId)) || {}; if (['Cancelled', 'Canceled', 'Draft', 'Quote'].indexOf(o.status) >= 0) return null;
      var stock = 0, missing = 0, fromStock = 0;
      (o.lines || []).forEach(function(l){
        if (l.bundleRole === 'head' || l.lineType === 'shipping' || !(num(l.qty) > 0)) return;
        var uncovered = Math.max(0, num(l.qty) - (linkedQty.get(o.id + '|' + l.productId) || 0)); if (!uncovered) return;
        // Custom lines (services, one-off items) carry their own cost; stock lines use the average cost from goods in.
        var unit = nonStockLine(l) ? (l.unitCost != null && l.unitCost !== '' ? num(l.unitCost) : null)
          : l.unitCost != null && l.unitCost !== '' && num(l.unitCost) > 0 ? num(l.unitCost) : stockCost(products.get(String(l.productId)));
        if (unit == null || !(unit > 0)) { missing++; return; }
        stock += uncovered * unit; fromStock++;
      });
      var cost = r2(x.linkedCostNet + stock), sales = r2(x.revenueNet), profit = r2(sales - cost);
      return { id: x.orderId, customerId: x.customerId, customer: x.customerName, status: x.status, date: orderDate(o), done: isDone(o),
        sales: sales, poCost: r2(x.linkedCostNet), stockCost: r2(stock), cost: cost, profit: profit, margin: sales > 0 ? profit / sales * 100 : null,
        missing: missing, basis: missing ? 'Cost missing on ' + missing + ' line' + (missing > 1 ? 's' : '') : x.linkedPOs.length && fromStock ? 'Bought in + stock' : x.linkedPOs.length ? 'Bought in' : 'Stock and line costs',
        pos: x.linkedPOs };
    }).filter(Boolean);
  }
  function projectRows(){
    var d = DATA(); if (typeof global.psProjectSummary !== 'function') return [];
    return (d.jobs || []).filter(function(j){ return j && j.project && ['Cancelled', 'Canceled'].indexOf(j.status) < 0; }).map(function(j){
      var s; try { s = global.psProjectSummary(j, d); } catch (_) { return null; }
      var c = (d.customers || []).find(function(x){ return x.id === j.customerId; }) || {};
      return { id: j.id, name: j.name || j.id, customerId: j.customerId, customer: c.name || '', status: j.status || '', date: String(j.startDate || j.created || '').slice(0, 10),
        sales: r2(s.revenue / 100), actual: r2(s.actual / 100), forecast: r2(s.forecast / 100), profit: r2(s.profit / 100), margin: s.margin, missing: s.missingCosts || 0 };
    }).filter(Boolean);
  }
  function range(){
    var t = new Date(), y = t.getFullYear(), m = t.getMonth(), iso = function(x){ return x.toISOString().slice(0, 10); };
    if (ui.period === 'month') return [iso(new Date(Date.UTC(y, m, 1))), ''];
    if (ui.period === 'last3') return [iso(new Date(Date.UTC(y, m - 2, 1))), ''];
    if (ui.period === 'year') return [iso(new Date(Date.UTC(y, 0, 1))), ''];
    if (ui.period === 'custom') return [ui.from, ui.to];
    return ['', ''];
  }
  function inRange(date){ var r = range(); if (!date) return !r[0] && !r[1]; return (!r[0] || date >= r[0]) && (!r[1] || date <= r[1]); }
  function filteredOrders(){ return orderRows().filter(function(x){ return (!ui.done || x.done) && inRange(x.date); }); }
  function group(rows, keyFn, labelFn){
    var m = new Map(); rows.forEach(function(x){ var k = keyFn(x), g = m.get(k) || { key: k, label: labelFn(x), count: 0, sales: 0, cost: 0, profit: 0, missing: 0 };
      g.count++; g.sales += x.sales; g.cost += x.cost != null ? x.cost : x.forecast; g.profit += x.profit; g.missing += x.missing ? 1 : 0; m.set(k, g); });
    return Array.from(m.values()).map(function(g){ g.sales = r2(g.sales); g.cost = r2(g.cost); g.profit = r2(g.profit); g.margin = g.sales > 0 ? g.profit / g.sales * 100 : null; return g; });
  }
  function byCustomer(){
    var rows = filteredOrders().concat(projectRows().map(function(p){ return Object.assign({}, p, { cost: p.forecast }); }));
    return group(rows, function(x){ return String(x.customerId || x.customer || '—'); }, function(x){ return x.customer || 'No customer'; }).sort(function(a, b){ return b.profit - a.profit; });
  }
  function byMonth(){ return group(filteredOrders().filter(function(x){ return x.date; }), function(x){ return x.date.slice(0, 7); }, function(x){ return x.date.slice(0, 7); }).sort(function(a, b){ return a.key < b.key ? 1 : -1; }); }

  function table(head, rows, empty){ return '<div class="table-wrap"><table class="pr-table"><thead><tr>' + head.map(function(h){ return '<th' + (h.r ? ' class="right"' : '') + '>' + esc(h.l) + '</th>'; }).join('') + '</tr></thead><tbody>' + (rows || '<tr><td colspan="' + head.length + '" class="muted">' + esc(empty) + '</td></tr>') + '</tbody></table></div>'; }
  function money(v, missing){ return '<td class="right">' + cash(v) + '</td>'; }
  function marginCell(m, missing){ return '<td class="right">' + (missing ? '<span class="finance-pill warn">check cost</span>' : '<strong class="' + (m != null && m < 0 ? 'pr-bad' : '') + '">' + pct(m) + '</strong>') + '</td>'; }
  function tiles(rows){
    var sales = rows.reduce(function(n, x){ return n + x.sales; }, 0), cost = rows.reduce(function(n, x){ return n + (x.cost != null ? x.cost : x.forecast); }, 0), profit = sales - cost, miss = rows.filter(function(x){ return x.missing; }).length;
    return '<div class="finance-command-metrics pr-tiles">' + [['Sales (before VAT)', cash(sales), rows.length + ' ' + (ui.view === 'project' ? 'projects' : 'orders')], ['Cost', cash(cost), ui.view === 'project' ? 'Forecast final cost' : 'Bought in + stock'],
      ['Gross profit', cash(profit), sales > 0 ? pct(profit / sales * 100) + ' margin' : ''], ['Missing a cost', String(miss), miss ? 'Add a cost price to these lines' : 'Every line has a cost']].map(function(t, i){
      return '<div class="finance-metric' + (i === 3 && miss ? ' warn' : '') + '"><span>' + esc(t[0]) + '</span><strong>' + esc(t[1]) + '</strong><small>' + esc(t[2]) + '</small></div>'; }).join('') + '</div>';
  }
  function body(){
    if (ui.view === 'project') {
      var pr = projectRows();
      return tiles(pr) + table([{ l: 'Project' }, { l: 'Customer' }, { l: 'Status' }, { l: 'Agreed sales', r: 1 }, { l: 'Actual cost so far', r: 1 }, { l: 'Forecast final cost', r: 1 }, { l: 'Forecast profit', r: 1 }, { l: 'Margin', r: 1 }],
        pr.map(function(x){ return '<tr><td><button type="button" class="link" data-pr-project="' + esc(x.id) + '">' + esc(x.name) + '</button></td><td>' + esc(x.customer) + '</td><td>' + esc(x.status) + '</td>' + money(x.sales) + money(x.actual) + money(x.forecast) + money(x.profit) + marginCell(x.margin, x.missing) + '</tr>'; }).join(''),
        'No projects yet.') + '<p class="muted">Projects use their own budget against actual: materials, purchase orders, labour, tools and approved extras. All dates.</p>';
    }
    var rows = filteredOrders();
    if (ui.view === 'customer' || ui.view === 'month') {
      var g = ui.view === 'customer' ? byCustomer() : byMonth();
      return tiles(rows) + table([{ l: ui.view === 'customer' ? 'Customer' : 'Month' }, { l: ui.view === 'customer' ? 'Orders & projects' : 'Orders', r: 1 }, { l: 'Sales', r: 1 }, { l: 'Cost', r: 1 }, { l: 'Gross profit', r: 1 }, { l: 'Margin', r: 1 }],
        g.map(function(x){ return '<tr><td>' + esc(x.label) + (x.missing ? ' <small class="muted">(' + x.missing + ' missing a cost)</small>' : '') + '</td><td class="right">' + x.count + '</td>' + money(x.sales) + money(x.cost) + money(x.profit) + marginCell(x.margin, false) + '</tr>'; }).join(''),
        'Nothing in this period.') + (ui.view === 'customer' ? '<p class="muted">Customers include their projects at forecast profit (all dates).</p>' : '');
    }
    rows.sort(function(a, b){ return (b.date || '').localeCompare(a.date || ''); });
    return tiles(rows) + table([{ l: 'Order' }, { l: 'Date' }, { l: 'Customer' }, { l: 'Status' }, { l: 'Sales', r: 1 }, { l: 'Bought in', r: 1 }, { l: 'Stock & lines', r: 1 }, { l: 'Gross profit', r: 1 }, { l: 'Margin', r: 1 }, { l: 'Cost from' }],
      rows.slice(0, 500).map(function(x){ return '<tr><td><button type="button" class="link" data-fc-action="open-sales-order" data-fc-order="' + esc(x.id) + '">' + esc(x.id) + '</button></td><td>' + esc(x.date) + '</td><td>' + esc(x.customer) + '</td><td>' + esc(x.status) + '</td>' +
        money(x.sales) + money(x.poCost) + money(x.stockCost) + money(x.profit) + marginCell(x.margin, x.missing) + '<td><small>' + esc(x.basis) + '</small></td></tr>'; }).join(''),
      ui.done ? 'No delivered or invoiced orders in this period.' : 'No orders in this period.') + (rows.length > 500 ? '<p class="muted">Showing the latest 500. Download the CSV for all ' + rows.length + '.</p>' : '');
  }
  function page(){
    var tabs = [['order', 'By order'], ['project', 'By project'], ['customer', 'By customer'], ['month', 'By month']];
    return '<section class="finance-panel pr-page"><header class="finance-panel-head"><div><h3>Profit</h3><p>Sales less what the goods cost: lines bought in for the order at their PO cost, stock at its average cost from goods in, and custom lines at the cost entered on the line. Before VAT. Labour and overheads are not included (projects include their labour).</p></div>' +
      '<div class="finance-row-actions"><button type="button" class="secondary" data-pr-csv>Download CSV</button></div></header>' +
      '<div class="pr-bar" role="tablist">' + tabs.map(function(t){ return '<button type="button" role="tab" class="pr-tab' + (ui.view === t[0] ? ' on' : '') + '" aria-selected="' + (ui.view === t[0]) + '" data-pr-view="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      (ui.view === 'project' ? '' : '<div class="pr-filters"><label>Period<select data-pr-period>' + [['month', 'This month'], ['last3', 'Last 3 months'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Choose dates']].map(function(p){ return '<option value="' + p[0] + '"' + (ui.period === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></label>' +
        (ui.period === 'custom' ? '<label>From<input type="date" data-pr-from value="' + esc(ui.from) + '"></label><label>To<input type="date" data-pr-to value="' + esc(ui.to) + '"></label>' : '') +
        '<label class="finance-check"><input type="checkbox" data-pr-done' + (ui.done ? ' checked' : '') + '> Delivered or invoiced only</label></div>') +
      body() + '</section>';
  }
  function csv(){
    var rows = ui.view === 'project' ? projectRows() : ui.view === 'customer' ? byCustomer() : ui.view === 'month' ? byMonth() : filteredOrders(), cols;
    if (ui.view === 'project') cols = ['id', 'name', 'customer', 'status', 'sales', 'actual', 'forecast', 'profit', 'margin'];
    else if (ui.view === 'order') cols = ['id', 'date', 'customer', 'status', 'sales', 'poCost', 'stockCost', 'cost', 'profit', 'margin', 'basis'];
    else cols = ['label', 'count', 'sales', 'cost', 'profit', 'margin', 'missing'];
    var q = function(v){ v = v == null ? '' : typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v); return /[",\n]/.test(v) || /^[=+\-@]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var text = cols.join(',') + '\n' + rows.map(function(r){ return cols.map(function(c){ return q(r[c]); }).join(','); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = 'pool-shed-profit-' + ui.view + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  }
  function redraw(){ var el = document.querySelector('.pr-page'); if (el) el.outerHTML = page(); }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function(e){
      var t = e.target && e.target.closest ? e.target : null; if (!t) return;
      var v = t.closest('[data-pr-view]'); if (v) { ui.view = v.dataset.prView; redraw(); return; }
      if (t.closest('[data-pr-csv]')) { csv(); return; }
      var p = t.closest('[data-pr-project]'); if (p && typeof global.__POOL_SHED_OPEN_SUBPAGE__ === 'function') { try { if (typeof psProjectSelected !== 'undefined') psProjectSelected = p.dataset.prProject; } catch (_) {} global.__POOL_SHED_OPEN_SUBPAGE__('jobs', 'Projects'); }
    });
    document.addEventListener('change', function(e){
      var t = e.target; if (!t || !t.matches) return;
      if (t.matches('[data-pr-period]')) { ui.period = t.value; redraw(); }
      else if (t.matches('[data-pr-from]')) { ui.from = t.value; redraw(); }
      else if (t.matches('[data-pr-to]')) { ui.to = t.value; redraw(); }
      else if (t.matches('[data-pr-done]')) { ui.done = t.checked; redraw(); }
    });
  }
  if (typeof document !== 'undefined' && document.head && !document.getElementById('pr-styles')) {
    var st = document.createElement('style'); st.id = 'pr-styles';
    st.textContent = '.pr-bar{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 10px}.pr-tab{border:1px solid rgba(15,76,87,.25);background:transparent;color:inherit;border-radius:999px;padding:6px 14px;cursor:pointer;min-height:0}.pr-tab.on{background:var(--color-action-primary)!important;color:var(--color-action-contrast)!important;border-color:var(--color-action-primary)}' +
      '.pr-filters{display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin-bottom:10px}.pr-filters label{display:flex;flex-direction:column;font-size:13px;gap:3px}.pr-filters .finance-check{flex-direction:row;align-items:center;gap:6px}' +
      '.pr-table td.right,.pr-table th.right{text-align:right;white-space:nowrap}.pr-bad{color:var(--color-status-danger-text)}.pr-page .link{background:none;border:0;padding:0;text-decoration:underline;cursor:pointer;color:inherit;min-height:0}';
    document.head.appendChild(st);
  }
  global.PoolShedProfit = { page: page, orderRows: orderRows, projectRows: projectRows, byCustomer: byCustomer, byMonth: byMonth, _ui: ui };
})(typeof window !== 'undefined' ? window : globalThis);
