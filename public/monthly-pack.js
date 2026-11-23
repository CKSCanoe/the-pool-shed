/* Pool Shed v1.82.0 — Monthly management pack (Reports → Monthly Pack).
   One page per month to read, print or save as PDF: sales and profit (against last month and the same month last
   year), the six-month trend, best customers and products, money owed to us and by us, stock value (warehouse and
   each van), purchasing, quotes, projects and contracts, and a short list of things to look at.
   Sales and profit come from delivered or invoiced orders (as on the Profit page). Money owed comes from the Pool Shed
   ledger plus anything invoiced before the ledger (Xero era), shown separately. Money figures are for Admin,
   Management and Accounts only. Stock value, money owed and stock to reorder are as of today. */
(function(global){
  'use strict';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DATA = function(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? (global.__POOL_SHED_GET_DATA__() || {}) : {}; };
  var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); };
  var num = function(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; };
  var r2 = function(n){ return Math.round(n * 100) / 100; };
  var cash = function(v){ v = num(v); return (v < 0 ? '−£' : '£') + Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); };
  var cash2 = function(v){ v = num(v); return (v < 0 ? '−£' : '£') + Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var pct = function(p){ return p == null || !Number.isFinite(p) ? '—' : (Math.round(p * 10) / 10).toFixed(1) + '%'; };
  var state = { month: '', ledger: null, loading: false, loadedAt: 0, error: '' };

  function ym(d){ return d.toISOString().slice(0, 7); }
  function defaultMonth(now){ now = now || new Date(); var d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); if (now.getUTCDate() < 8) d.setUTCMonth(d.getUTCMonth() - 1); return ym(d); }
  function shift(month, n){ var y = +month.slice(0, 4), m = +month.slice(5, 7) - 1 + n; return ym(new Date(Date.UTC(y + Math.floor(m / 12), ((m % 12) + 12) % 12, 1))); }
  function label(month){ return MONTHS[+month.slice(5, 7) - 1] + ' ' + month.slice(0, 4); }
  function inMonth(date, month){ return String(date || '').slice(0, 7) === month; }
  function canMoney(){ return typeof global.__POOL_SHED_CAN_ACCESS__ === 'function' ? !!global.__POOL_SHED_CAN_ACCESS__('accounting') : false; }
  function W(){ return typeof global.__POOL_SHED_WORKSPACE_ID__ === 'function' ? global.__POOL_SHED_WORKSPACE_ID__() : 'pool-bros-main'; }
  function change(now, before){ if (!(Math.abs(before) > 0)) return ''; var c = (now - before) / Math.abs(before) * 100; return '<small class="mp-chg ' + (c >= 0 ? 'up' : 'down') + '">' + (c >= 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(c)) + '%</small>'; }

  // ---------- Figures ----------
  function orders(){ return global.PoolShedProfit && global.PoolShedProfit.orderRows ? global.PoolShedProfit.orderRows().filter(function(x){ return x.done; }) : []; }
  function salesFor(month, rows){
    rows = (rows || orders()).filter(function(x){ return inMonth(x.date, month); });
    var sales = rows.reduce(function(t, x){ return t + x.sales; }, 0), cost = rows.reduce(function(t, x){ return t + x.cost; }, 0);
    return { month: month, count: rows.length, sales: r2(sales), cost: r2(cost), profit: r2(sales - cost), margin: sales > 0 ? (sales - cost) / sales * 100 : null, missing: rows.filter(function(x){ return x.missing; }).length, rows: rows };
  }
  function linePrice(l){ var p = (DATA().products || []).find(function(x){ return x.id === l.productId; }) || {}; return l.specialPrice != null && l.specialPrice !== '' ? num(l.specialPrice) : l.unitPrice != null ? num(l.unitPrice) : num(p.rrp); }
  function topProducts(rows){
    var d = DATA(), byId = new Map((d.salesOrders || []).map(function(o){ return [o.id, o]; })), agg = {};
    rows.forEach(function(x){ var o = byId.get(x.id); (o && o.lines || []).forEach(function(l){ if (l.lineType === 'shipping' || l.bundleRole === 'head') return;
      var p = (d.products || []).find(function(q){ return q.id === l.productId; }) || {}, k = l.lineType === 'custom' ? 'custom:' + (l.customProductName || l.description) : l.productId;
      var a = agg[k] || (agg[k] = { name: l.lineType === 'custom' ? (l.customProductName || l.description || 'Custom line') : (p.name || l.productId), sku: l.lineType === 'custom' ? '' : (p.sku || ''), qty: 0, sales: 0 });
      a.qty += num(l.qty); a.sales += num(l.qty) * linePrice(l); }); });
    return Object.keys(agg).map(function(k){ return agg[k]; }).sort(function(a, b){ return b.sales - a.sales; }).slice(0, 5);
  }
  function topCustomers(rows){
    var agg = {}; rows.forEach(function(x){ var a = agg[x.customerId || x.customer] || (agg[x.customerId || x.customer] = { name: x.customer || '—', sales: 0, profit: 0, count: 0 }); a.sales += x.sales; a.profit += x.profit; a.count++; });
    return Object.keys(agg).map(function(k){ return agg[k]; }).sort(function(a, b){ return b.profit - a.profit; }).slice(0, 5);
  }
  function stock(){
    var d = DATA(), locs = new Map((d.locations || []).map(function(l){ return [l.id, l]; })), products = new Map((d.products || []).map(function(p){ return [String(p.id), p]; }));
    var unit = function(p){ return global.PoolShedStockCost ? global.PoolShedStockCost.unitCost(p) : (p && p.cost != null ? num(p.cost) : null); };
    var out = { total: 0, units: 0, byType: {}, vans: {}, noCost: 0 };
    (d.stock || []).forEach(function(s){ var q = num(s.qty); if (!(q > 0)) return; var p = products.get(String(s.productId)); if (!p || p.stockTracked === false) return;
      var u = unit(p); if (u == null) { out.noCost++; return; } var v = q * u, loc = locs.get(s.locationId) || {}, type = loc.type || 'Warehouse';
      var group = /van/i.test(type) ? 'Vans' : /quarantine|returns/i.test(type) ? 'Quarantine & returns' : /receiving/i.test(type) ? 'Receiving' : 'Warehouse';
      out.total += v; out.units += q; out.byType[group] = (out.byType[group] || 0) + v;
      if (group === 'Vans') { var n = loc.name || s.locationId; out.vans[n] = (out.vans[n] || 0) + v; } });
    var sold = {}, cut = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    (d.salesOrders || []).forEach(function(o){ if (String(o.created || o.date || '') >= cut) (o.lines || []).forEach(function(l){ sold[l.productId] = 1; }); });
    out.slow = 0; (d.stock || []).forEach(function(s){ var q = num(s.qty), p = products.get(String(s.productId)); if (q > 0 && p && p.stockTracked !== false && !sold[s.productId]) out.slow += q * (unit(p) || 0); });
    out.reorder = global.PoolShedCoreStock && global.PoolShedCoreStock.needsOrder ? global.PoolShedCoreStock.needsOrder().length : null;
    return out;
  }
  function purchasing(month){
    var d = DATA(), today = new Date().toISOString().slice(0, 10), pos = (d.purchaseOrders || []).filter(function(p){ return ['Cancelled', 'Canceled'].indexOf(p.status) < 0; });
    var val = function(p){ return (p.lines || []).reduce(function(t, l){ return t + num(l.qty) * num(l.unitCost != null ? l.unitCost : l.cost); }, 0); };
    var raised = pos.filter(function(p){ return inMonth(p.orderedDate || p.created, month) && !/draft/i.test(p.status || ''); });
    var lineCost = new Map(); pos.forEach(function(p){ (p.lines || []).forEach(function(l){ lineCost.set(p.id + '|' + (l.receiptLineId || l.productId), num(l.unitCost != null ? l.unitCost : l.cost)); }); });
    var received = (d.receiptEvents || []).filter(function(e){ return inMonth(e.date, month); }).reduce(function(t, e){ return t + num(e.qty) * (e.unitCost != null ? num(e.unitCost) : (lineCost.get(e.poId + '|' + e.lineId) || 0)); }, 0);
    var late = pos.filter(function(p){ return p.due && String(p.due).slice(0, 10) < today && ['Sent', 'Supplier Confirmed', 'Part Received'].indexOf(p.status) >= 0; });
    return { raised: raised.length, raisedValue: r2(raised.reduce(function(t, p){ return t + val(p); }, 0)), received: r2(received), late: late.length, lateValue: r2(late.reduce(function(t, p){ return t + val(p); }, 0)) };
  }
  function quotes(month){
    var qs = DATA().quotes || [], Q = global.PoolShedQuoteStudio, net = function(q){ try { return Q && Q.totals ? num(Q.totals(q).net) : 0; } catch (_) { return 0; } };
    var made = qs.filter(function(q){ return inMonth(q.createdAt, month); }), won = qs.filter(function(q){ return ['Accepted', 'Won'].indexOf(q.status) >= 0 && inMonth((q.acceptance && q.acceptance.at) || q.updatedAt, month); });
    var sent = qs.filter(function(q){ return (q.deliveries || []).some(function(x){ return inMonth(x.sentAt || x.at || x.createdAt, month); }); });
    return { made: made.length, sent: sent.length, won: won.length, wonValue: r2(won.reduce(function(t, q){ return t + net(q); }, 0)), open: qs.filter(function(q){ return ['Draft', 'Sent', 'Viewed', 'Quote Ready', 'Published'].indexOf(q.status) >= 0; }).length };
  }
  function projects(){
    var rows = global.PoolShedProfit && global.PoolShedProfit.projectRows ? global.PoolShedProfit.projectRows() : [];
    var open = rows.filter(function(p){ return !/complete|closed/i.test(p.status || ''); });
    return { count: open.length, sales: r2(open.reduce(function(t, p){ return t + p.sales; }, 0)), profit: r2(open.reduce(function(t, p){ return t + p.profit; }, 0)), low: open.filter(function(p){ return p.margin != null && p.margin < 15; }) };
  }
  function contracts(month){
    var K = global.PoolShedContracts, list = DATA().salesOrderSubscriptions || []; if (!K) return null;
    var active = list.filter(function(c){ return c.status === 'Active'; });
    return { active: active.length, monthly: r2(active.reduce(function(t, c){ return t + K.monthly(c); }, 0)), created: list.reduce(function(t, c){ return t + (c.history || []).filter(function(h){ return inMonth(h.date, month); }).length; }, 0),
      started: list.filter(function(c){ return inMonth(c.createdAt, month); }).length, ended: list.filter(function(c){ return inMonth(c.endedAt, month); }).length, due: K.due().length };
  }
  function ledgerFor(month){
    var L = state.ledger; if (!L) return null;
    var docs = L.docs || [], inv = docs.filter(function(x){ return x.doc_type === 'sales_invoice' && inMonth(x.doc_date, month); }), cr = docs.filter(function(x){ return x.doc_type === 'sales_credit' && inMonth(x.doc_date, month); });
    var rec = docs.filter(function(x){ return x.doc_type === 'customer_receipt' && inMonth(x.doc_date, month); });
    var aged = L.aged || [], b = { not_due: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 };
    aged.forEach(function(a){ Object.keys(b).forEach(function(k){ b[k] += num(a[k]); }); });
    var bills = (L.bills || []).filter(function(x){ return num(x.outstanding) > 0; }), today = new Date().toISOString().slice(0, 10);
    return { invoiced: r2(inv.reduce(function(t, x){ return t + num(x.net); }, 0) - cr.reduce(function(t, x){ return t + num(x.net); }, 0)), invoices: inv.length, received: r2(rec.reduce(function(t, x){ return t + num(x.gross); }, 0)),
      aged: b, debtors: aged.slice().sort(function(a, c){ return num(c.total) - num(a.total); }).slice(0, 5), weOwe: r2(bills.reduce(function(t, x){ return t + num(x.outstanding); }, 0)),
      weOweOverdue: r2(bills.filter(function(x){ return x.due_date && x.due_date < today; }).reduce(function(t, x){ return t + num(x.outstanding); }, 0)), anyDocs: docs.length > 0 };
  }
  function beforeLedger(){ try { var s = global.PoolShedFinanceCommand && global.PoolShedFinanceCommand.snapshot ? global.PoolShedFinanceCommand.snapshot() : null; return s && s.metrics ? s.metrics : null; } catch (_) { return null; } }

  async function loadLedger(force){
    if (!canMoney() || state.loading || (!force && state.ledger && Date.now() - state.loadedAt < 120000)) return;
    var db = typeof global.__POOL_SHED_DB__ === 'function' ? global.__POOL_SHED_DB__() : null; if (!db || typeof db.rpc !== 'function') return;
    state.loading = true; state.error = '';
    try { var w = W(), r = await Promise.all([db.rpc('ps_sales_documents_list', { w: w, max_rows: 5000 }), db.rpc('ps_aged_debtors', { w: w }), db.rpc('ps_purchase_list', { w: w, max_rows: 1000 })]);
      r.forEach(function(x){ if (x.error) throw x.error; });
      state.ledger = { docs: r[0].data || [], aged: r[1].data || [], bills: r[2].data || [] }; state.loadedAt = Date.now(); }
    catch (e) { state.error = String(e && e.message || e); }
    state.loading = false; try { if (typeof global.render === 'function') global.render(); } catch (_) {}
  }

  // ---------- Page ----------
  function tile(lbl, value, sub, extra){ return '<div class="mp-tile"><span>' + esc(lbl) + '</span><strong>' + value + '</strong>' + (extra || '') + '<small>' + (sub || '') + '</small></div>'; }
  function section(title, body, note){ return '<section class="mp-section"><h3>' + esc(title) + '</h3>' + body + (note ? '<p class="mp-note">' + note + '</p>' : '') + '</section>'; }
  function body(){
    var month = state.month || (state.month = defaultMonth()), all = orders(), now = salesFor(month, all), prev = salesFor(shift(month, -1), all), ly = salesFor(shift(month, -12), all);
    var money = canMoney(); if (money) loadLedger(false);
    var trend = [], i; for (i = 5; i >= 0; i--) trend.push(salesFor(shift(month, -i), all));
    var maxS = Math.max.apply(null, trend.map(function(t){ return t.sales; }).concat([1]));
    var st = stock(), pu = purchasing(month), qu = quotes(month), pr = projects(), ct = contracts(month), L = money ? ledgerFor(month) : null, pre = money ? beforeLedger() : null;
    var looks = [];
    if (now.missing) looks.push(now.missing + ' order' + (now.missing > 1 ? 's this month have' : ' this month has') + ' a line with no cost, so profit is overstated for ' + (now.missing > 1 ? 'those' : 'it') + '. Add the cost on the order or the product.');
    if (prev.margin != null && now.margin != null && now.margin < prev.margin - 5) looks.push('Margin fell from ' + pct(prev.margin) + ' to ' + pct(now.margin) + ' compared with last month.');
    if (L && L.aged.d31_60 + L.aged.d61_90 + L.aged.d90_plus > 0) looks.push(cash(L.aged.d31_60 + L.aged.d61_90 + L.aged.d90_plus) + ' is more than 30 days overdue. See Accounts → Credit Control.');
    if (pu.late) looks.push(pu.late + ' purchase order' + (pu.late > 1 ? 's are' : ' is') + ' past the delivery date (' + cash(pu.lateValue) + ').');
    if (st.reorder) looks.push(st.reorder + ' core stock line' + (st.reorder > 1 ? 's need' : ' needs') + ' reordering.');
    if (ct && ct.due) looks.push(ct.due + ' contract' + (ct.due > 1 ? 's are' : ' is') + ' due to be created (Sales → Contracts).');
    if (pr.low.length) looks.push(pr.low.length + ' project' + (pr.low.length > 1 ? 's are' : ' is') + ' forecast below 15% margin: ' + pr.low.map(function(p){ return esc(p.name); }).join(', ') + '.');
    if (st.slow > 0) looks.push(cash(st.slow) + ' of stock has not sold in 12 months.');
    var opts = []; for (i = 0; i < 13; i++) { var m = shift(ym(new Date()), -i); opts.push('<option value="' + m + '"' + (m === month ? ' selected' : '') + '>' + label(m) + (i === 0 ? ' (so far)' : '') + '</option>'); }
    var head = '<div class="mp-head"><div><span class="mp-eyebrow">MONTHLY MANAGEMENT PACK</span><h2>' + esc(label(month)) + '</h2><p>Pool Bros · prepared ' + esc(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })) + '</p></div>' +
      '<div class="mp-actions mp-noprint"><label>Month<select data-mp-month>' + opts.join('') + '</select></label><button type="button" class="ac-btn" data-mp-csv>Download CSV</button><button type="button" class="ac-btn primary" data-mp-print>Print or save as PDF</button></div></div>';
    var headline = '<div class="mp-tiles">' + tile('Sales (before VAT)', cash(now.sales), now.count + ' delivered or invoiced orders · last month ' + cash(prev.sales), change(now.sales, prev.sales)) +
      tile('Gross profit', cash(now.profit), pct(now.margin) + ' margin · last month ' + pct(prev.margin), change(now.profit, prev.profit)) +
      tile('Same month last year', cash(ly.sales), ly.count ? 'profit ' + cash(ly.profit) + ' · ' + pct(ly.margin) : 'no orders recorded') +
      (L ? tile('Invoiced on the ledger', cash(L.invoiced), L.invoices + ' invoice' + (L.invoices === 1 ? '' : 's') + ' · cash in ' + cash(L.received)) : '') +
      (ct ? tile('Regular contract income', cash(ct.monthly) + '<em>/month</em>', ct.active + ' active contract' + (ct.active === 1 ? '' : 's')) : '') + '</div>';
    var trendRows = trend.map(function(t){ return '<tr><td>' + esc(label(t.month)) + '</td><td class="num">' + cash(t.sales) + '</td><td class="num">' + cash(t.profit) + '</td><td class="num">' + pct(t.margin) + '</td><td class="mp-barcell"><span class="mp-bar" style="width:' + Math.round(t.sales / maxS * 100) + '%"></span></td></tr>'; }).join('');
    var tc = topCustomers(now.rows), tp = topProducts(now.rows);
    var html = head + (looks.length ? '<section class="mp-section mp-looks"><h3>Worth a look</h3><ul>' + looks.map(function(x){ return '<li>' + x + '</li>'; }).join('') + '</ul></section>' : '') + headline +
      '<div class="mp-two">' + section('Last six months', '<table class="mp-table"><thead><tr><th>Month</th><th class="num">Sales</th><th class="num">Profit</th><th class="num">Margin</th><th></th></tr></thead><tbody>' + trendRows + '</tbody></table>', 'Delivered or invoiced orders, by order date, before VAT. Projects are reported separately below.') +
      section('Best customers this month', tc.length ? '<table class="mp-table"><thead><tr><th>Customer</th><th class="num">Orders</th><th class="num">Sales</th><th class="num">Profit</th></tr></thead><tbody>' + tc.map(function(c){ return '<tr><td>' + esc(c.name) + '</td><td class="num">' + c.count + '</td><td class="num">' + cash(c.sales) + '</td><td class="num">' + cash(c.profit) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted">No delivered or invoiced orders this month.</p>') + '</div>' +
      '<div class="mp-two">' + section('Best sellers this month', tp.length ? '<table class="mp-table"><thead><tr><th>Product or service</th><th class="num">Qty</th><th class="num">Sales</th></tr></thead><tbody>' + tp.map(function(p){ return '<tr><td>' + esc(p.name) + (p.sku ? ' <small>' + esc(p.sku) + '</small>' : '') + '</td><td class="num">' + Math.round(p.qty * 100) / 100 + '</td><td class="num">' + cash(p.sales) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted">Nothing sold yet this month.</p>') +
      (money ? section('Money', (L ? '<table class="mp-table"><tbody><tr><td>Customers owe us (ledger)</td><td class="num"><b>' + cash(L.aged.total) + '</b></td></tr><tr><td>&nbsp;&nbsp;not yet due</td><td class="num">' + cash(L.aged.not_due) + '</td></tr><tr><td>&nbsp;&nbsp;1–30 days late</td><td class="num">' + cash(L.aged.d1_30) + '</td></tr><tr><td>&nbsp;&nbsp;31–60 days late</td><td class="num">' + cash(L.aged.d31_60) + '</td></tr><tr><td>&nbsp;&nbsp;over 60 days late</td><td class="num">' + cash(L.aged.d61_90 + L.aged.d90_plus) + '</td></tr>' +
          '<tr><td>We owe suppliers (ledger bills)</td><td class="num"><b>' + cash(L.weOwe) + '</b></td></tr><tr><td>&nbsp;&nbsp;of which overdue</td><td class="num">' + cash(L.weOweOverdue) + '</td></tr></tbody></table>' +
          (L.debtors.length ? '<p class="mp-sub">Largest balances: ' + L.debtors.map(function(x){ return esc(x.customer) + ' ' + cash(x.total); }).join(' · ') + '</p>' : '')
        : state.error ? '<p class="mp-note">The ledger could not be read: ' + esc(state.error) + '</p>' : '<p class="muted">Loading the ledger…</p>') +
        (pre ? '<p class="mp-sub">Invoiced before the ledger (Xero era): customers owe ' + cash(pre.customersOweUs) + (num(pre.customersOverdue) ? ' (' + cash(pre.customersOverdue) + ' overdue)' : '') + '; supplier bills due ' + cash(pre.supplierBillsDue) + '.</p>' : ''),
        'Money owed is as of today, not the end of the month.') : '') + '</div>' +
      '<div class="mp-two">' + section('Stock', '<table class="mp-table"><tbody><tr><td>Stock value at average cost</td><td class="num"><b>' + cash(st.total) + '</b></td></tr>' +
          Object.keys(st.byType).sort().map(function(k){ return '<tr><td>&nbsp;&nbsp;' + esc(k) + '</td><td class="num">' + cash(st.byType[k]) + '</td></tr>'; }).join('') +
          Object.keys(st.vans).sort().map(function(k){ return '<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;' + esc(k) + '</td><td class="num">' + cash(st.vans[k]) + '</td></tr>'; }).join('') +
          '<tr><td>Not sold in 12 months</td><td class="num">' + cash(st.slow) + '</td></tr>' + (st.reorder != null ? '<tr><td>Core stock lines to reorder</td><td class="num">' + st.reorder + '</td></tr>' : '') + '</tbody></table>',
          'As of today.' + (st.noCost ? ' ' + st.noCost + ' stock line' + (st.noCost > 1 ? 's have' : ' has') + ' no cost and ' + (st.noCost > 1 ? 'are' : 'is') + ' left out.' : '')) +
      section('Purchasing', '<table class="mp-table"><tbody><tr><td>Purchase orders placed</td><td class="num">' + pu.raised + ' · ' + cash(pu.raisedValue) + '</td></tr><tr><td>Goods received (at cost)</td><td class="num">' + cash(pu.received) + '</td></tr><tr><td>Late deliveries (today)</td><td class="num">' + pu.late + (pu.late ? ' · ' + cash(pu.lateValue) : '') + '</td></tr></tbody></table>') + '</div>' +
      '<div class="mp-two">' + section('Quotes', '<table class="mp-table"><tbody><tr><td>Quotes started</td><td class="num">' + qu.made + '</td></tr><tr><td>Quotes sent</td><td class="num">' + qu.sent + '</td></tr><tr><td>Accepted</td><td class="num">' + qu.won + (qu.won ? ' · ' + cash(qu.wonValue) : '') + '</td></tr><tr><td>Still open (today)</td><td class="num">' + qu.open + '</td></tr></tbody></table>') +
      section('Projects and contracts', '<table class="mp-table"><tbody><tr><td>Projects in progress</td><td class="num">' + pr.count + '</td></tr><tr><td>Their agreed sales</td><td class="num">' + cash(pr.sales) + '</td></tr><tr><td>Their forecast profit</td><td class="num">' + cash(pr.profit) + (pr.sales > 0 ? ' · ' + pct(pr.profit / pr.sales * 100) : '') + '</td></tr>' +
          (ct ? '<tr><td>Active contracts</td><td class="num">' + ct.active + ' · ' + cash(ct.monthly) + '/month</td></tr><tr><td>Contract orders created this month</td><td class="num">' + ct.created + '</td></tr><tr><td>Contracts started / ended</td><td class="num">' + ct.started + ' / ' + ct.ended + '</td></tr>' : '') + '</tbody></table>') + '</div>' +
      '<p class="mp-foot">Sales and profit: delivered or invoiced orders dated in the month, before VAT, with stock at its average cost and custom lines at their entered cost. Labour and overheads are not included. Figures from Pool Shed; not an audited set of accounts.</p>';
    return '<div class="mp-page">' + html + '</div>';
  }
  function csv(){
    var month = state.month || defaultMonth(), all = orders(), now = salesFor(month, all), prev = salesFor(shift(month, -1), all), st = stock(), pu = purchasing(month), qu = quotes(month), ct = contracts(month), L = canMoney() ? ledgerFor(month) : null;
    var rows = [['Figure', label(month), 'Last month'], ['Sales (before VAT)', now.sales, prev.sales], ['Cost', now.cost, prev.cost], ['Gross profit', now.profit, prev.profit], ['Margin %', now.margin == null ? '' : r2(now.margin), prev.margin == null ? '' : r2(prev.margin)],
      ['Orders', now.count, prev.count], ['Orders missing a cost', now.missing, prev.missing], ['Stock value today', r2(st.total), ''], ['POs placed', pu.raised, ''], ['PO value placed', pu.raisedValue, ''], ['Goods received at cost', pu.received, ''],
      ['Quotes started', qu.made, ''], ['Quotes accepted', qu.won, ''], ['Accepted value', qu.wonValue, '']];
    if (ct) rows.push(['Active contracts', ct.active, ''], ['Contract income a month', ct.monthly, '']);
    if (L) rows.push(['Invoiced on the ledger', L.invoiced, ''], ['Cash received', L.received, ''], ['Customers owe us today', r2(L.aged.total), ''], ['We owe suppliers today', L.weOwe, '']);
    var text = rows.map(function(r){ return r.map(function(v){ v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = 'pool-shed-monthly-pack-' + month + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('change', function(e){ var t = e.target; if (t && t.matches && t.matches('[data-mp-month]')) { state.month = t.value; try { global.render(); } catch (_) {} } });
    document.addEventListener('click', function(e){ var t = e.target && e.target.closest ? e.target : null; if (!t) return;
      if (t.closest('[data-mp-print]')) { document.body.classList.add('mp-printing'); setTimeout(function(){ global.print(); setTimeout(function(){ document.body.classList.remove('mp-printing'); }, 500); }, 50); return; }
      if (t.closest('[data-mp-csv]')) csv(); });
  }
  if (typeof document !== 'undefined' && document.head && !document.getElementById('mp-styles')) {
    var st = document.createElement('style'); st.id = 'mp-styles';
    st.textContent = '.mp-page{max-width:1100px}.mp-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}.mp-head h2{margin:2px 0;font-size:28px}.mp-head p{margin:0;color:var(--color-text-secondary)}.mp-eyebrow{font-size:12px;letter-spacing:.08em;color:var(--color-text-secondary)}' +
      '.mp-actions{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}.mp-actions label{display:flex;flex-direction:column;font-size:12.5px;gap:3px}' +
      '.mp-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:12px 0}.mp-tile{border:1px solid rgba(15,76,87,.16);border-radius:12px;padding:12px 14px;background:var(--color-surface-default)}.mp-tile span{font-size:12.5px;color:var(--color-text-secondary)}.mp-tile strong{display:block;font-size:24px;margin:2px 0}.mp-tile strong em{font-size:13px;font-style:normal;font-weight:500}.mp-tile small{display:block;font-size:12.5px;color:var(--color-text-secondary)}' +
      '.mp-chg{display:inline-block!important;font-size:12.5px!important;margin-left:4px}.mp-chg.up{color:var(--color-status-success-text)!important}.mp-chg.down{color:var(--color-status-danger-text)!important}' +
      '.mp-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:12px}.mp-section{border:1px solid rgba(15,76,87,.16);border-radius:12px;padding:12px 14px;margin:0 0 12px;background:var(--color-surface-default);break-inside:avoid}.mp-section h3{margin:0 0 8px;font-size:16px}' +
      '.mp-table{width:100%;border-collapse:collapse;font-size:13.5px}.mp-table td,.mp-table th{padding:5px 6px;border-top:1px solid rgba(0,0,0,.06);text-align:left}.mp-table .num{text-align:right;white-space:nowrap}.mp-table small{color:var(--color-text-secondary)}' +
      '.mp-barcell{width:28%}.mp-bar{display:block;height:9px;border-radius:5px;background:var(--color-action-primary);opacity:.75}.mp-note,.mp-sub,.mp-foot{font-size:12.5px;color:var(--color-text-secondary);margin:8px 0 0}.mp-looks{border-color:rgba(168,98,0,.35);background:rgba(168,98,0,.05)}.mp-looks ul{margin:0;padding-left:18px}.mp-looks li{margin:3px 0}' +
      '@media print{body.mp-printing *{visibility:hidden}body.mp-printing .mp-page,body.mp-printing .mp-page *{visibility:visible}body.mp-printing .mp-page{position:absolute;left:0;top:0;width:100%;max-width:none}body.mp-printing .mp-noprint{display:none!important}.mp-section,.mp-tile{border-color:var(--color-border-default);background:var(--color-surface-default)}.mp-two{grid-template-columns:1fr 1fr}@page{size:A4;margin:12mm}}';
    document.head.appendChild(st);
  }
  global.PoolShedMonthlyPack = { body: body, salesFor: salesFor, stock: stock, purchasing: purchasing, quotes: quotes, contracts: contracts, ledgerFor: ledgerFor, shift: shift, label: label, defaultMonth: defaultMonth, topProducts: topProducts, topCustomers: topCustomers, _state: state, _load: loadLedger };
})(typeof window !== 'undefined' ? window : globalThis);
