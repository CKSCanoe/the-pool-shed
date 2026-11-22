/* Pool Shed v1.73.0 — customer page: "Account" tab (blueprint step 5).
   Adds to the existing customer profile, without replacing it, one place for the customer's money from the ledger:
   balance and how late, terms and credit limit, every invoice, credit note, payment and refund, a statement for any
   period (view, PDF), and the next actions (take a payment, open an invoice). Finance roles only: Admin,
   Management and Accounts. Other roles see the profile exactly as before. */
(function(global){
  'use strict';
  if (typeof customerMegaProfile !== 'function') return;
  var FINANCE = ['Admin', 'Management', 'Manager', 'Accounts'];
  var cache = {};    // customer key -> { loading, data, error, from, to }
  var W = function(){ return typeof global.__POOL_SHED_WORKSPACE_ID__ === 'function' ? global.__POOL_SHED_WORKSPACE_ID__() : 'pool-bros-main'; };
  var DB = function(){ return typeof global.__POOL_SHED_DB__ === 'function' ? global.__POOL_SHED_DB__() : null; };
  var me = function(){ return typeof global.__POOL_SHED_CURRENT_USER__ === 'function' ? (global.__POOL_SHED_CURRENT_USER__() || {}) : {}; };
  var finance = function(){ return FINANCE.indexOf(String(me().role || '')) >= 0; };
  function esc(x){ return String(x == null ? '' : x).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function cash(n){ return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(n || 0)); }
  function day(x){ return x ? new Date(String(x).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
  var TYPE = { sales_invoice: 'Invoice', sales_credit: 'Credit note', customer_receipt: 'Payment', manual_journal: 'Refund' };

  function load(key, from, to){
    var c = cache[key] = cache[key] || {}; c.loading = true; c.error = ''; if (from) c.from = from; if (to) c.to = to;
    var db = DB(); if (!db) { c.loading = false; c.error = 'Not connected.'; paint(key); return; }
    db.rpc('ps_customer_account', { w: W(), customer_key: key, period_from: c.from || null, period_to: c.to || null }).then(function(r){
      c.loading = false; if (r.error) c.error = String(r.error.message || r.error).replace(/^.*?ERROR:\s*/, ''); else { c.data = r.data; c.from = r.data.statement.from; c.to = r.data.statement.to; }
      paint(key);
    });
  }
  function body(key){
    var c = cache[key] || {}, a = c.data;
    if (c.error) return '<p class="pp-result bad">' + esc(c.error) + '</p>';
    if (!a) return '<p class="muted">Loading the account…</p>';
    var ag = a.aged || {}, overdue = ['d1_30', 'd31_60', 'd61_90', 'd90_plus'].reduce(function(t, k){ return t + Number(ag[k] || 0); }, 0);
    var limit = a.customer && a.customer.credit_limit, over = limit && Number(a.balance) > Number(limit);
    var openInv = (a.documents || []).filter(function(d){ return d.doc_type === 'sales_invoice' && Number(d.open) > 0; });
    var unused = (a.documents || []).filter(function(d){ return d.doc_type !== 'sales_invoice' && d.doc_type !== 'manual_journal' && Number(d.open) > 0; });
    var tiles = '<div class="ca-tiles">' +
      '<div class="ca-tile' + (Number(a.balance) > 0 ? ' owed' : '') + '"><span>Balance</span><b>' + cash(a.balance) + '</b><small>' + (Number(a.balance) < 0 ? 'in credit' : openInv.length + ' unpaid invoice' + (openInv.length === 1 ? '' : 's')) + '</small></div>' +
      '<div class="ca-tile' + (overdue > 0 ? ' late' : '') + '"><span>Overdue</span><b>' + cash(overdue) + '</b><small>' + (Number(ag.d61_90 || 0) + Number(ag.d90_plus || 0) > 0 ? 'some over 60 days' : 'by due date') + '</small></div>' +
      '<div class="ca-tile"><span>Terms</span><b class="ca-small">' + esc(a.terms) + '</b><small>' + (limit ? 'Credit limit ' + cash(limit) + (over ? ' · over the limit' : '') : 'No credit limit set') + '</small></div>' +
      '<div class="ca-tile"><span>On account</span><b>' + cash(unused.reduce(function(t, d){ return t + Number(d.open || 0); }, 0)) + '</b><small>unused payments and credits</small></div></div>';
    var docs = (a.documents || []).slice(0, 40).map(function(d){
      var state = d.doc_type === 'sales_invoice' ? (Number(d.open) <= 0 ? '<span class="finance-pill good">Paid</span>' : d.overdue ? '<span class="finance-pill bad">Overdue</span>' : '<span class="finance-pill warn">' + cash(d.open) + ' to pay</span>')
        : (Number(d.open) > 0 ? '<span class="finance-pill warn">' + cash(d.open) + ' unused</span>' : '<span class="finance-pill good">Applied</span>');
      return '<tr><td>' + day(d.doc_date) + '</td><td><b>' + esc(d.doc_number) + '</b><br><small>' + esc(TYPE[d.doc_type] || d.doc_type) + (d.source_id ? ' · ' + esc(d.source_id) : '') + '</small></td><td class="num">' + cash(d.gross) + '</td><td>' + state + '</td>' +
        '<td class="finance-row-actions">' + (d.doc_type === 'sales_invoice' || d.doc_type === 'sales_credit' ? '<button type="button" class="secondary small" data-si-action="pdf" data-id="' + esc(d.id) + '">PDF</button>' : '') + '</td></tr>'; }).join('');
    var st = a.statement || {};
    var lines = (st.lines || []).map(function(l){ return '<tr><td>' + day(l.date) + '</td><td><b>' + esc(l.doc_number) + '</b></td><td>' + esc(TYPE[l.doc_type] || l.doc_type) + '</td><td class="num">' + (Number(l.debit) ? cash(l.debit) : '') + '</td><td class="num">' + (Number(l.credit) ? cash(l.credit) : '') + '</td><td class="num"><b>' + cash(l.balance) + '</b></td></tr>'; }).join('');
    return tiles +
      '<div class="finance-row-actions ca-actions"><button type="button" class="primary" data-ca="pay" data-key="' + esc(key) + '">Record a payment</button><button type="button" class="secondary" data-ca="statement-pdf" data-key="' + esc(key) + '">Statement PDF</button>' +
      (overdue > 0 ? '<span class="muted ca-hint">Overdue: send the statement with a chase, or note a promise to pay in History.</span>' : '') + '</div>' +
      '<h4>Invoices, credits and payments</h4>' + (docs ? '<div class="scroll"><table class="finance-table"><thead><tr><th>Date</th><th>Document</th><th class="num">Total</th><th>Status</th><th></th></tr></thead><tbody>' + docs + '</tbody></table></div>' : '<p class="muted">Nothing invoiced in the Pool Shed ledger yet. Older invoices sit in Xero until opening balances are loaded.</p>') +
      '<h4>Statement</h4><div class="ca-period"><label>From <input type="date" data-ca-from value="' + esc(st.from) + '"></label><label>To <input type="date" data-ca-to value="' + esc(st.to) + '"></label><button type="button" class="secondary small" data-ca="period" data-key="' + esc(key) + '">Show</button></div>' +
      '<div class="scroll"><table class="finance-table"><thead><tr><th>Date</th><th>Document</th><th>Type</th><th class="num">Charges</th><th class="num">Credits</th><th class="num">Balance</th></tr></thead><tbody>' +
      '<tr class="muted"><td colspan="5">Opening balance</td><td class="num">' + cash(st.opening) + '</td></tr>' + lines +
      '</tbody><tfoot><tr><td colspan="5"><b>Balance on ' + day(st.to) + '</b></td><td class="num"><b>' + cash(st.closing) + '</b></td></tr></tfoot></table></div>';
  }
  function paint(key){ if (typeof document === 'undefined') return; var box = document.querySelector('[data-ca-box="' + (global.CSS && CSS.escape ? CSS.escape(key) : key) + '"]'); if (box) box.innerHTML = body(key); }

  // Add the Account tab to the customer profile.
  var previous = customerMegaProfile;
  customerMegaProfile = function(c){
    var html = previous.apply(this, arguments);
    try {
      if (!c || !finance()) return html;
      var key = 'id:' + c.id;
      var tab = '<button data-crm-profile-tab="account">Account' + (cache[key] && cache[key].data && Number(cache[key].data.balance) > 0 ? ' <i>' + esc(cash(cache[key].data.balance)) + '</i>' : '') + '</button>';
      html = html.replace('<button data-crm-profile-tab="orders">', tab + '<button data-crm-profile-tab="orders">');
      var page = '<div class="crm-profile-page" data-crm-profile-page="account"><section class="crm-depth-card"><header><div><h3>Account</h3><p>What this customer owes, every invoice and payment, and their statement. From the Pool Shed ledger.</p></div></header>' +
        '<div class="crm-depth-body" data-ca-box="' + esc(key) + '">' + body(key) + '</div></section></div>';
      html = html.replace('<div class="crm-profile-page" data-crm-profile-page="orders">', page + '<div class="crm-profile-page" data-crm-profile-page="orders">');
      if (!cache[key] || (!cache[key].data && !cache[key].loading && !cache[key].error)) load(key);
    } catch (e) { console.warn('Customer account tab skipped', e); }
    return html;
  };
  global.customerMegaProfile = customerMegaProfile;

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function(e){
      var b = e.target && e.target.closest ? e.target.closest('[data-ca]') : null; if (!b) return;
      var key = b.dataset.key, a = b.dataset.ca;
      if (a === 'period') { var f = (document.querySelector('[data-ca-from]') || {}).value, t = (document.querySelector('[data-ca-to]') || {}).value; load(key, f, t); paint(key); return; }
      if (a === 'pay') { var id = key.replace(/^id:/, ''), order = { customerId: id }; if (global.PoolShedSalesUI && global.PoolShedSalesUI.inlinePayment) global.PoolShedSalesUI.inlinePayment(order); return; }
      if (a === 'statement-pdf') {
        var c = cache[key] || {}, win = global.open('', '_blank');
        Promise.resolve(typeof global.__POOL_SHED_AUTH_TOKEN__ === 'function' ? global.__POOL_SHED_AUTH_TOKEN__() : '').then(function(tk){
          return fetch('/api/media?action=statement-pdf&workspace=' + encodeURIComponent(W()) + '&customer=' + encodeURIComponent(key) + '&from=' + encodeURIComponent(c.from || '') + '&to=' + encodeURIComponent(c.to || ''), { headers: { Authorization: 'Bearer ' + tk } }); })
          .then(function(r){ if (!r.ok) return r.json().then(function(x){ throw new Error(x.error || 'The statement could not be made.'); }); return r.blob(); })
          .then(function(blob){ var u = URL.createObjectURL(blob); if (win) win.location.href = u; else global.location.assign(u); setTimeout(function(){ URL.revokeObjectURL(u); }, 60000); })
          .catch(function(err){ if (win) win.close(); if (typeof global.toast === 'function') global.toast(String(err.message || err)); });
      }
    });
    // A payment recorded from the Account tab refreshes it.
    document.addEventListener('submit', function(e){ if (e.target && e.target.dataset && e.target.dataset.siForm === 'payment') setTimeout(function(){ Object.keys(cache).forEach(function(k){ cache[k].data = null; load(k); }); }, 2500); });
  }
  if (typeof document !== 'undefined' && document.head && !document.getElementById('ca-styles')) {
    var st = document.createElement('style'); st.id = 'ca-styles';
    st.textContent = '.ca-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:12px}.ca-tile{border:1px solid rgba(15,76,87,.16);border-radius:12px;padding:12px 14px;background:rgba(15,76,87,.03)}' +
      '.ca-tile span{display:block;font-size:13px;opacity:.75}.ca-tile b{display:block;font-size:22px;line-height:1.2;font-variant-numeric:tabular-nums}.ca-tile b.ca-small{font-size:16px}.ca-tile small{opacity:.75}.ca-tile.owed b{color:#0f4c57}.ca-tile.late b{color:#b9474f}' +
      '.ca-actions{margin:4px 0 14px;align-items:center;flex-wrap:wrap}.ca-hint{font-size:13px}.ca-period{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:6px 0 8px}.ca-period label{font-size:13px;display:flex;flex-direction:column}';
    document.head.appendChild(st);
  }
  global.PoolShedCustomerAccount = { _cache: cache, _body: body, load: load };
})(typeof window !== 'undefined' ? window : globalThis);
