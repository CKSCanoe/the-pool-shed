/* Pool Shed stock count import (from v1.97): get real stock levels in from a spreadsheet.
   Stock › Catalogue › "Import stock counts". Paste cells copied from Excel or Google Sheets, or choose a CSV file.
   Columns are recognised from the header (SKU / product code, barcode, supplier code, quantity / count, location);
   each row is matched to a product by SKU, then barcode, then supplier code, then exact name.
   Preview first: current and new stock for every product, rows that did not match, and anything that needs care.
   "Set to the counted number" (a stock count) or "Add to current stock" (a delivery not booked through a PO).
   Stock is never set below what is reserved for orders. Every change is a stock movement, and the whole import can be
   undone afterwards. Nothing changes until you confirm. */
(function(global){
'use strict';
var num = function(v){ var n = Number(v); return isFinite(n) ? n : 0; };
var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var HOLD = ['L-QUARANTINE', 'L-RECEIVING', 'L-RETURNS-HOLD'];
var si = global.poolShedStockImport || { open: false, text: '', mode: 'set', location: 'L-WH-A1', plan: null, last: null };
global.poolShedStockImport = si;
function D(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? global.__POOL_SHED_GET_DATA__() : (typeof data !== 'undefined' ? data : {}); }
function toast2(m){ try { (global.toast || console.log)(m); } catch (_) {} }
function who(){ try { return (currentUser() || {}).name || 'Office'; } catch (_) { return 'Office'; } }
function norm(v){ return String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' '); }
function key(v){ return String(v == null ? '' : v).trim().toLowerCase().replace(/[\s\-_.\/]+/g, ''); }

// ---------- reading the sheet ----------
function splitRows(text){
  text = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim(); if (!text) return [];
  var tab = text.split('\n')[0].indexOf('\t') >= 0, rows = [];
  if (tab) return text.split('\n').map(function(l){ return l.split('\t').map(function(c){ return c.trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"'); }); });
  // CSV with quotes
  var row = [], cell = '', q = false;
  for (var i = 0; i < text.length; i++) { var ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === ',') { row.push(cell.trim()); cell = ''; } else if (ch === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = ''; } else cell += ch; }
  row.push(cell.trim()); rows.push(row);
  return rows.filter(function(r){ return r.some(function(c){ return c !== ''; }); });
}
var HEADS = { sku: /^(sku|code|product ?code|item ?code|pool ?shed ?sku|our ?code|part ?(no|number))$/i, barcode: /^(barcode|ean|upc|gtin)$/i, supplierSku: /^(supplier ?(sku|code|ref|part)|mpn|manufacturer ?code)$/i,
  qty: /^(qty|quantity|count|counted|stock|on ?hand|in ?stock|level|units)$/i, name: /^(name|product|product ?name|description|item)$/i, location: /^(location|bin|warehouse|store)$/i };
function columns(rows){
  var head = rows[0] || [], map = {}, found = 0;
  head.forEach(function(h, i){ var t = String(h || '').trim(); Object.keys(HEADS).forEach(function(k){ if (map[k] == null && HEADS[k].test(t)) { map[k] = i; found++; } }); });
  if (found && map.qty != null) return { map: map, header: true };
  // no header: first column is the code, the last numeric column is the count
  var first = rows[0] || [], qi = -1; first.forEach(function(c, i){ if (c !== '' && isFinite(Number(String(c).replace(/,/g, '')))) qi = i; });
  return { map: { sku: 0, qty: qi > 0 ? qi : 1 }, header: false };
}
function indexProducts(){
  var by = { sku: {}, barcode: {}, supplierSku: {}, name: {} };
  (D().products || []).forEach(function(p){ if (!p || p.deleted) return;
    if (p.sku) by.sku[key(p.sku)] = by.sku[key(p.sku)] || p; if (p.barcode) by.barcode[key(p.barcode)] = by.barcode[key(p.barcode)] || p;
    if (p.supplierSku) by.supplierSku[key(p.supplierSku)] = by.supplierSku[key(p.supplierSku)] || p; if (p.mpn) by.supplierSku[key(p.mpn)] = by.supplierSku[key(p.mpn)] || p;
    if (p.name) by.name[norm(p.name)] = by.name[norm(p.name)] || p; });
  (D().supplierProducts || []).forEach(function(o){ if (o && o.supplierSku && !by.supplierSku[key(o.supplierSku)]) { var p = (D().products || []).find(function(x){ return x.id === o.productId; }); if (p) by.supplierSku[key(o.supplierSku)] = p; } });
  return by;
}
function locationFor(text){ if (!text) return null; var t = norm(text); return (D().locations || []).find(function(l){ return norm(l.name) === t || norm(l.id) === t; }) || null; }
function stockable(p){ var hub = global.PoolShedProductHub; if (global.PoolShedBundleEngine && global.PoolShedBundleEngine.isBundle(p)) return 'is a bundle (its parts hold the stock)'; if (hub && !hub.isStocked(p)) return 'is not stock-controlled'; return ''; }
function rowAt(pid, loc){ return (D().stock || []).find(function(r){ return r.productId === pid && r.locationId === loc; }) || null; }

function buildPlan(){
  var rows = splitRows(si.text); if (!rows.length) return { error: 'Paste the cells from your spreadsheet, or choose a CSV file.' };
  var col = columns(rows), body = col.header ? rows.slice(1) : rows, by = indexProducts(), m = col.map;
  if (m.qty == null) return { error: 'There is no quantity column. Name it “Qty”, “Quantity” or “Count”.' };
  var lines = {}, unmatched = [], skipped = [], bad = [];
  body.forEach(function(r, i){
    var rowNo = i + (col.header ? 2 : 1), rawQty = String(r[m.qty] == null ? '' : r[m.qty]).replace(/,/g, '').trim();
    if (rawQty === '' || !isFinite(Number(rawQty)) || Number(rawQty) < 0) { bad.push({ row: rowNo, text: r.join(' · '), why: rawQty === '' ? 'no quantity' : 'quantity “' + rawQty + '” is not a number' }); return; }
    var p = null, how = '';
    [['sku', 'SKU'], ['barcode', 'barcode'], ['supplierSku', 'supplier code']].some(function(k){ if (m[k[0]] == null) return false; var v = key(r[m[k[0]]]); if (v && by[k[0]][v]) { p = by[k[0]][v]; how = k[1]; return true; } return false; });
    if (!p && m.sku != null) { var v2 = key(r[m.sku]); if (v2 && by.barcode[v2]) { p = by.barcode[v2]; how = 'barcode'; } else if (v2 && by.supplierSku[v2]) { p = by.supplierSku[v2]; how = 'supplier code'; } }
    if (!p && m.name != null && by.name[norm(r[m.name])]) { p = by.name[norm(r[m.name])]; how = 'name'; }
    if (!p) { unmatched.push({ row: rowNo, text: r.filter(Boolean).join(' · ') }); return; }
    var why = stockable(p); if (why) { skipped.push({ row: rowNo, p: p, why: why }); return; }
    var loc = (m.location != null && locationFor(r[m.location])) ? locationFor(r[m.location]).id : si.location;
    if (HOLD.indexOf(loc) >= 0) loc = si.location;
    var k = p.id + '|' + loc, qty = Math.floor(Number(rawQty));
    if (lines[k]) { lines[k].qty += qty; lines[k].rows.push(rowNo); lines[k].dupe = true; }
    else lines[k] = { p: p, how: how, loc: loc, qty: qty, rows: [rowNo] };
  });
  var list = Object.keys(lines).map(function(k){ var l = lines[k], r = rowAt(l.p.id, l.loc), before = r ? num(r.qty) : 0, alloc = r ? num(r.allocated) : 0;
    var after = si.mode === 'add' ? before + l.qty : l.qty; l.floored = after < alloc; if (l.floored) after = alloc;
    l.before = before; l.after = after; l.diff = after - before; l.allocated = alloc; return l; });
  list.sort(function(a, b){ return Math.abs(b.diff) - Math.abs(a.diff); });
  return { lines: list, unmatched: unmatched, skipped: skipped, bad: bad, header: col.header, map: m, total: body.length };
}

// ---------- applying and undoing ----------
function apply(plan){
  var d = D(), id = 'SI-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(), user = who(), changes = [];
  if (!Array.isArray(d.stock)) d.stock = [];
  plan.lines.forEach(function(l){
    if (!l.diff) return;
    var r = rowAt(l.p.id, l.loc); if (!r) { r = { productId: l.p.id, locationId: l.loc, qty: 0, allocated: 0 }; d.stock.push(r); }
    var before = num(r.qty); r.qty = l.after;
    changes.push({ productId: l.p.id, locationId: l.loc, before: before, after: l.after });
    if (typeof addMovement === 'function') addMovement(si.mode === 'add' ? 'Stock added (import)' : 'Stock count (import)', l.p.id, Math.abs(l.after - before), l.after > before ? 'Count adjustment' : l.loc, l.after > before ? l.loc : 'Count adjustment', id, user, (l.after > before ? '+' : '−') + Math.abs(l.after - before) + ' from ' + before + ' to ' + l.after + (l.floored ? ' (kept at the reserved quantity)' : ''));
  });
  if (!Array.isArray(d.stockImports)) d.stockImports = [];
  var rec = { id: id, at: new Date().toISOString(), by: user, mode: si.mode, location: si.location, changes: changes, unmatched: plan.unmatched.length, rows: plan.total };
  d.stockImports.push(rec);
  try { if (global.PoolShedProductHub && global.PoolShedProductHub._resetCache) global.PoolShedProductHub._resetCache(); } catch (_) {}
  if (typeof saveAppData === 'function') saveAppData();
  return rec;
}
function undo(id){
  var d = D(), rec = (d.stockImports || []).find(function(x){ return x.id === id; }); if (!rec || rec.undoneAt) return { ok: false, error: 'This import has already been undone.' };
  var blocked = rec.changes.filter(function(c){ var r = rowAt(c.productId, c.locationId); return !r || num(r.qty) !== c.after || num(r.allocated) > c.before; });
  if (blocked.length) return { ok: false, error: blocked.length + ' product' + (blocked.length === 1 ? ' has' : 's have') + ' changed since the import (sold, received or reserved), so it can’t be undone safely. Count those again instead.' };
  rec.changes.forEach(function(c){ var r = rowAt(c.productId, c.locationId); r.qty = c.before;
    if (typeof addMovement === 'function') addMovement('Stock import undone', c.productId, Math.abs(c.after - c.before), c.locationId, c.locationId, rec.id, who(), 'Back to ' + c.before); });
  rec.undoneAt = new Date().toISOString(); rec.undoneBy = who();
  try { if (global.PoolShedProductHub && global.PoolShedProductHub._resetCache) global.PoolShedProductHub._resetCache(); } catch (_) {}
  if (typeof saveAppData === 'function') saveAppData();
  return { ok: true, count: rec.changes.length };
}

// ---------- the page ----------
function locName(id){ var l = (D().locations || []).find(function(x){ return x.id === id; }); return l ? l.name : id; }
function page(){
  var locs = (D().locations || []).filter(function(l){ return HOLD.indexOf(l.id) < 0; });
  var plan = si.plan, out = '<div class="si-page"><header class="cl-head"><div><h2>Import stock counts</h2><p>Paste from Excel or Google Sheets, or choose a CSV file. Nothing changes until you confirm, and you can undo it afterwards.</p></div><div class="cl-head-actions"><button type="button" class="secondary" data-si-close>Back to catalogue</button></div></header>';
  out += '<section class="cl-card si-card"><div class="si-grid"><label class="si-field"><span>1 · Your counts</span><textarea data-si-text rows="8" placeholder="SKU&#9;Qty&#10;PB-CPC-CLTAB201AS&#9;22&#10;PB-CPC-PHMIN15&#9;14">' + esc(si.text) + '</textarea><small>Copy the columns from your spreadsheet (with their headings) and paste them here. Columns can be SKU, Barcode or Supplier code, plus Qty, and optionally Location. <label class="si-file">or choose a CSV file<input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" data-si-file hidden></label></small></label>' +
    '<div class="si-side"><label class="si-field"><span>2 · Where the stock is</span><select data-si-loc>' + locs.map(function(l){ return '<option value="' + esc(l.id) + '"' + (l.id === si.location ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select><small>Used for rows without a Location column.</small></label>' +
    '<fieldset class="si-field si-mode"><span>3 · What the numbers mean</span><label><input type="radio" name="si-mode" value="set" data-si-mode' + (si.mode === 'set' ? ' checked' : '') + '> A count: set stock to these numbers</label><label><input type="radio" name="si-mode" value="add" data-si-mode' + (si.mode === 'add' ? ' checked' : '') + '> A delivery: add these to current stock</label></fieldset>' +
    '<button type="button" class="primary" data-si-preview>Preview the changes</button></div></div></section>';
  if (plan && plan.error) out += '<section class="cl-card si-msg">' + esc(plan.error) + '</section>';
  else if (plan) {
    var up = plan.lines.filter(function(l){ return l.diff > 0; }).length, down = plan.lines.filter(function(l){ return l.diff < 0; }).length, same = plan.lines.filter(function(l){ return !l.diff; }).length, floored = plan.lines.filter(function(l){ return l.floored; }).length;
    out += '<section class="cl-card"><div class="si-sum"><div><strong>' + plan.lines.length + ' product' + (plan.lines.length === 1 ? '' : 's') + ' matched</strong><small>' + up + ' going up · ' + down + ' going down · ' + same + ' unchanged' + (plan.unmatched.length ? ' · <b class="si-warn">' + plan.unmatched.length + ' row' + (plan.unmatched.length === 1 ? '' : 's') + ' not matched</b>' : '') + (plan.skipped.length ? ' · ' + plan.skipped.length + ' skipped' : '') + (plan.bad.length ? ' · ' + plan.bad.length + ' without a usable quantity' : '') + '</small></div>' +
      (up + down ? '<button type="button" class="primary" data-si-apply>' + (si.mode === 'add' ? 'Add' : 'Update') + ' stock for ' + (up + down) + ' product' + (up + down === 1 ? '' : 's') + '</button>' : '') + '</div>' +
      (floored ? '<p class="si-note">' + floored + ' product' + (floored === 1 ? ' is' : 's are') + ' counted lower than what is already reserved for orders, so ' + (floored === 1 ? 'it stays' : 'they stay') + ' at the reserved quantity: check those orders.</p>' : '') +
      '<div class="cl-table-wrap"><table class="cl-table"><thead><tr><th>Product</th><th>Matched by</th><th>Location</th><th class="num">Now</th><th class="num">After</th><th class="num">Change</th></tr></thead><tbody>' +
      plan.lines.slice(0, 300).map(function(l){ return '<tr' + (l.floored ? ' class="si-flag"' : '') + '><td><strong>' + esc(l.p.name) + '</strong><small>' + esc(l.p.sku || '') + (l.dupe ? ' · on ' + l.rows.length + ' rows, added together' : '') + '</small></td><td>' + esc(l.how) + '</td><td>' + esc(locName(l.loc)) + '</td><td class="num">' + l.before + '</td><td class="num"><strong>' + l.after + '</strong>' + (l.floored ? '<small>reserved ' + l.allocated + '</small>' : '') + '</td><td class="num ' + (l.diff > 0 ? 'si-up' : l.diff < 0 ? 'si-down' : '') + '">' + (l.diff > 0 ? '+' : '') + l.diff + '</td></tr>'; }).join('') +
      (plan.lines.length > 300 ? '<tr><td colspan="6" class="cl-dim">…and ' + (plan.lines.length - 300) + ' more</td></tr>' : '') + '</tbody></table></div>' +
      (plan.unmatched.length || plan.skipped.length || plan.bad.length ? '<details class="si-issues"' + (plan.lines.length ? '' : ' open') + '><summary>Rows that won’t be imported (' + (plan.unmatched.length + plan.skipped.length + plan.bad.length) + ')</summary><ul>' +
        plan.unmatched.slice(0, 200).map(function(u){ return '<li>Row ' + u.row + ': <b>no product found</b> · ' + esc(u.text) + '</li>'; }).join('') +
        plan.skipped.map(function(u){ return '<li>Row ' + u.row + ': ' + esc(u.p.name) + ' ' + esc(u.why) + '</li>'; }).join('') +
        plan.bad.map(function(u){ return '<li>Row ' + u.row + ': ' + esc(u.why) + ' · ' + esc(u.text) + '</li>'; }).join('') + '</ul>' +
        (plan.unmatched.length ? '<button type="button" class="secondary" data-si-unmatched>Download the rows that didn’t match</button>' : '') + '</details>' : '') + '</section>';
  }
  var history = (D().stockImports || []).slice(-5).reverse();
  if (history.length) out += '<section class="cl-card si-hist"><div class="si-sum"><strong>Recent imports</strong></div><ul>' + history.map(function(h){ return '<li><span>' + esc(h.id) + ' · ' + esc(String(h.at).slice(0, 16).replace('T', ' ')) + ' · ' + esc(h.by) + ' · ' + (h.mode === 'add' ? 'added' : 'counted') + ' ' + h.changes.length + ' product' + (h.changes.length === 1 ? '' : 's') + (h.undoneAt ? ' · <b>undone</b>' : '') + '</span>' + (h.undoneAt ? '' : '<button type="button" class="link si-link" data-si-undo="' + esc(h.id) + '">Undo this import</button>') + '</li>'; }).join('') + '</ul></section>';
  return out + '</div>';
}

// ---------- wiring into Stock › Catalogue ----------
if (typeof renderProducts === 'function') {
  var base = renderProducts;
  renderProducts = function(){
    try { var sub = typeof selectedSubPage === 'function' ? selectedSubPage('products') : ''; if (si.open && sub === 'Catalogue' && (typeof productView === 'undefined' || productView === 'list')) { var s = document.getElementById('screen-products'), html = page(); if (s) s.innerHTML = html; return html; } } catch (e) { console.warn('Stock import fell back', e); }
    return base.apply(this, arguments);
  };
  global.renderProducts = renderProducts;
}
function redraw(){ if (typeof renderProducts === 'function') renderProducts(); }
function download(name, rows){ var csv = rows.map(function(r){ return r.map(function(v){ v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500); }
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('[data-si-open],[data-si-close],[data-si-preview],[data-si-apply],[data-si-undo],[data-si-unmatched]'); if (!t) return;
    e.preventDefault(); var ds = t.dataset;
    if (ds.siOpen !== undefined) { si.open = true; if (global.poolShedProductData) global.poolShedProductData.open = false; si.plan = null; return redraw(); }
    if (ds.siClose !== undefined) { si.open = false; si.plan = null; return redraw(); }
    if (ds.siPreview !== undefined) { si.plan = buildPlan(); redraw(); var c = document.querySelector('.si-sum'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    if (ds.siUnmatched !== undefined && si.plan) { download('stock-import-not-matched.csv', [['Row', 'Contents']].concat(si.plan.unmatched.map(function(u){ return [u.row, u.text]; }))); return; }
    if (ds.siApply !== undefined && si.plan && si.plan.lines) {
      var plan = buildPlan(), n = plan.lines.filter(function(l){ return l.diff; }).length; if (!n) return toast2('Nothing to change.');
      var go = function(){ var rec = apply(plan); si.plan = null; si.text = ''; si.last = rec.id; toast2(rec.changes.length + ' product' + (rec.changes.length === 1 ? '' : 's') + ' updated (' + rec.id + '). You can undo it from Recent imports.'); redraw(); };
      if (global.PoolShedDialog) global.PoolShedDialog.confirm({ title: (si.mode === 'add' ? 'Add stock for ' : 'Update stock for ') + n + ' product' + (n === 1 ? '' : 's') + '?', message: 'Each change is recorded as a stock movement' + (plan.unmatched.length ? '; the ' + plan.unmatched.length + ' rows that didn’t match are left out' : '') + '. You can undo this import afterwards if nothing has moved since.', confirmLabel: 'Update stock' }).then(function(yes){ if (yes) go(); });
      else if (global.confirm('Update stock for ' + n + ' products?')) go();
      return;
    }
    if (ds.siUndo) { var res = undo(ds.siUndo); toast2(res.ok ? res.count + ' product' + (res.count === 1 ? '' : 's') + ' put back as they were.' : res.error); return redraw(); }
  }, true);
  document.addEventListener('input', function(e){ var t = e.target.closest && e.target.closest('[data-si-text]'); if (t) { si.text = t.value; si.plan = null; } });
  document.addEventListener('change', function(e){
    var t = e.target.closest && e.target.closest('[data-si-loc],[data-si-mode],[data-si-file]'); if (!t) return;
    if (t.hasAttribute('data-si-loc')) { si.location = t.value; if (si.plan) si.plan = buildPlan(); return redraw(); }
    if (t.hasAttribute('data-si-mode')) { si.mode = t.value; if (si.plan) si.plan = buildPlan(); return redraw(); }
    if (t.hasAttribute('data-si-file') && t.files && t.files[0]) { var f = t.files[0]; if (/\.xlsx?$/i.test(f.name)) { toast2('Save the sheet as CSV first, or copy the cells and paste them in.'); return; } f.text().then(function(txt){ si.text = txt; si.plan = buildPlan(); redraw(); }); }
  });
}
global.PoolShedStockImport = { splitRows: splitRows, indexProducts: indexProducts, key: key, columns: columns, buildPlan: buildPlan, apply: apply, undo: undo, page: page, state: si };
})(typeof window !== 'undefined' ? window : globalThis);
