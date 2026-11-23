/* Pool Shed v1.84.0 — Sales invoicing in the Pool Shed ledger (Operations O3).
   Accounting → Invoice Ready · Customer Invoices · Payments & Allocations · Credit Control · Credits & Returns.
   Every money rule (prices, what may be invoiced, credits, payments) is enforced by the database (database/029);
   these screens only collect, show and confirm. Invoices are never edited: corrections are credit notes. */
(function(global){
  'use strict';
  var W = function(){ return typeof global.__POOL_SHED_WORKSPACE_ID__ === 'function' ? global.__POOL_SHED_WORKSPACE_ID__() : 'pool-bros-main'; };
  var DB = function(){ return typeof global.__POOL_SHED_DB__ === 'function' ? global.__POOL_SHED_DB__() : null; };
  var DATA = function(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? (global.__POOL_SHED_GET_DATA__() || {}) : {}; };
  var METHODS = { bank_transfer: 'Bank transfer', card: 'Card', cash: 'Cash', cheque: 'Cheque', other: 'Other' };
  var s = { queue: null, docs: null, aged: null, profile: null, loading: false, error: '', busy: false, last: null,
            review: null, part: null, doc: null, filter: 'open', focus: '', payCustomer: '', opening: null };

  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function cash(v){ return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(v || 0)); }
  function day(v){ return v ? new Date(String(v).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
  function today(){ return new Date().toISOString().slice(0, 10); }
  function notify(m){ try { if (typeof global.toast === 'function') global.toast(m); else console.log(m); } catch (_) {} }
  function rerender(){ try { if (typeof global.render === 'function') global.render(); } catch (_) {} }
  function friendly(e){ return String(e && (e.message || e.error_description || e.error) || e || 'Something went wrong').replace(/^.*?ERROR:\s*/, ''); }
  function pill(text, tone){ return '<span class="finance-pill ' + (tone || 'dark') + '">' + esc(text) + '</span>'; }
  function metric(label, value, help){ return '<div class="finance-metric"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong><small>' + esc(help || '') + '</small></div>'; }
  function panel(title, help, body, actions, id){ return '<section class="finance-panel"' + (id ? ' id="' + id + '"' : '') + '><header class="finance-panel-head"><div><h3>' + esc(title) + '</h3><p>' + esc(help || '') + '</p></div>' + (actions ? '<div class="finance-row-actions">' + actions + '</div>' : '') + '</header>' + body + '</section>'; }
  function result(){ return s.last ? '<div class="pp-result ' + (s.last.ok ? 'good' : 'bad') + '">' + s.last.html + '</div>' : ''; }
  function stateTone(st){ return ({ paid: 'good', used: 'good', overdue: 'bad', part_paid: 'warn', unpaid: 'dark', unused: 'warn' })[st] || 'dark'; }
  function stateText(d){ return d.doc_type === 'sales_invoice' ? ({ paid: 'Paid', overdue: 'Overdue ' + d.days_overdue + 'd', part_paid: 'Part paid', unpaid: 'Unpaid' })[d.state] || d.state
                                                               : d.state === 'unused' ? cash(d.open) + ' unused' : 'Used'; }
  function docLabel(t){ return ({ sales_invoice: 'Invoice', sales_credit: 'Credit note', customer_receipt: 'Payment' })[t] || t; }

  async function rpc(name, args){ var db = DB(); if (!db) throw new Error('Not connected. Sign in again.'); var r = await db.rpc(name, args); if (r.error) throw r.error; return r.data; }
  async function token(){ return typeof global.__POOL_SHED_AUTH_TOKEN__ === 'function' ? await global.__POOL_SHED_AUTH_TOKEN__() : ''; }
  async function load(force){
    if (s.loading || (!force && s.queue)) return;
    s.loading = true; s.error = '';
    try {
      var w = W(), r = await Promise.all([rpc('ps_invoicing_queue', { w: w }), rpc('ps_sales_documents_list', { w: w, max_rows: 500 }),
                                          rpc('ps_aged_debtors', { w: w }), rpc('ps_invoice_profile_get', { w: w })]);
      s.queue = r[0] || { orders: [], jobs: [] }; s.docs = r[1] || []; s.aged = r[2] || []; s.profile = r[3] || {};
    } catch (e) { s.error = friendly(e); }
    s.loading = false; rerender();
  }
  async function act(fn){ if (s.busy) return; s.busy = true; s.last = null; rerender(); paintModal();
    try { await fn(); } catch (e) { s.last = { ok: false, html: esc(friendly(e)) }; }
    s.busy = false; await load(true); paintModal(); }

  // ---------- In place on the order page (v1.56): invoice or take a payment without leaving the order ----------
  function modalBox(){ var m = document.getElementById('si-modal');
    if (!m) { m = document.createElement('div'); m.id = 'si-modal'; m.className = 'si-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); document.body.appendChild(m); }
    return m; }
  function closeModal(){ var m = document.getElementById('si-modal'); if (m) m.remove(); s.modal = null; s.review = null; s.last = null; rerender(); }
  function paintModal(){
    if (!s.modal || typeof document === 'undefined') return;
    var m = modalBox(), body = '';
    if (s.modal === 'invoice') body = s.review ? reviewPanel() : result() + (s.last ? '' : '<p class="muted">Loading the invoice…</p>');
    else if (s.modal === 'payment') body = result() + paymentForm(true);
    else if (s.modal === 'stage') body = result() + (s.part ? partPanel() : s.last ? '' : '<p class="muted">Loading the project…</p>');
    m.innerHTML = '<div class="si-modal-card"><button type="button" class="si-modal-close" data-si-action="close-modal" aria-label="Close">×</button>' + body + '</div>';
  }
  function inlineInvoice(orderId){
    if (!(typeof global.__POOL_SHED_CAN_ACCESS__ === 'function' && global.__POOL_SHED_CAN_ACCESS__('accounting'))) { notify('Invoices are raised by Accounts.'); return; }
    s.modal = 'invoice'; s.review = null; s.last = null; s.part = null; paintModal();
    rpc('ps_sales_order_preview', { w: W(), order_id: orderId }).then(function(r){
      if (r.state !== 'ready') { s.last = { ok: false, html: esc(r.state === 'invoiced' ? orderId + ' is already invoiced.' : r.state === 'before_ledger' ? orderId + ' was invoiced before the ledger.' : orderId + ' is not delivered yet. Raise a deposit invoice from Accounts → Invoice Ready if needed.') }; }
      else s.review = r;
      paintModal();
    }).catch(function(e){ s.last = { ok: false, html: esc(friendly(e)) }; paintModal(); });
  }
  // v1.61: invoice a project stage from the project page, on the ledger (replaces the old Xero draft queue).
  function inlineStage(jobId, phaseId){
    if (!(typeof global.__POOL_SHED_CAN_ACCESS__ === 'function' && global.__POOL_SHED_CAN_ACCESS__('accounting'))) { notify('Stage invoices are raised by Accounts.'); return; }
    s.modal = 'stage'; s.review = null; s.last = null; s.part = null; paintModal();
    load(true).then(function(){
      var row = ((s.queue || {}).jobs || []).find(function(j){ return j.job_id === jobId; });
      if (!row) s.last = { ok: false, html: 'This project is not billed by stage, so it has no stage invoices. Set its billing to stages first.' };
      else if (!(Number(row.remaining_net) > 0)) s.last = { ok: false, html: 'Everything agreed on this project is already invoiced.' };
      else s.part = { source: 'job', id: jobId, label: row.name || jobId, left: row.remaining_net, phases: row.phases || [], phase: phaseId || '' };
      paintModal();
    });
  }
  // Keep the project's stage in step with the ledger so the project screens show the invoice number.
  function markPhase(jobId, phaseId, docNumber, docDate){
    if (!phaseId) return;
    var j = (DATA().jobs || []).find(function(x){ return String(x.id) === String(jobId); }), ph = j && j.project && (j.project.phases || []).find(function(x){ return x.id === phaseId; });
    if (!ph) return;
    ph.invoiceRequested = true; ph.ledgerInvoice = docNumber; ph.invoicedAt = docDate || today();
    if (Array.isArray(j.project.audit)) j.project.audit.push({ id: 'A-' + Date.now().toString(36), action: 'stage_invoice_posted', at: new Date().toISOString(),
      user: (typeof global.__POOL_SHED_CURRENT_USER__ === 'function' && (global.__POOL_SHED_CURRENT_USER__() || {}).name) || '', details: { phase: phaseId, document: docNumber } });
    try { if (typeof global.__POOL_SHED_SAVE_APP_DATA__ === 'function') global.__POOL_SHED_SAVE_APP_DATA__(); } catch (_) {}
  }
  function inlinePayment(order){
    if (!(typeof global.__POOL_SHED_CAN_ACCESS__ === 'function' && global.__POOL_SHED_CAN_ACCESS__('accounting'))) { notify('Payments are recorded by Accounts.'); return; }
    var c = (DATA().customers || []).find(function(x){ return String(x.id) === String(order.customerId); });
    s.payCustomer = c ? 'id:' + c.id : ''; s.modal = 'payment'; s.last = null; paintModal();
    load(!s.docs).then(paintModal);
  }

  // Keep the order in step (status and invoice number) so the Sales screens show the ledger invoice.
  function markOrder(orderId, docNumber, docDate){
    var o = (DATA().salesOrders || []).find(function(x){ return String(x.id) === String(orderId); }); if (!o) return;
    o.xeroRef = docNumber; o.invoiceSource = 'Ledger'; o.invoiceDate = docDate; o.status = 'Invoiced'; o.statusUpdatedAt = new Date().toISOString();
    o.invoiceEmailStatus = o.invoiceEmailStatus || 'Not sent';
    if (!Array.isArray(o.tags)) o.tags = []; if (o.tags.indexOf('Invoiced') < 0) o.tags.push('Invoiced');
    try { if (typeof global.__POOL_SHED_SAVE_APP_DATA__ === 'function') global.__POOL_SHED_SAVE_APP_DATA__(); } catch (_) {}
  }

  // Ledger payments are copied onto the order (marked as from the ledger) so the order's own balance and "Paid" are right.
  function copyPaymentToOrders(receiptNumber, date, method, reference, allocs){
    var changed = false;
    allocs.forEach(function(a){
      var inv = (s.docs || []).find(function(d){ return d.id === a.document_id; }); if (!inv || inv.source_type !== 'sales_order') return;
      var o = (DATA().salesOrders || []).find(function(x){ return String(x.id) === String(inv.source_id); }); if (!o) return;
      o.payments = Array.isArray(o.payments) ? o.payments : [];
      var id = receiptNumber + '-' + inv.doc_number; if (o.payments.some(function(p){ return p.id === id; })) return;
      o.payments.push({ id: id, amount: a.amount, type: METHODS[method] || 'Other', reference: (receiptNumber + ' → ' + inv.doc_number + (reference ? ' · ' + reference : '')).slice(0, 120), date: date, ledger: true });
      if (Number(inv.open) - a.amount <= 0.004) { o.tags = Array.isArray(o.tags) ? o.tags : []; if (o.tags.indexOf('Paid') < 0) o.tags.push('Paid'); }
      changed = true;
    });
    if (changed) try { if (typeof global.__POOL_SHED_SAVE_APP_DATA__ === 'function') global.__POOL_SHED_SAVE_APP_DATA__(); } catch (_) {}
  }
  function payForOrder(order){
    var c = (DATA().customers || []).find(function(x){ return String(x.id) === String(order.customerId); });
    s.payCustomer = c ? 'id:' + c.id : ''; s.doc = null; s.last = null; openSub('Payments & Allocations');
  }

  // ---------- Invoice Ready ----------
  function readyPage(){
    load(false);
    var q = s.queue || { orders: [], jobs: [] }, orders = q.orders || [];
    var ready = orders.filter(function(o){ return o.state === 'ready'; }), wip = orders.filter(function(o){ return o.state === 'in_progress' || o.state === 'on_hold'; });
    var before = orders.filter(function(o){ return o.state === 'before_ledger'; }), staged = orders.filter(function(o){ return o.state === 'project_stages'; });
    var sum = function(a, k){ return a.reduce(function(t, o){ return t + Number(o[k] || 0); }, 0); };
    var html = (s.error ? '<div class="pp-result bad">' + esc(s.error) + '</div>' : '') + profileWarning() +
      '<div class="finance-command-metrics">' + metric('Ready to invoice', cash(sum(ready, 'remaining_gross')), ready.length + ' delivered orders') +
      metric('Not delivered yet', wip.length, 'Deposit invoices can be raised') + metric('Projects billed by stage', (q.jobs || []).length, cash(sum(q.jobs || [], 'remaining_net')) + ' net left to bill') +
      metric('Invoiced before the ledger', before.length, 'Already invoiced: never invoiced again') + '</div>' + result();
    if (s.review) html += reviewPanel();
    if (s.part) html += partPanel();
    var rowsReady = ready.map(function(o){ return '<tr' + (s.focus === o.order_id ? ' class="si-focus"' : '') + '><td><strong>' + esc(o.order_id) + '</strong>' + (o.customer_po ? '<br><small>PO ' + esc(o.customer_po) + '</small>' : '') + '</td><td>' + esc(o.customer || '—') + '</td><td>' + pill(o.status || '', 'good') + '</td>' +
      '<td class="num">' + cash(o.gross) + '</td><td class="num">' + (Number(o.billed_net) ? cash(Number(o.billed_net) + Number(o.billed_vat)) + '<br><small>' + esc((o.invoices || []).join(', ')) + '</small>' : '—') + '</td>' +
      '<td class="num"><strong>' + cash(o.remaining_gross) + '</strong></td><td class="finance-row-actions"><button type="button" class="primary small" data-si-action="review" data-id="' + esc(o.order_id) + '">Review &amp; invoice</button></td></tr>'; }).join('');
    html += panel('Ready to invoice', 'Delivered or completed orders. Check each one, then post the invoice: it gets the next number and goes into the ledger. Prices come from the order exactly as agreed.',
      ready.length ? '<table class="finance-table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Order total</th><th>Already invoiced</th><th>To invoice</th><th></th></tr></thead><tbody>' + rowsReady + '</tbody></table>'
                   : '<p class="muted">' + (s.loading ? 'Loading…' : 'Nothing waiting to be invoiced.') + '</p>', '<button type="button" class="secondary" data-si-action="refresh">Refresh</button>');
    var rowsJobs = (q.jobs || []).map(function(j){ var phases = (j.phases || []).map(function(p){ return esc(p.name || p.id) + (p.amount_net != null ? ' ' + cash(p.amount_net) : '') + (p.status ? ' (' + esc(p.status) + ')' : ''); }).join(' · ');
      return '<tr><td><strong>' + esc(j.name || j.job_id) + '</strong><br><small>' + esc(j.job_id) + (phases ? ' · ' + phases : '') + '</small></td><td>' + esc(j.customer || '—') + '</td><td class="num">' + cash(j.contract_net) + '</td>' +
        '<td class="num">' + cash(j.billed_net) + (j.invoices && j.invoices.length ? '<br><small>' + esc(j.invoices.join(', ')) + '</small>' : '') + '</td><td class="num"><strong>' + cash(j.remaining_net) + '</strong></td>' +
        '<td class="finance-row-actions"><button type="button" class="primary small" data-si-action="stage" data-id="' + esc(j.job_id) + '"' + (Number(j.remaining_net) > 0 ? '' : ' disabled') + '>Stage invoice</button></td></tr>'; }).join('');
    if ((q.jobs || []).length) html += panel('Projects billed by stage', 'Invoice each agreed stage (and any deposit) as it is reached. The total can never go over the accepted quote plus approved extras. Amounts are before VAT.',
      '<table class="finance-table"><thead><tr><th>Project</th><th>Customer</th><th>Contract (net)</th><th>Invoiced (net)</th><th>Left to bill (net)</th><th></th></tr></thead><tbody>' + rowsJobs + '</tbody></table>');
    var rowsWip = wip.map(function(o){ return '<tr><td><strong>' + esc(o.order_id) + '</strong></td><td>' + esc(o.customer || '—') + '</td><td>' + pill(o.status || '', o.state === 'on_hold' ? 'warn' : 'dark') + '</td><td class="num">' + cash(o.gross) + '</td>' +
      '<td class="num">' + (Number(o.billed_net) ? cash(Number(o.billed_net) + Number(o.billed_vat)) + '<br><small>' + esc((o.invoices || []).join(', ')) + '</small>' : '—') + '</td>' +
      '<td class="finance-row-actions"><button type="button" class="secondary small" data-si-action="deposit" data-id="' + esc(o.order_id) + '">Deposit invoice</button></td></tr>'; }).join('');
    if (wip.length) html += panel('Not delivered yet', 'These can be invoiced once delivered. If you take a deposit first, raise a deposit invoice: the final invoice will deduct it automatically.',
      '<table class="finance-table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Order total</th><th>Deposits invoiced</th><th></th></tr></thead><tbody>' + rowsWip + '</tbody></table>');
    if (before.length || staged.length) html += '<details class="finance-panel si-details"><summary>Already invoiced before the ledger (' + before.length + ') and project orders billed by stage (' + staged.length + ')</summary>' +
      '<p class="muted">These are shown for completeness and cannot be invoiced again here. Their unpaid balances come in as opening balances from Xero (Customer Invoices → Opening balances).</p><ul class="si-list">' +
      before.map(function(o){ return '<li>' + esc(o.order_id) + ' · ' + esc(o.customer || '') + ' · ' + cash(o.gross) + (o.legacy_ref ? ' · ' + esc(o.legacy_ref) : '') + '</li>'; }).join('') +
      staged.map(function(o){ return '<li>' + esc(o.order_id) + ' · ' + esc(o.customer || '') + ' · billed through project ' + esc(o.job_id) + '</li>'; }).join('') + '</ul></details>';
    return html;
  }
  function reviewPanel(){
    var r = s.review, c = r.customer || {}, lines = (r.lines || []).map(function(l){ return '<tr><td>' + esc(l.description) + (l.sku ? '<br><small>' + esc(l.sku) + '</small>' : '') + '</td><td class="num">' + esc(l.qty) + '</td><td class="num">' + cash(l.unit_net) + '</td><td class="num">' + esc(l.vat_rate) + '%</td><td class="num">' + cash(l.net) + '</td></tr>'; }).join('');
    var billed = r.billed || {}, deposits = Number(billed.net) || Number(billed.vat) ? '<tr class="muted"><td colspan="4">Less already invoiced (' + esc((billed.documents || []).join(', ')) + ')</td><td class="num">' + cash(-billed.net) + '</td></tr>' : '';
    var noEmail = !c.email ? '<p class="pp-result bad">' + esc(c.name || 'This customer') + ' has no email address. Add one on the customer record before emailing the invoice.</p>' : '';
    return panel('Invoice ' + (r.next_number || '') + ' for ' + r.order_id, 'Check the customer, lines and total. Once posted it cannot be edited; mistakes are corrected with a credit note.',
      '<div class="form-grid two si-review-head"><div><span class="muted">Customer</span><br><strong>' + esc(c.name || 'Missing customer') + '</strong><br><small>' + esc(c.email || 'No email') + '</small></div>' +
      '<div><span class="muted">Terms</span><br><strong>' + esc(r.terms || '') + '</strong></div></div>' + noEmail +
      '<table class="finance-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit (net)</th><th>VAT</th><th>Net</th></tr></thead><tbody>' + lines + deposits + '</tbody>' +
      '<tfoot><tr><td colspan="4">Net</td><td class="num">' + cash(r.remaining_net) + '</td></tr><tr><td colspan="4">VAT</td><td class="num">' + cash(Number(r.remaining_gross) - Number(r.remaining_net)) + '</td></tr>' +
      '<tr><td colspan="4"><strong>Total to invoice</strong></td><td class="num"><strong>' + cash(r.remaining_gross) + '</strong></td></tr></tfoot></table>' +
      '<form class="pp-form" data-si-form="final"><div class="form-grid two"><label>Invoice date<input type="date" name="date" value="' + today() + '" max="' + today() + '" required></label>' +
      '<label>Customer reference / PO<input name="po" maxlength="60" value="' + esc(r.customer_po || '') + '"></label>' +
      '<label class="full inline"><input type="checkbox" name="ok" required> I have checked the customer, the lines and the total</label></div>' +
      '<div class="finance-row-actions"><button type="submit" class="primary"' + (s.busy ? ' disabled' : '') + '>' + (s.busy ? 'Posting…' : 'Post invoice') + '</button><button type="button" class="secondary" data-si-action="cancel">Cancel</button></div></form>',
      '', 'si-review');
  }
  function partPanel(){
    var p = s.part, job = p.source === 'job', phases = job ? (p.phases || []) : [];
    var pick = job ? phases.find(function(ph){ return ph.id === p.phase && !(Number(ph.billed_net) > 0); }) : null;
    var phaseSel = phases.length ? '<label>Stage<select name="phase"><option value="">Choose…</option>' + phases.map(function(ph){ var done = Number(ph.billed_net) > 0;
      return '<option value="' + esc(ph.id) + '" data-amount="' + esc(ph.amount_net == null ? '' : ph.amount_net) + '" data-name="' + esc(ph.name || '') + '"' + (done ? ' disabled' : '') + (pick && pick.id === ph.id ? ' selected' : '') + '>' +
        esc((ph.name || ph.id) + (ph.amount_net != null ? ' · ' + cash(ph.amount_net) : '') + (done ? ' · invoiced ' + (ph.invoices || []).join(', ') : '')) + '</option>'; }).join('') + '</select></label>' : '';
    return panel((job ? 'Stage invoice: ' : 'Deposit invoice: ') + p.label, (job ? 'Up to ' + cash(p.left) + ' net is left to bill on this project.' : 'Up to ' + cash(p.left) + ' net is left on this order. The final invoice deducts this automatically.'),
      '<form class="pp-form" data-si-form="part"><div class="form-grid two">' + phaseSel +
      (job ? '' : '<label>Deposit %<input name="pct" inputmode="decimal" placeholder="e.g. 30"><small>Or type the amount.</small></label>') +
      '<label>Amount before VAT (£)<input name="net" required inputmode="decimal" pattern="[0-9]+([.][0-9]{1,2})?"' + (pick && pick.amount_net != null ? ' value="' + Number(pick.amount_net).toFixed(2) + '"' : '') + '></label>' +
      '<label>VAT<select name="rate"><option value="20">20%</option><option value="5">5%</option><option value="0">0% / zero-rated</option></select></label>' +
      '<label class="full">Shown on the invoice as<input name="description" required maxlength="200" value="' + esc(job ? (pick ? pick.name || '' : '') : 'Deposit') + '" placeholder="' + (job ? 'e.g. Stage 2: shell and plumbing' : 'e.g. 30% deposit') + '"></label>' +
      '<label>Invoice date<input type="date" name="date" value="' + today() + '" max="' + today() + '" required></label>' +
      '<label class="full inline"><input type="checkbox" name="ok" required> I have checked the customer and the amount</label></div>' +
      '<div class="finance-row-actions"><button type="submit" class="primary"' + (s.busy ? ' disabled' : '') + '>Post invoice</button><button type="button" class="secondary" data-si-action="cancel">Cancel</button></div></form>', '', 'si-part');
  }
  function profileWarning(){
    var m = (s.profile && s.profile.missing) || [];
    return m.length ? '<div class="pp-result bad">Before invoices can be emailed, add the <strong>invoice details</strong>: ' + esc(m.join(', ')) + '. <button type="button" class="link" data-si-action="go" data-page="Customer Invoices">Add them</button></div>' : '';
  }

  // ---------- Customer Invoices (and Credits & Returns) ----------
  function invoicesPage(creditsOnly){
    load(false);
    var docs = s.docs || [], f = creditsOnly ? 'credits' : s.filter;
    var list = docs.filter(function(d){
      if (f === 'credits') return d.doc_type === 'sales_credit';
      if (f === 'payments') return d.doc_type === 'customer_receipt';
      if (d.doc_type !== 'sales_invoice') return f === 'all';
      if (f === 'open') return Number(d.open) > 0; if (f === 'overdue') return d.state === 'overdue'; if (f === 'paid') return d.state === 'paid'; return true; });
    var inv = docs.filter(function(d){ return d.doc_type === 'sales_invoice'; });
    var owed = inv.reduce(function(t, d){ return t + Number(d.open || 0); }, 0), od = inv.filter(function(d){ return d.state === 'overdue'; });
    var html = (s.error ? '<div class="pp-result bad">' + esc(s.error) + '</div>' : '') + result();
    if (!creditsOnly) html += '<div class="finance-command-metrics">' + metric('Owed by customers', cash(owed), inv.filter(function(d){ return Number(d.open) > 0; }).length + ' open invoices') +
      metric('Overdue', cash(od.reduce(function(t, d){ return t + Number(d.open); }, 0)), od.length + ' invoices') +
      metric('Invoiced this month', cash(inv.filter(function(d){ return String(d.doc_date).slice(0, 7) === today().slice(0, 7); }).reduce(function(t, d){ return t + Number(d.gross); }, 0)), 'incl. VAT') +
      metric('Emails', s.profile && s.profile.emails_on ? 'On' : 'Off', s.profile && s.profile.emails_on ? 'Invoices can be emailed' : 'Download the PDF and send it yourself') + '</div>';
    if (s.doc) html += docPanel();
    var filters = creditsOnly ? '' : ['open:Unpaid', 'overdue:Overdue', 'paid:Paid', 'all:Everything', 'credits:Credit notes', 'payments:Payments'].map(function(x){ var p = x.split(':');
      return '<button type="button" class="' + (s.filter === p[0] ? 'primary' : 'secondary') + ' small" data-si-action="filter" data-f="' + p[0] + '">' + p[1] + '</button>'; }).join('');
    var rows = list.map(function(d){ return '<tr><td><button type="button" class="link" data-si-action="view" data-id="' + esc(d.id) + '"><strong>' + esc(d.doc_number) + '</strong></button><br><small>' + esc(docLabel(d.doc_type)) + (d.kind && d.kind !== 'final' ? ' · ' + esc(d.kind) : '') + (d.opening ? ' · opening balance' : '') + '</small></td>' +
      '<td>' + day(d.doc_date) + (d.doc_type === 'sales_invoice' ? '<br><small>due ' + day(d.due_date) + '</small>' : '') + '</td><td>' + esc(d.customer || '') + '</td><td>' + esc(d.source_id && d.source_type !== 'opening' ? d.source_id : (d.reference || '')) + '</td>' +
      '<td class="num">' + cash(d.gross) + '</td><td class="num">' + (d.doc_type === 'sales_invoice' ? cash(d.open) : '') + '</td><td>' + pill(stateText(d), stateTone(d.state)) + '</td>' +
      '<td><small>' + (d.last_sent ? 'Emailed ' + day(d.last_sent.at) : d.doc_type === 'customer_receipt' ? esc(METHODS[d.method] || '') : '') + '</small></td>' +
      '<td class="finance-row-actions">' + (d.doc_type !== 'customer_receipt' && !d.opening ? '<button type="button" class="secondary small" data-si-action="pdf" data-id="' + esc(d.id) + '">PDF</button>' : '') + '<button type="button" class="secondary small" data-si-action="view" data-id="' + esc(d.id) + '">Open</button></td></tr>'; }).join('');
    html += panel(creditsOnly ? 'Credit notes' : 'Invoices, credit notes and payments', creditsOnly ? 'Returns, price corrections and cancelled work are credited against the original invoice (open the invoice → Credit note). Credit notes are never edited.'
        : 'Open a document to see it, download or email the PDF, raise a credit note or record a payment.',
      '<div class="finance-row-actions si-filters">' + filters + '</div>' + (list.length ? '<table class="finance-table"><thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>Order / project</th><th>Total</th><th>Left to pay</th><th>Status</th><th></th><th></th></tr></thead><tbody>' + rows + '</tbody></table>'
        : '<p class="muted">' + (s.loading ? 'Loading…' : 'Nothing here yet.') + '</p>'), '<button type="button" class="secondary" data-si-action="refresh">Refresh</button>');
    if (!creditsOnly) html += profilePanel() + openingPanel();
    return html;
  }
  function docPanel(){
    var d = s.doc, credit = d.doc_type === 'sales_credit', c = d.customer || {};
    var lines = (d.lines || []).map(function(l){ return '<tr' + (l.deduction ? ' class="muted"' : '') + '><td>' + esc(l.description) + '</td><td class="num">' + esc(l.qty) + '</td><td class="num">' + (l.unit_net == null ? '' : cash(l.unit_net)) + '</td><td class="num">' + (l.vat_rate == null ? '' : esc(l.vat_rate) + '%') + '</td><td class="num">' + cash(l.net) + '</td></tr>'; }).join('');
    var pays = (d.payments || []).map(function(p){ return '<li>' + esc(p.doc_number) + ' · ' + day(p.date) + ' · ' + cash(p.amount) + '</li>'; }).join('');
    var sends = (d.sends || []).map(function(x){ return '<li>Emailed to ' + esc(x.to) + ' · ' + day(x.at) + '</li>'; }).join('');
    var actions = '<button type="button" class="primary small" data-si-action="pdf" data-id="' + esc(d.id) + '">Download PDF</button>';
    var forms = '';
    forms += '<details class="si-act"' + (s.profile && s.profile.emails_on ? '' : '') + '><summary>Email ' + (credit ? 'credit note' : 'invoice') + '</summary>' +
      (s.profile && s.profile.emails_on ? '<form class="pp-form" data-si-form="email" data-id="' + esc(d.id) + '"><label>Send to<input type="email" name="to" required value="' + esc(c.email || '') + '"></label>' +
        '<div class="finance-row-actions"><button type="submit" class="primary small"' + (s.busy ? ' disabled' : '') + '>Send with PDF attached</button></div></form>'
        : '<p class="muted">Invoice emails are switched off. Download the PDF and send it yourself; the owner can switch emails on once the invoice details are complete.</p>') + '</details>';
    if (!credit && Number(d.open) > 0) forms += '<details class="si-act"><summary>Record a payment</summary><p class="muted">Use Payments &amp; Allocations to record money received; it is applied to this invoice first.</p>' +
      '<button type="button" class="secondary small" data-si-action="pay-for" data-key="' + esc(c.key || '') + '">Record payment for ' + esc(c.name || 'customer') + '</button></details>';
    if (!credit) forms += '<details class="si-act"><summary>Credit note (return, price correction, cancelled work)</summary><form class="pp-form" data-si-form="credit" data-id="' + esc(d.id) + '"><div class="form-grid two">' +
      '<label class="full inline"><input type="checkbox" name="full"> Credit the whole invoice (' + cash(d.gross) + ')</label>' +
      '<label>Or amount before VAT (£)<input name="net" inputmode="decimal" pattern="[0-9]+([.][0-9]{1,2})?"></label>' +
      '<label>VAT<select name="rate"><option value="20">20%</option><option value="5">5%</option><option value="0">0%</option></select></label>' +
      '<label class="full">Reason (shown on the credit note)<input name="reason" required maxlength="200" placeholder="e.g. 1 pump returned unused"></label></div>' +
      '<div class="finance-row-actions"><button type="submit" class="primary small"' + (s.busy ? ' disabled' : '') + '>Post credit note</button></div></form></details>';
    return panel(docLabel(d.doc_type) + ' ' + d.doc_number, c.name + ' · ' + day(d.doc_date) + (credit ? (d.credits_invoice ? ' · against ' + d.credits_invoice.doc_number : '') : ' · due ' + day(d.due_date)),
      '<table class="finance-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>VAT</th><th>Net</th></tr></thead><tbody>' + lines + '</tbody><tfoot>' +
      '<tr><td colspan="4">Net</td><td class="num">' + cash(d.net) + '</td></tr><tr><td colspan="4">VAT</td><td class="num">' + cash(d.vat) + '</td></tr>' +
      '<tr><td colspan="4"><strong>Total</strong></td><td class="num"><strong>' + cash(d.gross) + '</strong></td></tr>' +
      (credit ? '' : '<tr><td colspan="4"><strong>Left to pay</strong></td><td class="num"><strong>' + cash(d.open) + '</strong></td></tr>') + '</tfoot></table>' +
      (d.reason ? '<p class="muted">Reason: ' + esc(d.reason) + '</p>' : '') + (pays ? '<h4>Payments and credits applied</h4><ul class="si-list">' + pays + '</ul>' : '') + (sends ? '<ul class="si-list">' + sends + '</ul>' : '') + forms,
      actions + '<button type="button" class="secondary small" data-si-action="close-doc">Close</button>', 'si-doc');
  }
  function profilePanel(){
    var p = (s.profile && s.profile.profile) || {}, co = (s.profile && s.profile.company) || {}, can = s.profile && s.profile.can_edit, m = (s.profile && s.profile.missing) || [];
    var field = function(k, label, ph, full){ return '<label' + (full ? ' class="full"' : '') + '>' + label + '<input name="' + k + '" maxlength="600" value="' + esc(p[k] || '') + '" placeholder="' + esc(ph || '') + '"' + (can ? '' : ' disabled') + '></label>'; };
    return '<details class="finance-panel si-details"' + (m.length ? ' open' : '') + '><summary>Invoice details (shown on every invoice)' + (m.length ? ' · <strong>missing: ' + esc(m.join(', ')) + '</strong>' : ' · complete') + '</summary>' +
      '<form class="pp-form" data-si-form="profile"><div class="form-grid two">' +
      field('legal_name', 'Registered company name', co.name || 'e.g. Pool Bros Ltd') + field('address', 'Address on invoices', co.address || 'Leave blank to use the company address', true) +
      field('vat_number', 'VAT registration number', 'GB123456789') + field('company_number', 'Company number', '8 digits') +
      field('bank_name', 'Bank', 'e.g. Barclays') + field('account_name', 'Account name', 'Pool Bros Ltd') + field('sort_code', 'Sort code', '12-34-56') + field('account_number', 'Account number', '12345678') +
      field('payment_note', 'Payment note', 'e.g. Payment is due on receipt. Thank you!', true) + field('footer', 'Footer', 'Optional small print', true) + '</div>' +
      (can ? '<div class="finance-row-actions"><button type="submit" class="primary small">Save invoice details</button></div>' : '<p class="muted">Only Admin or Management can change these.</p>') + '</form></details>';
  }
  function openingPanel(){
    if (!(s.profile && s.profile.can_edit)) return '';
    var o = s.opening;
    return '<details class="finance-panel si-details"><summary>Opening balances: customers\' unpaid invoices from Xero (go-live)</summary>' +
      '<p class="muted">At go-live, export <strong>Aged Receivables Detail</strong> from Xero as CSV and choose it here. Each unpaid invoice is loaded as an opening balance so payments can be recorded against it. Opening balances are never sent back to Xero.</p>' +
      '<label class="secondary small pp-file">Choose CSV<input type="file" accept=".csv,text/csv" data-si-opening></label>' +
      (o ? '<p>' + o.rows.length + ' invoices, ' + cash(o.rows.reduce(function(t, r){ return t + r.outstanding_gross; }, 0)) + ' in total' + (o.unknown.length ? '. <strong>Not matched to a Pool Shed customer:</strong> ' + esc(o.unknown.join(', ')) + ' (add or rename them, then choose the file again)' : '') + '</p>' +
        '<label>Go-live date<input type="date" data-si-asof value="' + today() + '"></label> <button type="button" class="primary small" data-si-action="load-opening"' + (o.rows.length ? '' : ' disabled') + '>Load ' + o.rows.length + ' opening balances</button>' : '') + '</details>';
  }

  // ---------- Payments & Allocations ----------
  function paymentForm(compact){
    var docs = s.docs || [], custs = {}, cust = s.payCustomer;
    docs.forEach(function(d){ if (!custs[d.customer_key]) custs[d.customer_key] = { name: d.customer, open: 0 }; if (d.doc_type === 'sales_invoice') custs[d.customer_key].open += Number(d.open || 0); });
    (DATA().customers || []).forEach(function(c){ var k = 'id:' + c.id; if (!custs[k]) custs[k] = { name: c.companyName || c.name || ((c.firstName || '') + ' ' + (c.lastName || '')).trim() || c.id, open: 0 }; });
    var keys = Object.keys(custs).sort(function(a, b){ return (custs[b].open - custs[a].open) || String(custs[a].name).localeCompare(String(custs[b].name)); });
    var opts = '<option value="">Choose customer…</option>' + keys.map(function(k){ return '<option value="' + esc(k) + '"' + (k === cust ? ' selected' : '') + '>' + esc(custs[k].name) + (custs[k].open > 0 ? ' · owes ' + cash(custs[k].open) : '') + '</option>'; }).join('');
    var open = docs.filter(function(d){ return d.customer_key === cust && d.doc_type === 'sales_invoice' && Number(d.open) > 0; }).sort(function(a, b){ return String(a.due_date || a.doc_date).localeCompare(String(b.due_date || b.doc_date)); });
    var invRows = open.map(function(d){ return '<tr><td><strong>' + esc(d.doc_number) + '</strong><br><small>' + day(d.doc_date) + ' · due ' + day(d.due_date) + '</small></td><td class="num">' + cash(d.open) + '</td><td>' + pill(stateText(d), stateTone(d.state)) + '</td>' +
      '<td><input class="si-alloc" data-si-alloc="' + esc(d.id) + '" data-max="' + esc(d.open) + '" inputmode="decimal" placeholder="0.00"></td></tr>'; }).join('');
    var form = '<form class="pp-form" data-si-form="payment"><div class="form-grid two"><label>Customer<select name="customer" required data-si-paycust>' + opts + '</select></label>' +
      '<label>Amount received (£)<input name="amount" required inputmode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" data-si-amount></label>' +
      '<label>Date received<input type="date" name="date" value="' + today() + '" max="' + today() + '" required></label>' +
      '<label>How<select name="method">' + Object.keys(METHODS).map(function(k){ return '<option value="' + k + '">' + METHODS[k] + '</option>'; }).join('') + '</select></label>' +
      '<label class="full">Reference<input name="reference" maxlength="80" placeholder="Bank reference, card slip or cheque number"></label></div>' +
      (cust ? (open.length ? '<p class="muted">Applied to the oldest invoices first; change the amounts if the customer said otherwise. Anything not applied stays on their account as credit.</p><table class="finance-table"><thead><tr><th>Invoice</th><th>Left to pay</th><th>Status</th><th>Apply (£)</th></tr></thead><tbody>' + invRows + '</tbody></table>'
                         : '<p class="muted">This customer has no unpaid invoices: the payment will stay on their account as credit (for example a payment before the invoice).</p>') : '') +
      '<div class="finance-row-actions"><button type="submit" class="primary"' + (s.busy ? ' disabled' : '') + '>Record payment</button></div></form>';
    return panel('Record a customer payment', compact ? 'Applied to this customer\u2019s oldest invoices first.' : 'Money received from a customer, applied to their invoices. It is never typed onto an order by hand.', form);
  }
  function paymentsPage(){
    load(false);
    var docs = s.docs || [];
    var unused = docs.filter(function(d){ return d.doc_type !== 'sales_invoice' && Number(d.open) > 0; });
    var uRows = unused.map(function(u){ var targets = docs.filter(function(d){ return d.customer_key === u.customer_key && d.doc_type === 'sales_invoice' && Number(d.open) > 0; });
      return '<tr><td><strong>' + esc(u.doc_number) + '</strong><br><small>' + esc(docLabel(u.doc_type)) + ' · ' + day(u.doc_date) + '</small></td><td>' + esc(u.customer) + '</td><td class="num">' + cash(u.open) + '</td><td>' +
        (targets.length ? '<form class="si-inline" data-si-form="apply" data-from="' + esc(u.id) + '"><select name="to">' + targets.map(function(t){ return '<option value="' + esc(t.id) + '" data-open="' + esc(t.open) + '">' + esc(t.doc_number) + ' · ' + cash(t.open) + '</option>'; }).join('') + '</select><input name="amount" inputmode="decimal" value="' + Math.min(Number(u.open), Number(targets[0].open)).toFixed(2) + '"><button type="submit" class="secondary small">Apply</button></form>' : '<small class="muted">No unpaid invoices</small>') +
        (s.profile && s.profile.can_edit ? '<form class="si-inline" data-si-form="refund" data-from="' + esc(u.id) + '"><input name="amount" inputmode="decimal" value="' + Number(u.open).toFixed(2) + '"><select name="method"><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="cash">Cash</option></select><button type="submit" class="secondary small">Refund</button></form>' : '') + '</td></tr>'; }).join('');
    return (s.error ? '<div class="pp-result bad">' + esc(s.error) + '</div>' : '') + result() +
      paymentForm(false) +
      panel('Money on account', 'Payments and credit notes not yet used: apply them to an invoice, or refund the customer (Admin or Management).',
        unused.length ? '<table class="finance-table"><thead><tr><th>From</th><th>Customer</th><th>Unused</th><th>Apply or refund</th></tr></thead><tbody>' + uRows + '</tbody></table>' : '<p class="muted">Nothing on account.</p>');
  }

  // ---------- Payment reminders (v1.80): who to chase, a ready-made reminder, and when each invoice was last chased ----------
  // Nothing is sent from Pool Shed: the reminder opens in your own email app or is copied. "Mark as chased" keeps the history.
  function reminderLog(){ var d = DATA(); d.paymentReminders = Array.isArray(d.paymentReminders) ? d.paymentReminders : []; return d.paymentReminders; }
  function chasedFor(docId){ return reminderLog().filter(function(r){ return r.doc_id === docId; }).sort(function(a, b){ return String(b.at).localeCompare(String(a.at)); }); }
  function customerFor(key){ var id = String(key || '').replace(/^id:/, ''); return (DATA().customers || []).find(function(c){ return String(c.id) === id; }) || null; }
  function stageFor(doc){ var n = chasedFor(doc.id).length, days = Number(doc.days_overdue || 0), byDays = days > 44 ? 3 : days > 14 ? 2 : 1; return Math.min(3, Math.max(byDays, n + 1)); }
  var STAGE = { 1: 'Friendly reminder', 2: 'Second reminder', 3: 'Final reminder' };
  function daysText(n){ n = Number(n || 0); return n + (n === 1 ? ' day' : ' days'); }
  function ukDate(v){ var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(v || ''); }
  function reminderText(doc){ var c = customerFor(doc.customer_key) || {}, prof = (s.profile && s.profile.profile) || {}, co = (s.profile && s.profile.company) || {}, stage = stageFor(doc);
    var name = (c.firstName || String(c.name || doc.customer || '').split(' ')[0] || 'there').trim(), biz = prof.legal_name || co.name || 'Pool Bros', amount = cash(doc.open), days = Number(doc.days_overdue || 0);
    var subject = (stage === 3 ? 'Final reminder: ' : stage === 2 ? 'Second reminder: ' : 'Reminder: ') + 'invoice ' + doc.doc_number + ' (' + amount + ' outstanding)';
    var lines = ['Hello ' + name + ',', ''];
    if (stage === 1) lines.push('I hope all is well. This is a friendly reminder that invoice ' + doc.doc_number + ', dated ' + ukDate(doc.doc_date) + ', was due on ' + ukDate(doc.due_date || doc.doc_date) + ' and ' + amount + ' is still outstanding.', '', 'If you have already paid, thank you, and please ignore this message. If not, we would be grateful if you could arrange payment at your convenience.');
    else if (stage === 2) lines.push('We have not yet received payment for invoice ' + doc.doc_number + ', dated ' + ukDate(doc.doc_date) + '. It is now ' + daysText(days) + ' overdue and ' + amount + ' is outstanding.', '', 'Please arrange payment within the next 7 days, or let us know if there is a problem with the invoice so we can help.');
    else lines.push('Despite our earlier reminders, invoice ' + doc.doc_number + ', dated ' + ukDate(doc.doc_date) + ', remains unpaid. It is now ' + daysText(days) + ' overdue and ' + amount + ' is outstanding.', '', 'Please make payment within 7 days. If we do not hear from you, we may have to pause further work and supply on your account until it is settled. If there is a reason payment has been held up, please get in touch so we can resolve it.');
    if (prof.sort_code && prof.account_number) lines.push('', 'Bank transfer details:', 'Account name: ' + (prof.account_name || biz), 'Sort code: ' + prof.sort_code, 'Account number: ' + prof.account_number, 'Reference: ' + doc.doc_number);
    else lines.push('', 'Please quote ' + doc.doc_number + ' as the payment reference.');
    lines.push('', 'Kind regards,', biz);
    return { stage: stage, label: STAGE[stage], subject: subject, body: lines.join('\n'), to: String(c.email || '').trim() }; }
  function chaseList(){ var docs = (s.docs || []).filter(function(d){ return d.doc_type === 'sales_invoice' && d.state === 'overdue' && Number(d.open) > 0; })
      .sort(function(a, b){ return Number(b.days_overdue) - Number(a.days_overdue); });
    if (!docs.length) return panel('Chase list', 'Overdue invoices, oldest first.', '<p class="muted">' + (s.loading ? 'Loading…' : 'Nothing overdue. Nobody to chase.') + '</p>');
    var open = s.remind && docs.find(function(d){ return d.id === s.remind; });
    var rows = docs.map(function(d){ var last = chasedFor(d.id)[0], st = stageFor(d), c = customerFor(d.customer_key);
      return '<tr' + (open && open.id === d.id ? ' class="si-row-on"' : '') + '><td><strong>' + esc(d.doc_number) + '</strong><br><span class="muted">' + esc(d.customer || '') + '</span></td><td class="num si-bad">' + esc(daysText(d.days_overdue)) + '</td><td class="num"><strong>' + cash(d.open) + '</strong></td>' +
        '<td>' + (last ? esc(STAGE[last.stage] || 'Chased') + '<br><span class="muted">' + esc(ukDate(last.at)) + ' · ' + esc(last.by || '') + '</span>' : '<span class="muted">Not chased yet</span>') + '</td>' +
        '<td>' + (c && c.email ? '' : '<span class="muted">No email on file</span><br>') + '<span class="si-stage si-stage-' + st + '">' + esc(STAGE[st]) + ' next</span></td>' +
        '<td class="finance-row-actions"><button type="button" class="secondary small" data-si-action="remind" data-id="' + esc(d.id) + '">Write reminder</button></td></tr>'; }).join('');
    var letter = '';
    if (open) { var r = reminderText(open);
      letter = '<div class="si-reminder" id="si-reminder"><div class="si-reminder-head"><strong>' + esc(r.label) + ' · ' + esc(open.doc_number) + '</strong><span>' + (r.to ? 'To ' + esc(r.to) : 'No email address on file for this customer') + '</span></div>' +
        '<label>Subject<input data-si-remind-subject value="' + esc(r.subject) + '"></label><label>Message<textarea data-si-remind-body rows="14">' + esc(r.body) + '</textarea></label>' +
        '<div class="si-reminder-actions"><button type="button" class="primary" data-si-action="remind-mail" data-id="' + esc(open.id) + '"' + (r.to ? '' : ' disabled') + '>Open in my email</button><button type="button" class="secondary" data-si-action="remind-copy">Copy</button><button type="button" class="secondary" data-si-action="pdf" data-id="' + esc(open.id) + '">Invoice PDF</button>' +
        '<button type="button" class="secondary" data-si-action="remind-mark" data-id="' + esc(open.id) + '" data-stage="' + r.stage + '">Mark as chased</button><button type="button" class="ghost" data-si-action="remind-close">Close</button></div>' +
        '<p class="muted">Pool Shed does not send this. It opens in your own email app (attach the invoice PDF there), or copy it into a message. Then press “Mark as chased”.</p></div>'; }
    return panel('Chase list', 'Overdue invoices, oldest first, with the reminder each one needs next: friendly, then second, then final.', letter + '<table class="finance-table"><thead><tr><th>Invoice</th><th>Overdue</th><th>Owed</th><th>Last chased</th><th>Next</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>', '', 'si-chase'); }

  // ---------- Credit Control (aged debtors) ----------
  function agedPage(){
    load(false);
    var a = s.aged || [], tot = { not_due: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, on_account: 0, total: 0 };
    a.forEach(function(r){ Object.keys(tot).forEach(function(k){ tot[k] += Number(r[k] || 0); }); });
    var cell = function(v, bad){ return '<td class="num' + (bad && Number(v) > 0 ? ' si-bad' : '') + '">' + (Number(v) ? cash(v) : '—') + '</td>'; };
    var rows = a.map(function(r){ return '<tr><td><strong>' + esc(r.customer) + '</strong></td>' + cell(r.not_due) + cell(r.d1_30, 1) + cell(r.d31_60, 1) + cell(r.d61_90, 1) + cell(r.d90_plus, 1) + cell(-r.on_account) + '<td class="num"><strong>' + cash(r.total) + '</strong></td>' +
      '<td class="finance-row-actions"><button type="button" class="secondary small" data-si-action="pay-for" data-key="' + esc(r.customer_key) + '">Record payment</button></td></tr>'; }).join('');
    var overdue = tot.d1_30 + tot.d31_60 + tot.d61_90 + tot.d90_plus;
    return (s.error ? '<div class="pp-result bad">' + esc(s.error) + '</div>' : '') +
      '<div class="finance-command-metrics">' + metric('Owed in total', cash(tot.total), a.length + ' customers') + metric('Overdue', cash(overdue), 'Chase these first') +
      metric('Over 60 days', cash(tot.d61_90 + tot.d90_plus), 'Consider stopping supply') + metric('On account', cash(tot.on_account), 'Unused payments and credits') + '</div>' + chaseList() +
      panel('Aged debtors', 'What each customer owes, by how late it is (from the due date). From the Pool Shed ledger.',
        a.length ? '<table class="finance-table"><thead><tr><th>Customer</th><th>Not due</th><th>1–30 days</th><th>31–60</th><th>61–90</th><th>90+</th><th>On account</th><th>Total</th><th></th></tr></thead><tbody>' + rows + '</tbody>' +
          '<tfoot><tr><td><strong>Total</strong></td>' + cell(tot.not_due) + cell(tot.d1_30) + cell(tot.d31_60) + cell(tot.d61_90) + cell(tot.d90_plus) + cell(-tot.on_account) + '<td class="num"><strong>' + cash(tot.total) + '</strong></td><td></td></tr></tfoot></table>'
                 : '<p class="muted">' + (s.loading ? 'Loading…' : 'No customer owes anything.') + '</p>', '<button type="button" class="secondary" data-si-action="aged-csv">Download CSV</button>');
  }

  // ---------- Actions ----------
  function money(v){ var n = Number(String(v == null ? '' : v).replace(/[£,\s]/g, '')); return isFinite(n) ? Math.round(n * 100) / 100 : NaN; }
  async function openPdf(id){
    var t = await token(); if (!t) throw new Error('Sign in again.');
    var win = global.open('', '_blank');
    var r = await fetch('/api/media?action=invoice-pdf&workspace=' + encodeURIComponent(W()) + '&id=' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + t } });
    if (!r.ok) { if (win) win.close(); var b = await r.json().catch(function(){ return {}; }); throw new Error(b.error || 'The PDF could not be made.'); }
    var url = URL.createObjectURL(await r.blob());
    if (win) win.location.href = url; else global.location.assign(url);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
  }
  function openSub(page){ if (typeof global.__POOL_SHED_OPEN_SUBPAGE__ === 'function') global.__POOL_SHED_OPEN_SUBPAGE__('accounting', page); }
  function parseCsv(text){ // quoted fields, commas and line breaks inside quotes, "" escapes
    var rows = [], row = [], cell = '', q = false, t = String(text || '').replace(/^\uFEFF/, '');
    for (var i = 0; i < t.length; i++) { var ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
      if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch; }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function(r){ return r.some(function(c){ return String(c).trim() !== ''; }); });
  }
  function isoFromUk(v){ var m = String(v || '').trim().match(/^(\d{1,2})[\/\-. ](\d{1,2}|[A-Za-z]{3})[\/\-. ](\d{2,4})$/); if (!m) return /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : null;
    var mon = isNaN(m[2]) ? ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].toLowerCase()) + 1 : Number(m[2]); var y = Number(m[3]); if (y < 100) y += 2000;
    return y + '-' + String(mon).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0'); }
  function readOpening(text){
    var rows = parseCsv(text), header = (rows.shift() || []).map(function(h){ return String(h).toLowerCase(); });
    var col = function(re){ return header.findIndex(function(h){ return re.test(h); }); };
    var cc = col(/contact|customer/), ci = col(/invoice number|number|reference/), cd = col(/invoice date|^date/), cdu = col(/due date/), ca = col(/outstanding|amount due|balance|due amount|^due$/);
    var byName = {}; (DATA().customers || []).forEach(function(c){ [c.companyName, c.name, ((c.firstName || '') + ' ' + (c.lastName || '')).trim()].forEach(function(n){ if (n) byName[String(n).trim().toLowerCase()] = 'id:' + c.id; }); });
    var out = [], unknown = [];
    rows.forEach(function(r){ var name = String(r[cc] || '').trim(), amount = money(r[ca]); if (!name || !(amount > 0)) return;
      var key = byName[name.toLowerCase()]; if (!key) { if (unknown.indexOf(name) < 0) unknown.push(name); return; }
      out.push({ customer_key: key, invoice_number: String(r[ci] || '').trim(), invoice_date: isoFromUk(r[cd]), due_date: isoFromUk(r[cdu]), outstanding_gross: amount }); });
    return { rows: out, unknown: unknown };
  }

  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-si-action]'); if (!b) return;
    var a = b.dataset.siAction, id = b.dataset.id;
    if (a === 'refresh') { s.last = null; load(true); return; }
    if (a === 'cancel') { if (s.modal) { closeModal(); return; } s.review = null; s.part = null; rerender(); return; }
    if (a === 'close-doc') { s.doc = null; rerender(); return; }
    if (a === 'close-modal') { closeModal(); return; }
    if (a === 'filter') { s.filter = b.dataset.f; rerender(); return; }
    if (a === 'go') { openSub(b.dataset.page); return; }
    if (a === 'pay-for') { s.payCustomer = b.dataset.key || ''; s.doc = null; openSub('Payments & Allocations'); return; }
    if (a === 'review') { s.part = null; s.last = null; rpc('ps_sales_order_preview', { w: W(), order_id: id }).then(function(r){ s.review = r; rerender(); scrollTo('si-review'); }).catch(function(err){ notify(friendly(err)); }); return; }
    if (a === 'deposit' || a === 'stage') {
      var q = s.queue || {}, row = a === 'stage' ? (q.jobs || []).find(function(j){ return j.job_id === id; }) : (q.orders || []).find(function(o){ return o.order_id === id; });
      if (!row) return;
      s.review = null; s.last = null;
      s.part = a === 'stage' ? { source: 'job', id: id, label: row.name || id, left: row.remaining_net, phases: row.phases || [] }
                             : { source: 'sales_order', id: id, label: id + ' · ' + (row.customer || ''), left: Math.round((Number(row.net) - Number(row.billed_net)) * 100) / 100, orderNet: Number(row.net) };
      rerender(); scrollTo('si-part'); return;
    }
    if (a === 'view') { rpc('ps_sales_invoice_get', { w: W(), doc_id: id }).then(function(d){ s.doc = d; rerender(); scrollTo('si-doc'); })
      .catch(function(){ var d = (s.docs || []).find(function(x){ return x.id === id; }); if (d && d.doc_type === 'customer_receipt') notify(d.doc_number + ': ' + cash(d.gross) + ' from ' + d.customer + ' (' + (METHODS[d.method] || '') + '), ' + cash(d.open) + ' unused.'); }); return; }
    if (a === 'pdf') { openPdf(id).catch(function(err){ notify(friendly(err)); }); return; }
    if (a === 'remind') { s.remind = id; rerender(); scrollTo('si-reminder'); return; }
    if (a === 'remind-close') { s.remind = null; rerender(); return; }
    if (a === 'remind-copy') { var sub0 = document.querySelector('[data-si-remind-subject]'), body0 = document.querySelector('[data-si-remind-body]'); if (!body0) return;
      var txt = (sub0 ? sub0.value + '\n\n' : '') + body0.value; (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function(){ notify('Reminder copied.'); }).catch(function(){ body0.select(); notify('Select all and copy the message.'); }); return; }
    if (a === 'remind-mail') { var doc1 = (s.docs || []).find(function(d){ return d.id === id; }); if (!doc1) return; var r1 = reminderText(doc1); if (!r1.to) return notify('Add an email address to this customer first.');
      var sub1 = document.querySelector('[data-si-remind-subject]'), body1 = document.querySelector('[data-si-remind-body]');
      global.location.href = 'mailto:' + encodeURIComponent(r1.to) + '?subject=' + encodeURIComponent(sub1 ? sub1.value : r1.subject) + '&body=' + encodeURIComponent(body1 ? body1.value : r1.body); return; }
    if (a === 'remind-mark') { var doc2 = (s.docs || []).find(function(d){ return d.id === id; }); if (!doc2) return; var u = typeof global.__POOL_SHED_CURRENT_USER__ === 'function' ? (global.__POOL_SHED_CURRENT_USER__() || {}) : {};
      reminderLog().push({ doc_id: doc2.id, doc_number: doc2.doc_number, customer_key: doc2.customer_key, stage: Number(b.dataset.stage) || stageFor(doc2), open: Number(doc2.open), at: today(), by: u.name || u.email || 'Team' });
      try { if (global.__POOL_SHED_SAVE_APP_DATA__) global.__POOL_SHED_SAVE_APP_DATA__(); } catch (_) {}
      s.remind = null; notify(doc2.doc_number + ' marked as chased.'); rerender(); return; }
    if (a === 'aged-csv') {
      var csv = [['Customer','Not due','1-30','31-60','61-90','90+','On account','Total']].concat((s.aged || []).map(function(r){ return [r.customer, r.not_due, r.d1_30, r.d31_60, r.d61_90, r.d90_plus, r.on_account, r.total]; }))
        .map(function(r){ return r.map(function(v){ return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
      var l = document.createElement('a'); l.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); l.download = 'aged-debtors-' + today() + '.csv'; l.click(); return;
    }
    if (a === 'load-opening') {
      var asOf = (document.querySelector('[data-si-asof]') || {}).value || today(), o = s.opening; if (!o || !o.rows.length) return;
      act(async function(){ var r = await rpc('ps_opening_customer_invoices', { w: W(), as_of: asOf, rows: o.rows });
        s.opening = null; s.last = { ok: !(r.problems || []).length, html: 'Loaded ' + r.loaded + ' opening balances (' + cash(r.total) + ').' + ((r.problems || []).length ? ' Not loaded: ' + esc(r.problems.join('; ')) : '') }; });
    }
  });
  function scrollTo(id){ setTimeout(function(){ var el = document.getElementById(id); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); }

  document.addEventListener('change', function(e){
    var t = e.target;
    if (t.matches && t.matches('[data-si-paycust]')) { s.payCustomer = t.value; rerender(); paintModal(); return; }
    if (t.matches && t.matches('[data-si-opening]') && t.files && t.files[0]) { t.files[0].text().then(function(txt){ s.opening = readOpening(txt); rerender(); }); return; }
    if (t.matches && t.matches('[data-si-form="part"] select[name="phase"]')) { var opt = t.selectedOptions[0], f = t.form;
      if (opt && opt.dataset.amount) f.net.value = Number(opt.dataset.amount).toFixed(2); if (opt && opt.dataset.name && !f.description.value) f.description.value = opt.dataset.name; return; }
  });
  document.addEventListener('input', function(e){
    var t = e.target, f = t.form;
    if (f && f.dataset.siForm === 'part' && t.name === 'pct' && s.part && s.part.orderNet) { var p = money(t.value); if (p > 0) { f.net.value = (Math.round(s.part.orderNet * p) / 100).toFixed(2); f.description.value = p + '% deposit'; } return; }
    if (t.matches && t.matches('[data-si-amount]')) { // apply oldest first
      var left = money(t.value) || 0; document.querySelectorAll('[data-si-alloc]').forEach(function(inp){ var x = Math.min(left, Number(inp.dataset.max)); inp.value = x > 0 ? x.toFixed(2) : ''; left = Math.round((left - Math.max(0, x)) * 100) / 100; });
    }
  });
  document.addEventListener('submit', function(e){
    var f = e.target, kind = f.dataset && f.dataset.siForm; if (!kind) return;
    e.preventDefault(); var fd = new FormData(f);
    if (kind === 'final') { var r = s.review; if (!r) return;
      act(async function(){ var x = await rpc('ps_sales_invoice_create', { w: W(), p: { source: 'sales_order', id: r.order_id, kind: 'final', invoice_date: fd.get('date'), customer_po: String(fd.get('po') || ''), expected_gross: Number(r.remaining_gross) } });
        markOrder(r.order_id, x.doc_number, fd.get('date')); s.review = null;
        s.last = { ok: true, html: 'Posted <strong>' + esc(x.doc_number) + '</strong> for ' + cash(x.gross) + ' (due ' + day(x.due_date) + '). <button type="button" class="link" data-si-action="pdf" data-id="' + esc(x.id) + '">Download PDF</button> · <button type="button" class="link" data-si-action="view" data-id="' + esc(x.id) + '">Open to email</button>' }; }); return; }
    if (kind === 'part') { var p = s.part; if (!p) return;
      act(async function(){ var x = await rpc('ps_sales_invoice_create', { w: W(), p: { source: p.source, id: p.id, kind: p.source === 'job' ? 'stage' : 'deposit', net: money(fd.get('net')), vat_rate: Number(fd.get('rate')),
          description: String(fd.get('description') || ''), phase_id: String(fd.get('phase') || '') || null, invoice_date: fd.get('date') } });
        if (p.source === 'job') markPhase(p.id, String(fd.get('phase') || ''), x.doc_number, fd.get('date'));
        s.part = null; s.last = { ok: true, html: 'Posted <strong>' + esc(x.doc_number) + '</strong> for ' + cash(x.gross) + '. <button type="button" class="link" data-si-action="pdf" data-id="' + esc(x.id) + '">Download PDF</button> · <button type="button" class="link" data-si-action="view" data-id="' + esc(x.id) + '">Open to email</button>' }; }); return; }
    if (kind === 'credit') { var full = !!fd.get('full'), net = money(fd.get('net'));
      if (!full && !(net > 0)) return notify('Tick "credit the whole invoice" or enter the amount to credit.');
      act(async function(){ var x = await rpc('ps_sales_credit_create', { w: W(), p: { invoice_id: f.dataset.id, full: full, net: full ? null : net, vat_rate: Number(fd.get('rate')), reason: String(fd.get('reason') || '') } });
        s.doc = null; s.last = { ok: true, html: 'Posted credit note <strong>' + esc(x.doc_number) + '</strong> for ' + cash(x.gross) + '.' + (Number(x.customer_credit) > 0 ? ' ' + cash(x.customer_credit) + ' is now on the customer\'s account (the invoice was already paid): apply it or refund it in Payments &amp; Allocations.' : '') +
          ' <button type="button" class="link" data-si-action="pdf" data-id="' + esc(x.id) + '">Download PDF</button>' }; }); return; }
    if (kind === 'email') { var id = f.dataset.id, to = String(fd.get('to') || '').trim();
      act(async function(){ var t = await token(); var r = await fetch('/api/media?action=invoice-email&workspace=' + encodeURIComponent(W()), { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id, to: to }) });
        var b = await r.json().catch(function(){ return {}; }); if (!r.ok) throw new Error(b.error || 'The email could not be sent.');
        s.doc = null; s.last = { ok: true, html: 'Emailed <strong>' + esc(b.doc_number) + '</strong> to ' + esc(b.to) + ' with the PDF attached.' }; }); return; }
    if (kind === 'payment') { var allocs = []; document.querySelectorAll('[data-si-alloc]').forEach(function(inp){ var v = money(inp.value); if (v > 0) allocs.push({ document_id: inp.dataset.siAlloc, amount: v }); });
      act(async function(){ var x = await rpc('ps_customer_receipt_record', { w: W(), p: { customer_key: String(fd.get('customer') || ''), amount: money(fd.get('amount')), date: fd.get('date'), method: String(fd.get('method') || ''), reference: String(fd.get('reference') || ''), allocations: allocs } });
        copyPaymentToOrders(x.doc_number, fd.get('date'), String(fd.get('method') || ''), String(fd.get('reference') || ''), allocs);
        s.last = { ok: true, html: 'Recorded payment <strong>' + esc(x.doc_number) + '</strong>: ' + cash(x.applied) + ' applied to invoices' + (Number(x.on_account) > 0 ? ', ' + cash(x.on_account) + ' left on account' : '') + '.' }; f.reset(); }); return; }
    if (kind === 'apply') { act(async function(){ var x = await rpc('ps_customer_apply_credit', { w: W(), from_doc: f.dataset.from, to_doc: String(fd.get('to')), amount: money(fd.get('amount')) });
        var from = (s.docs || []).find(function(d){ return d.id === f.dataset.from; });
        if (from && from.doc_type === 'customer_receipt') copyPaymentToOrders(from.doc_number, today(), from.method, 'applied from account', [{ document_id: String(fd.get('to')), amount: Number(x.applied) }]);
        s.last = { ok: true, html: 'Applied ' + cash(x.applied) + '. ' + cash(x.invoice_left) + ' left on that invoice.' }; }); return; }
    if (kind === 'refund') { act(async function(){ var x = await rpc('ps_customer_refund', { w: W(), from_doc: f.dataset.from, amount: money(fd.get('amount')), method: String(fd.get('method')), reference: null });
        s.last = { ok: true, html: 'Refund ' + esc(x.doc_number) + ' of ' + cash(x.refunded) + ' recorded. Make sure the money is actually sent from the bank.' }; }); return; }
    if (kind === 'profile') { var p2 = {}; ['legal_name','address','vat_number','company_number','bank_name','account_name','sort_code','account_number','payment_note','footer'].forEach(function(k){ p2[k] = String(fd.get(k) || ''); });
      act(async function(){ var x = await rpc('ps_invoice_profile_save', { w: W(), p: p2 }); s.profile = x; s.last = { ok: true, html: 'Invoice details saved.' + ((x.missing || []).length ? ' Still missing: ' + esc(x.missing.join(', ')) + '.' : '') }; }); return; }
  });

  // Called by the order screen's "Invoice" button: open Invoice Ready at that order.
  function openForOrder(orderId){
    s.focus = String(orderId || ''); s.part = null; s.last = null; openSub('Invoice Ready');
    var row = ((s.queue || {}).orders || []).find(function(o){ return o.order_id === orderId; });
    if (!row || row.state === 'ready') rpc('ps_sales_order_preview', { w: W(), order_id: orderId }).then(function(r){ if (r.state === 'ready') { s.review = r; rerender(); scrollTo('si-review'); } }).catch(function(){});
  }

  if (typeof document !== 'undefined' && document.head && !document.getElementById('si-styles')) {
    var st = document.createElement('style'); st.id = 'si-styles';
    st.textContent = '.si-focus td{background:rgba(24,124,140,.08)}.si-details{padding:12px 16px}.si-details>summary{cursor:pointer;font-weight:600}.si-list{margin:6px 0 0 18px}' +
      '.si-act{margin-top:10px;border-top:1px solid rgba(0,0,0,.08);padding-top:8px}.si-act>summary{cursor:pointer;font-weight:600}.si-inline{display:inline-flex;gap:6px;align-items:center;margin:2px 6px 2px 0}.si-inline input{width:90px}.si-inline select{max-width:190px}' +
      '.si-modal{position:fixed;inset:0;z-index:1000;background:rgba(10,28,33,.45);display:grid;place-items:start center;padding:6vh 12px;overflow:auto}.si-modal-card{position:relative;background:var(--surface,#fff);color:inherit;border-radius:14px;max-width:760px;width:100%;padding:10px 16px 8px;box-shadow:0 20px 60px rgba(0,0,0,.25)}' +
      '.si-modal label.inline{display:flex;flex-direction:row;align-items:center;gap:8px}.si-modal label.inline input{width:18px;height:18px;margin:0}.si-modal .form-grid .full{grid-column:1/-1}' +
      '.si-modal-close{position:absolute;top:8px;right:10px;border:0;background:none;font-size:26px;line-height:1;cursor:pointer;min-height:0;color:inherit;z-index:1}' +
      '.si-alloc{width:110px}.si-bad{color:#b9474f;font-weight:600}.si-filters{flex-wrap:wrap;margin-bottom:8px}.si-review-head{margin-bottom:8px}';
    document.head.appendChild(st);
  }
  global.PoolShedSalesUI = { readyPage: readyPage, invoicesPage: function(){ return invoicesPage(false); }, creditsPage: function(){ return invoicesPage(true); },
    paymentsPage: paymentsPage, agedPage: agedPage, openForOrder: openForOrder, payForOrder: payForOrder, inlineInvoice: inlineInvoice, inlinePayment: inlinePayment, inlineStage: inlineStage, reload: function(){ return load(true); }, _state: s, _readOpening: readOpening };
})(typeof window !== 'undefined' ? window : globalThis);
