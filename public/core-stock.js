/* Pool Shed v1.63.0 — Core stock (blueprint step 6).
   Pool Bros buys most things to order and keeps a smaller range on the shelf. This page is where that range is chosen:
   for each product, "keep in stock" with a reorder point and an order-up-to level, singly or in bulk, with suggested
   levels from what has actually sold. Only kept lines appear on the reorder list (Product Hub → Replenishment), which
   already groups by supplier, allows for stock on order and orders waiting, and makes the draft purchase orders.
   Nothing about a product changes unless someone chooses it here. */
(function(global){
  'use strict';
  var DATA = function(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? (global.__POOL_SHED_GET_DATA__() || {}) : {}; };
  var HUB = function(){ return global.PoolShedProductHub || null; };
  var st = { type: '', supplier: '', q: '', show: 'all', selected: {}, msg: null, page: 0 };
  var PAGE = 100, NOT_STOCK = /service|non-stock|shipping charge|custom charge|custom purchase/i;
  function esc(x){ return String(x == null ? '' : x).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function cash(n){ return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Number(n || 0)); }
  function num(v){ var n = Number(v); return isFinite(n) ? n : 0; }
  function rerender(){ try { if (typeof global.render === 'function') global.render(); } catch (_) {} }
  function save(){ try { if (typeof global.__POOL_SHED_SAVE_APP_DATA__ === 'function') global.__POOL_SHED_SAVE_APP_DATA__(); } catch (_) {} }
  function kept(p){ return p.replenishmentEnabled === true || p.replenishmentEnabled === 'true' || (p.replenishmentEnabled == null && num(p.reorderPoint != null ? p.reorderPoint : p.reorder) > 0); }
  function stockable(p){ return p && !p.deleted && !NOT_STOCK.test(String(p.productType || p.type || '')) && !(HUB() && HUB().isBundle && HUB().isBundle(p)); }

  // Units sold per product in the last 90 and 365 days, from sales orders (cached for a minute).
  var salesCache = { at: 0, map: {} };
  function sales(){
    if (Date.now() - salesCache.at < 60000) return salesCache.map;
    var now = Date.now(), map = {};
    (DATA().salesOrders || []).forEach(function(o){
      var t = Date.parse(o.created || o.date || ''); if (!isFinite(t)) return; var age = (now - t) / 86400000; if (age > 365) return;
      (o.lines || []).forEach(function(l){ if (!l.productId || l.lineType) return; var m = map[l.productId] = map[l.productId] || { d90: 0, d365: 0 };
        m.d365 += num(l.qty); if (age <= 90) m.d90 += num(l.qty); });
    });
    salesCache = { at: now, map: map }; return map;
  }
  // Suggested levels: reorder when two weeks' cover remains; order up to six weeks' cover. With no sales, 1 and 2.
  function suggest(p){
    var s = sales()[p.id] || { d90: 0, d365: 0 }, daily = s.d90 ? s.d90 / 90 : s.d365 / 365;
    var reorder = Math.max(1, Math.ceil(daily * 14)), upTo = Math.max(reorder + 1, Math.ceil(daily * 42));
    var offer = HUB() && HUB().supplierOffer ? (HUB().supplierOffer(p) || {}) : {}, pack = Math.max(1, num(p.orderMultiple || p.packQty || offer.packQty) || 1);
    upTo = Math.ceil(upTo / pack) * pack;
    return { reorder: reorder, upTo: upTo };
  }
  function onHand(p){ var h = HUB(); if (h && h.stockSummary) return h.stockSummary(p.id).onHand; return (DATA().stock || []).filter(function(r){ return r.productId === p.id; }).reduce(function(t, r){ return t + num(r.qty); }, 0); }

  function filtered(){
    var q = st.q.trim().toLowerCase(), list = (DATA().products || []).filter(stockable);
    if (st.type) list = list.filter(function(p){ return String(p.productType || '') === st.type; });
    if (st.supplier) list = list.filter(function(p){ return String(p.preferredSupplier || p.supplier || '') === st.supplier; });
    if (st.show === 'kept') list = list.filter(kept); if (st.show === 'not') list = list.filter(function(p){ return !kept(p); });
    if (st.show === 'sold') { var s = sales(); list = list.filter(function(p){ return s[p.id] && s[p.id].d365 > 0; }); }
    if (q) list = list.filter(function(p){ return [p.sku, p.name, p.supplier, p.supplierSku, p.category].join(' ').toLowerCase().indexOf(q) >= 0; });
    var s2 = sales();
    return list.sort(function(a, b){ return (kept(b) - kept(a)) || ((s2[b.id] || {}).d365 || 0) - ((s2[a.id] || {}).d365 || 0) || String(a.name || '').localeCompare(String(b.name || '')); });
  }
  // Kept lines at or below their reorder point. Only kept lines can need ordering, so only they are checked (fast).
  function needsOrder(){
    var hub = HUB(); if (!hub || !hub.replenishmentRow) return [];
    return (DATA().products || []).filter(function(p){ return stockable(p) && kept(p); }).map(hub.replenishmentRow).filter(function(r){ return r && r.needsOrder; });
  }
  function page(){
    var all = (DATA().products || []).filter(stockable), keptAll = all.filter(kept), hub = HUB();
    var need = needsOrder();
    var types = {}, sups = {}; all.forEach(function(p){ types[p.productType || ''] = (types[p.productType || ''] || 0) + 1; sups[p.preferredSupplier || p.supplier || ''] = 1; });
    var list = filtered(), pages = Math.max(1, Math.ceil(list.length / PAGE)); st.page = Math.min(st.page, pages - 1);
    var shown = list.slice(st.page * PAGE, st.page * PAGE + PAGE), s = sales();
    var opt = function(map, cur, label){ return '<option value="">' + label + '</option>' + Object.keys(map).filter(Boolean).sort().map(function(k){ return '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(k) + (typeof map[k] === 'number' && map[k] > 1 ? ' (' + map[k] + ')' : '') + '</option>'; }).join(''); };
    var rows = shown.map(function(p){
      var k = kept(p), sg = suggest(p), so = s[p.id] || { d90: 0, d365: 0 };
      var rp = k ? num(p.reorderPoint != null ? p.reorderPoint : p.reorder) : '', ut = k ? num(p.targetStock != null ? p.targetStock : p.restockTo) : '';
      return '<tr' + (k ? ' class="cs-kept"' : '') + '><td><input type="checkbox" data-cs-pick="' + esc(p.id) + '"' + (st.selected[p.id] ? ' checked' : '') + ' aria-label="Select ' + esc(p.sku || p.name) + '"></td>' +
        '<td><b>' + esc(p.name || p.sku) + '</b><br><small>' + esc(p.sku || '') + ' · ' + esc(p.productType || '') + ' · ' + esc(p.preferredSupplier || p.supplier || '') + '</small></td>' +
        '<td class="num">' + so.d90 + '</td><td class="num">' + so.d365 + '</td><td class="num">' + onHand(p) + '</td><td class="num">' + cash(p.cost) + '</td>' +
        '<td><input class="cs-n" inputmode="numeric" data-cs-field="reorderPoint" data-id="' + esc(p.id) + '" value="' + esc(rp) + '" placeholder="' + sg.reorder + '"' + (k ? '' : ' disabled') + '></td>' +
        '<td><input class="cs-n" inputmode="numeric" data-cs-field="targetStock" data-id="' + esc(p.id) + '" value="' + esc(ut) + '" placeholder="' + sg.upTo + '"' + (k ? '' : ' disabled') + '></td>' +
        '<td><button type="button" class="' + (k ? 'secondary' : 'primary') + ' small" data-cs-toggle="' + esc(p.id) + '">' + (k ? 'Stop keeping' : 'Keep in stock') + '</button></td></tr>'; }).join('');
    var picked = Object.keys(st.selected).filter(function(id){ return st.selected[id]; }).length;
    return '<section class="ph-card cs-page"><header class="cs-head"><div><h2>Core stock</h2><p>Choose the lines you keep on the shelf. Everything else is bought when an order needs it. Kept lines get a reorder point and an order-up-to level; when stock (plus what is on order, less what orders need) falls to the reorder point, the line joins the reorder list.</p></div>' +
      '<button type="button" class="primary" data-cs-reorder>Open reorder list' + (need.length ? ' (' + need.length + ')' : '') + '</button></header>' +
      (st.msg ? '<div class="pp-result ' + (st.msg.ok ? 'good' : 'bad') + '">' + esc(st.msg.text) + '</div>' : '') +
      '<div class="cs-tiles"><div><b>' + keptAll.length + '</b><span>lines kept in stock</span></div><div><b>' + need.length + '</b><span>at or below reorder point</span></div><div><b>' + (all.length - keptAll.length) + '</b><span>bought to order</span></div></div>' +
      '<div class="cs-filters"><label>Type<select data-cs-filter="type">' + opt(types, st.type, 'All types') + '</select></label><label>Supplier<select data-cs-filter="supplier">' + opt(sups, st.supplier, 'All suppliers') + '</select></label>' +
      '<label>Show<select data-cs-filter="show"><option value="all"' + (st.show === 'all' ? ' selected' : '') + '>All</option><option value="kept"' + (st.show === 'kept' ? ' selected' : '') + '>Kept in stock</option><option value="not"' + (st.show === 'not' ? ' selected' : '') + '>Bought to order</option><option value="sold"' + (st.show === 'sold' ? ' selected' : '') + '>Sold in the last year</option></select></label>' +
      '<label class="cs-q">Search<input data-cs-filter="q" value="' + esc(st.q) + '" placeholder="SKU, name, supplier"></label></div>' +
      '<div class="cs-bulk"><span>' + list.length + ' products' + (picked ? ' · ' + picked + ' selected' : '') + '</span><button type="button" class="secondary small" data-cs-bulk="pick-page">Select this page</button>' +
      '<button type="button" class="primary small" data-cs-bulk="keep"' + (picked ? '' : ' disabled') + '>Keep selected, suggested levels</button><button type="button" class="secondary small" data-cs-bulk="stop"' + (picked ? '' : ' disabled') + '>Stop keeping selected</button>' +
      (picked ? '<button type="button" class="link small" data-cs-bulk="clear">Clear selection</button>' : '') + '</div>' +
      '<div class="scroll"><table class="finance-table cs-table"><thead><tr><th></th><th>Product</th><th class="num">Sold 90d</th><th class="num">Sold 12m</th><th class="num">On hand</th><th class="num">Cost</th><th>Reorder at</th><th>Order up to</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="9" class="muted">No products match.</td></tr>') + '</tbody></table></div>' +
      (pages > 1 ? '<div class="cs-pager"><button type="button" class="secondary small" data-cs-page="-1"' + (st.page ? '' : ' disabled') + '>Previous</button><span>Page ' + (st.page + 1) + ' of ' + pages + '</span><button type="button" class="secondary small" data-cs-page="1"' + (st.page < pages - 1 ? '' : ' disabled') + '>Next</button></div>' : '') +
      '<p class="muted cs-note">Suggested levels: reorder when about two weeks of recent sales remain, order up to about six weeks, rounded to the supplier’s pack size. Type your own to override. Placeholders show the suggestion.</p></section>';
  }
  function keep(p, on){
    if (on) { var sg = suggest(p); p.replenishmentEnabled = true; if (!(num(p.reorderPoint) > 0)) p.reorderPoint = sg.reorder; if (!(num(p.targetStock) > num(p.reorderPoint))) p.targetStock = Math.max(sg.upTo, num(p.reorderPoint) + 1); }
    else { p.replenishmentEnabled = false; }
    p.updatedAt = new Date().toISOString();
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function(e){
      var t = e.target && e.target.closest ? e.target : null; if (!t || !t.closest('.cs-page')) return;
      var prod = function(id){ return (DATA().products || []).filter(function(p){ return p.id === id; })[0]; };
      var tg = t.closest('[data-cs-toggle]'); if (tg) { var p = prod(tg.dataset.csToggle); if (!p) return; var on = !kept(p); keep(p, on); save(); st.msg = { ok: true, text: (p.sku || p.name) + (on ? ' is now kept in stock (reorder at ' + p.reorderPoint + ', order up to ' + p.targetStock + ').' : ' is now bought to order.') }; rerender(); return; }
      var bk = t.closest('[data-cs-bulk]'); if (bk) { var a = bk.dataset.csBulk;
        if (a === 'pick-page') { var list = filtered().slice(st.page * PAGE, st.page * PAGE + PAGE); list.forEach(function(p){ st.selected[p.id] = true; }); rerender(); return; }
        if (a === 'clear') { st.selected = {}; rerender(); return; }
        var ids = Object.keys(st.selected).filter(function(id){ return st.selected[id]; }), n = 0;
        ids.forEach(function(id){ var p = prod(id); if (p && stockable(p)) { keep(p, a === 'keep'); n++; } });
        save(); st.selected = {}; st.msg = { ok: true, text: n + ' product' + (n === 1 ? '' : 's') + (a === 'keep' ? ' now kept in stock with suggested levels.' : ' now bought to order.') }; rerender(); return; }
      var pg = t.closest('[data-cs-page]'); if (pg) { st.page = Math.max(0, st.page + Number(pg.dataset.csPage)); rerender(); return; }
      if (t.closest('[data-cs-reorder]') && typeof global.__POOL_SHED_OPEN_SUBPAGE__ === 'function') global.__POOL_SHED_OPEN_SUBPAGE__('products', 'Replenishment');
    });
    document.addEventListener('change', function(e){
      var t = e.target; if (!t || !t.closest || !t.closest('.cs-page')) return;
      if (t.matches('[data-cs-pick]')) { st.selected[t.dataset.csPick] = t.checked; rerender(); return; }
      if (t.matches('[data-cs-filter]')) { st[t.dataset.csFilter] = t.value; st.page = 0; rerender(); return; }
      if (t.matches('[data-cs-field]')) { var p = (DATA().products || []).filter(function(x){ return x.id === t.dataset.id; })[0]; if (!p) return;
        var v = Math.floor(num(t.value)); if (v < 0) v = 0; p[t.dataset.csField] = v;
        if (num(p.targetStock) <= num(p.reorderPoint)) p.targetStock = num(p.reorderPoint) + 1;
        p.updatedAt = new Date().toISOString(); save(); st.msg = { ok: true, text: (p.sku || p.name) + ': reorder at ' + p.reorderPoint + ', order up to ' + p.targetStock + '.' }; rerender(); }
    });
    var timer = null;
    document.addEventListener('input', function(e){ var t = e.target; if (!t || !t.matches || !t.matches('.cs-page [data-cs-filter="q"]')) return; clearTimeout(timer); timer = setTimeout(function(){ st.q = t.value; st.page = 0; rerender();
      var again = document.querySelector('.cs-page [data-cs-filter="q"]'); if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); } }, 200); });
  }
  if (typeof document !== 'undefined' && document.head && !document.getElementById('cs-styles')) {
    var css = document.createElement('style'); css.id = 'cs-styles';
    css.textContent = '.cs-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}.cs-head p{max-width:760px}.cs-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:10px 0}' +
      '.cs-tiles div{border:1px solid rgba(15,76,87,.16);border-radius:12px;padding:10px 12px}.cs-tiles b{display:block;font-size:22px;color:#0f4c57}.cs-tiles span{font-size:13px;opacity:.8}' +
      '.cs-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin:8px 0}.cs-filters label{display:flex;flex-direction:column;font-size:13px}.cs-q{flex:1;min-width:200px}.cs-bulk{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}' +
      '.cs-n{width:72px;text-align:right}.cs-kept td{background:rgba(52,182,200,.07)}.cs-pager{display:flex;gap:10px;align-items:center;justify-content:center;margin:10px 0}.cs-note{font-size:13px}';
    document.head.appendChild(css);
  }
  global.PoolShedCoreStock = { page: page, suggest: suggest, kept: kept, needsOrder: needsOrder, _state: st, _sales: sales };
})(typeof window !== 'undefined' ? window : globalThis);
