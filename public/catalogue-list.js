/* Pool Shed catalogue list (from v1.92), laid out like Shopify's product list with Brightpearl's stock detail.
   - One row per product family, its variants folding out underneath (520 products instead of 6,662 rows).
   - Tabs: All, Active, Draft, Needs attention, Kept in stock, Needs ordering, Archived; one search box; filter chips.
   - ◆ marks a product kept in stock (separate from the ★ favourites on sales orders); "Needs ordering" shows when free stock
     plus stock on order falls to the reorder point (the existing replenishment rules in product-hub-engine.js).
   - Needs ordering view: grouped by supplier with editable quantities, Create PO (opens it, ready to approve and email), export.
   - Bulk changes for ticked products: category, supplier, prices by a percentage, keep in stock, archive or restore, export.
   Products are only changed when someone chooses a change here; every product record stays as it is. */
(function(global){
'use strict';
if (typeof renderProducts !== 'function' || !global.PoolShedProductHub) return;
var hub = global.PoolShedProductHub;
var num = function(v){ var n = Number(v); return isFinite(n) ? n : 0; };
var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var gbp = function(v){ return typeof money === 'function' ? money(num(v)) : '£' + num(v).toFixed(2); };
var PAGE = 50;
var st = global.poolShedCatalogueState || { tab: 'all', q: '', category: '', supplier: '', brand: '', stock: '', sort: 'name', dir: 1, page: 1, open: {}, sel: {}, qty: {} };
global.poolShedCatalogueState = st;
function D(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? global.__POOL_SHED_GET_DATA__() : (typeof data !== 'undefined' ? data : {}); }
function section(){ try { return (typeof selectedSubPage === 'function' && selectedSubPage('products')) || ''; } catch (_) { return ''; } }
function toast2(m){ try { (global.toast || console.log)(m); } catch (_) {} }
function saveAll(){ try { if (hub._resetCache) hub._resetCache(); } catch (_) {} if (typeof saveAppData === 'function') saveAppData(); }

// ---------- product facts ----------
function isArchived(p){ var s = String(p.status || '').toLowerCase(); return p.archived === true || p.active === false || s === 'archived' || String(p.active).toLowerCase() === 'no'; }
function statusOf(p){ if (isArchived(p)) return 'archived'; var s = String(p.status || '').toLowerCase(); return s === 'needs review' || s === 'draft' ? 'draft' : 'active'; }
function kept(p){ if (!hub.isStocked(p)) return false; try { return !!hub.replenishmentSettings(p).enabled; } catch (_) { return p.replenishmentEnabled === true; } }
function familyKey(p){ try { if (global.PoolShedProductImages && global.PoolShedProductImages.groupKey) { var k = global.PoolShedProductImages.groupKey(p); if (k) return 'g:' + k; } } catch (_) {} return p.parentSku ? 'g:' + p.parentSku : 'p:' + p.id; }
function margin(p){ return num(p.rrp) > 0 ? (num(p.rrp) - num(p.cost)) / num(p.rrp) * 100 : null; }
function facts(p){
  var stocked = hub.isStocked(p), s = stocked ? hub.stockSummary(p.id) : { available: 0, onHand: 0, allocated: 0 }, k = kept(p), r = k ? hub.replenishmentRow(p) : null;
  var BE = global.PoolShedBundleEngine, bundle = !!(BE && BE.isBundle(p)), cm = bundle ? BE.canMake(p) : null;
  return { p: p, stocked: stocked, available: num(s.available), kept: k, row: r, needs: !!(r && r.needsOrder), status: statusOf(p), margin: bundle && num(p.rrp) > 0 ? (num(p.rrp) - BE.partsCost(p)) / num(p.rrp) * 100 : margin(p), attention: num(p.rrp) <= 0 || (!bundle && num(p.cost) <= 0), bundle: bundle, canMake: cm };
}
function products(){ return (D().products || []).filter(function(p){ return p && !p.deleted && !p.hiddenFromCatalogue && !(hub.isOrderLineOnly && hub.isOrderLineOnly(p)); }); }
function families(){
  var map = {}, list = [];
  products().forEach(function(p){ var k = familyKey(p); if (!map[k]) { map[k] = { key: k, items: [] }; list.push(map[k]); } map[k].items.push(facts(p)); });
  list.forEach(function(f){
    f.items.sort(function(a, b){ return num(a.p.variantSortOrder) - num(b.p.variantSortOrder) || String(a.p.name).localeCompare(String(b.p.name)); });
    var first = f.items[0].p, prices = f.items.map(function(x){ return num(x.p.rrp); }).filter(function(v){ return v > 0; }), ms = f.items.map(function(x){ return x.margin; }).filter(function(v){ return v != null; });
    f.multi = f.items.length > 1;
    f.name = f.multi ? (first.parentName || first.productGroup || first.name) : first.name;
    f.code = f.multi ? (first.parentSku || first.sku) : first.sku;
    f.supplier = first.supplier || ''; f.category = first.category || ''; f.brand = first.brand || '';
    f.available = f.items.reduce(function(t, x){ return t + (x.stocked ? x.available : 0); }, 0);
    f.stocked = f.items.some(function(x){ return x.stocked; });
    f.min = prices.length ? Math.min.apply(null, prices) : 0; f.max = prices.length ? Math.max.apply(null, prices) : 0;
    f.margin = ms.length ? ms.reduce(function(t, v){ return t + v; }, 0) / ms.length : null;
    f.kept = f.items.some(function(x){ return x.kept; }); f.needs = f.items.filter(function(x){ return x.needs; }).length;
    f.status = f.items.every(function(x){ return x.status === 'archived'; }) ? 'archived' : f.items.some(function(x){ return x.status === 'active'; }) ? 'active' : 'draft';
    f.attention = f.items.some(function(x){ return x.attention; });
    f.text = f.items.map(function(x){ var p = x.p; return [p.name, p.sku, p.supplierSku, p.barcode, p.mpn, p.parentName, p.parentSku, p.variantName, p.variantValue, p.brand, p.category].join(' '); }).join(' ').toLowerCase();
  });
  return list;
}
var TABS = [['all', 'All'], ['active', 'Active'], ['draft', 'Draft'], ['attention', 'Needs attention'], ['kept', 'Kept in stock'], ['needs', 'Needs ordering'], ['archived', 'Archived']];
function inTab(f, tab){
  if (tab === 'archived') return f.status === 'archived';
  if (f.status === 'archived') return false;
  if (tab === 'active') return f.status === 'active'; if (tab === 'draft') return f.status === 'draft';
  if (tab === 'attention') return f.attention; if (tab === 'kept') return f.kept; if (tab === 'needs') return f.needs > 0;
  return true;
}
function stockBand(x){ if (!x.stocked) return 'none'; if (x.available <= 0) return 'out'; var r = x.row; return r && x.available <= r.reorderPoint ? 'low' : 'in'; }
function matches(f){
  if (st.q) { var words = st.q.toLowerCase().split(/\s+/).filter(Boolean); if (!words.every(function(w){ return f.text.indexOf(w) >= 0; })) return false; }
  if (st.category && f.category !== st.category) return false;
  if (st.supplier && f.supplier !== st.supplier) return false;
  if (st.brand && f.brand !== st.brand) return false;
  if (st.stock) { var bands = f.items.map(stockBand); if (bands.indexOf(st.stock) < 0) return false; }
  return true;
}
function sorted(list){
  var key = st.sort, d = st.dir;
  return list.slice().sort(function(a, b){
    var va = key === 'stock' ? a.available : key === 'price' ? a.min : key === 'margin' ? (a.margin == null ? -1e9 : a.margin) : String(a.name).toLowerCase();
    var vb = key === 'stock' ? b.available : key === 'price' ? b.min : key === 'margin' ? (b.margin == null ? -1e9 : b.margin) : String(b.name).toLowerCase();
    return (va < vb ? -1 : va > vb ? 1 : 0) * d;
  });
}

// ---------- drawing ----------
function initials(name){ var w = String(name || '?').replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(function(x){ return x.length > 1; }); return ((w[0] || '?')[0] + (w[1] ? w[1][0] : (w[0] || '')[1] || '')).toUpperCase(); }
function thumb(p, name){ try { if (global.PoolShedProductImages) { var url = global.PoolShedProductImages.variantImageUrl(p) || global.PoolShedProductImages.parentImageUrl(p); if (url) return '<img class="cl-thumb" src="' + esc(url) + '" alt="" loading="lazy">'; } } catch (_) {} return '<span class="cl-thumb cl-thumb-text">' + esc(initials(name)) + '</span>'; }
var KEEP = '<span class="cl-keep" title="Kept in stock" aria-label="Kept in stock">◆</span>';
function statusPill(s){ return '<span class="cl-pill ' + (s === 'active' ? 'good' : s === 'draft' ? 'muted' : 'muted') + '">' + (s === 'active' ? 'Active' : s === 'draft' ? 'Draft' : 'Archived') + '</span>'; }
function stockCell(x){ if (!x.stocked) return '<span class="cl-dim">Not stocked</span>'; var b = stockBand(x); return '<span class="cl-stock ' + (b === 'out' ? 'bad' : b === 'low' ? 'warn' : 'good') + '">' + x.available + '</span>'; }
function reorderCell(x){
  if (!x.stocked) return '<span class="cl-dim">—</span>';
  if (!x.kept) return '<span class="cl-dim">Not kept in stock</span>';
  var r = x.row; if (!r) return '';
  return x.needs ? '<span class="cl-need" title="' + esc(r.reason) + '">' + r.projectedAvailable + ' ≤ ' + r.reorderPoint + ' · order ' + r.suggestedQty + '</span>' : '<span class="cl-dim">' + r.reorderPoint + ' / ' + r.targetStock + '</span>';
}
function price(f){ return f.min === f.max ? gbp(f.min) : gbp(f.min) + ' – ' + gbp(f.max); }
function pct(v){ return v == null ? '—' : Math.round(v) + '%'; }
function famRow(f){
  var open = !!st.open[f.key], ids = f.items.map(function(x){ return x.p.id; }), all = ids.every(function(id){ return st.sel[id]; });
  var b0 = !f.multi && f.items[0].bundle ? f.items[0] : null;
  var stockHtml = b0 ? (b0.canMake && b0.canMake.stocked ? '<span class="cl-can">Can make ' + b0.canMake.qty + '</span>' : '<span class="cl-dim">No stocked parts</span>') : f.stocked ? '<span class="cl-stock ' + (f.available <= 0 ? 'bad' : f.needs ? 'warn' : 'good') + '">' + f.available + '</span>' : '<span class="cl-dim">Not stocked</span>';
  var reorder = b0 ? '<span class="cl-dim">Parts reorder themselves</span>' : !f.stocked ? '<span class="cl-dim">—</span>' : f.needs ? '<span class="cl-need">Needs ordering' + (f.multi && f.needs > 1 ? ' (' + f.needs + ')' : '') + '</span>' : f.kept ? (f.multi ? '<span class="cl-dim">Kept in stock</span>' : reorderCell(f.items[0])) : '<span class="cl-dim">Not kept in stock</span>';
  var name = f.multi ? '<button type="button" class="cl-name" data-cl-toggle="' + esc(f.key) + '" aria-expanded="' + open + '"><span class="cl-caret">' + (open ? '▾' : '▸') + '</span>' : '<button type="button" class="cl-name" data-cl-open="' + esc(f.items[0].p.id) + '"><span class="cl-caret"></span>';
  return '<tr class="cl-fam' + (open ? ' open' : '') + '"><td class="cl-check"><input type="checkbox" data-cl-select-fam="' + esc(f.key) + '"' + (all ? ' checked' : '') + ' aria-label="Select ' + esc(f.name) + '"></td>' +
    '<td>' + name + thumb(f.items[0].p, f.name) + '<span class="cl-title"><b>' + esc(f.name) + (f.kept ? KEEP : '') + (b0 ? ' <span class="cl-bundle">BUNDLE</span>' : '') + '</b><small>' + (f.multi ? f.items.length + ' variants · ' : b0 ? global.PoolShedBundleEngine.parts(b0.p).length + ' parts · ' : '') + esc(f.code || '') + '</small></span></button></td>' +
    '<td>' + statusPill(f.status) + '</td><td class="num">' + stockHtml + '</td><td>' + reorder + '</td><td class="num">' + price(f) + '</td><td class="num">' + pct(f.margin) + '</td><td>' + esc(f.supplier) + '</td><td>' + esc(f.category) + '</td></tr>' +
    (f.multi && open ? f.items.map(varRow).join('') : '');
}
function varRow(x){
  var p = x.p, label = p.variantValue || p.variantName || p.variantLabel || p.name;
  return '<tr class="cl-var"><td class="cl-check"><input type="checkbox" data-cl-select="' + esc(p.id) + '"' + (st.sel[p.id] ? ' checked' : '') + ' aria-label="Select ' + esc(label) + '"></td>' +
    '<td><button type="button" class="cl-name cl-var-name" data-cl-open="' + esc(p.id) + '">' + esc(label) + ' <small>' + esc(p.sku || '') + '</small>' + (x.kept ? KEEP : '') + '</button></td>' +
    '<td>' + (x.status !== 'active' ? statusPill(x.status) : '') + '</td><td class="num">' + stockCell(x) + '</td><td>' + reorderCell(x) + '</td><td class="num">' + gbp(p.rrp) + '</td><td class="num">' + pct(x.margin) + '</td><td></td><td></td></tr>';
}
function chip(key, label, values){
  var cur = st[key], opts = values.map(function(v){ return '<option value="' + esc(v[0]) + '"' + (String(v[0]) === String(cur) ? ' selected' : '') + '>' + esc(v[1]) + '</option>'; }).join('');
  return '<label class="cl-chip' + (cur ? ' on' : '') + '"><span class="sr-only">' + esc(label) + '</span><select class="cl-chip-select" data-cl-filter="' + key + '"><option value="">' + (cur ? label + ': any' : '+ ' + label) + '</option>' + opts + '</select>' + (cur ? '<button type="button" class="cl-chip-x" data-cl-clear="' + key + '" aria-label="Clear ' + esc(label) + '">✕</button>' : '') + '</label>';
}
function uniq(fams, key){ var seen = {}; fams.forEach(function(f){ if (f[key]) seen[f[key]] = 1; }); return Object.keys(seen).sort().map(function(v){ return [v, v]; }); }
function th(key, label, cls){ var on = st.sort === key; return '<th class="' + (cls || '') + '"><button type="button" class="cl-sort' + (on ? ' on' : '') + '" data-cl-sort="' + key + '">' + label + (on ? (st.dir > 0 ? ' ↑' : ' ↓') : '') + '</button></th>'; }

function listPage(){
  var fams = families(), counts = {};
  TABS.forEach(function(t){ counts[t[0]] = fams.filter(function(f){ return inTab(f, t[0]); }).length; });
  var variants = fams.reduce(function(t, f){ return t + f.items.length; }, 0), cats = uniq(fams, 'category').length;
  var tabs = '<nav class="cl-tabs" aria-label="Catalogue views">' + TABS.map(function(t){ return '<button type="button" class="' + (st.tab === t[0] ? 'on' : '') + '" data-cl-tab="' + t[0] + '">' + t[1] + '<em>' + counts[t[0]].toLocaleString('en-GB') + '</em></button>'; }).join('') + '</nav>';
  var head = '<header class="cl-head"><div><h2>Catalogue</h2><p>' + fams.length.toLocaleString('en-GB') + ' products · ' + variants.toLocaleString('en-GB') + ' variants · ' + cats + ' categories</p></div><div class="cl-head-actions">' +
    '<button type="button" class="secondary" data-ph-section="Imports">Import</button><button type="button" class="secondary" data-cl-export="list">Export</button><button type="button" class="primary" data-ph-new-product="true">Add product</button></div></header>';
  if (st.tab === 'needs') return '<div class="cl-page">' + head + '<section class="cl-card">' + tabs + orderingView() + '</section></div>';
  var rows = sorted(fams.filter(function(f){ return inTab(f, st.tab) && matches(f); }));
  if (st.q || st.category || st.supplier || st.brand || st.stock) rows.forEach(function(f){ if (f.multi && f.items.length <= 12 && st.q) st.open[f.key] = st.open[f.key] !== false; });
  var pages = Math.max(1, Math.ceil(rows.length / PAGE)); st.page = Math.min(Math.max(1, st.page), pages);
  var shown = rows.slice((st.page - 1) * PAGE, st.page * PAGE), selCount = Object.keys(st.sel).length;
  var bar = '<div class="cl-bar"><input type="search" class="cl-search" data-cl-q value="' + esc(st.q) + '" placeholder="Search by name, SKU, barcode, supplier code…" aria-label="Search the catalogue">' +
    chip('category', 'Category', uniq(fams, 'category')) + chip('supplier', 'Supplier', uniq(fams, 'supplier')) + chip('brand', 'Brand', uniq(fams, 'brand')) +
    chip('stock', 'Stock', [['in', 'In stock'], ['low', 'Low'], ['out', 'Out of stock'], ['none', 'Not stocked']]) + '</div>';
  var bulk = selCount ? '<div class="cl-bulk"><strong>' + selCount + ' selected</strong><button type="button" class="secondary" data-cl-bulk="category">Set category</button><button type="button" class="secondary" data-cl-bulk="supplier">Set supplier</button><button type="button" class="secondary" data-cl-bulk="prices">Change prices</button><button type="button" class="secondary" data-cl-bulk="keep">Keep in stock…</button><button type="button" class="secondary" data-cl-bulk="' + (st.tab === 'archived' ? 'restore' : 'archive') + '">' + (st.tab === 'archived' ? 'Restore' : 'Archive') + '</button><button type="button" class="secondary" data-cl-export="selected">Export</button><button type="button" class="link" data-cl-bulk="clear">Clear</button></div>' : '';
  var pager = pages > 1 ? '<nav class="cl-pager"><span>' + ((st.page - 1) * PAGE + 1) + '–' + Math.min(rows.length, st.page * PAGE) + ' of ' + rows.length.toLocaleString('en-GB') + '</span><button type="button" class="secondary" data-cl-page="' + (st.page - 1) + '"' + (st.page > 1 ? '' : ' disabled') + '>Previous</button><button type="button" class="secondary" data-cl-page="' + (st.page + 1) + '"' + (st.page < pages ? '' : ' disabled') + '>Next</button></nav>' : '<nav class="cl-pager"><span>' + rows.length + ' product' + (rows.length === 1 ? '' : 's') + '</span></nav>';
  var table = rows.length ? '<div class="cl-table-wrap"><table class="cl-table"><thead><tr><th class="cl-check"></th>' + th('name', 'Product') + '<th>Status</th>' + th('stock', 'Stock', 'num') + '<th>Reorder at / up to</th>' + th('price', 'Price', 'num') + th('margin', 'Margin', 'num') + '<th>Supplier</th><th>Category</th></tr></thead><tbody>' + shown.map(famRow).join('') + '</tbody></table></div>'
    : '<div class="cl-empty"><strong>No products match</strong><span>Try fewer words, or clear a filter.</span></div>';
  return '<div class="cl-page">' + head + '<section class="cl-card">' + tabs + bar + bulk + table + pager + '<p class="cl-legend">' + KEEP + ' Kept in stock (separate from the ★ favourites on orders) · <span class="cl-need">Needs ordering</span> shows when free stock plus stock on order falls to the reorder point.</p></section></div>';
}

function orderingRows(){ try { return hub.replenishmentRows({ needsOrder: true }); } catch (_) { return []; } }
function orderingView(){
  var groups = hub.groupReplenishmentBySupplier(orderingRows());
  if (!groups.length) return '<div class="cl-empty"><strong>Nothing needs ordering</strong><span>Products marked ' + KEEP + ' kept in stock appear here when they fall to their reorder point. Set it on a product, or tick products in the list and choose “Keep in stock…”.</span></div>';
  var total = 0, lines = 0;
  var html = groups.map(function(g){
    var sum = 0, rows = g.rows.map(function(r){ var q = st.qty[r.productId] != null ? st.qty[r.productId] : r.suggestedQty, cost = q * num(r.unitCost); sum += cost; lines++;
      return '<tr><td><button type="button" class="cl-name" data-cl-open="' + esc(r.productId) + '"><span class="cl-title"><b>' + esc(r.product.name) + '</b><small>' + esc(r.product.sku || '') + (r.supplierSku ? ' · ' + esc(r.supplierSku) : '') + '</small></span></button></td>' +
        '<td class="num">' + r.available + '</td><td class="num">' + r.inbound + '</td><td class="num">' + r.reorderPoint + ' / ' + r.targetStock + '</td><td class="num"><input type="number" min="0" step="1" class="cl-qty" data-cl-qty="' + esc(r.productId) + '" value="' + q + '" aria-label="Order quantity for ' + esc(r.product.name) + '"></td><td class="num">' + gbp(cost) + '</td></tr>'; }).join('');
    total += sum;
    var sup = (D().suppliers || []).find(function(s){ return s && (s.name === g.supplier || s.supplier === g.supplier); }) || {};
    var info = [sup.ordersEmail || sup.email || '', sup.leadTimeDays ? 'lead time ' + sup.leadTimeDays + ' days' : ''].filter(Boolean).join(' · ');
    return '<section class="cl-sup"><header><b>' + esc(g.supplier || 'No supplier set') + '</b><small>' + esc(info) + '</small><span class="cl-sup-total">' + g.rows.length + ' line' + (g.rows.length === 1 ? '' : 's') + ' · ' + gbp(sum) + '</span><button type="button" class="primary" data-cl-create-po="' + esc(g.supplier) + '">Create PO</button></header>' +
      '<div class="cl-table-wrap"><table class="cl-table"><thead><tr><th>Product</th><th class="num">Free</th><th class="num">On order</th><th class="num">Reorder at / up to</th><th class="num">Order qty</th><th class="num">Cost</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
  }).join('');
  return '<div class="cl-order-head"><div><strong>' + lines + ' product' + (lines === 1 ? '' : 's') + ' below their reorder point · ' + groups.length + ' supplier' + (groups.length === 1 ? '' : 's') + ' · ' + gbp(total) + ' to order</strong><small>Create the purchase order, then approve and email it from the order: it opens ready to send.</small></div>' +
    '<div class="cl-head-actions"><button type="button" class="secondary" data-cl-export="ordering">Export report</button><button type="button" class="primary" data-cl-create-po="*">Create ' + groups.length + ' purchase order' + (groups.length === 1 ? '' : 's') + '</button></div></div>' + html;
}

// ---------- wiring into the Products area ----------
var base = renderProducts;
renderProducts = function(){
  try {
    if (section() === 'Catalogue' && (typeof productView === 'undefined' || productView === 'list' || !productView)) {
      if (typeof productView !== 'undefined') productView = 'list';
      var screen = document.getElementById('screen-products'), html = listPage();
      if (screen) screen.innerHTML = html;
      return html;
    }
  } catch (e) { console.warn('Catalogue list fell back to the previous view', e); }
  return base.apply(this, arguments);
};
global.renderProducts = renderProducts;
function redraw(keepFocus){
  var pos = keepFocus && keepFocus.selectionStart; renderProducts();
  if (keepFocus) { var n = document.querySelector('[data-cl-q]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } }
}

// ---------- export ----------
function download(name, rows){
  var csv = rows.map(function(r){ return r.map(function(v){ v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function exportProducts(ids){
  var set = ids ? new Set(ids) : null, out = [['SKU', 'Name', 'Family', 'Variant', 'Status', 'Category', 'Brand', 'Supplier', 'Supplier SKU', 'Barcode', 'Cost', 'RRP', 'Trade', 'Wholesale', 'Free stock', 'Kept in stock', 'Reorder at', 'Order up to', 'Needs ordering']];
  families().forEach(function(f){ if (!set && !(inTab(f, st.tab) && matches(f))) return; f.items.forEach(function(x){ var p = x.p; if (set && !set.has(p.id)) return; var r = x.row;
    out.push([p.sku, p.name, p.parentName || '', p.variantValue || p.variantName || '', x.status, p.category, p.brand, p.supplier, p.supplierSku, p.barcode, num(p.cost).toFixed(2), num(p.rrp).toFixed(2), num(p.trade).toFixed(2), num(p.wholesale).toFixed(2), x.stocked ? x.available : '', x.kept ? 'Yes' : 'No', r ? r.reorderPoint : '', r ? r.targetStock : '', x.needs ? (r.suggestedQty) : '']); }); });
  download('pool-shed-catalogue-' + new Date().toISOString().slice(0, 10) + '.csv', out); return out.length - 1;
}
function exportOrdering(){
  var out = [['Supplier', 'SKU', 'Product', 'Supplier SKU', 'Free', 'On order', 'Waiting on orders', 'Reorder at', 'Order up to', 'Order qty', 'Unit cost', 'Line cost', 'Why']];
  orderingRows().forEach(function(r){ var q = st.qty[r.productId] != null ? st.qty[r.productId] : r.suggestedQty; out.push([r.supplier, r.product.sku, r.product.name, r.supplierSku, r.available, r.inbound, r.demand, r.reorderPoint, r.targetStock, q, num(r.unitCost).toFixed(2), (q * num(r.unitCost)).toFixed(2), r.reason]); });
  download('pool-shed-reorder-report-' + new Date().toISOString().slice(0, 10) + '.csv', out); return out.length - 1;
}

// ---------- bulk changes ----------
function selectedProducts(){ return Object.keys(st.sel).map(function(id){ return hub.productById(id); }).filter(Boolean); }
function ask(o){ return global.PoolShedDialog ? global.PoolShedDialog.ask(o) : Promise.resolve(null); }
function bulk(kind){
  var ps = selectedProducts(); if (!ps.length && kind !== 'clear') return;
  var n = ps.length + ' product' + (ps.length === 1 ? '' : 's');
  var done = function(msg){ saveAll(); toast2(msg); renderProducts(); };
  if (kind === 'clear') { st.sel = {}; return renderProducts(); }
  if (kind === 'category' || kind === 'supplier') {
    var values = uniq(families(), kind).map(function(v){ return v[0]; });
    return ask({ title: (kind === 'category' ? 'Set category' : 'Set supplier') + ' for ' + n, fields: [{ name: 'v', label: kind === 'category' ? 'Category' : 'Supplier', type: 'select', options: values, value: values[0] || '' }, { name: 'nv', label: 'Or a new one', placeholder: kind === 'category' ? 'New category name' : 'New supplier name' }], confirmLabel: 'Apply' })
      .then(function(v){ if (!v) return; var val = String(v.nv || '').trim() || v.v; if (!val) return; ps.forEach(function(p){ p[kind] = val; if (kind === 'supplier') p.preferredSupplier = val; p.updatedAt = new Date().toISOString(); }); done(n + ': ' + kind + ' set to ' + val + '.'); });
  }
  if (kind === 'prices') return ask({ title: 'Change prices for ' + n, message: 'A positive percentage raises prices, a negative one lowers them. Prices are rounded to the penny.',
      fields: [{ name: 'which', label: 'Which price', type: 'select', options: [['rrp', 'RRP'], ['trade', 'Trade'], ['wholesale', 'Wholesale'], ['all', 'RRP, trade and wholesale'], ['cost', 'Cost']], value: 'rrp' }, { name: 'pct', label: 'Change by %', type: 'number', step: '0.1', required: true, placeholder: '5' }], confirmLabel: 'Change prices',
      validate: function(v){ var p = Number(v.pct); return !isFinite(p) || p === 0 ? 'Enter a percentage other than 0.' : p <= -100 ? 'That would make prices zero or less.' : ''; } })
    .then(function(v){ if (!v) return; var f = 1 + Number(v.pct) / 100, keys = v.which === 'all' ? ['rrp', 'trade', 'wholesale'] : [v.which];
      ps.forEach(function(p){ keys.forEach(function(k){ if (num(p[k]) > 0) p[k] = Math.round(num(p[k]) * f * 100) / 100; }); p.updatedAt = new Date().toISOString(); }); done(n + ': ' + (v.which === 'all' ? 'prices' : v.which.toUpperCase() === 'RRP' ? 'RRP' : v.which) + ' changed by ' + v.pct + '%.'); });
  if (kind === 'keep') return ask({ title: 'Keep in stock: ' + n, message: 'Kept products get the ◆ mark and appear in Needs ordering when they fall to the reorder point.',
      fields: [{ name: 'on', label: 'Keep in stock', type: 'choice', options: [['yes', 'Yes, keep in stock'], ['no', 'No, order when sold']], value: 'yes' }, { name: 'at', label: 'Reorder at', type: 'number', min: 0, step: '1', hint: 'Leave blank to keep each product’s current level' }, { name: 'to', label: 'Order up to', type: 'number', min: 0, step: '1' }], confirmLabel: 'Apply',
      validate: function(v){ return v.on === 'yes' && v.at !== '' && v.to !== '' && Number(v.to) < Number(v.at) ? 'Order up to must be at least the reorder level.' : ''; } })
    .then(function(v){ if (!v) return; var stocked = ps.filter(function(p){ return hub.isStocked(p); });
      stocked.forEach(function(p){ p.replenishmentEnabled = v.on === 'yes'; if (v.on === 'yes') { if (v.at !== '') { p.reorderPoint = Math.max(0, Math.floor(Number(v.at))); p.reorder = p.reorderPoint; } if (v.to !== '') { p.targetStock = Math.max(0, Math.floor(Number(v.to))); p.restockTo = p.targetStock; } } p.updatedAt = new Date().toISOString(); });
      done(stocked.length + ' product' + (stocked.length === 1 ? '' : 's') + (v.on === 'yes' ? ' kept in stock.' : ' set to order when sold.') + (stocked.length < ps.length ? ' ' + (ps.length - stocked.length) + ' not stock-controlled, left as they were.' : '')); });
  if (kind === 'archive' || kind === 'restore') return (global.PoolShedDialog ? global.PoolShedDialog.confirm({ title: (kind === 'archive' ? 'Archive ' : 'Restore ') + n + '?', message: kind === 'archive' ? 'Archived products stay on past orders and reports but no longer appear when adding items. You can restore them from the Archived tab.' : 'They return to the catalogue and can be added to orders again.', confirmLabel: kind === 'archive' ? 'Archive' : 'Restore' }) : Promise.resolve(true))
    .then(function(yes){ if (!yes) return; ps.forEach(function(p){ if (kind === 'archive') p.archived = true; else { delete p.archived; if (p.active === false) p.active = true; if (String(p.status || '').toLowerCase() === 'archived') p.status = ''; } p.updatedAt = new Date().toISOString(); }); st.sel = {}; done(n + (kind === 'archive' ? ' archived.' : ' restored.')); });
}

// ---------- create purchase orders ----------
function createPOs(supplier){
  var rows = orderingRows().filter(function(r){ return supplier === '*' || r.supplier === supplier; });
  var picks = rows.map(function(r){ return { productId: r.productId, qty: st.qty[r.productId] != null ? st.qty[r.productId] : r.suggestedQty }; }).filter(function(x){ return x.qty > 0; });
  if (!picks.length) return toast2('Set an order quantity first.');
  var pos = hub.createDraftPurchaseOrders(picks) || [];
  picks.forEach(function(x){ delete st.qty[x.productId]; });
  if (!pos.length) return toast2('No purchase order was created.');
  toast2(pos.map(function(p){ return p.id; }).join(', ') + ' created. Approve it, then Send to supplier emails it.');
  if (pos.length === 1 && typeof selectedPurchaseOrderId !== 'undefined') {
    try { active = 'purchase'; activeSubPage.purchase = 'Purchase Orders'; selectedPurchaseOrderId = pos[0].id; purchaseOrderView = 'detail'; } catch (_) {}
    if (typeof render === 'function') render(); return;
  }
  if (global.PoolShedFrame && global.PoolShedFrame.openPage) global.PoolShedFrame.openPage('purchase', 'Purchase Orders');
}

// ---------- events ----------
var qTimer = 0;
if (typeof document !== 'undefined') {
  document.addEventListener('input', function(e){
    var q = e.target.closest && e.target.closest('[data-cl-q]'); if (q) { st.q = q.value; st.page = 1; clearTimeout(qTimer); qTimer = setTimeout(function(){ redraw(q); }, 160); return; }
    var qty = e.target.closest && e.target.closest('[data-cl-qty]'); if (qty) { st.qty[qty.dataset.clQty] = Math.max(0, Math.floor(Number(qty.value) || 0)); }
  });
  document.addEventListener('change', function(e){
    var f = e.target.closest && e.target.closest('[data-cl-filter]'); if (f) { st[f.dataset.clFilter] = f.value; st.page = 1; return renderProducts(); }
    var qty = e.target.closest && e.target.closest('[data-cl-qty]'); if (qty) { return renderProducts(); }
    var sf = e.target.closest && e.target.closest('[data-cl-select-fam]'); if (sf) { var fam = families().find(function(x){ return x.key === sf.dataset.clSelectFam; }); if (fam) fam.items.forEach(function(x){ if (sf.checked) st.sel[x.p.id] = 1; else delete st.sel[x.p.id]; }); return renderProducts(); }
    var s1 = e.target.closest && e.target.closest('[data-cl-select]'); if (s1) { if (s1.checked) st.sel[s1.dataset.clSelect] = 1; else delete st.sel[s1.dataset.clSelect]; return renderProducts(); }
  });
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('[data-cl-tab],[data-cl-toggle],[data-cl-open],[data-cl-sort],[data-cl-page],[data-cl-clear],[data-cl-export],[data-cl-bulk],[data-cl-create-po]'); if (!t) return;
    var d = t.dataset; e.preventDefault();
    if (d.clTab) { st.tab = d.clTab; st.page = 1; st.sel = {}; return renderProducts(); }
    if (d.clToggle) { st.open[d.clToggle] = !st.open[d.clToggle]; return renderProducts(); }
    if (d.clOpen) { try { selectedProductId = d.clOpen; productView = 'profile'; } catch (_) {} if (typeof render === 'function') render(); return; }
    if (d.clSort) { if (st.sort === d.clSort) st.dir = -st.dir; else { st.sort = d.clSort; st.dir = d.clSort === 'name' ? 1 : -1; } return renderProducts(); }
    if (d.clPage) { if (t.disabled) return; st.page = Number(d.clPage) || 1; renderProducts(); var c = document.querySelector('.cl-card'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'start' }); return; }
    if (d.clClear) { st[d.clClear] = ''; st.page = 1; return renderProducts(); }
    if (d.clExport) { var n = d.clExport === 'ordering' ? exportOrdering() : exportProducts(d.clExport === 'selected' ? Object.keys(st.sel) : null); return toast2(n + ' row' + (n === 1 ? '' : 's') + ' exported.'); }
    if (d.clBulk) return bulk(d.clBulk);
    if (d.clCreatePo) return createPOs(d.clCreatePo);
  }, true);
}
global.PoolShedCatalogueList = { families: families, listPage: listPage, orderingView: orderingView, exportProducts: exportProducts, exportOrdering: exportOrdering, createPOs: createPOs, state: st, inTab: inTab, matches: matches };
})(typeof window !== 'undefined' ? window : globalThis);
