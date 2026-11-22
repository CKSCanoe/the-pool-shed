/* Pool Shed v1.70.0 — van stock (blueprint step 4, Team & Vans).
   Engineers: "My van stock" with a quick count on the phone (only differences need a touch). The count goes to the office.
   Office (Admin, Management): every van's stock, value and shortfalls; set up van stock (a stock location per van);
   apply or discard submitted counts (applying adjusts stock and logs a movement); minimums from the van supplies list;
   one top-up list across all vans that creates warehouse-to-van transfers. Engineers never see costs. */
(function(global){
  'use strict';
  var UI = global.PoolShedFleetUI; if (!UI) return;
  var W = function(){ return typeof global.__POOL_SHED_WORKSPACE_ID__ === 'function' ? global.__POOL_SHED_WORKSPACE_ID__() : 'pool-bros-main'; };
  var DB = function(){ return typeof global.__POOL_SHED_DB__ === 'function' ? global.__POOL_SHED_DB__() : null; };
  var DATA = function(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? (global.__POOL_SHED_GET_DATA__() || {}) : {}; };
  var INV = function(){ return global.PoolShedInventoryControl || null; };
  var me = function(){ return typeof global.__POOL_SHED_CURRENT_USER__ === 'function' ? (global.__POOL_SHED_CURRENT_USER__() || {}) : {}; };
  var isManager = function(){ return ['Admin', 'Management', 'Manager'].indexOf(String(me().role || '')) >= 0; };
  var v = { mine: {}, counting: null, counts: null, loading: false, busy: false, msg: null, topups: null };
  function esc(x){ return String(x == null ? '' : x).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function cash(n){ return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Number(n || 0)); }
  function day(x){ return x ? new Date(x).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'; }
  function rerender(){ try { if (typeof global.render === 'function') global.render(); } catch (_) {} }
  function notify(m){ try { if (typeof global.toast === 'function') global.toast(m); } catch (_) {} }
  function friendly(e){ return String(e && (e.message || e.error) || e || 'Something went wrong').replace(/^.*?ERROR:\s*/, ''); }
  function save(){ try { if (typeof global.__POOL_SHED_SAVE_APP_DATA__ === 'function') return global.__POOL_SHED_SAVE_APP_DATA__(); } catch (_) {} }
  async function rpc(name, args){ var db = DB(); if (!db) throw new Error('Not connected. Sign in again.'); var r = await db.rpc(name, args); if (r.error) throw r.error; return r.data; }
  function panel(title, help, body, actions){ return '<section class="finance-panel vs-panel"><header class="finance-panel-head"><div><h3>' + esc(title) + '</h3><p>' + esc(help || '') + '</p></div>' + (actions ? '<div class="finance-row-actions">' + actions + '</div>' : '') + '</header>' + body + '</section>'; }
  function msg(){ return v.msg ? '<div class="pp-result ' + (v.msg.ok ? 'good' : 'bad') + '">' + esc(v.msg.text) + '</div>' : ''; }

  // ---------- Engineer: my van stock and the count ----------
  function loadMine(van){
    if (v.mine[van.id] && !v.mine[van.id].stale) return;
    v.mine[van.id] = { loading: true };
    rpc('ps_van_stock', { w: W(), van: van.id }).then(function(r){ v.mine[van.id] = r || { items: [] }; rerender(); })
      .catch(function(e){ v.mine[van.id] = { error: friendly(e), items: [] }; rerender(); });
  }
  function myVanStock(van){
    loadMine(van);
    var st = v.mine[van.id] || {};
    if (st.loading) return panel('My van stock', '', '<p class="muted">Loading…</p>');
    if (st.error) return panel('My van stock', '', '<p class="pp-result bad">' + esc(st.error) + '</p>');
    if (!st.location_id) return panel('My van stock', '', '<p class="muted">Your van’s stock is not set up yet. The office sets this up.</p>');
    var items = st.items || [], short = items.filter(function(i){ return i.min != null && Number(i.expected) < Number(i.min); });
    var last = st.last_count;
    var lastText = last ? (last.status === 'submitted' ? 'Your count from ' + day(last.counted_at) + ' is waiting for the office.' : 'Last count ' + day(last.counted_at) + (last.status === 'applied' ? ', applied.' : ', discarded by the office.')) : 'Not counted yet.';
    if (v.counting === van.id) return countForm(van, items);
    var rows = items.map(function(i){ var low = i.min != null && Number(i.expected) < Number(i.min);
      return '<tr' + (low ? ' class="vs-low"' : '') + '><td><b>' + esc(i.name) + '</b><br><small>' + esc(i.sku || '') + '</small></td><td class="num">' + esc(i.expected) + '</td><td class="num">' + (i.min == null ? '—' : esc(i.min)) + '</td></tr>'; }).join('');
    return panel('My van stock', items.length + ' items' + (short.length ? ' · ' + short.length + ' below minimum' : '') + ' · ' + lastText,
      items.length ? '<div class="scroll"><table class="finance-table vs-table"><thead><tr><th>Item</th><th class="num">On van</th><th class="num">Minimum</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="muted">Nothing is recorded on your van yet. Count it to start.</p>',
      (last && last.status === 'submitted') ? '' : '<button type="button" class="primary" data-vs="count" data-van="' + esc(van.id) + '">Count my van</button>');
  }
  function countForm(van, items){
    var rows = items.map(function(i, n){ return '<li><span><b>' + esc(i.name) + '</b><small>' + esc(i.sku || '') + ' · expected ' + esc(i.expected) + '</small></span>' +
      '<span class="vs-step"><button type="button" data-vs-step="-1" data-i="' + n + '" aria-label="One less">−</button><input inputmode="numeric" pattern="[0-9]*" data-vs-qty="' + n + '" data-pid="' + esc(i.product_id) + '" value="' + esc(i.expected) + '" aria-label="Count of ' + esc(i.name) + '"><button type="button" data-vs-step="1" data-i="' + n + '" aria-label="One more">+</button></span></li>'; }).join('');
    return panel('Count ' + (van.registration || 'my van'), 'Each line starts at what should be on the van. Only change what is different, then send it to the office.',
      '<ul class="vs-count">' + rows + '</ul><label class="vs-note">Note (optional)<input data-vs-note maxlength="300" placeholder="e.g. 2 used on the Riverside job"></label>' +
      '<div class="finance-row-actions"><button type="button" class="primary" data-vs="submit" data-van="' + esc(van.id) + '"' + (v.busy ? ' disabled' : '') + '>' + (v.busy ? 'Sending…' : 'Send count to the office') + '</button><button type="button" class="secondary" data-vs="cancel">Cancel</button></div>');
  }

  // ---------- Office: all vans ----------
  function loadCounts(force){
    if (v.loading || (!force && v.counts)) return; v.loading = true;
    rpc('ps_van_counts_list', { w: W() }).then(function(r){ v.counts = r || []; v.loading = false; rerender(); })
      .catch(function(e){ v.counts = []; v.loading = false; v.msg = { ok: false, text: friendly(e) }; rerender(); });
  }
  function vanRows(vans){
    var inv = INV(), counts = v.counts || [];
    return vans.map(function(van){
      if (!van.location_id) return '<tr><td><b>' + esc(van.registration) + '</b></td><td>' + esc(van.assigned_name || '—') + '</td><td colspan="4" class="muted">Stock not set up</td><td class="finance-row-actions"><button type="button" class="primary small" data-vs="setup" data-van="' + esc(van.id) + '">Set up van stock</button></td></tr>';
      var sum = inv ? inv.locationSummary(van.location_id) : null, ready = inv ? inv.vanReadiness(van.location_id) : null;
      var last = counts.filter(function(c){ return c.van_id === van.id; })[0];
      var waiting = last && last.status === 'submitted';
      return '<tr><td><b>' + esc(van.registration) + '</b></td><td>' + esc(van.assigned_name || '—') + '</td>' +
        '<td class="num">' + (sum ? esc(sum.onHand) : '—') + '</td><td class="num">' + (sum ? cash(sum.stockValue) : '—') + '</td>' +
        '<td>' + (ready && ready.belowMin ? '<span class="finance-pill bad">' + ready.belowMin + ' short</span>' : ready && ready.totalCore ? '<span class="finance-pill good">Full</span>' : '<span class="muted">No minimums</span>') + '</td>' +
        '<td>' + (waiting ? '<span class="finance-pill warn">Count waiting</span>' : last ? day(last.counted_at) : '<span class="muted">Never</span>') + '</td>' +
        '<td class="finance-row-actions"><button type="button" class="secondary small" data-vs="kit-min" data-van="' + esc(van.id) + '">Minimums from supplies list</button><button type="button" class="secondary small" data-vs="inventory" data-loc="' + esc(van.location_id) + '">Open in Inventory</button></td></tr>';
    }).join('');
  }
  function countsPanel(){
    var waiting = (v.counts || []).filter(function(c){ return c.status === 'submitted'; });
    if (!waiting.length) return '';
    return panel('Van counts to check', 'Engineers’ counts change nothing until applied here. Applying adjusts the van’s stock and logs each difference.',
      waiting.map(function(c){ var diffs = (c.lines || []).filter(function(l){ return Number(l.counted) !== Number(l.expected); });
        return '<div class="vs-countcard"><p><b>' + esc(c.registration) + '</b> counted by ' + esc(c.engineer || 'someone') + ' on ' + day(c.counted_at) + (c.note ? ' · “' + esc(c.note) + '”' : '') + '</p>' +
          (diffs.length ? '<div class="scroll"><table class="finance-table vs-table"><thead><tr><th>Item</th><th class="num">Expected</th><th class="num">Counted</th><th class="num">Difference</th></tr></thead><tbody>' +
            diffs.map(function(l){ var d = Number(l.counted) - Number(l.expected); return '<tr><td>' + esc(l.name) + '</td><td class="num">' + esc(l.expected) + '</td><td class="num">' + esc(l.counted) + '</td><td class="num ' + (d < 0 ? 'vs-down' : 'vs-up') + '">' + (d > 0 ? '+' : '') + d + '</td></tr>'; }).join('') + '</tbody></table></div>'
            : '<p class="muted">Everything matched (' + (c.lines || []).length + ' items).</p>') +
          '<div class="finance-row-actions"><button type="button" class="primary small" data-vs="apply" data-id="' + esc(c.id) + '"' + (v.busy ? ' disabled' : '') + '>Apply count</button><button type="button" class="secondary small" data-vs="discard" data-id="' + esc(c.id) + '">Discard</button></div></div>'; }).join(''));
  }
  function topupPanel(vans){
    var inv = INV(); if (!inv) return '';
    var rows = [];
    vans.filter(function(x){ return x.location_id; }).forEach(function(van){ inv.locationRows(van.location_id).filter(function(r){ return r.belowMin && r.suggestedTopUp > 0; })
      .forEach(function(r){ rows.push({ van: van, r: r }); }); });
    if (!rows.length) return '';
    return panel('Van top-ups', 'Items below their minimum on each van, with what the warehouse can send.',
      '<div class="scroll"><table class="finance-table vs-table"><thead><tr><th>Van</th><th>Item</th><th class="num">On van</th><th class="num">Minimum</th><th class="num">Top up</th><th class="num">Warehouse free</th></tr></thead><tbody>' +
      rows.map(function(x){ return '<tr><td>' + esc(x.van.registration) + '</td><td>' + esc(x.r.name) + '<br><small>' + esc(x.r.sku) + '</small></td><td class="num">' + esc(x.r.available) + '</td><td class="num">' + esc(x.r.min) + '</td><td class="num"><b>' + esc(x.r.suggestedTopUp) + '</b></td><td class="num' + (x.r.warehouseAvailable < x.r.suggestedTopUp ? ' vs-down' : '') + '">' + esc(x.r.warehouseAvailable) + '</td></tr>'; }).join('') +
      '</tbody></table></div>', '<button type="button" class="primary" data-vs="topup"' + (v.busy ? ' disabled' : '') + '>Create top-up transfers</button>');
  }
  function officeView(vans){
    loadCounts(false);
    return msg() + countsPanel() + panel('Van stock', 'Each van is its own stock location. Value is at cost; engineers see quantities only.',
      vans.length ? '<div class="scroll"><table class="finance-table vs-table"><thead><tr><th>Van</th><th>Engineer</th><th class="num">Items</th><th class="num">Value</th><th>Minimums</th><th>Last count</th><th></th></tr></thead><tbody>' + vanRows(vans) + '</tbody></table></div>' : '<p class="muted">Add a van first.</p>',
      '<button type="button" class="secondary" data-vs="refresh">Refresh</button>') + topupPanel(vans);
  }

  // ---------- Actions ----------
  function vanById(id){ return (UI._state.vans || []).filter(function(x){ return x.id === id; })[0]; }
  function setupVan(van){
    var d = DATA(); if (!Array.isArray(d.locations)) d.locations = [];
    var id = 'L-VAN-' + String(van.registration || van.id).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!d.locations.some(function(l){ return l.id === id; })) d.locations.push({ id: id, name: 'Van ' + van.registration, type: 'Engineer Van', owner: van.assigned_name || '', barcode: id, parentId: '', isMaster: false, countCadenceDays: 7 });
    save();
    return rpc('ps_fleet_van_link_location', { w: W(), van: van.id, loc: id }).then(function(){ van.location_id = id; return id; });
  }
  function stockRow(d, pid, loc){ if (!Array.isArray(d.stock)) d.stock = []; var r = d.stock.filter(function(x){ return x.productId === pid && x.locationId === loc; })[0];
    if (!r) { r = { productId: pid, locationId: loc, qty: 0, allocated: 0 }; d.stock.push(r); } return r; }
  function applyCount(c){
    var d = DATA(), who = me().name || 'Office';
    (c.lines || []).forEach(function(l){ var diff = Number(l.counted) - Number(l.expected); if (!diff) return;
      var row = stockRow(d, l.product_id, c.location_id); row.qty = Math.max(0, Number(row.qty || 0) + diff);
      if (typeof global.addMovement === 'function') global.addMovement(diff < 0 ? 'Van Count Down' : 'Van Count Up', l.product_id, Math.abs(diff), diff < 0 ? c.location_id : '', diff > 0 ? c.location_id : '', 'Van count ' + String(c.id).slice(0, 8), who, 'Van count by ' + (c.engineer || 'engineer') + (c.note ? ': ' + c.note : ''));
    });
    if (!Array.isArray(d.stockTakes)) d.stockTakes = [];
    d.stockTakes.push({ id: 'ST-' + Date.now().toString(36), locationId: c.location_id, lastCounted: new Date().toISOString(), countedBy: c.engineer || '', appliedBy: who, source: 'van count' });
    save();
  }
  function kitMinimums(van){
    return rpc('ps_fleet_van_kit', { w: W(), van: van.id }).then(function(kit){
      var d = DATA(); if (!Array.isArray(d.restockRules)) d.restockRules = []; var n = 0;
      (kit || []).filter(function(k){ return k.product_id && Number(k.target_qty) > 0; }).forEach(function(k){
        var rule = d.restockRules.filter(function(r){ return r.productId === k.product_id && r.locationId === van.location_id; })[0];
        if (!rule) { rule = { productId: k.product_id, locationId: van.location_id, priority: 'Normal' }; d.restockRules.push(rule); }
        rule.min = Number(k.target_qty); rule.restockTo = Number(k.target_qty); rule.max = Math.max(Number(rule.max || 0), Number(k.target_qty)); n++; });
      save(); return n;
    });
  }
  async function run(fn){ if (v.busy) return; v.busy = true; v.msg = null; rerender();
    try { await fn(); } catch (e) { v.msg = { ok: false, text: friendly(e) }; } v.busy = false; rerender(); }

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function(e){
      var t = e.target && e.target.closest ? e.target : null; if (!t) return;
      var step = t.closest('[data-vs-step]');
      if (step) { var inp = document.querySelector('[data-vs-qty="' + step.dataset.i + '"]'); if (inp) inp.value = Math.max(0, (parseInt(inp.value, 10) || 0) + Number(step.dataset.vsStep)); return; }
      var b = t.closest('[data-vs]'); if (!b) return; var a = b.dataset.vs, van = vanById(b.dataset.van);
      if (a === 'count') { v.counting = b.dataset.van; rerender(); return; }
      if (a === 'cancel') { v.counting = null; rerender(); return; }
      if (a === 'refresh') { v.counts = null; v.msg = null; rerender(); return; }
      if (a === 'inventory') { if (typeof global.__POOL_SHED_OPEN_SUBPAGE__ === 'function') global.__POOL_SHED_OPEN_SUBPAGE__('locations', 'Locations'); return; }
      if (a === 'submit' && van) { var lines = [].map.call(document.querySelectorAll('[data-vs-qty]'), function(i){ return { product_id: i.dataset.pid, counted: parseInt(i.value, 10) }; });
        if (lines.some(function(l){ return !(l.counted >= 0); })) return notify('Enter a whole number for every item.');
        var note = (document.querySelector('[data-vs-note]') || {}).value || '';
        run(async function(){ var r = await rpc('ps_van_count_submit', { w: W(), van: van.id, lines: lines, note: note }); v.counting = null; v.mine[van.id] = null;
          notify('Count sent to the office' + (r.differences ? ' (' + r.differences + ' difference' + (r.differences === 1 ? '' : 's') + ')' : ', everything matched') + '.'); }); return; }
      if (a === 'setup' && van) { run(async function(){ var id = await setupVan(van); v.msg = { ok: true, text: van.registration + ' now has its own stock location (' + id + '). Set minimums from the supplies list, then count the van.' }; }); return; }
      if (a === 'kit-min' && van) { run(async function(){ var n = await kitMinimums(van); v.msg = { ok: n > 0, text: n ? n + ' minimums set for ' + van.registration + ' from its supplies list.' : 'The supplies list for ' + van.registration + ' has no catalogue products yet. Link supplies to products in the van’s details first.' }; }); return; }
      if (a === 'apply' || a === 'discard') { var c = (v.counts || []).filter(function(x){ return x.id === b.dataset.id; })[0]; if (!c) return;
        run(async function(){ if (a === 'apply') { await rpc('ps_van_count_decide', { w: W(), count_id: c.id, apply: true, reason: null }); applyCount(c); v.msg = { ok: true, text: 'Count applied to ' + c.registration + '.' }; }
          else { await rpc('ps_van_count_decide', { w: W(), count_id: c.id, apply: false, reason: null }); v.msg = { ok: true, text: 'Count for ' + c.registration + ' discarded; stock unchanged.' }; }
          v.counts = null; }); return; }
      if (a === 'topup') { run(async function(){ var inv = INV(), made = 0, failed = [];
          (UI._state.vans || []).filter(function(x){ return x.location_id; }).forEach(function(vv){ inv.locationRows(vv.location_id).filter(function(r){ return r.belowMin && r.suggestedTopUp > 0; }).forEach(function(r){
            var res = inv.createTopUpTransfer(vv.location_id, r.productId, Math.min(r.suggestedTopUp, r.warehouseAvailable));
            if (res && res.ok) made++; else failed.push(vv.registration + ' ' + (r.sku || r.name) + (res && res.reason ? ': ' + res.reason : '')); }); });
          save(); v.msg = { ok: !failed.length, text: made + ' top-up transfer' + (made === 1 ? '' : 's') + ' created.' + (failed.length ? ' Not possible: ' + failed.join('; ') : '') }; }); return; }
    });
  }

  // Add to the Vans & Fleet page (list view only); everything already there stays.
  var previous = UI.render;
  UI.render = function(){
    var html = previous.apply(this, arguments), s = UI._state || {};
    if (s.view && s.view !== 'list') return html;
    try {
      var vans = s.vans || [];
      if (isManager()) html += officeView(vans);
      else vans.forEach(function(van){ html += myVanStock(van); });
    } catch (e) { console.warn('Van stock skipped', e); }
    return html;
  };
  if (typeof document !== 'undefined' && document.head && !document.getElementById('vs-styles')) {
    var st = document.createElement('style'); st.id = 'vs-styles';
    st.textContent = '.vs-panel{margin-top:16px}.vs-low td{background:rgba(185,71,79,.06)}.vs-down{color:#b9474f;font-weight:700}.vs-up{color:#1d7a4c;font-weight:700}' +
      '.vs-count{list-style:none;margin:0;padding:0}.vs-count li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.08)}.vs-count li small{display:block;opacity:.7;font-size:13px}' +
      '.vs-step{display:inline-flex;align-items:center;gap:4px}.vs-step button{width:44px;height:44px;font-size:22px;border-radius:10px;border:1px solid rgba(15,76,87,.3);background:transparent;cursor:pointer;color:inherit}.vs-step input{width:64px;height:44px;text-align:center;font-size:18px;border-radius:10px;border:1px solid rgba(15,76,87,.3)}' +
      '.vs-note{display:block;margin:12px 0;font-size:14px}.vs-note input{display:block;width:100%;margin-top:4px;height:40px}.vs-countcard{border:1px solid rgba(15,76,87,.15);border-radius:12px;padding:10px 12px;margin-bottom:10px}';
    document.head.appendChild(st);
  }
  global.PoolShedVanStock = { state: v, applyCount: applyCount };
})(typeof window !== 'undefined' ? window : globalThis);
