/* Pool Shed v1.85.0 — Contracts: recurring maintenance and repeat orders (Sales → Contracts).
   Upgrades the earlier "Subscriptions" page: the same records (salesOrderSubscriptions) are kept, and each one is now
   either a maintenance contract (billed as a fixed fee per period, or per visit) or a repeat order of products.
   Service lines are kept at the agreed contract price (customer discounts do not apply), frequencies follow the
   calendar (weekly to annual), and everything due is listed so one click creates the orders to check. Nothing is
   created, sent or invoiced on its own. Fixed-fee orders with no products go straight to Invoice Ready; per-visit and
   product orders start as New Order. The same period can never be created twice. */
(function(global){
  'use strict';
  var FREQ = { weekly: { label: 'Weekly', days: 7, perYear: 52 }, fortnightly: { label: 'Every 2 weeks', days: 14, perYear: 26 },
    '4-weekly': { label: 'Every 4 weeks', days: 28, perYear: 13 }, monthly: { label: 'Monthly', months: 1, perYear: 12 },
    quarterly: { label: 'Quarterly', months: 3, perYear: 4 }, '6-monthly': { label: 'Every 6 months', months: 6, perYear: 2 }, annual: { label: 'Yearly', months: 12, perYear: 1 } };
  var VAT = ['20% VAT', '5% VAT', 'No VAT (zero rated)'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DATA = function(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? (global.__POOL_SHED_GET_DATA__() || {}) : {}; };
  var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); };
  var num = function(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; };
  var r2 = function(n){ return Math.round(n * 100) / 100; };
  var cash = function(v){ return '£' + num(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var today = function(){ return new Date().toISOString().slice(0, 10); };
  var ui = { edit: null, sel: {}, msg: null, filter: 'Active' };

  function notify(m){ try { if (typeof global.toast === 'function') global.toast(m); } catch (_) {} }
  function save(){ try { if (typeof global.__POOL_SHED_SAVE_APP_DATA__ === 'function') global.__POOL_SHED_SAVE_APP_DATA__(); else if (typeof global.saveAppData === 'function') global.saveAppData(); } catch (_) {} }
  function redraw(){ try { if (typeof global.render === 'function') global.render(); } catch (_) {} }
  function list(){ var d = DATA(); if (!Array.isArray(d.salesOrderSubscriptions)) d.salesOrderSubscriptions = []; return d.salesOrderSubscriptions; }
  function customerOf(c){ return (DATA().customers || []).find(function(x){ return String(x.id) === String(c.customerId); }) || null; }
  function customerName(c){ var x = customerOf(c); return x ? (x.name || x.company || x.id) : (c.customerId || '—'); }
  function product(id){ return (DATA().products || []).find(function(p){ return String(p.id) === String(id); }) || null; }

  // ---------- Dates ----------
  function parse(s){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null; }
  function iso(y, m, d){ var dt = new Date(Date.UTC(y, m, d)); return dt.toISOString().slice(0, 10); }
  function addPeriod(date, freq, n){
    var p = parse(date); if (!p) return ''; var f = FREQ[freq]; n = n == null ? 1 : n;
    if (!f) return iso(p.y, p.m, p.d + n * Math.max(7, num(freq) || 30));   // older records: every N days
    if (f.days) return iso(p.y, p.m, p.d + n * f.days);
    var total = p.m + n * f.months, y = p.y + Math.floor(total / 12), m = ((total % 12) + 12) % 12, last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return iso(y, m, Math.min(p.d, last));   // 31 Jan + 1 month = 28/29 Feb
  }
  function nice(date){ var p = parse(date); return p ? p.d + ' ' + MONTHS[p.m] + ' ' + p.y : '—'; }
  function frequencyOf(c){ if (FREQ[c.frequency]) return c.frequency; var d = num(c.cadenceDays) || 30; return d === 7 ? 'weekly' : d === 14 ? 'fortnightly' : d === 28 ? '4-weekly' : String(d); }
  function frequencyLabel(c){ var f = frequencyOf(c); return FREQ[f] ? FREQ[f].label : 'Every ' + f + ' days'; }
  function perYear(c){ var f = frequencyOf(c); return FREQ[f] ? FREQ[f].perYear : 365 / (num(f) || 30); }
  // What the period of a fixed-fee invoice covers (in advance: starting on the due date; in arrears: ending the day before).
  function periodLabel(c, date){
    var f = frequencyOf(c), start = c.invoiceTiming === 'arrears' ? addPeriod(date, f, -1) : date, end = addPeriod(start, f, 1), s = parse(start), e = parse(iso(parse(end).y, parse(end).m, parse(end).d - 1));
    if (!FREQ[f] || FREQ[f].days) return (FREQ[f] && FREQ[f].days === 7 ? 'week commencing ' : '') + nice(start) + (FREQ[f] && FREQ[f].days === 7 ? '' : ' to ' + nice(iso(e.y, e.m, e.d)));
    if (FREQ[f].months === 1 && s.d === 1) return LONG[s.m] + ' ' + s.y;
    return nice(start) + ' to ' + nice(iso(e.y, e.m, e.d));
  }

  // ---------- Contract facts ----------
  function kind(c){ return c.kind || ((c.lines || []).some(function(l){ return l.lineType === 'custom'; }) ? 'Maintenance' : 'Repeat order'); }
  function billing(c){ return kind(c) === 'Maintenance' ? (c.billing === 'visit' ? 'visit' : 'fixed') : 'order'; }
  function lineNet(l){ var p = l.specialPrice != null && l.specialPrice !== '' ? num(l.specialPrice) : l.unitPrice != null ? num(l.unitPrice) : num((product(l.productId) || {}).rrp); return r2(num(l.qty || 1) * p); }
  function periodNet(c){ return r2((c.lines || []).reduce(function(t, l){ return t + lineNet(l); }, 0)); }
  function monthly(c){ return r2(periodNet(c) * perYear(c) / 12); }
  function isDue(c, by){ return c.status === 'Active' && !!c.nextOrderDate && c.nextOrderDate <= (by || today()); }
  function hasProducts(c){ return (c.lines || []).some(function(l){ return l.lineType !== 'custom'; }); }
  function renewalSoon(c){ if (c.status !== 'Active' || !c.renewalDate) return false; var limit = iso(parse(today()).y, parse(today()).m, parse(today()).d + 60); return c.renewalDate <= limit; }

  // ---------- Create orders for what is due ----------
  function createOrder(c){
    var d = DATA(), cust = customerOf(c), date = c.nextOrderDate;
    if (!cust) return { ok: false, error: customerName(c) + ': customer not found' };
    if (c.status !== 'Active') return { ok: false, error: (c.name || c.id) + ' is not active' };
    if (!(c.lines || []).length) return { ok: false, error: (c.name || c.id) + ' has no lines' };
    if (!Array.isArray(c.history)) c.history = [];
    if (c.history.some(function(h){ return h.date === date; })) return { ok: false, error: (c.name || c.id) + ': ' + nice(date) + ' was already created (' + c.history.find(function(h){ return h.date === date; }).orderId + ')' };
    var b = billing(c), label = b === 'fixed' ? periodLabel(c, date) : b === 'visit' ? 'visit ' + nice(date) : '';
    var id = typeof global.nextSalesOrderId === 'function' ? global.nextSalesOrderId('SO') : 'SO-' + Date.now();
    var status = b === 'fixed' && !hasProducts(c) ? 'Invoice Ready' : 'New Order';
    var order = { id: id, customerId: cust.id, quoteRef: 'Contract ' + c.id, xeroRef: 'Draft', source: 'Contract', status: status, tags: ['Contract', c.id], channel: 'Contract',
      priceList: c.priceList || cust.priceList || 'rrp', priceOverrideReason: 'Agreed contract price (' + c.id + ')', shipTo: typeof global.addressText === 'function' ? global.addressText(cust, 'delivery') : '',
      created: today(), due: date > today() ? date : today(), carrier: 'Main Warehouse A1', subscriptionId: c.id, contractId: c.id, contractPeriod: label, customerPo: c.customerPo || '',
      lines: (c.lines || []).map(function(l){
        var custom = l.lineType === 'custom', qty = Math.max(1, num(l.qty || 1)), price = l.specialPrice != null && l.specialPrice !== '' ? num(l.specialPrice) : undefined;
        var line = { productId: l.productId, qty: qty, allocated: custom ? qty : 0, picked: 0, packed: 0, shipped: 0, specialPrice: price, taxCode: l.taxCode || '20% VAT', description: l.description || '', customerDiscountExempt: true };
        if (custom) Object.assign(line, { lineType: 'custom', customProductName: l.customProductName || l.description, customVariant: label, variantDescription: label, description: (l.customProductName || l.description) + (label ? ' (' + label + ')' : ''),
          unitPrice: price || 0, unitCost: num(l.unitCost), accountCode: l.accountCode || '4010 Service Upsell' });
        return line; }), payments: [], notifications: [] };
    if (!Array.isArray(d.salesOrders)) d.salesOrders = [];
    d.salesOrders.unshift(order);
    c.history.push({ date: date, orderId: id, period: label, at: new Date().toISOString() });
    c.lastGeneratedAt = new Date().toISOString(); c.lastSalesOrderId = id;
    var next = addPeriod(date, frequencyOf(c), 1);
    if (c.endDate && next > c.endDate) { c.status = 'Ended'; c.endedAt = today(); c.nextOrderDate = ''; } else c.nextOrderDate = next;
    try { if (typeof global.addSalesOrderNotification === 'function') global.addSalesOrderNotification(order, 'Contract order', id + ' created from contract ' + c.id + (label ? ' for ' + label : '') + '. Check it before it goes further.', 'Internal note'); } catch (_) {}
    return { ok: true, id: id, status: status, label: label };
  }
  function createDue(ids){
    var made = [], errors = [];
    ids.forEach(function(cid){ var c = list().find(function(x){ return x.id === cid; }); if (!c) return; var r = createOrder(c); if (r.ok) made.push(r); else errors.push(r.error); });
    if (made.length) save();
    return { made: made, errors: errors };
  }

  // ---------- Saving a contract ----------
  function nextId(){ var n = list().length + 1, id; do { id = 'SUB-' + String(n++).padStart(4, '0'); } while (list().some(function(x){ return x.id === id; })); return id; }
  function serviceProduct(name, price, cost, existingId){
    var p = existingId && product(existingId);
    if (p && p.productType === 'Custom charge') { p.name = name; p.rrp = p.trade = p.wholesale = p.special = price; p.cost = cost; return p.id; }
    if (typeof global.createNonStockProduct === 'function') return global.createNonStockProduct('custom', name, price, cost, '').id;
    var d = DATA(), id = 'CUSTOM-CTR' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
    (d.products = d.products || []).push({ id: id, sku: id, name: name, rrp: price, trade: price, wholesale: price, special: price, cost: cost, productType: 'Custom charge', stockTracked: false, hiddenFromCatalogue: true, status: 'Live', category: 'One-off Sales Charges', supplier: 'Not applicable', unit: 'Each' });
    return id;
  }
  function findSku(sku){ sku = String(sku || '').trim().toLowerCase(); if (!sku) return null; return (DATA().products || []).find(function(p){ return String(p.sku || '').toLowerCase() === sku || String(p.id).toLowerCase() === sku; }) || null; }
  function saveContract(v){
    var errs = [];
    if (!v.customerId || !(DATA().customers || []).some(function(c){ return String(c.id) === String(v.customerId); })) errs.push('choose the customer');
    if (!String(v.name || '').trim()) errs.push('give the contract a name');
    if (!FREQ[v.frequency]) errs.push('choose how often');
    if (!parse(v.nextOrderDate)) errs.push('choose the first due date');
    if (v.endDate && v.endDate < v.nextOrderDate) errs.push('the end date is before the first due date');
    var lines = [];
    (v.lines || []).forEach(function(l, i){
      if (l.type === 'product') { if (!String(l.sku || '').trim()) return; var p = findSku(l.sku); if (!p) { errs.push('line ' + (i + 1) + ': no product with SKU ' + l.sku); return; }
        lines.push({ productId: p.id, sku: p.sku, qty: Math.max(1, Math.round(num(l.qty) || 1)), specialPrice: l.price === '' || l.price == null ? null : r2(num(l.price)), taxCode: l.taxCode || '20% VAT', description: p.name || '' }); return; }
      var name = String(l.name || '').trim(); if (!name) return;
      if (!(num(l.price) >= 0) || l.price === '' || l.price == null) { errs.push('line ' + (i + 1) + ': enter the price'); return; }
      lines.push({ lineType: 'custom', productId: l.productId || '', customProductName: name, description: name, qty: Math.max(1, num(l.qty) || 1), specialPrice: r2(num(l.price)), unitCost: r2(num(l.cost)), taxCode: l.taxCode || '20% VAT', accountCode: '4010 Service Upsell' });
    });
    if (!lines.length) errs.push('add at least one line');
    if (errs.length) return { ok: false, error: 'Please ' + errs.join('; ') + '.' };
    lines.forEach(function(l){ if (l.lineType === 'custom') l.productId = serviceProduct(l.customProductName, l.specialPrice, l.unitCost, l.productId); });
    var c = v.id ? list().find(function(x){ return x.id === v.id; }) : null, isNew = !c;
    if (!c) { c = { id: nextId(), status: 'Active', createdAt: new Date().toISOString(), autoCreate: false, approvalRequired: true, history: [] }; list().push(c); }
    var f = FREQ[v.frequency];
    Object.assign(c, { customerId: v.customerId, name: String(v.name).trim(), kind: v.kind === 'Repeat order' ? 'Repeat order' : 'Maintenance', billing: v.billing === 'visit' ? 'visit' : 'fixed',
      frequency: v.frequency, cadenceDays: f.days || Math.round(365 / f.perYear), nextOrderDate: v.nextOrderDate, startDate: v.startDate || c.startDate || v.nextOrderDate,
      endDate: v.endDate || '', renewalDate: v.renewalDate || '', invoiceTiming: v.invoiceTiming === 'arrears' ? 'arrears' : 'advance', site: String(v.site || '').trim(),
      notes: String(v.notes || '').trim(), customerPo: String(v.customerPo || '').trim(), lines: lines, updatedAt: new Date().toISOString(), autoCreate: false, approvalRequired: true });
    if (c.status === 'Ended' && (!c.endDate || c.endDate >= today())) c.status = 'Active';
    save();
    return { ok: true, id: c.id, isNew: isNew };
  }
  function setStatus(id, status){ var c = list().find(function(x){ return x.id === id; }); if (!c) return; c.status = status; if (status === 'Ended') { c.endedAt = today(); c.nextOrderDate = ''; } save(); }
  function renew(id, upliftPct){
    var c = list().find(function(x){ return x.id === id; }); if (!c) return null;
    var from = c.renewalDate || today(), pct = num(upliftPct);
    c.renewalDate = addPeriod(from, 'annual', 1); if (c.endDate && c.endDate < c.renewalDate) c.endDate = c.renewalDate;
    if (pct) (c.lines || []).forEach(function(l){ if (l.specialPrice != null && l.specialPrice !== '') { l.specialPrice = r2(num(l.specialPrice) * (1 + pct / 100)); var p = l.lineType === 'custom' && product(l.productId); if (p) p.rrp = p.trade = p.wholesale = p.special = l.specialPrice; } });
    (c.renewals = c.renewals || []).push({ at: new Date().toISOString(), from: from, to: c.renewalDate, upliftPct: pct });
    save(); return c;
  }

  // ---------- Page ----------
  function blankLine(type){ return { type: type || 'service', name: '', qty: 1, price: '', cost: '', taxCode: '20% VAT', sku: '' }; }
  function editFrom(c){
    if (!c) return { id: '', customerId: '', name: '', kind: 'Maintenance', billing: 'fixed', frequency: 'monthly', invoiceTiming: 'advance', nextOrderDate: today(), endDate: '', renewalDate: addPeriod(today(), 'annual', 1), site: '', notes: '', customerPo: '', lines: [blankLine()] };
    return { id: c.id, customerId: c.customerId, name: c.name || '', kind: kind(c), billing: c.billing === 'visit' ? 'visit' : 'fixed', frequency: FREQ[c.frequency] ? c.frequency : 'monthly', invoiceTiming: c.invoiceTiming || 'advance',
      nextOrderDate: c.nextOrderDate || today(), endDate: c.endDate || '', renewalDate: c.renewalDate || '', site: c.site || '', notes: c.notes || '', customerPo: c.customerPo || '',
      lines: (c.lines || []).map(function(l){ var p = product(l.productId) || {};
        return l.lineType === 'custom' ? { type: 'service', productId: l.productId, name: l.customProductName || l.description, qty: l.qty, price: l.specialPrice, cost: l.unitCost || '', taxCode: l.taxCode || '20% VAT' }
                                       : { type: 'product', sku: l.sku || p.sku || l.productId, qty: l.qty, price: l.specialPrice == null ? '' : l.specialPrice, taxCode: l.taxCode || '20% VAT' }; }) };
  }
  function opt(v, label, cur){ return '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function form(){
    var e = ui.edit, custs = (DATA().customers || []).slice().sort(function(a, b){ return String(a.name || '').localeCompare(String(b.name || '')); });
    var lines = e.lines.map(function(l, i){
      var vat = '<select name="l' + i + 'vat" aria-label="VAT">' + VAT.map(function(x){ return opt(x, x.replace(' (zero rated)', ''), l.taxCode); }).join('') + '</select>';
      return '<tr><td>' + (l.type === 'product' ? '<input name="l' + i + 'sku" value="' + esc(l.sku) + '" placeholder="Product SKU" aria-label="Product SKU">' : '<input name="l' + i + 'name" value="' + esc(l.name) + '" placeholder="e.g. Weekly pool clean and chemical check" aria-label="Service">') +
        '<input type="hidden" name="l' + i + 'type" value="' + esc(l.type) + '"><input type="hidden" name="l' + i + 'pid" value="' + esc(l.productId || '') + '"></td>' +
        '<td><input name="l' + i + 'qty" inputmode="decimal" value="' + esc(l.qty) + '" class="ct-n" aria-label="Quantity"></td><td><input name="l' + i + 'price" inputmode="decimal" value="' + esc(l.price) + '" class="ct-n" placeholder="' + (l.type === 'product' ? 'list price' : '0.00') + '" aria-label="Price each before VAT"></td>' +
        '<td>' + (l.type === 'product' ? '' : '<input name="l' + i + 'cost" inputmode="decimal" value="' + esc(l.cost) + '" class="ct-n" placeholder="optional" aria-label="Cost each">') + '</td><td>' + vat + '</td>' +
        '<td><button type="button" class="link" data-ct-dropline="' + i + '" aria-label="Remove line">Remove</button></td></tr>'; }).join('');
    return '<section class="panel ct-form" id="ct-form"><div class="panel-head"><div><h2>' + (e.id ? 'Edit ' + esc(e.id) : 'New contract') + '</h2><p>Prices are the agreed contract prices before VAT; customer discounts are not applied.</p></div></div>' +
      '<form data-ct-form><div class="ct-grid">' +
      '<label>Customer<select name="customerId" required><option value="">Choose…</option>' + custs.map(function(c){ return opt(c.id, (c.name || c.id) + (c.postcode ? ' · ' + c.postcode : ''), e.customerId); }).join('') + '</select></label>' +
      '<label>Contract name<input name="name" required value="' + esc(e.name) + '" placeholder="e.g. Weekly pool maintenance"></label>' +
      '<label>Type<select name="kind">' + opt('Maintenance', 'Maintenance contract', e.kind) + opt('Repeat order', 'Repeat order of products', e.kind) + '</select></label>' +
      (e.kind === 'Maintenance' ? '<label>Charged<select name="billing">' + opt('fixed', 'Fixed fee per period', e.billing) + opt('visit', 'Per visit', e.billing) + '</select></label>' : '<input type="hidden" name="billing" value="fixed">') +
      '<label>How often<select name="frequency">' + Object.keys(FREQ).map(function(k){ return opt(k, FREQ[k].label, e.frequency); }).join('') + '</select></label>' +
      (e.kind === 'Maintenance' && e.billing === 'fixed' ? '<label>Invoice<select name="invoiceTiming">' + opt('advance', 'In advance (for the coming period)', e.invoiceTiming) + opt('arrears', 'In arrears (for the period just gone)', e.invoiceTiming) + '</select></label>' : '<input type="hidden" name="invoiceTiming" value="advance">') +
      '<label>' + (e.id ? 'Next due' : 'First due') + '<input type="date" name="nextOrderDate" required value="' + esc(e.nextOrderDate) + '"></label>' +
      '<label>Renewal date<input type="date" name="renewalDate" value="' + esc(e.renewalDate) + '"><small>When to review the price and terms.</small></label>' +
      '<label>Ends<input type="date" name="endDate" value="' + esc(e.endDate) + '"><small>Leave empty if it carries on.</small></label>' +
      '<label>Customer PO / reference<input name="customerPo" value="' + esc(e.customerPo) + '"></label>' +
      '<label class="ct-wide">Site / pool<input name="site" value="' + esc(e.site) + '" placeholder="e.g. Outdoor pool 10 x 5 m, plant room at the back"></label>' +
      '<label class="ct-wide">Notes<textarea name="notes" rows="2">' + esc(e.notes) + '</textarea></label></div>' +
      '<div class="table-wrap"><table class="ct-lines"><thead><tr><th>' + (e.kind === 'Maintenance' ? 'Service or product' : 'Product') + '</th><th>Qty</th><th>Price each (£)</th><th>Cost each (£)</th><th>VAT</th><th></th></tr></thead><tbody>' + lines + '</tbody></table></div>' +
      '<div class="ct-actions"><button type="button" class="secondary" data-ct-addline="service">Add a service line</button><button type="button" class="secondary" data-ct-addline="product">Add a product by SKU</button></div>' +
      '<p class="ct-total">Each ' + (e.billing === 'visit' && e.kind === 'Maintenance' ? 'visit' : 'time') + ': <strong data-ct-total>' + cash(e.lines.reduce(function(t, l){ return t + num(l.qty || 1) * num(l.price); }, 0)) + '</strong> before VAT</p>' +
      '<div class="ct-actions"><button type="submit" class="primary">Save contract</button><button type="button" class="secondary" data-ct-cancel>Cancel</button></div></form></section>';
  }
  function kpi(label, value, sub){ return '<div class="so-list-kpi"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong><small>' + esc(sub) + '</small></div>'; }
  function page(){
    var all = list(), active = all.filter(function(c){ return c.status === 'Active'; }), due = active.filter(function(c){ return isDue(c); });
    var soon = active.filter(function(c){ return !isDue(c) && isDue(c, iso(parse(today()).y, parse(today()).m, parse(today()).d + 7)); });
    var renewals = active.filter(renewalSoon), mrr = active.reduce(function(t, c){ return t + monthly(c); }, 0);
    var msg = ui.msg ? '<div class="ct-msg ' + (ui.msg.ok ? 'ok' : 'bad') + '" role="status">' + ui.msg.html + '</div>' : '';
    var dueRows = due.concat(soon).map(function(c){ var b = billing(c), overdue = c.nextOrderDate < today(), checked = ui.sel[c.id] !== false && isDue(c);
      return '<tr><td><input type="checkbox" data-ct-pick="' + esc(c.id) + '"' + (checked ? ' checked' : '') + (isDue(c) ? '' : ' disabled') + ' aria-label="Create ' + esc(c.name) + '"></td><td><strong>' + esc(customerName(c)) + '</strong><small>' + esc(c.name || c.id) + '</small></td>' +
        '<td>' + (b === 'fixed' ? esc(periodLabel(c, c.nextOrderDate)) : b === 'visit' ? 'Visit ' + esc(nice(c.nextOrderDate)) : 'Repeat order') + '</td><td class="num">' + cash(periodNet(c)) + '</td>' +
        '<td>' + (isDue(c) ? '<span class="ct-pill ' + (overdue ? 'bad' : 'warn') + '">' + (overdue ? 'Overdue since ' : 'Due ') + esc(nice(c.nextOrderDate)) + '</span>' : 'Due ' + esc(nice(c.nextOrderDate))) + '</td>' +
        '<td><small>' + (b === 'fixed' && !hasProducts(c) ? 'Goes to Invoice Ready' : b === 'visit' ? 'New order; mark done after the visit' : 'New order to pick') + '</small></td></tr>'; }).join('');
    var pickN = due.filter(function(c){ return ui.sel[c.id] !== false; }).length;
    var shown = all.filter(function(c){ return ui.filter === 'All' || c.status === ui.filter || (ui.filter === 'Active' && c.status === 'Paused'); })
      .sort(function(a, b){ return String(a.nextOrderDate || '9999').localeCompare(String(b.nextOrderDate || '9999')) || customerName(a).localeCompare(customerName(b)); });
    var rows = shown.map(function(c){ var b = billing(c);
      return '<tr><td><strong>' + esc(customerName(c)) + '</strong><small>' + esc(c.name || '') + ' · ' + esc(c.id) + (c.site ? ' · ' + esc(c.site) : '') + '</small></td>' +
        '<td>' + esc(kind(c) === 'Maintenance' ? (b === 'visit' ? 'Per visit' : 'Fixed fee') : 'Repeat order') + '<small>' + esc(frequencyLabel(c)) + '</small></td>' +
        '<td class="num">' + cash(periodNet(c)) + '<small>' + cash(monthly(c)) + ' a month</small></td><td>' + (c.nextOrderDate ? esc(nice(c.nextOrderDate)) : '—') + '</td>' +
        '<td>' + (c.renewalDate ? esc(nice(c.renewalDate)) + (renewalSoon(c) ? ' <span class="ct-pill warn">soon</span>' : '') : '—') + '</td>' +
        '<td><span class="ct-pill ' + (c.status === 'Active' ? 'good' : c.status === 'Paused' ? 'warn' : '') + '">' + esc(c.status || 'Active') + '</span>' + (c.lastSalesOrderId ? '<small>Last: <button type="button" class="link" data-ct-order="' + esc(c.lastSalesOrderId) + '">' + esc(c.lastSalesOrderId) + '</button></small>' : '') + '</td>' +
        '<td class="ct-row-actions"><button type="button" class="link" data-ct-edit="' + esc(c.id) + '">Edit</button>' +
        (c.status === 'Active' ? '<button type="button" class="link" data-ct-status="Paused" data-id="' + esc(c.id) + '">Pause</button>' : c.status === 'Paused' ? '<button type="button" class="link" data-ct-status="Active" data-id="' + esc(c.id) + '">Resume</button>' : '') +
        (c.status !== 'Ended' ? '<button type="button" class="link" data-ct-status="Ended" data-id="' + esc(c.id) + '">End</button>' : '') + '</td></tr>'; }).join('');
    var renewRows = renewals.map(function(c){ return '<li><strong>' + esc(customerName(c)) + '</strong> · ' + esc(c.name) + ' · renews ' + esc(nice(c.renewalDate)) + ' · ' + cash(monthly(c)) + ' a month ' +
      '<label class="ct-inline">Price change %<input data-ct-uplift="' + esc(c.id) + '" inputmode="decimal" value="0" class="ct-n"></label><button type="button" class="secondary small" data-ct-renew="' + esc(c.id) + '">Renew for a year</button></li>'; }).join('');
    return '<section class="so-list-page ct-page" aria-label="Contracts">' +
      '<div class="so-list-commandbar"><div class="so-list-command-copy"><span>RECURRING SALES</span><strong>Contracts</strong><small>Maintenance contracts (fixed fee or per visit) and repeat orders. Nothing is created until you click.</small></div>' +
      '<div><button type="button" class="primary" data-ct-new>New contract</button></div></div>' + msg +
      '<div class="so-list-kpis">' + kpi('ACTIVE', String(active.length), 'contracts') + kpi('A MONTH', cash(mrr), 'regular income before VAT') + kpi('A YEAR', cash(mrr * 12), 'at today’s prices') +
        kpi('DUE NOW', String(due.length), due.length ? cash(due.reduce(function(t, c){ return t + periodNet(c); }, 0)) + ' to create' : 'nothing waiting') + kpi('RENEWALS', String(renewals.length), 'in the next 60 days') + '</div>' +
      (ui.edit ? form() : '') +
      '<div class="panel"><div class="panel-head"><div><h2>Due</h2><p>Due now (ticked) and the next 7 days. One click creates an order for each ticked contract, for you to check.</p></div>' +
        (due.length ? '<div><button type="button" class="primary" data-ct-create' + (pickN ? '' : ' disabled') + '>Create ' + pickN + ' order' + (pickN === 1 ? '' : 's') + '</button></div>' : '') + '</div>' +
        (dueRows ? '<div class="table-wrap"><table class="ct-table"><thead><tr><th></th><th>Customer</th><th>For</th><th class="num">Before VAT</th><th>When</th><th>Becomes</th></tr></thead><tbody>' + dueRows + '</tbody></table></div>' : '<p class="muted">Nothing due in the next 7 days.</p>') + '</div>' +
      (renewRows ? '<div class="panel"><div class="panel-head"><div><h2>Renewals coming up</h2><p>Review the price and renew for another year. A price change applies to every line from the next order.</p></div></div><ul class="ct-renewals">' + renewRows + '</ul></div>' : '') +
      '<div class="panel"><div class="panel-head"><div><h2>All contracts</h2></div><div class="ct-filter">' + ['Active', 'Ended', 'All'].map(function(f){ return '<button type="button" class="pill ' + (ui.filter === f ? 'blue' : 'dark') + '" data-ct-filter="' + f + '">' + f + '</button>'; }).join('') + '</div></div>' +
        (rows ? '<div class="table-wrap"><table class="ct-table"><thead><tr><th>Customer</th><th>Type</th><th class="num">Each time</th><th>Next due</th><th>Renewal</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="muted">No contracts yet. Use New contract to add one.</p>') + '</div></section>';
  }

  // ---------- Events ----------
  function capture(f){
    if (!f || !ui.edit) return; var fd = new FormData(f), e = ui.edit;
    ['customerId', 'name', 'kind', 'billing', 'frequency', 'invoiceTiming', 'nextOrderDate', 'renewalDate', 'endDate', 'customerPo', 'site', 'notes'].forEach(function(k){ if (fd.has(k)) e[k] = String(fd.get(k) || ''); });
    e.lines = e.lines.map(function(l, i){ return { type: String(fd.get('l' + i + 'type') || l.type), productId: String(fd.get('l' + i + 'pid') || ''), name: String(fd.get('l' + i + 'name') || ''), sku: String(fd.get('l' + i + 'sku') || ''),
      qty: String(fd.get('l' + i + 'qty') || '1'), price: String(fd.get('l' + i + 'price') || ''), cost: String(fd.get('l' + i + 'cost') || ''), taxCode: String(fd.get('l' + i + 'vat') || '20% VAT') }; });
  }
  function openOrder(id){ try { global.selectedSalesOrderId = id; if (typeof selectedSalesOrderId !== 'undefined') selectedSalesOrderId = id; if (typeof salesOrderView !== 'undefined') salesOrderView = 'detail'; } catch (_) {}
    if (typeof global.__POOL_SHED_OPEN_SUBPAGE__ === 'function') global.__POOL_SHED_OPEN_SUBPAGE__('salesorders', 'Sales Orders'); try { if (typeof salesOrderView !== 'undefined') salesOrderView = 'detail'; selectedSalesOrderId = id; } catch (_) {} redraw(); }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function(ev){
      var t = ev.target && ev.target.closest ? ev.target : null; if (!t || !t.closest('.ct-page')) return;
      var f = document.querySelector('[data-ct-form]'), b;
      if (t.closest('[data-ct-new]')) { ui.edit = editFrom(null); ui.msg = null; redraw(); setTimeout(function(){ var el = document.getElementById('ct-form'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' }); }, 30); return; }
      if ((b = t.closest('[data-ct-edit]'))) { ui.edit = editFrom(list().find(function(c){ return c.id === b.dataset.ctEdit; })); ui.msg = null; redraw(); setTimeout(function(){ var el = document.getElementById('ct-form'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' }); }, 30); return; }
      if (t.closest('[data-ct-cancel]')) { ui.edit = null; redraw(); return; }
      if ((b = t.closest('[data-ct-addline]'))) { capture(f); ui.edit.lines.push(blankLine(b.dataset.ctAddline)); redraw(); return; }
      if ((b = t.closest('[data-ct-dropline]'))) { capture(f); ui.edit.lines.splice(Number(b.dataset.ctDropline), 1); if (!ui.edit.lines.length) ui.edit.lines.push(blankLine()); redraw(); return; }
      if ((b = t.closest('[data-ct-filter]'))) { ui.filter = b.dataset.ctFilter; redraw(); return; }
      if ((b = t.closest('[data-ct-order]'))) { openOrder(b.dataset.ctOrder); return; }
      if ((b = t.closest('[data-ct-status]'))) { var st = b.dataset.ctStatus, c = list().find(function(x){ return x.id === b.dataset.id; });
        if (st === 'Ended' && !(global.confirm ? global.confirm('End ' + (c ? c.name : '') + '? No more orders will be listed for it. It stays on record.') : true)) return;
        setStatus(b.dataset.id, st); ui.msg = { ok: true, html: esc((c && c.name) || b.dataset.id) + ' is now ' + esc(st.toLowerCase()) + '.' }; redraw(); return; }
      if ((b = t.closest('[data-ct-renew]'))) { var up = document.querySelector('[data-ct-uplift="' + b.dataset.ctRenew + '"]'), rc = renew(b.dataset.ctRenew, up ? up.value : 0);
        if (rc) ui.msg = { ok: true, html: esc(rc.name) + ' renewed to ' + esc(nice(rc.renewalDate)) + (num(up && up.value) ? ', prices changed by ' + esc(num(up.value)) + '%' : '') + '.' }; redraw(); return; }
      if (t.closest('[data-ct-create]')) {
        var ids = list().filter(function(c){ return isDue(c) && ui.sel[c.id] !== false; }).map(function(c){ return c.id; }); if (!ids.length) return;
        var r = createDue(ids); ui.sel = {};
        ui.msg = { ok: !r.errors.length, html: (r.made.length ? 'Created ' + r.made.map(function(m){ return '<button type="button" class="link" data-ct-order="' + esc(m.id) + '">' + esc(m.id) + '</button>' + (m.status === 'Invoice Ready' ? ' (ready to invoice)' : ''); }).join(', ') + '. ' : '') +
          (r.errors.length ? 'Not created: ' + r.errors.map(esc).join('; ') + '.' : '') };
        notify(r.made.length + ' contract order' + (r.made.length === 1 ? '' : 's') + ' created.'); redraw(); return; }
    });
    document.addEventListener('change', function(ev){
      var t = ev.target; if (!t || !t.closest || !t.closest('.ct-page')) return;
      if (t.matches('[data-ct-pick]')) { ui.sel[t.dataset.ctPick] = t.checked; redraw(); return; }
      if (t.form && t.form.matches('[data-ct-form]') && ['kind', 'billing'].indexOf(t.name) >= 0) { capture(t.form); redraw(); }
    });
    document.addEventListener('input', function(ev){
      var f = ev.target && ev.target.form; if (!f || !f.matches || !f.matches('[data-ct-form]')) return;
      var tot = 0, fd = new FormData(f); for (var i = 0; fd.has('l' + i + 'type'); i++) tot += (num(fd.get('l' + i + 'qty')) || 1) * num(fd.get('l' + i + 'price'));
      var el = f.querySelector('[data-ct-total]'); if (el) el.textContent = cash(tot);
    });
    document.addEventListener('submit', function(ev){
      var f = ev.target; if (!f || !f.matches || !f.matches('[data-ct-form]')) return; ev.preventDefault(); capture(f);
      var r = saveContract(ui.edit);
      if (!r.ok) { ui.msg = { ok: false, html: esc(r.error) }; redraw(); return; }
      ui.edit = null; ui.msg = { ok: true, html: (r.isNew ? 'Contract ' : 'Saved ') + esc(r.id) + (r.isNew ? ' added.' : '.') }; redraw();
    });
  }
  if (typeof document !== 'undefined' && document.head && !document.getElementById('ct-styles')) {
    var st = document.createElement('style'); st.id = 'ct-styles';
    st.textContent = '.ct-page small{display:block;color:var(--color-text-secondary);font-size:12.5px}.ct-table td,.ct-table th{vertical-align:top}.ct-table .num,.ct-table th.num{text-align:right;white-space:nowrap}' +
      '.ct-pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:12.5px;background:rgba(15,76,87,.08)}.ct-pill.good{background:var(--color-status-success-bg);color:var(--color-status-success-text)}.ct-pill.warn{background:var(--color-status-attention-bg);color:var(--color-status-attention-text)}.ct-pill.bad{background:var(--color-status-danger-bg);color:var(--color-status-danger-text)}' +
      '.ct-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px 14px;margin-bottom:12px}.ct-grid label{display:flex;flex-direction:column;gap:4px;font-size:13.5px}.ct-grid .ct-wide{grid-column:1/-1}' +
      '.ct-lines input,.ct-lines select{width:100%}.ct-lines .ct-n,.ct-n{max-width:110px}.ct-actions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.ct-total{margin:6px 0 0}' +
      '.ct-msg{border-radius:10px;padding:10px 12px;margin:10px 0}.ct-msg.ok{background:var(--color-status-success-bg)}.ct-msg.bad{background:var(--color-status-danger-bg)}.ct-row-actions{white-space:nowrap}.ct-row-actions .link,.ct-page .link{background:none;border:0;padding:0 8px 0 0;text-decoration:underline;cursor:pointer;color:inherit;min-height:0}' +
      '.ct-renewals{list-style:none;margin:0;padding:0}.ct-renewals li{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 0;border-top:1px solid rgba(0,0,0,.07)}.ct-inline{display:flex;gap:6px;align-items:center;font-size:13px}.ct-filter{display:flex;gap:6px}';
    document.head.appendChild(st);
  }
  // Take over the Sales → Contracts page (formerly Subscriptions). Events are handled above, so the old binder is not needed.
  if (typeof global.salesOrderSubscriptionsPage === 'function' || typeof salesOrderSubscriptionsPage === 'function') {
    try { salesOrderSubscriptionsPage = page; bindSalesOrderSubscriptions = function(){}; } catch (_) {}
    global.salesOrderSubscriptionsPage = page; global.bindSalesOrderSubscriptions = function(){};
  }
  global.PoolShedContracts = { page: page, addPeriod: addPeriod, periodLabel: periodLabel, monthly: monthly, periodNet: periodNet, isDue: isDue, createOrder: createOrder, createDue: createDue,
    saveContract: saveContract, renew: renew, setStatus: setStatus, due: function(){ return list().filter(function(c){ return isDue(c); }); }, renewalSoon: renewalSoon, _ui: ui, _editFrom: editFrom };
})(typeof window !== 'undefined' ? window : globalThis);
