/* Pool Shed v1.51.0 — Record a purchase and Payment runs (Operations O1/O2).
   All money rules are enforced by the database (database/022-024); these screens only collect and show.
   Pro-forma suppliers are paid up front; on-account suppliers are paid on their terms through approved payment runs. */
(function(global){
  'use strict';
  var W = function(){ return typeof global.__POOL_SHED_WORKSPACE_ID__ === 'function' ? global.__POOL_SHED_WORKSPACE_ID__() : 'pool-bros-main'; };
  var DB = function(){ return typeof global.__POOL_SHED_DB__ === 'function' ? global.__POOL_SHED_DB__() : null; };
  var DATA = function(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? global.__POOL_SHED_GET_DATA__() : {}; };
  var CATEGORIES = ['Building materials','Plant & hire','Groundworks','Pool equipment','Plumbing','Electrical','Consumables','Delivery / freight',
                    'Fuel','Tools & equipment','Vehicles','Subcontractor','Office & admin','Other'];
  var state = { purchases: null, candidates: null, runs: null, settings: null, loading: false, error: '', dueBy: isoDays(7), selected: {}, busy: false, last: null };

  function isoDays(n){ return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function cash(v){ return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(v || 0)); }
  function day(v){ return v ? new Date(v + (String(v).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
  function notify(m){ try { if (typeof global.toast === 'function') global.toast(m); else console.log(m); } catch (_) {} }
  function rerender(){ try { if (typeof global.render === 'function') global.render(); } catch (_) {} }
  function supplierKey(s){ return s && s.id != null && s.id !== '' ? 'id:' + s.id : 'name:' + (s && s.name || ''); }
  function supplierBasis(s){ return /pro\s*-?\s*forma/i.test(String(s && s.accountType || '')) ? 'pro_forma' : 'on_account'; }
  function suppliers(){ return (DATA().suppliers || []).filter(function(s){ return s && s.name && String(s.status || 'Active') !== 'Inactive'; })
    .sort(function(a, b){ return String(a.name).localeCompare(String(b.name)); }); }
  function pill(text, tone){ return '<span class="finance-pill ' + (tone || 'dark') + '">' + esc(text) + '</span>'; }
  function tone(stateText){ return /Paid/.test(stateText) ? 'good' : /Overdue|Rejected/.test(stateText) ? 'bad' : /approval|missing/.test(stateText) ? 'warn' : 'dark'; }
  function panel(title, help, body, actions){ return '<section class="finance-panel"><header class="finance-panel-head"><div><h3>' + esc(title) + '</h3><p>' + esc(help || '') + '</p></div>' + (actions ? '<div class="finance-row-actions">' + actions + '</div>' : '') + '</header><div class="finance-panel-body">' + body + '</div></section>'; }
  function friendly(e){ var m = String(e && (e.message || e.error_description || e.error) || e || 'Something went wrong'); return m.replace(/^.*?ERROR:\s*/, ''); }

  async function rpc(name, args){
    var db = DB(); if (!db) throw new Error('Not connected. Sign in again.');
    var r = await db.rpc(name, args); if (r.error) throw r.error; return r.data;
  }
  async function load(force){
    if (state.loading || (!force && state.purchases)) return;
    state.loading = true; state.error = '';
    try {
      var w = W();
      var res = await Promise.all([rpc('ps_ledger_settings_get', { w: w }), rpc('ps_purchase_list', { w: w, max_rows: 200 }),
                                   rpc('ps_payment_candidates', { w: w, up_to: state.dueBy }), rpc('ps_payment_runs_list', { w: w })]);
      state.settings = res[0]; state.purchases = res[1] || []; state.candidates = res[2] || []; state.runs = res[3] || [];
    } catch (e) { state.error = friendly(e); }
    state.loading = false; rerender();
  }
  async function authToken(){ return typeof global.__POOL_SHED_AUTH_TOKEN__ === 'function' ? await global.__POOL_SHED_AUTH_TOKEN__() : ''; }
  async function uploadCopy(file, supKey, kind){
    if (!file) return null;
    if (file.size > 25 * 1024 * 1024) throw new Error('The file is larger than 25 MB.');
    var token = await authToken(); if (!token) throw new Error('Sign in again to upload.');
    var url = '/api/media?action=finance-upload&workspace=' + encodeURIComponent(W()) + '&supplierKey=' + encodeURIComponent(supKey) +
              '&kind=' + encodeURIComponent(kind || 'supplier_invoice') + '&name=' + encodeURIComponent(file.name || 'invoice');
    var r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': file.type || 'application/octet-stream' }, body: file });
    var body = await r.json().catch(function(){ return {}; });
    if (!r.ok) throw new Error(body.error || 'The copy could not be uploaded.');
    return body.ref;
  }
  async function openCopy(ref){
    var token = await authToken();
    var r = await fetch('/api/media?action=finance-sign&workspace=' + encodeURIComponent(W()) + '&refs=' + encodeURIComponent(ref), { headers: { Authorization: 'Bearer ' + token } });
    var body = await r.json().catch(function(){ return {}; });
    if (!r.ok || !body.urls || !body.urls[ref]) throw new Error(body.error || 'The copy could not be opened.');
    global.open(body.urls[ref], '_blank', 'noopener');
  }

  // ---------- Record a purchase ----------
  function recordPage(){
    load(false);
    var s = state, list = s.purchases || [];
    var waiting = list.filter(function(p){ return p.state === 'Waiting for approval'; });
    var missing = list.filter(function(p){ return p.state === 'Invoice copy missing'; });
    var today = isoDays(0);
    var overdue = list.filter(function(p){ return Number(p.outstanding) > 0 && p.due_date && p.due_date < today; });
    var due7 = list.filter(function(p){ return Number(p.outstanding) > 0 && p.due_date && p.due_date >= today && p.due_date <= isoDays(7); });
    var sum = function(a){ return a.reduce(function(t, p){ return t + Number(p.outstanding || p.gross || 0); }, 0); };
    var metrics = '<div class="finance-command-metrics">' +
      metric('Waiting for approval', waiting.length, cash(sum(waiting))) + metric('Invoice copy missing', missing.length, 'Cannot be paid until attached') +
      metric('Due in 7 days', cash(sum(due7)), due7.length + ' bills') + metric('Overdue', cash(sum(overdue)), overdue.length + ' bills') + '</div>';
    var sups = suppliers();
    var supOptions = '<option value="">Choose supplier…</option>' + sups.map(function(x){
      var basis = supplierBasis(x) === 'pro_forma' ? 'Pro forma: paid up front' : 'On account: ' + (x.terms || 'Net 30');
      return '<option value="' + esc(supplierKey(x)) + '" data-basis="' + supplierBasis(x) + '">' + esc(x.name) + ' · ' + esc(basis) + '</option>'; }).join('');
    var jobs = (DATA().jobs || []).map(function(j){ return '<option value="' + esc(j.id) + '">' + esc(j.id + ' · ' + (j.name || 'Job')) + '</option>'; }).join('');
    var cats = CATEGORIES.map(function(c){ return '<option>' + esc(c) + '</option>'; }).join('');
    var form = '<form class="pp-form" data-pp-form="purchase" autocomplete="off">' +
      '<div class="form-grid two">' +
      '<label>Supplier<select name="supplier" required>' + supOptions + '</select><small data-pp-basis>Pro-forma suppliers are paid up front; on-account suppliers are paid on their terms.</small></label>' +
      '<label>Supplier invoice or receipt number<input name="invoiceNo" required maxlength="60" placeholder="As printed on the invoice or receipt"></label>' +
      '<label>Invoice date<input type="date" name="date" required value="' + new Date().toISOString().slice(0, 10) + '" max="' + new Date().toISOString().slice(0, 10) + '"></label>' +
      '<label>Job<select name="job"><option value="">Not for a job (overhead)…</option>' + jobs + '</select></label>' +
      '<label>Cost category<select name="category"><option value="">Choose…</option>' + cats + '</select><small>Required when it is not for a job.</small></label>' +
      '<label>What was bought<input name="description" maxlength="200" placeholder="e.g. 40 blocks, sand and cement"></label>' +
      '<label>Net amount (£)<input name="net" required inputmode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" placeholder="0.00"></label>' +
      '<label>VAT (£)<input name="vat" inputmode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" placeholder="0.00"><small><button type="button" class="link" data-pp-action="vat20">Add 20% VAT</button> · use 0 if no VAT</small></label>' +
      '<label class="full">Invoice or receipt copy<input type="file" name="copy" accept="image/*,application/pdf" capture="environment"><small>Photo or PDF. Bills cannot be paid until a copy is attached.</small></label>' +
      '<fieldset class="full pp-paid"><legend>Already paid?</legend>' +
      '<label class="inline"><input type="checkbox" name="paid"> Yes, paid at purchase <span class="muted">(required for pro-forma suppliers)</span></label>' +
      '<div class="form-grid two pp-paid-fields"><label>How<select name="method"><option value="card">Company card</option><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option></select></label>' +
      '<label>Payment reference<input name="payRef" maxlength="60" placeholder="Card slip or bank reference"></label></div></fieldset>' +
      '</div><div class="finance-row-actions"><button type="submit" class="primary" ' + (s.busy ? 'disabled' : '') + '>' + (s.busy ? 'Saving…' : 'Record purchase') + '</button></div></form>' +
      (s.last ? '<div class="pp-result ' + (s.last.ok ? 'good' : 'bad') + '">' + s.last.html + '</div>' : '');
    var rows = list.slice(0, 60).map(function(p){
      var actions = '';
      if (p.state === 'Invoice copy missing') actions += '<label class="secondary small pp-file">Attach copy<input type="file" accept="image/*,application/pdf" capture="environment" data-pp-attach="' + esc(p.document_id) + '" data-pp-supplier="' + esc(p.supplier_key) + '" hidden></label>';
      if (p.attachment_ref) actions += '<button type="button" class="secondary small" data-pp-action="open-copy" data-ref="' + esc(p.attachment_ref) + '">View copy</button>';
      if (p.state === 'Waiting for approval' && s.settings && s.settings.can_approve && !p.created_by_me) {
        actions += '<button type="button" class="primary small" data-pp-action="approve" data-doc="' + esc(p.document_id) + '">Approve</button>' +
                   '<button type="button" class="secondary small" data-pp-action="reject" data-doc="' + esc(p.document_id) + '">Reject</button>';
      }
      return '<tr><td><strong>' + esc(p.supplier) + '</strong><br><small>' + esc(p.supplier_invoice_no) + ' · ' + esc(p.doc_number) + '</small></td>' +
        '<td>' + esc(p.job_id || p.category || '—') + (p.description ? '<br><small>' + esc(p.description) + '</small>' : '') + '</td>' +
        '<td>' + day(p.doc_date) + '</td><td class="num">' + cash(p.gross) + '</td><td class="num">' + cash(p.outstanding) + '</td>' +
        '<td>' + pill(p.state, tone(p.state)) + (p.payment_basis === 'pro_forma' ? ' ' + pill('Pro forma', 'dark') : '') + '</td><td class="finance-row-actions">' + actions + '</td></tr>';
    }).join('');
    var table = list.length ? '<table class="finance-table"><thead><tr><th>Supplier / invoice</th><th>Job or category</th><th>Date</th><th>Total</th><th>Owed</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>'
                            : '<p class="muted">' + (s.loading ? 'Loading…' : 'No purchases recorded yet.') + '</p>';
    return (s.error ? '<div class="pp-result bad">' + esc(s.error) + '</div>' : '') + metrics +
      panel('Record a purchase', 'For anything already bought: one step, with the invoice or receipt. Larger purchases (' + cash(s.settings ? s.settings.approval_threshold : 1000) + ' or more) wait for approval by a different person.', form) +
      panel('Recent purchases', 'Corrections are made with a credit note, never by editing.', table, '<button type="button" class="secondary" data-pp-action="refresh">Refresh</button>');
  }
  function metric(label, value, help){ return '<div class="finance-metric"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong><small>' + esc(help || '') + '</small></div>'; }

  async function submitPurchase(form){
    var f = new FormData(form), supKey = String(f.get('supplier') || ''), sup = suppliers().find(function(x){ return supplierKey(x) === supKey; });
    var paid = !!f.get('paid'), net = String(f.get('net') || '').trim(), vat = String(f.get('vat') || '').trim() || '0';
    if (!sup) return notify('Choose the supplier.');
    if (supplierBasis(sup) === 'pro_forma' && !paid) return notify(sup.name + ' is a pro-forma supplier: tick "paid at purchase" and record how it was paid.');
    state.busy = true; state.last = null; rerender();
    try {
      var file = f.get('copy'); var ref = file && file.size ? await uploadCopy(file, supKey, paid ? 'receipt' : 'supplier_invoice') : null;
      var p = { supplier_key: supKey, supplier_invoice_no: String(f.get('invoiceNo') || '').trim(), invoice_date: f.get('date'),
                job_id: String(f.get('job') || ''), category: String(f.get('category') || ''), description: String(f.get('description') || ''),
                net: Number(net), vat: Number(vat), attachment_ref: ref };
      if (paid) p.paid = { method: String(f.get('method') || 'card'), reference: String(f.get('payRef') || ''), date: f.get('date') };
      var r = await rpc('ps_purchase_record', { w: W(), p: p });
      var bits = ['Recorded <strong>' + esc(r.document.doc_number) + '</strong> for ' + esc(sup.name) + '.'];
      if (r.payment) bits.push('Payment ' + esc(r.payment.doc_number) + ' recorded.');
      else bits.push('Due ' + day(r.due_date) + '.');
      if (r.approval === 'pending') bits.push('<strong>Waiting for approval</strong> by Admin or Management.');
      if (!ref && !r.payment) bits.push('Attach the invoice copy before it can be paid.');
      if (r.over_credit_limit) bits.push('<strong>Over ' + esc(sup.name) + '\'s credit limit</strong> (owed ' + cash(r.owed_to_supplier) + ').');
      state.last = { ok: true, html: bits.join(' ') };
      form.reset();
      await load(true);
    } catch (e) { state.last = { ok: false, html: esc(friendly(e)) }; }
    state.busy = false; rerender();
  }

  // ---------- Payment runs ----------
  function runsPage(){
    load(false);
    var s = state, c = s.candidates || [], ready = c.filter(function(x){ return x.ready; }), held = c.filter(function(x){ return !x.ready; });
    var chosen = ready.filter(function(x){ return s.selected[x.document_id] !== false; });
    var total = chosen.reduce(function(t, x){ return t + Number(x.outstanding || 0); }, 0);
    var rows = c.map(function(x){
      return '<tr class="' + (x.ready ? '' : 'muted') + '"><td>' + (x.ready ? '<input type="checkbox" data-pp-select="' + esc(x.document_id) + '" ' + (s.selected[x.document_id] !== false ? 'checked' : '') + '>' : '') + '</td>' +
        '<td><strong>' + esc(x.supplier) + '</strong><br><small>' + esc(x.supplier_invoice_no) + ' · ' + esc(x.doc_number) + '</small></td>' +
        '<td>' + day(x.due_date) + '</td><td class="num">' + cash(x.outstanding) + '</td><td>' + (x.ready ? pill('Ready', 'good') : pill(x.held_reason || 'Held', 'warn')) + '</td></tr>'; }).join('');
    var dueTable = '<div class="form-grid three"><label>Bills due by<input type="date" data-pp-dueby value="' + esc(s.dueBy) + '"></label></div>' +
      (c.length ? '<table class="finance-table"><thead><tr><th></th><th>Supplier / invoice</th><th>Due</th><th>Owed</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table>'
                : '<p class="muted">' + (s.loading ? 'Loading…' : 'Nothing on account is due by this date.') + '</p>') +
      (held.some(function(x){ return /approval|copy|Rejected/.test(x.held_reason || ''); }) ? '<p class="muted">Bills waiting for approval or an invoice copy are sorted out on the Record a Purchase page.</p>' : '');
    var create = '<button type="button" class="primary" data-pp-action="create-run" ' + (!chosen.length || s.busy ? 'disabled' : '') + '>Create payment run · ' + cash(total) + ' (' + chosen.length + ')</button>';
    var runRows = (s.runs || []).map(function(r){
      var a = '';
      if (r.status === 'draft' && s.settings && s.settings.can_approve && !r.created_by_me) a += '<button type="button" class="primary small" data-pp-action="approve-run" data-run="' + esc(r.run_id) + '">Approve</button>';
      if (r.status === 'draft' && r.created_by_me) a += '<small class="muted">Needs approval by a different person</small> ';
      if (r.status === 'approved' || r.status === 'paid') a += '<button type="button" class="secondary small" data-pp-action="run-csv" data-run="' + esc(r.run_id) + '" data-num="' + esc(r.run_number) + '">Payment list (CSV)</button>';
      if (r.status === 'approved') a += '<button type="button" class="primary small" data-pp-action="pay-run" data-run="' + esc(r.run_id) + '">Mark paid</button>';
      if (r.status === 'draft' || r.status === 'approved') a += '<button type="button" class="secondary small" data-pp-action="cancel-run" data-run="' + esc(r.run_id) + '">Cancel</button>';
      return '<tr><td><strong>' + esc(r.run_number) + '</strong></td><td>' + day(r.pay_date) + '</td><td class="num">' + cash(r.total) + '</td><td>' + esc(r.bills) + ' bills · ' + esc(r.suppliers) + ' suppliers</td>' +
        '<td>' + pill(r.status === 'draft' ? 'Waiting for approval' : r.status === 'approved' ? 'Approved, ready to pay' : 'Paid', r.status === 'paid' ? 'good' : r.status === 'approved' ? 'dark' : 'warn') + '</td><td class="finance-row-actions">' + a + '</td></tr>'; }).join('');
    var runsTable = (s.runs || []).length ? '<table class="finance-table"><thead><tr><th>Run</th><th>Pay date</th><th>Total</th><th>Contents</th><th>Status</th><th></th></tr></thead><tbody>' + runRows + '</tbody></table>' : '<p class="muted">No payment runs yet.</p>';
    return (s.error ? '<div class="pp-result bad">' + esc(s.error) + '</div>' : '') +
      panel('Bills to pay', 'On-account supplier bills that are due, approved and have their invoice copy. Pro-forma suppliers are paid up front, so they never appear here.', dueTable, create) +
      panel('Payment runs', 'Created by one person, approved by another, then paid. Paying records each supplier payment and settles the bills.', runsTable, '<button type="button" class="secondary" data-pp-action="refresh">Refresh</button>');
  }

  // ---------- Xero hand-off (ready, NOT linked) ----------
  var xs = { outbox: null, accounts: null, summary: null, loading: false, error: '', opening: null, openingResult: '' };
  async function loadXero(force){
    if (xs.loading || (!force && xs.outbox)) return;
    xs.loading = true; xs.error = '';
    try {
      xs.summary = await rpc('ps_xero_prepare_all', { w: W() });
      var res = await Promise.all([rpc('ps_xero_outbox_list', { w: W() }), rpc('ps_xero_accounts_list', { w: W() })]);
      xs.outbox = res[0] || []; xs.accounts = res[1] || [];
    } catch (e) { xs.error = friendly(e); }
    xs.loading = false; rerender();
  }
  function xeroPanel(){
    loadXero(false);
    var sum = xs.summary || {}, box = xs.outbox || [];
    var head = '<div class="pp-result ' + (sum.linked ? 'bad' : 'good') + '"><strong>' + (sum.linked ? 'Sending to Xero is ON.' : 'Not linked: nothing is sent to Xero.') + '</strong> ' +
      'Each posted bill and supplier payment is prepared exactly as Xero would receive it and checked for problems, so linking later is a switch, not a project.</div>';
    var rows = box.map(function(o){
      return '<tr><td><strong>' + esc(o.doc_number) + '</strong><br><small>' + esc(o.kind === 'bill' ? 'Supplier bill' : 'Supplier payment') + '</small></td><td>' + esc(o.contact) + '</td><td>' + day(o.doc_date) + '</td>' +
        '<td class="num">' + cash(o.amount) + '</td><td>' + pill(o.state === 'ready' ? 'Ready' : o.state === 'held' ? 'Held' : o.state, o.state === 'ready' ? 'good' : o.state === 'held' ? 'warn' : 'dark') + '</td>' +
        '<td>' + ((o.problems || []).length ? '<small>' + (o.problems || []).map(esc).join('<br>') + '</small>' : '<small class="muted">No problems</small>') + '</td>' +
        '<td><details><summary>What Xero receives</summary><pre class="pp-json">' + esc(JSON.stringify(o.payload, null, 2)) + '</pre></details></td></tr>'; }).join('');
    var outbox = box.length ? '<table class="finance-table"><thead><tr><th>Document</th><th>Supplier</th><th>Date</th><th>Amount</th><th>Status</th><th>To fix before sending</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>'
                            : '<p class="muted">' + (xs.loading ? 'Preparing…' : 'Nothing posted yet.') + '</p>';
    var acc = (xs.accounts || []).map(function(a){
      return '<tr><td><strong>' + esc(a.code) + '</strong> ' + esc(a.name) + '</td><td><input class="pp-code" data-pp-xcode="' + esc(a.code) + '" value="' + esc(a.xero_code || '') + '" maxlength="10" placeholder="Xero code"></td>' +
        '<td>' + (a.xero_confirmed ? pill('Confirmed', 'good') : pill('To confirm', 'warn')) + '</td><td><button type="button" class="secondary small" data-pp-action="confirm-code" data-code="' + esc(a.code) + '">Confirm</button></td></tr>'; }).join('');
    var accounts = '<p class="muted">Suggested codes are Xero\'s UK defaults. Check each against your Xero chart of accounts (Accounting → Chart of accounts) and confirm.</p>' +
      '<table class="finance-table"><thead><tr><th>Pool Shed account</th><th>Xero account code</th><th></th><th></th></tr></thead><tbody>' + acc + '</tbody></table>';
    var op = xs.opening;
    var opening = '<p class="muted">On the day Pool Shed takes over, load the supplier bills still unpaid in Xero (Xero → Reports → Aged Payables Detail → export to CSV). ' +
      'They are recorded in Pool Shed so they can be paid in payment runs, and are <strong>never sent back to Xero</strong>.</p>' +
      '<div class="form-grid three"><label>Balances as at<input type="date" data-pp-opening-date value="' + new Date().toISOString().slice(0, 10) + '"></label>' +
      '<label class="full">CSV file (columns: Supplier, Invoice number, Invoice date, Due date, Amount outstanding)<input type="file" accept=".csv,text/csv" data-pp-opening-file></label></div>' +
      (op ? '<p><strong>' + op.rows.length + ' bills, ' + cash(op.rows.reduce(function(t, r){ return t + Number(r.outstanding_gross || 0); }, 0)) + '</strong>' +
            (op.unknown.length ? ' · <span class="bad">Not matched to a Pool Shed supplier: ' + esc(op.unknown.join(', ')) + '</span>' : '') + '</p>' +
            '<button type="button" class="primary" data-pp-action="load-opening" ' + (op.rows.length ? '' : 'disabled') + '>Load opening balances</button>' : '') +
      (xs.openingResult ? '<div class="pp-result">' + xs.openingResult + '</div>' : '');
    return (xs.error ? '<div class="pp-result bad">' + esc(xs.error) + '</div>' : '') +
      panel('Pool Shed ledger → Xero', 'Ready to link, not linked.', head + outbox, '<button type="button" class="secondary" data-pp-action="xero-prepare">Re-check</button>') +
      panel('Xero account codes', 'Which Xero account each Pool Shed ledger account posts to.', accounts) +
      panel('Opening balances from Xero', 'Only for the go-live day.', opening);
  }
  function parseCsv(text){
    var rows = [], row = [], field = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (ch === '"') q = false; else field += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
      else field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function(r){ return r.some(function(c){ return String(c).trim(); }); });
  }
  function ukDate(v){ var m = String(v || '').trim().match(/^(\d{1,2})[\/ -](\d{1,2}|[A-Za-z]{3})[\/ -](\d{2,4})$/); if (!m) return /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()) ? String(v).trim() : null;
    var mon = isNaN(m[2]) ? ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].toLowerCase()) + 1 : Number(m[2]);
    var y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]); return y + '-' + String(mon).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0'); }
  function readOpening(text){
    var rows = parseCsv(text), header = (rows.shift() || []).map(function(h){ return String(h).toLowerCase(); });
    var col = function(re){ return header.findIndex(function(h){ return re.test(h); }); };
    var cs = col(/contact|supplier/), ci = col(/invoice number|number|reference/), cd = col(/invoice date|^date/), cdu = col(/due/), ca = col(/outstanding|due amount|amount due|balance/);
    var byName = {}; suppliers().forEach(function(x){ byName[String(x.name).trim().toLowerCase()] = supplierKey(x); });
    var out = [], unknown = [];
    rows.forEach(function(r){
      var name = String(r[cs] || '').trim(), amount = Number(String(r[ca] || '').replace(/[£,\s]/g, ''));
      if (!name || !(amount > 0)) return;
      var key = byName[name.toLowerCase()]; if (!key) { if (unknown.indexOf(name) < 0) unknown.push(name); return; }
      out.push({ supplier_key: key, supplier_invoice_no: String(r[ci] || '').trim(), invoice_date: ukDate(r[cd]), due_date: ukDate(r[cdu]), outstanding_gross: Math.round(amount * 100) / 100 });
    });
    return { rows: out, unknown: unknown };
  }
  async function act(fn, done){
    if (state.busy) return; state.busy = true; rerender();
    try { var r = await fn(); if (done) notify(done(r)); await load(true); } catch (e) { notify(friendly(e)); }
    state.busy = false; rerender();
  }
  async function downloadRun(runId, num){
    var lines = await rpc('ps_payment_run_lines', { w: W(), run: runId });
    var csv = [['Supplier', 'Amount', 'Reference', 'Bills paid']].concat((lines || []).map(function(l){ return [l.supplier, Number(l.amount).toFixed(2), num, l.bills]; }))
      .map(function(row){ return row.map(function(v){ return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = num + '-payment-list.csv'; a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  }

  document.addEventListener('submit', function(e){
    var form = e.target.closest && e.target.closest('[data-pp-form="purchase"]'); if (!form) return;
    e.preventDefault(); submitPurchase(form);
  });
  document.addEventListener('change', function(e){
    var t = e.target;
    if (t.matches && t.matches('[data-pp-form="purchase"] select[name="supplier"]')) {
      var opt = t.selectedOptions[0], form = t.form, pro = opt && opt.dataset.basis === 'pro_forma';
      var note = form.querySelector('[data-pp-basis]'); if (note) note.textContent = pro ? 'Pro-forma supplier: paid up front, so record how it was paid.' : 'On account: paid on their terms through a payment run.';
      var box = form.querySelector('input[name="paid"]'); if (box && pro) box.checked = true;
    }
    if (t.matches && t.matches('[data-pp-attach]')) {
      var file = t.files && t.files[0]; if (!file) return;
      act(async function(){ var ref = await uploadCopy(file, t.dataset.ppSupplier, 'supplier_invoice'); return rpc('ps_purchase_attach', { w: W(), doc_id: t.dataset.ppAttach, p_ref: ref }); },
          function(){ return 'Invoice copy attached.'; });
    }
    if (t.matches && t.matches('[data-pp-opening-file]')) {
      var of = t.files && t.files[0]; if (!of) return;
      of.text().then(function(text){ xs.opening = readOpening(text); xs.openingResult = ''; rerender(); });
    }
    if (t.matches && t.matches('[data-pp-select]')) { state.selected[t.dataset.ppSelect] = t.checked; rerender(); }
    if (t.matches && t.matches('[data-pp-dueby]')) { state.dueBy = t.value || isoDays(7); state.purchases = null; load(true); }
  });
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-pp-action]'); if (!b) return;
    var a = b.dataset.ppAction;
    if (a === 'refresh') return load(true);
    if (a === 'vat20') { var f = b.closest('form'), net = Number(f.net.value || 0); f.vat.value = (Math.round(net * 20) / 100).toFixed(2); return; }
    if (a === 'open-copy') return openCopy(b.dataset.ref).catch(function(err){ notify(friendly(err)); });
    if (a === 'approve') return act(function(){ return rpc('ps_purchase_approve', { w: W(), doc_id: b.dataset.doc, approve: true, reason: null }); }, function(){ return 'Purchase approved.'; });
    if (a === 'reject') { var why = prompt('Why is this purchase rejected?'); if (!why) return; return act(function(){ return rpc('ps_purchase_approve', { w: W(), doc_id: b.dataset.doc, approve: false, reason: why }); }, function(){ return 'Purchase rejected.'; }); }
    if (a === 'create-run') {
      var ids = (state.candidates || []).filter(function(x){ return x.ready && state.selected[x.document_id] !== false; }).map(function(x){ return x.document_id; });
      return act(function(){ return rpc('ps_payment_run_create', { w: W(), pay_date: new Date().toISOString().slice(0, 10), document_ids: ids, method: 'bank_transfer' }); },
                 function(r){ return 'Payment run ' + r.run_number + ' created. A different person must approve it.'; });
    }
    if (a === 'approve-run') return act(function(){ return rpc('ps_payment_run_approve', { w: W(), run: b.dataset.run }); }, function(){ return 'Payment run approved.'; });
    if (a === 'pay-run') { if (!confirm('Mark this payment run as paid? Only do this once the bank payments have been made.')) return;
      return act(function(){ return rpc('ps_payment_run_pay', { w: W(), run: b.dataset.run, paid_date: new Date().toISOString().slice(0, 10) }); }, function(r){ return 'Paid: ' + r.supplier_payments + ' supplier payment(s) recorded.'; }); }
    if (a === 'cancel-run') { if (!confirm('Cancel this payment run? Its bills go back to the list.')) return;
      return act(function(){ return rpc('ps_payment_run_cancel', { w: W(), run: b.dataset.run }); }, function(){ return 'Payment run cancelled.'; }); }
    if (a === 'xero-prepare') return loadXero(true);
    if (a === 'confirm-code') { var input = document.querySelector('[data-pp-xcode="' + b.dataset.code + '"]');
      return act(function(){ return rpc('ps_xero_account_confirm', { w: W(), ledger_code: b.dataset.code, xero_code: input ? input.value : '' }); }, function(r){ return 'Account ' + r.code + ' → Xero ' + r.xero_code + ' confirmed.'; }).then(function(){ return loadXero(true); }); }
    if (a === 'load-opening') { var dt = document.querySelector('[data-pp-opening-date]');
      if (!confirm('Load ' + xs.opening.rows.length + ' opening supplier bills as at ' + (dt && dt.value) + '? They cannot be edited afterwards, only reversed.')) return;
      return act(function(){ return rpc('ps_opening_supplier_bills', { w: W(), as_of: dt && dt.value, rows: xs.opening.rows }); },
        function(r){ xs.openingResult = 'Loaded ' + r.loaded + ' bills (' + cash(r.total) + ').' + (r.problems && r.problems.length ? ' Not loaded: ' + esc(r.problems.join('; ')) : ''); xs.opening = null; return 'Opening balances loaded.'; }).then(function(){ return loadXero(true); }); }
    if (a === 'run-csv') return downloadRun(b.dataset.run, b.dataset.num).catch(function(err){ notify(friendly(err)); });
  });

  global.PoolShedPurchasesUI = { recordPage: recordPage, runsPage: runsPage, xeroPanel: xeroPanel, _readOpening: readOpening, _parseCsv: parseCsv, reload: function(){ return load(true); }, _state: state, _supplierKey: supplierKey };
})(typeof window !== 'undefined' ? window : globalThis);
