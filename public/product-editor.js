/* Pool Shed product editor (from v1.93): one page, everything everyday is editable, like Shopify's product page with
   Brightpearl's stock and supplier detail.
   Left: title and description, image, the variants grid (edit like a spreadsheet; paste a column from Excel), pricing.
   Right: status, organisation, supplier, stock and reordering (keep in stock, reorder at, order up to, with levels
   suggested from the last 90 days of sales), insights.
   Changes are held until you press Save (or Ctrl+S) on the floating bar; Discard puts everything back. The full record
   with every field (media documents, price books, accounting, bundles, history) is still one click away: "All fields". */
(function(global){
'use strict';
if (typeof renderProducts !== 'function' || !global.PoolShedProductHub) return;
var hub = global.PoolShedProductHub;
var num = function(v){ var n = Number(v); return isFinite(n) ? n : 0; };
var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var gbp = function(v){ return typeof money === 'function' ? money(num(v)) : '£' + num(v).toFixed(2); };
var ed = global.poolShedEditorState || { draft: {}, focus: '', allFields: {} };
global.poolShedEditorState = ed;
var NUMS = ['rrp', 'trade', 'wholesale', 'special', 'cost', 'reorderPoint', 'targetStock', 'leadTimeDays', 'minimumOrderQuantity', 'orderMultiple'];
function D(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? global.__POOL_SHED_GET_DATA__() : (typeof data !== 'undefined' ? data : {}); }
function toast2(m){ try { (global.toast || console.log)(m); } catch (_) {} }
function current(){ try { return typeof selectedProductId !== 'undefined' ? hub.productById(selectedProductId) : null; } catch (_) { return null; } }
function familyOf(p){
  var key = ''; try { if (global.PoolShedProductImages && global.PoolShedProductImages.groupKey) key = global.PoolShedProductImages.groupKey(p); } catch (_) {}
  var list = (D().products || []).filter(function(x){ return x && !x.deleted && (key ? (function(){ try { return global.PoolShedProductImages.groupKey(x) === key; } catch (_) { return false; } })() : x.id === p.id); });
  if (!list.length) list = [p];
  return list.sort(function(a, b){ return num(a.variantSortOrder) - num(b.variantSortOrder) || String(a.sku).localeCompare(String(b.sku)); });
}
// The value shown: the draft if edited, otherwise the record (reorder levels fall back to the older field names).
function val(p, k){
  var d = ed.draft[p.id]; if (d && Object.prototype.hasOwnProperty.call(d, k)) return d[k];
  if (k === 'reorderPoint') return p.reorderPoint != null ? p.reorderPoint : (p.reorder != null ? p.reorder : '');
  if (k === 'targetStock') return p.targetStock != null ? p.targetStock : (p.restockTo != null ? p.restockTo : '');
  if (k === 'keep') { try { return !!hub.replenishmentSettings(p).enabled; } catch (_) { return !!p.replenishmentEnabled; } }
  if ((k === 'leadTimeDays' || k === 'minimumOrderQuantity') && (p[k] == null || p[k] === '')) { try { var o = hub.supplierOffer(p) || {}; var ov = k === 'leadTimeDays' ? o.leadTimeDays : o.minQty; if (ov != null && ov !== '') return ov; } catch (_) {} return ''; }
  if (k === 'status') { var s = String(p.status || '').toLowerCase(); return p.archived === true || p.active === false || s === 'archived' ? 'archived' : s === 'needs review' || s === 'draft' ? 'draft' : 'active'; }
  return p[k] == null ? '' : p[k];
}
function setDraft(id, k, v){ (ed.draft[id] = ed.draft[id] || {})[k] = v; }
function dirtyCount(){ return Object.keys(ed.draft).reduce(function(t, id){ return t + Object.keys(ed.draft[id]).length; }, 0); }
function margin(p){ var r = num(val(p, 'rrp')), c = num(val(p, 'cost')); return r > 0 ? Math.round((r - c) / r * 1000) / 10 : null; }
function marginAt(p, k){ var r = num(val(p, k)), c = num(val(p, 'cost')); return r > 0 ? Math.round((r - c) / r * 100) + '%' : '—'; }
function sold90(ids){
  var since = Date.now() - 90 * 864e5, set = {}, n = 0; ids.forEach(function(id){ set[id] = 1; });
  (D().salesOrders || []).forEach(function(o){ var t = Date.parse(o.created || o.date || ''); if (!(t >= since) || o.status === 'Cancelled') return; (o.lines || []).forEach(function(l){ if (set[l.productId]) n += num(l.qty); }); });
  return n;
}
function onOrder(id){ return (D().purchaseOrders || []).filter(function(po){ return !/cancel|received|closed/i.test(po.status || ''); }).reduce(function(t, po){ return t + (po.lines || []).filter(function(l){ return l.productId === id; }).reduce(function(s, l){ return s + Math.max(0, num(l.qty) - num(l.received)); }, 0); }, 0); }
function suggest(p){ var s = sold90([p.id]), lead = Math.max(1, num(val(p, 'leadTimeDays')) || 5), daily = s / 90; if (!s) return null;
  var at = Math.max(1, Math.ceil(daily * (lead + 7))), to = Math.max(at + 1, Math.ceil(at + daily * 30)); return { at: at, to: to, sold: s }; }

// ---------- drawing ----------
function input(p, k, opts){ opts = opts || {}; var v = val(p, k);
  return '<input class="pe-in' + (opts.cls ? ' ' + opts.cls : '') + '" data-pe="' + esc(p.id + '|' + k) + '" value="' + esc(v) + '"' + (NUMS.indexOf(k) >= 0 ? ' type="number" step="' + (/Point|Stock|Days|Quantity|Multiple/.test(k) ? '1' : '0.01') + '" min="0" inputmode="decimal"' : ' type="text"') + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + (opts.label ? ' aria-label="' + esc(opts.label) + '"' : '') + (opts.list ? ' list="' + opts.list + '"' : '') + '>'; }
function fieldRow(label, html, hint){ return '<label class="pe-field"><span>' + esc(label) + '</span>' + html + (hint ? '<small>' + hint + '</small>' : '') + '</label>'; }
function card(title, body, extra){ return '<section class="pe-card"><header><h3>' + esc(title) + '</h3>' + (extra || '') + '</header>' + body + '</section>'; }
function datalist(id, key){ var seen = {}; (D().products || []).forEach(function(p){ if (p && p[key]) seen[p[key]] = 1; }); return '<datalist id="' + id + '">' + Object.keys(seen).sort().slice(0, 400).map(function(v){ return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>'; }
function imageHtml(p){
  var main = p.imageUrl || p.variantImageUrl || '', url = '';
  try { url = global.PoolShedBusinessMedia ? global.PoolShedBusinessMedia.url(main) : main; } catch (_) { url = main; }
  if (!url) { try { if (global.PoolShedProductImages) url = global.PoolShedProductImages.variantImageUrl(p) || global.PoolShedProductImages.parentImageUrl(p) || ''; } catch (_) {} }
  var ref = global.PoolShedBusinessMedia && main && global.PoolShedBusinessMedia.secureRef && global.PoolShedBusinessMedia.secureRef(main) ? ' data-business-media-ref="' + esc(main) + '"' : '';
  var gallery = Array.isArray(p.galleryImages) ? p.galleryImages.length : 0;
  return '<div class="pe-media"><div class="pe-media-main"' + ref + (url ? ' style="background-image:url(&quot;' + esc(url) + '&quot;)"' : '') + '>' + (url ? '' : '<span>No image yet</span>') + '</div>' +
    '<div class="pe-media-side"><button type="button" class="secondary" data-ph-media-upload="main_image" data-ph-media-key="imageUrl" data-ph-media-accept="image/jpeg,image/png,image/webp">' + (url ? 'Replace image' : 'Upload image') + '</button>' +
    '<small>' + (gallery ? gallery + ' more image' + (gallery === 1 ? '' : 's') + ' in the gallery · ' : '') + 'Used on quotes, orders and the web shop.</small><button type="button" class="link pe-link" data-pe-all="Media & Docs">Gallery, brochures and data sheets</button></div></div>';
}
function variantsGrid(fam, p){
  var cols = [['variantValue', 'Variant'], ['sku', 'SKU'], ['rrp', 'RRP'], ['trade', 'Trade'], ['cost', 'Cost']];
  var head = cols.map(function(c){ return '<th class="' + (NUMS.indexOf(c[0]) >= 0 ? 'num' : '') + '">' + c[1] + '</th>'; }).join('') + '<th class="num">Margin</th><th class="num">Free stock</th>';
  var rows = fam.map(function(v, i){
    var s = hub.isStocked(v) ? hub.stockSummary(v.id).available : null, m = margin(v);
    return '<tr class="' + (v.id === p.id ? 'on' : '') + '">' + cols.map(function(c){ return '<td class="' + (NUMS.indexOf(c[0]) >= 0 ? 'num' : '') + '">' + input(v, c[0], { label: c[1] + ' for ' + (v.variantValue || v.sku), cls: 'pe-grid-in' }).replace('<input ', '<input data-pe-row="' + i + '" data-pe-col="' + c[0] + '" ') + '</td>'; }).join('') +
      '<td class="num ' + (m != null && m < 25 ? 'pe-low' : '') + '">' + (m == null ? '—' : m + '%') + '</td><td class="num">' + (s == null ? '<span class="pe-dim">Not stocked</span>' : s) + '</td></tr>';
  }).join('');
  return card(fam.length > 1 ? 'Variants' : 'Price and code', '<div class="pe-grid-wrap"><table class="pe-grid"><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table></div><p class="pe-hint">Tab moves across · paste a column from Excel into the first cell and it fills down · margins update as you type</p>');
}
function editorHtml(p){
  var fam = familyOf(p), multi = fam.length > 1, title = multi ? (val(p, 'parentName') || p.name) : val(p, 'name');
  var dirty = dirtyCount(), s = hub.isStocked(p) ? hub.stockSummary(p.id) : null, keep = val(p, 'keep'), sg = suggest(p), sold = sold90(fam.map(function(v){ return v.id; }));
  var suppliers = (D().suppliers || []).map(function(x){ return x && (x.name || x.supplier); }).filter(Boolean); if (p.supplier && suppliers.indexOf(p.supplier) < 0) suppliers.unshift(p.supplier);
  var supSel = '<select class="pe-in" data-pe="' + esc(p.id + '|supplier') + '"><option value="">No supplier</option>' + suppliers.sort().map(function(n){ return '<option' + (n === val(p, 'supplier') ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>';
  var statusSel = '<select class="pe-in" data-pe="' + esc(p.id + '|status') + '">' + [['active', 'Active'], ['draft', 'Draft'], ['archived', 'Archived']].map(function(o){ return '<option value="' + o[0] + '"' + (val(p, 'status') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
  var statusHint = { active: 'Can be added to orders, quotes and the web shop.', draft: 'Kept back for review: shows as Draft in the catalogue.', archived: 'Hidden when adding items; stays on past orders and reports.' }[val(p, 'status')];
  var left = card('Title and description', fieldRow(multi ? 'Product name (all ' + fam.length + ' variants)' : 'Product name', '<input class="pe-in pe-title" data-pe="' + esc(p.id + '|' + (multi ? 'parentName' : 'name')) + '" value="' + esc(title) + '">') +
      fieldRow('Description', '<textarea class="pe-in" rows="4" data-pe="' + esc(p.id + '|description') + '">' + esc(val(p, 'description')) + '</textarea>')) +
    card('Image', imageHtml(p)) + variantsGrid(fam, p) +
    card('Pricing' + (multi ? ': ' + (p.variantValue || p.sku) : ''), '<div class="pe-g4">' + fieldRow('RRP', input(p, 'rrp'), marginAt(p, 'rrp') + ' margin') + fieldRow('Trade', input(p, 'trade'), marginAt(p, 'trade') + ' margin') + fieldRow('Wholesale', input(p, 'wholesale'), marginAt(p, 'wholesale') + ' margin') + fieldRow('Cost', input(p, 'cost'), 'ex VAT') + '</div>' +
      '<div class="pe-g4">' + fieldRow('Special price', input(p, 'special', { ph: 'none' })) + fieldRow('Barcode', input(p, 'barcode')) + fieldRow('Manufacturer code', input(p, 'mpn')) + fieldRow('Unit', input(p, 'unit', { ph: 'Each' })) + '</div>');
  var right = card('Status', statusSel + '<p class="pe-hint">' + statusHint + '</p>') +
    card('Organisation', fieldRow('Category', input(p, 'category', { list: 'pe-cats' })) + fieldRow('Brand', input(p, 'brand', { list: 'pe-brands' })) + fieldRow('Product type', input(p, 'productType', { ph: 'Stocked Product' }))) +
    card('Supplier', fieldRow('Supplier', supSel) + fieldRow('Supplier code', input(p, 'supplierSku')) + '<div class="pe-g2">' + fieldRow('Lead time (days)', input(p, 'leadTimeDays')) + fieldRow('Minimum order', input(p, 'minimumOrderQuantity')) + '</div>') +
    (hub.isStocked(p) ? card('Stock and reordering', '<label class="pe-switch"><input type="checkbox" data-pe="' + esc(p.id + '|keep') + '"' + (keep ? ' checked' : '') + '><span class="pe-keep">◆</span> Keep in stock</label>' +
      (keep ? '<div class="pe-g2">' + fieldRow('Reorder at', input(p, 'reorderPoint')) + fieldRow('Order up to', input(p, 'targetStock')) + '</div>' + (sg ? '<p class="pe-hint">From the last 90 days (' + sg.sold + ' sold): ' + sg.at + ' / ' + sg.to + ' <button type="button" class="link pe-link" data-pe-suggest="' + esc(p.id + '|' + sg.at + '|' + sg.to) + '">Use these</button></p>' : '<p class="pe-hint">No sales in the last 90 days to suggest levels from.</p>') : '<p class="pe-hint">Ordered when sold. Switch on to reorder it automatically from Needs ordering.</p>') +
      '<dl class="pe-stock"><div><dt>On hand</dt><dd>' + s.onHand + '</dd></div><div><dt>Allocated</dt><dd>' + s.allocated + '</dd></div><div><dt>Free</dt><dd>' + s.available + '</dd></div><div><dt>On order</dt><dd>' + onOrder(p.id) + '</dd></div></dl>') : card('Stock', '<p class="pe-hint">Not stock-controlled: no stock to count or reorder.</p>')) +
    card('Insights', '<p class="pe-hint">' + sold + ' sold in the last 90 days' + (multi ? ' across all variants' : '') + ' · last edited ' + esc(String(p.updatedAt || '').slice(0, 10) || 'not recorded') + '</p>');
  return '<div class="pe-page">' + datalist('pe-cats', 'category') + datalist('pe-brands', 'brand') +
    '<header class="pe-head"><button type="button" class="secondary" data-pe-back>← Catalogue</button><div class="pe-head-title"><h2>' + esc(title) + '</h2><p>' + (multi ? fam.length + ' variants · ' : '') + esc(p.sku || '') + (p.supplier ? ' · ' + esc(p.supplier) : '') + '</p></div>' +
    '<div class="pe-head-actions"><button type="button" class="secondary" data-pe-all="Overview">All fields</button></div></header>' +
    '<div class="pe-cols"><div class="pe-main">' + left + '</div><aside class="pe-side">' + right + '</aside></div>' +
    '<div class="pe-savebar' + (dirty ? ' on' : '') + '" role="region" aria-label="Unsaved changes"><span>' + dirty + ' unsaved change' + (dirty === 1 ? '' : 's') + '</span><button type="button" class="secondary" data-pe-discard>Discard</button><button type="button" class="primary" data-ph-save-product data-pe-save>Save</button></div></div>';
}

// ---------- saving ----------
function apply(){
  var d = D(), n = 0, now = new Date().toISOString();
  Object.keys(ed.draft).forEach(function(id){
    var p = hub.productById(id), ch = ed.draft[id]; if (!p) return;
    Object.keys(ch).forEach(function(k){
      var v = ch[k]; n++;
      if (k === 'keep') { p.replenishmentEnabled = !!v; return; }
      if (k === 'status') { if (v === 'archived') p.archived = true; else { delete p.archived; if (p.active === false) p.active = true; p.status = v === 'draft' ? 'Needs review' : (String(p.status || '').toLowerCase() === 'needs review' || String(p.status || '').toLowerCase() === 'archived' ? '' : p.status || ''); } return; }
      if (k === 'parentName') { familyOf(p).forEach(function(x){ x.parentName = v; if (x.productGroup) x.productGroup = v; x.updatedAt = now; }); return; }
      if (NUMS.indexOf(k) >= 0) v = v === '' ? (k === 'special' ? '' : 0) : Math.max(0, num(v));
      if (k === 'reorderPoint') p.reorder = v; if (k === 'targetStock') p.restockTo = v;
      if (k === 'supplier') p.preferredSupplier = v;
      p[k] = typeof v === 'string' ? v.trim() : v;
    });
    p.updatedAt = now;
    // keep the supplier's price record in step, as the full record does
    var supplier = p.preferredSupplier || p.supplier;
    if (supplier && ['supplier', 'supplierSku', 'cost', 'leadTimeDays', 'minimumOrderQuantity'].some(function(k){ return k in ch; })) {
      if (!Array.isArray(d.supplierProducts)) d.supplierProducts = [];
      var offer = d.supplierProducts.find(function(o){ return o.productId === p.id && o.supplier === supplier; });
      if (!offer) { offer = { id: 'SP-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), productId: p.id, supplier: supplier, available: true }; d.supplierProducts.push(offer); }
      // only what was edited here: blank fields on the product never wipe the supplier's own lead time or minimum order
      if ('supplierSku' in ch || !offer.supplierSku) offer.supplierSku = p.supplierSku || offer.supplierSku || p.sku;
      if ('cost' in ch || offer.cost == null) offer.cost = num(p.cost);
      if ('leadTimeDays' in ch) offer.leadTimeDays = num(p.leadTimeDays);
      if ('minimumOrderQuantity' in ch) offer.minQty = Math.max(1, num(p.minimumOrderQuantity) || 1);
      offer.lastUpdated = now.slice(0, 10);
    }
  });
  ed.draft = {};
  try { if (hub._resetCache) hub._resetCache(); } catch (_) {}
  if (n && typeof saveAppData === 'function') saveAppData();
  return n;
}
function validate(){
  var dupes = [];
  Object.keys(ed.draft).forEach(function(id){ var sku = ed.draft[id].sku; if (sku == null) return; sku = String(sku).trim();
    if (!sku) dupes.push('A SKU can’t be empty.');
    else if ((D().products || []).some(function(x){ return x && x.id !== id && !x.deleted && String(x.sku || '').toLowerCase() === sku.toLowerCase(); })) dupes.push(sku + ' is already used by another product.'); });
  return dupes[0] || '';
}

// ---------- wiring ----------
var base = renderProducts;
renderProducts = function(){
  try {
    var p = current();
    if (typeof productView !== 'undefined' && productView === 'profile' && p && !ed.allFields[p.id]) {
      var screen = document.getElementById('screen-products'), html = editorHtml(p);
      if (screen) { screen.innerHTML = html; if (ed.focus) { var f = screen.querySelector('[data-pe="' + ed.focus + '"]'); if (f) { f.focus(); try { var l = String(f.value).length; f.setSelectionRange && f.type === 'text' && f.setSelectionRange(l, l); } catch (_) {} } ed.focus = ''; } }
      return html;
    }
  } catch (e) { console.warn('Product editor fell back to the full record', e); }
  return base.apply(this, arguments);
};
global.renderProducts = renderProducts;
function refreshBar(){ var bar = document.querySelector('.pe-savebar'); if (!bar) return; var n = dirtyCount(); bar.classList.toggle('on', n > 0); var s = bar.querySelector('span'); if (s) s.textContent = n + ' unsaved change' + (n === 1 ? '' : 's'); }
function refreshMargins(){ var p = current(); if (!p) return; var focus = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.pe : ''; ed.focus = focus || ''; renderProducts(); }

if (typeof document !== 'undefined') {
  var marginTimer = 0;
  document.addEventListener('input', function(e){
    var t = e.target.closest && e.target.closest('[data-pe]'); if (!t || t.type === 'checkbox' || t.tagName === 'SELECT') return;
    var parts = t.dataset.pe.split('|'); setDraft(parts[0], parts[1], t.value); refreshBar();
    if (['rrp', 'trade', 'wholesale', 'cost'].indexOf(parts[1]) >= 0) { clearTimeout(marginTimer); marginTimer = setTimeout(refreshMargins, 600); }
  });
  document.addEventListener('change', function(e){
    var t = e.target.closest && e.target.closest('[data-pe]'); if (!t || (t.type !== 'checkbox' && t.tagName !== 'SELECT')) return;
    var parts = t.dataset.pe.split('|'); setDraft(parts[0], parts[1], t.type === 'checkbox' ? t.checked : t.value); renderProducts();
  });
  // Paste a column from Excel into a grid cell: fills that column downwards.
  document.addEventListener('paste', function(e){
    var t = e.target.closest && e.target.closest('[data-pe-row]'); if (!t) return;
    var text = (e.clipboardData || global.clipboardData).getData('text'); if (!/\n/.test(String(text).trim())) return;
    e.preventDefault();
    var values = String(text).replace(/\r/g, '').split('\n').map(function(x){ return x.split('\t')[0].trim(); }).filter(function(x, i, a){ return x !== '' || i < a.length - 1; });
    var col = t.dataset.peCol, start = Number(t.dataset.peRow), cells = Array.prototype.slice.call(document.querySelectorAll('[data-pe-col="' + col + '"]'));
    values.forEach(function(v, i){ var c = cells[start + i]; if (!c) return; var parts = c.dataset.pe.split('|'); if (NUMS.indexOf(col) >= 0) v = String(v).replace(/[£,\s]/g, ''); setDraft(parts[0], parts[1], v); });
    renderProducts(); toast2(Math.min(values.length, cells.length - start) + ' cells filled from the clipboard.');
  });
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('[data-pe-save],[data-pe-discard],[data-pe-back],[data-pe-all],[data-pe-suggest]'); if (!t) return;
    if (t.hasAttribute('data-pe-save')) { e.preventDefault(); e.stopImmediatePropagation(); var err = validate(); if (err) return toast2(err); var n = apply(); toast2(n ? 'Saved.' : 'Nothing to save.'); return renderProducts(); }
    e.preventDefault();
    if (t.hasAttribute('data-pe-discard')) { ed.draft = {}; toast2('Changes discarded.'); return renderProducts(); }
    if (t.hasAttribute('data-pe-back')) {
      if (dirtyCount() && !global.confirm('You have unsaved changes. Leave without saving?')) return;
      ed.draft = {}; try { productView = 'list'; activeSubPage.products = 'Catalogue'; } catch (_) {} if (typeof render === 'function') render(); return;
    }
    if (t.dataset.peAll) { var p = current(); if (!p) return; ed.allFields[p.id] = true; try { global.poolShedProductHubV111State.productTab = t.dataset.peAll; } catch (_) {} renderProducts(); return; }
    if (t.dataset.peSuggest) { var s = t.dataset.peSuggest.split('|'); setDraft(s[0], 'reorderPoint', s[1]); setDraft(s[0], 'targetStock', s[2]); return renderProducts(); }
  }, true);
  // Back from "All fields" to the editor whenever another product is opened.
  document.addEventListener('click', function(e){ var o = e.target.closest && e.target.closest('[data-cl-open],[data-ph-open-product]'); if (o) { var id = o.dataset.clOpen || o.dataset.phOpenProduct; delete ed.allFields[id]; } }, true);
}
global.PoolShedProductEditor = { editorHtml: editorHtml, apply: apply, validate: validate, state: ed, familyOf: familyOf, suggest: suggest, setDraft: setDraft };
})(typeof window !== 'undefined' ? window : globalThis);
