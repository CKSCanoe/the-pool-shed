/* Pool Shed v1.83.0 — Accounts home and grouped menu (blueprint step 5).
   Accounts opens on what needs doing, from the Pool Shed ledger, in three groups (money in, money out, the books);
   each figure opens the page to act on. The long strip of 18 tabs becomes the same three groups. Every page is kept. */
(function(global){
  'use strict';
  var GROUPS = [
    ['Money in', ['Invoice Ready', 'Customer Invoices', 'Payments & Allocations', 'Credit Control', 'Credits & Returns', 'Customer Accounts']],
    ['Money out', ['Record a Purchase', 'Supplier Bills', 'Payment Runs', 'Payables', 'Supplier Accounts', 'Three-Way Match']],
    ['The books', ['Xero Sync', 'Reconciliation', 'Month End', 'Order Profit', 'Reports']]
  ];
  var W = function(){ return typeof global.__POOL_SHED_WORKSPACE_ID__ === 'function' ? global.__POOL_SHED_WORKSPACE_ID__() : 'pool-bros-main'; };
  var DB = function(){ return typeof global.__POOL_SHED_DB__ === 'function' ? global.__POOL_SHED_DB__() : null; };
  var h = { data: null, loading: false, at: 0 };
  function esc(x){ return String(x == null ? '' : x).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function cash(n){ return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Number(n || 0)); }
  function sum(a, k){ return a.reduce(function(t, x){ return t + Number(x[k] || 0); }, 0); }

  function nav(current, pages){
    var placed = {};
    var html = '<div class="ah-nav"><button type="button" class="ah-home' + (current === 'Overview' ? ' active' : '') + '" data-fc-page="Overview">Accounts home</button>';
    GROUPS.forEach(function(g){
      var own = g[1].filter(function(x){ return pages.indexOf(x) >= 0; }); own.forEach(function(x){ placed[x] = true; });
      if (!own.length) return;
      html += '<div class="ah-group' + (own.indexOf(current) >= 0 ? ' open' : '') + '"><span>' + esc(g[0]) + '</span><div>' + own.map(function(x){ return '<button type="button" class="' + (x === current ? 'active' : '') + '" data-fc-page="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div></div>';
    });
    var extra = pages.filter(function(x){ return x !== 'Overview' && !placed[x]; });
    if (extra.length) html += '<div class="ah-group"><span>More</span><div>' + extra.map(function(x){ return '<button type="button" class="' + (x === current ? 'active' : '') + '" data-fc-page="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div></div>';
    return html + '</div>';
  }

  function load(force){
    if (h.loading || (!force && h.data && Date.now() - h.at < 60000)) return;
    var db = DB(); if (!db) return; h.loading = true;
    var w = W(), soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), call = function(n, a){ return db.rpc(n, a).then(function(r){ return r.error ? null : r.data; }, function(){ return null; }); };
    Promise.all([call('ps_invoicing_queue', { w: w }), call('ps_sales_documents_list', { w: w, max_rows: 500 }), call('ps_purchase_list', { w: w, max_rows: 300 }),
                 call('ps_payment_candidates', { w: w, up_to: soon }), call('ps_payment_runs_list', { w: w }), call('ps_xero_outbox_list', { w: w }), call('ps_ledger_trial_balance', { w: w })])
      .then(function(r){ h.data = { queue: r[0], docs: r[1], purchases: r[2], bills: r[3], runs: r[4], outbox: r[5], tb: r[6] }; h.loading = false; h.at = Date.now(); paint(); });
  }
  function tile(n, label, sub, page, tone){ return '<button type="button" class="ah-tile' + (tone ? ' ' + tone : '') + (n ? '' : ' clear') + '" data-fc-page="' + esc(page) + '"><b>' + esc(n) + '</b><span>' + esc(label) + '</span><small>' + esc(sub || '') + '</small></button>'; }
  function homeBody(){
    var d = h.data; if (!d) return '<p class="muted">Loading what needs doing…</p>';
    var ready = ((d.queue || {}).orders || []).filter(function(o){ return o.state === 'ready'; });
    var inv = (d.docs || []).filter(function(x){ return x.doc_type === 'sales_invoice'; }), unpaid = inv.filter(function(x){ return Number(x.open) > 0; }), late = inv.filter(function(x){ return x.state === 'overdue'; });
    var unused = (d.docs || []).filter(function(x){ return x.doc_type !== 'sales_invoice' && Number(x.open) > 0; });
    var p = d.purchases || [], waiting = p.filter(function(x){ return x.state === 'Waiting for approval'; }), noCopy = p.filter(function(x){ return x.state === 'Invoice copy missing'; });
    var due = (d.bills || []).filter(function(b){ return b.ready; }), held = (d.bills || []).filter(function(b){ return !b.ready; });
    var runs = d.runs || [], toApprove = runs.filter(function(r){ return r.status === 'draft'; }), toPay = runs.filter(function(r){ return r.status === 'approved'; });
    var out = d.outbox || [], xHeld = out.filter(function(x){ return x.state === 'held'; }), xReady = out.filter(function(x){ return x.state === 'ready'; });
    var tb = d.tb || [], diff = Math.round((sum(tb, 'debit') - sum(tb, 'credit')) * 100) / 100;
    return '<div class="ah-cols">' +
      '<section><h4>Money in</h4>' + tile(ready.length, 'ready to invoice', cash(sum(ready, 'remaining_gross')), 'Invoice Ready', ready.length ? 'hot' : '') +
        tile(unpaid.length, 'unpaid invoices', cash(sum(unpaid, 'open')), 'Customer Invoices') + tile(late.length, 'overdue', cash(sum(late, 'open')), 'Credit Control', late.length ? 'bad' : '') +
        tile(unused.length, 'payments or credits on account', cash(sum(unused, 'open')), 'Payments & Allocations') + '</section>' +
      '<section><h4>Money out</h4>' + tile(waiting.length, 'purchases to approve', cash(sum(waiting, 'gross')), 'Record a Purchase', waiting.length ? 'hot' : '') +
        tile(noCopy.length, 'bills missing their copy', 'cannot be paid until attached', 'Record a Purchase', noCopy.length ? 'warn' : '') +
        tile(due.length, 'bills ready to pay this week', cash(sum(due, 'outstanding')) + (held.length ? ' · ' + held.length + ' held' : ''), 'Payment Runs') +
        tile(toApprove.length + toPay.length, 'payment runs to approve or pay', toApprove.length + ' to approve, ' + toPay.length + ' to pay', 'Payment Runs', toApprove.length + toPay.length ? 'hot' : '') + '</section>' +
      '<section><h4>The books</h4>' + tile(diff === 0 ? 'Balanced' : cash(diff), 'ledger check', diff === 0 ? 'debits equal credits' : 'difference: report this', 'Reports', diff === 0 ? 'good' : 'bad') +
        tile(xReady.length + xHeld.length, 'documents for Xero', 'Xero not linked yet · ' + xHeld.length + ' need attention', 'Xero Sync') +
        tile(inv.length, 'invoices in the ledger', 'since the ledger started', 'Customer Invoices') + '</section></div>';
  }
  function home(){ load(false); return '<section class="finance-panel ah-home-panel"><header class="finance-panel-head"><div><h3>What needs doing</h3><p>From the Pool Shed ledger. Click a figure to open the page.</p></div><div class="finance-row-actions"><button type="button" class="secondary" data-ah-refresh>Refresh</button></div></header><div id="ah-box">' + homeBody() + '</div></section>'; }
  function paint(){ if (typeof document === 'undefined') return; var b = document.getElementById('ah-box'); if (b) b.innerHTML = homeBody(); }
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', function(e){ if (e.target && e.target.closest && e.target.closest('[data-ah-refresh]')) { load(true); } });
  if (typeof document !== 'undefined' && document.head && !document.getElementById('ah-styles')) {
    var st = document.createElement('style'); st.id = 'ah-styles';
    st.textContent = '.ah-nav{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:flex-start;margin:6px 0 14px}.ah-nav button{border:1px solid rgba(15,76,87,.18);background:transparent;border-radius:999px;padding:6px 12px;font-size:13.5px;cursor:pointer;color:inherit;min-height:34px}' +
      '.ah-nav button.active{background:#0f4c57;color:#fff;border-color:#0f4c57}.ah-home{font-weight:700}.ah-group{display:flex;flex-direction:column;gap:4px}.ah-group>span{font-size:12px;font-weight:700;opacity:.7}.ah-group>div{display:flex;flex-wrap:wrap;gap:6px}' +
      '.ah-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}.ah-cols h4{margin:0 0 8px}.ah-tile{display:flex;flex-direction:column;align-items:flex-start;width:100%;text-align:left;border:1px solid rgba(15,76,87,.16);border-radius:12px;padding:10px 12px;margin-bottom:8px;background:rgba(15,76,87,.03);cursor:pointer;color:inherit}' +
      '.ah-tile b{font-size:22px;line-height:1.15;color:#0f4c57}.ah-tile span{font-weight:700}.ah-tile small{opacity:.75}.ah-tile.hot b{color:#d8432c}.ah-tile.bad b{color:#b9474f}.ah-tile.warn b{color:#a86200}.ah-tile.good b{color:#1d7a4c}.ah-tile.clear{opacity:.65}' +
      '.fc-old{margin-top:18px}.fc-old>summary{cursor:pointer;font-weight:600;opacity:.8}';
    document.head.appendChild(st);
  }
  global.PoolShedAccountsHome = { nav: nav, home: home, GROUPS: GROUPS, _state: h, _body: homeBody };
})(typeof window !== 'undefined' ? window : globalThis);
