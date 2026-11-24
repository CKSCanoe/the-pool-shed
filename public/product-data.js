/* Pool Shed product data (from v1.98): fill in the gaps in the catalogue.
   Stock › Catalogue › "Fill gaps". Three ways in:
   1. Fill in by hand: products missing an RRP, a cost, a barcode or an image, edited like a spreadsheet
      (paste a column from Excel into the first box and it fills down), with live margin, barcode checks and
      "Price from cost" to set RRPs at a chosen margin.
   2. Supplier price list: paste or choose a CSV (SKU / supplier code / barcode, plus cost, RRP, trade, wholesale, barcode),
      preview every change, "only fill gaps" by default; costs also update that supplier's offer.
   3. Images by file name: choose many images named by SKU, barcode or supplier code (e.g. PB-CPC-PHMIN15.jpg,
      PB-CPC-PHMIN15-2.jpg for extra images); they upload securely to the right products.
   Every save is recorded and can be undone while the values are unchanged since. */
(function(global){
'use strict';
var num = function(v){ var n = Number(v); return isFinite(n) ? n : 0; };
var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var GAPS = [['rrp', 'No RRP'], ['cost', 'No cost'], ['barcode', 'No barcode'], ['image', 'No image']];
var FIELDS = ['cost', 'rrp', 'trade', 'wholesale', 'barcode'];
var PER = 50;
var pd = global.poolShedProductData || { open: false, mode: 'grid', gap: 'rrp', q: '', supplier: '', page: 0, draft: {}, margin: 40, text: '', fill: 'gaps', impSupplier: '', plan: null, files: [], uploading: null };
global.poolShedProductData = pd;
function D(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? global.__POOL_SHED_GET_DATA__() : (typeof data !== 'undefined' ? data : {}); }
function toast2(m){ try { (global.toast || console.log)(m); } catch (_) {} }
function who(){ try { return (currentUser() || {}).name || 'Office'; } catch (_) { return 'Office'; } }
function SI(){ return global.PoolShedStockImport; }
function key(v){ return String(v == null ? '' : v).trim().toLowerCase().replace(/[\s\-_.\/]+/g, ''); }
function money(v){ return '£' + num(v).toFixed(2); }
function isBundle(p){ return !!(global.PoolShedBundleEngine && global.PoolShedBundleEngine.isBundle(p)); }
function live(p){ return p && !p.deleted && !p.archived && String(p.status || '').toLowerCase() !== 'archived'; }
function oneOff(p){ return !!p.hiddenFromCatalogue || /^(PO)?CUSTOM-/i.test(String(p.sku || '')); }
function missing(p, gap){
  if (gap === 'rrp') return !(num(p.rrp) > 0);
  if (gap === 'cost') return !isBundle(p) && !(num(p.cost) > 0);
  if (gap === 'barcode') return !String(p.barcode || '').trim();
  if (gap === 'image') return !(p.imageUrl || p.variantImageUrl);
  return false;
}
function counts(){ var c = { rrp: 0, cost: 0, barcode: 0, image: 0, total: 0, oneOff: 0 }; (D().products || []).forEach(function(p){ if (!live(p)) return; if (oneOff(p) && !pd.oneOff) { c.oneOff++; return; } c.total++; GAPS.forEach(function(g){ if (missing(p, g[0])) c[g[0]]++; }); }); return c; }
// EAN-8 / UPC-A / EAN-13 / GTIN-14 check digit
function barcodeIssue(v){
  v = String(v || '').trim(); if (!v) return '';
  if (!/^\d+$/.test(v)) return 'not all digits';
  if ([8, 12, 13, 14].indexOf(v.length) < 0) return v.length + ' digits (expected 8, 12, 13 or 14)';
  var s = 0, d = v.split('').map(Number), check = d.pop(); d.reverse().forEach(function(x, i){ s += x * (i % 2 ? 1 : 3); });
  return (10 - s % 10) % 10 === check ? '' : 'check digit does not match';
}
function barcodeOwner(v, exceptId){ if (!v) return null; var k = key(v); return (D().products || []).find(function(p){ return p.id !== exceptId && live(p) && key(p.barcode) === k; }) || null; }
function margin(cost, rrp){ return num(rrp) > 0 && num(cost) > 0 ? ((num(rrp) - num(cost)) / num(rrp)) * 100 : null; }
function priceFromCost(cost, m){ m = Math.min(95, Math.max(0, num(m))); var p = num(cost) / (1 - m / 100); return p > 0 ? Math.ceil(p * 100 - 1e-6) / 100 : 0; }

// ---------- recording changes (shared by all three) ----------
function record(changes, source){
  var d = D(); if (!changes.length) return null;
  var id = 'PD-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  if (!Array.isArray(d.productDataChanges)) d.productDataChanges = [];
  var rec = { id: id, at: new Date().toISOString(), by: who(), source: source, changes: changes };
  d.productDataChanges.push(rec); if (d.productDataChanges.length > 60) d.productDataChanges.splice(0, d.productDataChanges.length - 60);
  try { if (global.PoolShedProductHub && global.PoolShedProductHub._resetCache) global.PoolShedProductHub._resetCache(); } catch (_) {}
  if (typeof saveAppData === 'function') saveAppData();
  return rec;
}
function setField(p, f, v, changes, offer){
  var before = p[f] == null ? '' : p[f]; if (String(before) === String(v)) return;
  p[f] = v; p.updatedAt = new Date().toISOString(); changes.push({ productId: p.id, field: f, before: before, after: v });
  if (offer && f === 'cost') { var ob = offer.cost; offer.cost = v; changes.push({ productId: p.id, field: 'cost', offerSupplier: offer.supplier, before: ob == null ? '' : ob, after: v }); }
}
function undo(id){
  var d = D(), rec = (d.productDataChanges || []).find(function(x){ return x.id === id; }); if (!rec || rec.undoneAt) return { ok: false, error: 'Already undone.' };
  var prods = {}; (d.products || []).forEach(function(p){ prods[p.id] = p; });
  function target(c){ return c.offerSupplier ? (d.supplierProducts || []).find(function(o){ return o.productId === c.productId && o.supplier === c.offerSupplier; }) : prods[c.productId]; }
  var moved = rec.changes.filter(function(c){ var t = target(c); return !t || String(t[c.field] == null ? '' : t[c.field]) !== String(c.after); });
  if (moved.length) return { ok: false, error: moved.length + ' value' + (moved.length === 1 ? ' has' : 's have') + ' been changed again since, so this can’t be undone safely.' };
  rec.changes.forEach(function(c){ var t = target(c); t[c.field] = c.before; if (!c.offerSupplier) t.updatedAt = new Date().toISOString(); });
  rec.undoneAt = new Date().toISOString(); rec.undoneBy = who();
  try { if (global.PoolShedProductHub && global.PoolShedProductHub._resetCache) global.PoolShedProductHub._resetCache(); } catch (_) {}
  if (typeof saveAppData === 'function') saveAppData();
  return { ok: true, count: rec.changes.filter(function(c){ return !c.offerSupplier; }).length };
}

// ---------- 1. fill in by hand ----------
function gridRows(){
  var q = pd.q.trim().toLowerCase().split(/\s+/).filter(Boolean), sup = pd.supplier;
  return (D().products || []).filter(function(p){
    if (!live(p) || (oneOff(p) && !pd.oneOff)) return false;
    if (!missing(p, pd.gap) && !pd.draft[p.id]) return false;
    if (sup && (p.preferredSupplier || p.supplier || '') !== sup) return false;
    if (q.length) { var h = [p.name, p.sku, p.supplierSku, p.brand, p.category].join(' ').toLowerCase(); if (!q.every(function(w){ return h.indexOf(w) >= 0; })) return false; }
    return true;
  }).sort(function(a, b){ return String(a.preferredSupplier || a.supplier || '~').localeCompare(String(b.preferredSupplier || b.supplier || '~')) || String(a.name).localeCompare(String(b.name)); });
}
function val(p, f){ var d = pd.draft[p.id]; if (d && d[f] !== undefined) return d[f]; var v = p[f] == null ? '' : p[f]; return f !== 'barcode' && v !== '' && !(num(v) > 0) ? '' : v; }
function draftCount(){ return Object.keys(pd.draft).reduce(function(n, id){ return n + Object.keys(pd.draft[id]).length; }, 0); }
function setDraft(id, f, v){
  var p = (D().products || []).find(function(x){ return x.id === id; }); if (!p) return;
  v = String(v == null ? '' : v).trim(); if (f !== 'barcode') v = v.replace(/[£,\s]/g, '');
  var cur = p[f] == null ? '' : String(p[f]); if (f !== 'barcode' && !(num(cur) > 0)) cur = '';
  pd.draft[id] = pd.draft[id] || {};
  if (v === cur || (f !== 'barcode' && v !== '' && cur !== '' && num(v) === num(cur))) delete pd.draft[id][f]; else pd.draft[id][f] = v;
  if (!Object.keys(pd.draft[id]).length) delete pd.draft[id];
}
function draftProblems(){
  var out = []; Object.keys(pd.draft).forEach(function(id){ var dr = pd.draft[id], p = (D().products || []).find(function(x){ return x.id === id; }); if (!p) return;
    ['cost', 'rrp', 'trade', 'wholesale'].forEach(function(f){ if (dr[f] !== undefined && dr[f] !== '' && (!isFinite(Number(dr[f])) || Number(dr[f]) < 0)) out.push(p.sku + ': ' + f + ' “' + dr[f] + '” is not a price'); });
    if (dr.barcode) { var own = barcodeOwner(dr.barcode, id); if (own) out.push(p.sku + ': barcode already on ' + own.sku); } });
  return out;
}
function saveDraft(){
  var probs = draftProblems(); if (probs.length) return { ok: false, error: probs.slice(0, 3).join(' · ') };
  var changes = [], prods = {}; (D().products || []).forEach(function(p){ prods[p.id] = p; });
  Object.keys(pd.draft).forEach(function(id){ var p = prods[id]; if (!p) return; Object.keys(pd.draft[id]).forEach(function(f){ var v = pd.draft[id][f]; setField(p, f, f === 'barcode' ? v : (v === '' ? '' : Math.round(Number(v) * 100) / 100), changes); }); });
  pd.draft = {}; var rec = record(changes, 'By hand'); return { ok: true, rec: rec, count: changes.length };
}
function priceVisibleFromCost(){
  var n = 0; gridRows().forEach(function(p){ var c = num(val(p, 'cost')); if (c > 0 && !(num(val(p, 'rrp')) > 0)) { setDraft(p.id, 'rrp', priceFromCost(c, pd.margin).toFixed(2)); n++; } }); return n;
}
function gridPage(){
  var c = counts(), rows = gridRows(), pages = Math.max(1, Math.ceil(rows.length / PER)); if (pd.page >= pages) pd.page = pages - 1;
  var view = rows.slice(pd.page * PER, pd.page * PER + PER), sups = {}; (D().products || []).forEach(function(p){ if (live(p) && (pd.oneOff || !oneOff(p)) && missing(p, pd.gap)) { var s = p.preferredSupplier || p.supplier; if (s) sups[s] = (sups[s] || 0) + 1; } });
  var dc = draftCount(), out = '<nav class="cl-tabs pd-gaps">' + GAPS.map(function(g){ return '<button type="button" class="' + (pd.gap === g[0] ? 'on' : '') + '" data-pd-gap="' + g[0] + '">' + g[1] + '<em>' + c[g[0]].toLocaleString('en-GB') + '</em></button>'; }).join('') + '</nav>';
  out += '<div class="cl-bar pd-bar"><input type="search" data-pd-q placeholder="Search name, SKU, brand…" value="' + esc(pd.q) + '"><select data-pd-supplier><option value="">All suppliers</option>' + Object.keys(sups).sort().map(function(s){ return '<option value="' + esc(s) + '"' + (s === pd.supplier ? ' selected' : '') + '>' + esc(s) + ' (' + sups[s] + ')</option>'; }).join('') + '</select>' +
    (pd.gap === 'rrp' ? '<span class="pd-pfc">RRP from cost at <input type="number" min="0" max="90" step="1" data-pd-margin value="' + esc(pd.margin) + '">% margin <button type="button" class="secondary" data-pd-pfc>Fill these RRPs</button></span>' : '') + (c.oneOff || pd.oneOff ? '<label class="pd-oneoff"><input type="checkbox" data-pd-oneoff' + (pd.oneOff ? ' checked' : '') + '> Include one-off custom items' + (pd.oneOff ? '' : ' (' + c.oneOff + ')') + '</label>' : '') +
    '<span class="pd-save">' + (dc ? '<button type="button" class="link si-link" data-pd-discard>Discard</button><button type="button" class="primary" data-pd-save>Save ' + dc + ' change' + (dc === 1 ? '' : 's') + '</button>' : '<small>Changes are kept until you save. Paste a column from Excel into a box to fill down.</small>') + '</span></div>';
  if (pd.gap === 'image') {
    out += '<div class="pd-empty">' + c.image.toLocaleString('en-GB') + ' products have no image. The quickest way is <button type="button" class="link si-link" data-pd-mode="images">Images by file name</button>: name each image by SKU or barcode and upload them together.</div>';
  }
  if (!rows.length) return out + '<div class="pd-empty">Nothing missing here' + (pd.q || pd.supplier ? ' for this search' : '') + '.</div>';
  out += '<div class="cl-table-wrap"><table class="cl-table pd-table"><thead><tr><th>Product</th><th>Supplier</th><th class="num">Cost</th><th class="num">RRP</th><th class="num">Trade</th><th class="num">Wholesale</th><th class="num">Margin</th><th>Barcode</th></tr></thead><tbody>' +
    view.map(function(p){ var dr = pd.draft[p.id] || {}, m = margin(val(p, 'cost'), val(p, 'rrp')), bi = barcodeIssue(val(p, 'barcode')), dup = dr.barcode ? barcodeOwner(dr.barcode, p.id) : null;
      function cell(f, cls){ return '<td class="' + (cls || '') + '"><input class="pd-in' + (dr[f] !== undefined ? ' pd-dirty' : '') + (missing(p, f) && dr[f] === undefined ? ' pd-miss' : '') + '" data-pd-cell="' + esc(p.id) + '|' + f + '" value="' + esc(val(p, f)) + '"' + (f === 'barcode' ? ' inputmode="numeric"' : ' inputmode="decimal"') + (f === 'cost' && isBundle(p) ? ' disabled title="A bundle’s cost is the total of its parts"' : '') + '></td>'; }
      return '<tr><td><button type="button" class="link pd-name" data-ph-open-product="' + esc(p.id) + '">' + esc(p.name) + '</button><small>' + esc(p.sku || '') + (p.supplierSku ? ' · ' + esc(p.supplierSku) : '') + '</small></td><td><small>' + esc(p.preferredSupplier || p.supplier || '—') + '</small></td>' +
        cell('cost', 'num') + cell('rrp', 'num') + cell('trade', 'num') + cell('wholesale', 'num') + '<td class="num">' + (m == null ? '—' : '<span class="' + (m < 15 ? 'si-down' : '') + '">' + m.toFixed(0) + '%</span>') + '</td>' + cell('barcode') .replace('</td>', (bi || dup ? '<small class="si-warn">' + esc(dup ? 'already on ' + dup.sku : bi) + '</small>' : '') + '</td>') + '</tr>'; }).join('') + '</tbody></table></div>';
  if (pages > 1) out += '<div class="pd-pager"><button type="button" class="secondary" data-pd-page="-1"' + (pd.page ? '' : ' disabled') + '>Previous</button><span>' + (pd.page * PER + 1) + '–' + Math.min(rows.length, pd.page * PER + PER) + ' of ' + rows.length.toLocaleString('en-GB') + '</span><button type="button" class="secondary" data-pd-page="1"' + (pd.page < pages - 1 ? '' : ' disabled') + '>Next</button></div>';
  return out;
}

// ---------- 2. supplier price list ----------
var HEAD = { sku: /^(sku|code|product ?code|item ?code|our ?code|pool ?shed ?sku)$/i, supplierSku: /^(supplier ?(sku|code|ref|part( ?no)?)|part ?(no|number)|mpn|manufacturer ?code|stock ?code)$/i, barcodeKey: /^(barcode|ean|ean13|upc|gtin)$/i,
  cost: /^(cost|unit ?cost|net|net ?price|buy|buy ?price|trade ?cost|price ?ex ?vat|cost ?price|our ?price)$/i, rrp: /^(rrp|retail|retail ?price|sell|sell ?price|srp|msrp)$/i, trade: /^(trade|trade ?price)$/i, wholesale: /^(wholesale|wholesale ?price)$/i, name: /^(name|description|product|product ?name|item)$/i };
function importColumns(rows){ var m = {}; (rows[0] || []).forEach(function(h, i){ var t = String(h || '').trim(); Object.keys(HEAD).forEach(function(k){ if (m[k] == null && HEAD[k].test(t)) m[k] = i; }); }); return m; }
function price(v){ v = String(v == null ? '' : v).replace(/[£$€,\s]/g, ''); return v !== '' && isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v) * 100) / 100 : null; }
function buildImport(){
  var rows = SI().splitRows(pd.text); if (rows.length < 2) return { error: 'Paste the price list with its headings (for example: Supplier code, Cost, RRP, Barcode), or choose a CSV file.' };
  var m = importColumns(rows); if (m.sku == null && m.supplierSku == null && m.barcodeKey == null) return { error: 'There is no column to match products by. Name one “SKU”, “Supplier code” or “Barcode”.' };
  if (m.cost == null && m.rrp == null && m.trade == null && m.wholesale == null && m.barcodeKey == null) return { error: 'There is nothing to update. Add a Cost, RRP, Trade, Wholesale or Barcode column.' };
  var by = SI().indexProducts(), sup = pd.impSupplier, supIdx = {};
  if (sup) (D().supplierProducts || []).forEach(function(o){ if (o && o.supplier === sup && o.supplierSku) supIdx[key(o.supplierSku)] = o.productId; });
  var prods = {}; (D().products || []).forEach(function(p){ prods[p.id] = p; });
  var lines = [], unmatched = [], seen = {};
  rows.slice(1).forEach(function(r, i){
    var p = null, how = '';
    if (m.supplierSku != null && r[m.supplierSku]) { var k = key(r[m.supplierSku]); if (supIdx[k]) { p = prods[supIdx[k]]; how = 'supplier code'; } else if (by.supplierSku[k]) { p = by.supplierSku[k]; how = 'supplier code'; } else if (by.sku[k]) { p = by.sku[k]; how = 'SKU'; } else if (by.barcode[k]) { p = by.barcode[k]; how = 'barcode'; } }
    if (!p && m.sku != null && r[m.sku]) { var k2 = key(r[m.sku]); if (by.sku[k2]) { p = by.sku[k2]; how = 'SKU'; } else if (by.supplierSku[k2]) { p = by.supplierSku[k2]; how = 'supplier code'; } }
    if (!p && m.barcodeKey != null && r[m.barcodeKey] && by.barcode[key(r[m.barcodeKey])]) { p = by.barcode[key(r[m.barcodeKey])]; how = 'barcode'; }
    if (!p || p.deleted) { if (r.some(Boolean)) unmatched.push({ row: i + 2, text: r.filter(Boolean).join(' · ') }); return; }
    if (seen[p.id]) return; seen[p.id] = true;
    var ch = [];
    ['cost', 'rrp', 'trade', 'wholesale'].forEach(function(f){ if (m[f] == null) return; if (f === 'cost' && isBundle(p)) return; var v = price(r[m[f]]); if (v == null || v === 0) return; var cur = num(p[f]);
      if (cur === v) return; if (pd.fill === 'gaps' && cur > 0) return; ch.push({ f: f, before: p[f] == null ? '' : p[f], after: v }); });
    if (m.barcodeKey != null) { var b = String(r[m.barcodeKey] || '').trim(); if (b && key(b) !== key(p.barcode) && (pd.fill !== 'gaps' || !String(p.barcode || '').trim()) && !barcodeIssue(b) && !barcodeOwner(b, p.id)) ch.push({ f: 'barcode', before: p.barcode || '', after: b }); }
    if (ch.length) { var nc = ch.find(function(c){ return c.f === 'cost'; }), nr = ch.find(function(c){ return c.f === 'rrp'; });
      lines.push({ p: p, how: how, ch: ch, margin: margin(nc ? nc.after : p.cost, nr ? nr.after : p.rrp), costJump: nc && num(nc.before) > 0 ? (nc.after - num(nc.before)) / num(nc.before) * 100 : null, big: ch.some(function(c){ return c.f !== 'barcode' && num(c.before) > 0 && Math.abs(c.after - num(c.before)) / num(c.before) >= 0.2; }) }); }
  });
  return { lines: lines, unmatched: unmatched, total: rows.length - 1, matched: Object.keys(seen).length, map: m };
}
function applyImport(plan){
  var changes = [], sup = pd.impSupplier;
  plan.lines.forEach(function(l){ var offer = sup ? (D().supplierProducts || []).find(function(o){ return o.productId === l.p.id && o.supplier === sup; }) : null;
    l.ch.forEach(function(c){ setField(l.p, c.f, c.after, changes, offer); }); });
  return record(changes, 'Price list' + (sup ? ' · ' + sup : ''));
}
var LBL = { cost: 'Cost', rrp: 'RRP', trade: 'Trade', wholesale: 'Wholesale', barcode: 'Barcode' };
function importPage(){
  var sups = {}; (D().supplierProducts || []).forEach(function(o){ if (o && o.supplier) sups[o.supplier] = 1; }); (D().suppliers || []).forEach(function(s){ if (s && s.name) sups[s.name] = 1; });
  var out = '<div class="si-grid pd-imp"><label class="si-field"><span>1 · The price list</span><textarea data-pd-text rows="8" placeholder="Supplier code&#9;Cost&#9;RRP&#9;Barcode&#10;CLTAB201AS&#9;18.40&#9;34.99&#9;5012345678900">' + esc(pd.text) + '</textarea><small>Copy the columns with their headings from the supplier’s spreadsheet. Match by SKU, Supplier code or Barcode; update Cost, RRP, Trade, Wholesale and Barcode. <label class="si-file">or choose a CSV file<input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" data-pd-file hidden></label></small></label>' +
    '<div class="si-side"><label class="si-field"><span>2 · Whose price list</span><select data-pd-impsup><option value="">Any supplier</option>' + Object.keys(sups).sort().map(function(s){ return '<option value="' + esc(s) + '"' + (s === pd.impSupplier ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select><small>Choosing the supplier matches their own codes first and updates the cost on their offer too.</small></label>' +
    '<fieldset class="si-field si-mode"><span>3 · What to change</span><label><input type="radio" name="pd-fill" value="gaps" data-pd-fill' + (pd.fill === 'gaps' ? ' checked' : '') + '> Only fill in what is missing</label><label><input type="radio" name="pd-fill" value="all" data-pd-fill' + (pd.fill === 'all' ? ' checked' : '') + '> Update to the new prices</label></fieldset>' +
    '<button type="button" class="primary" data-pd-preview>Preview the changes</button></div></div>';
  var plan = pd.plan; if (!plan) return out;
  if (plan.error) return out + '<div class="si-msg">' + esc(plan.error) + '</div>';
  var n = plan.lines.reduce(function(t, l){ return t + l.ch.length; }, 0), jumps = plan.lines.filter(function(l){ return l.big; }).length, low = plan.lines.filter(function(l){ return l.margin != null && l.margin < 15; }).length;
  out += '<div class="si-sum"><div><strong>' + plan.lines.length + ' product' + (plan.lines.length === 1 ? '' : 's') + ' to update · ' + n + ' value' + (n === 1 ? '' : 's') + '</strong><small>' + plan.total + ' rows · ' + plan.matched + ' matched' + (plan.matched - plan.lines.length > 0 ? ' (' + (plan.matched - plan.lines.length) + ' already up to date' + (pd.fill === 'gaps' ? ' or already filled in' : '') + ')' : '') + (plan.unmatched.length ? ' · <b class="si-warn">' + plan.unmatched.length + ' not matched</b>' : '') + '</small></div>' + (n ? '<button type="button" class="primary" data-pd-apply>Update ' + plan.lines.length + ' product' + (plan.lines.length === 1 ? '' : 's') + '</button>' : '') + '</div>';
  if (jumps || low) out += '<p class="si-note">' + (jumps ? jumps + ' product' + (jumps === 1 ? ' has a price' : 's have prices') + ' changing by 20% or more' : '') + (jumps && low ? ' · ' : '') + (low ? low + ' product' + (low === 1 ? '' : 's') + ' would be under 15% margin' : '') + ': they are highlighted below.</p>';
  out += '<div class="cl-table-wrap"><table class="cl-table"><thead><tr><th>Product</th><th>Matched by</th><th>Changes</th><th class="num">Margin after</th></tr></thead><tbody>' + plan.lines.slice(0, 300).map(function(l){
    var flag = l.big || (l.margin != null && l.margin < 15);
    return '<tr' + (flag ? ' class="si-flag"' : '') + '><td><strong>' + esc(l.p.name) + '</strong><small>' + esc(l.p.sku || '') + '</small></td><td>' + esc(l.how) + '</td><td>' + l.ch.map(function(c){ return '<span class="pd-ch">' + LBL[c.f] + ' ' + (c.before === '' || c.before == null ? '<i>empty</i>' : esc(c.f === 'barcode' ? c.before : money(c.before))) + ' → <b>' + esc(c.f === 'barcode' ? c.after : money(c.after)) + '</b>' + (c.f !== 'barcode' && num(c.before) > 0 ? ' <small>(' + (c.after >= num(c.before) ? '+' : '') + ((c.after - num(c.before)) / num(c.before) * 100).toFixed(0) + '%)</small>' : '') + '</span>'; }).join('') + '</td><td class="num">' + (l.margin == null ? '—' : '<span class="' + (l.margin < 15 ? 'si-down' : '') + '">' + l.margin.toFixed(0) + '%</span>') + '</td></tr>'; }).join('') +
    (plan.lines.length > 300 ? '<tr><td colspan="4" class="cl-dim">…and ' + (plan.lines.length - 300) + ' more</td></tr>' : '') + '</tbody></table></div>';
  if (plan.unmatched.length) out += '<details class="si-issues"><summary>Rows not matched (' + plan.unmatched.length + ')</summary><ul>' + plan.unmatched.slice(0, 200).map(function(u){ return '<li>Row ' + u.row + ': ' + esc(u.text) + '</li>'; }).join('') + '</ul><button type="button" class="secondary" data-pd-unmatched>Download the rows that didn’t match</button></details>';
  return out;
}

// ---------- 3. images by file name ----------
function matchFile(name){
  var stem = String(name || '').replace(/\.[a-z0-9]+$/i, ''), extra = false, by = SI().indexProducts();
  function find(s){ var k = key(s); return by.sku[k] || by.barcode[k] || by.supplierSku[k] || null; }
  var p = find(stem);
  if (!p) { var m = stem.match(/^(.*?)[\s_\-.(]+(\d{1,2})\)?$/); if (m && find(m[1])) { p = find(m[1]); extra = Number(m[2]) > 1; } }
  return { p: p, extra: extra };
}
function planFiles(files){
  var claimed = {};
  return files.map(function(f){ var ok = /^image\/(jpeg|png|webp)$/.test(f.type || '') || /\.(jpe?g|png|webp)$/i.test(f.name), m = ok ? matchFile(f.name) : { p: null };
    var kind = !m.p ? '' : (!m.extra && !(m.p.imageUrl || m.p.variantImageUrl) && !claimed[m.p.id] ? 'main_image' : 'gallery');
    if (kind === 'main_image') claimed[m.p.id] = true;
    return { file: f, p: m.p, kind: kind, why: !ok ? 'not a JPG, PNG or WebP image' : (m.p ? '' : 'no product with this SKU, barcode or supplier code'), status: '' }; });
}
async function uploadAll(){
  var list = pd.files.filter(function(x){ return x.p && x.status !== 'done'; }); if (!list.length) return;
  if (!global.PoolShedBusinessMedia) return toast2('Image upload is not available here.');
  pd.uploading = { done: 0, total: list.length, failed: 0 }; redraw();
  var changes = [];
  for (var i = 0; i < list.length; i++) { var x = list[i];
    try { var media = await global.PoolShedBusinessMedia.upload('product', x.p.id, x.kind, x.file, { title: x.p.name || x.p.sku || '', altText: x.p.name || '' });
      if (x.kind === 'main_image' && !(x.p.imageUrl || x.p.variantImageUrl)) { changes.push({ productId: x.p.id, field: 'imageUrl', before: x.p.imageUrl || '', after: media.ref }); x.p.imageUrl = media.ref; }
      else { x.p.galleryImages = Array.isArray(x.p.galleryImages) ? x.p.galleryImages : []; x.p.galleryImages.push(media.ref); }
      x.p.updatedAt = new Date().toISOString(); x.status = 'done'; pd.uploading.done++;
    } catch (e) { x.status = 'failed'; x.why = e.message || 'upload failed'; pd.uploading.failed++; }
    if (i % 5 === 4) redraw();
  }
  var u = pd.uploading; pd.uploading = null;
  if (u.done) { record(changes, 'Images'); if (!changes.length && typeof saveAppData === 'function') saveAppData(); }
  toast2(u.done + ' image' + (u.done === 1 ? '' : 's') + ' uploaded' + (u.failed ? ', ' + u.failed + ' failed (listed below)' : '') + '.'); redraw();
}
function imagesPage(){
  var f = pd.files, ok = f.filter(function(x){ return x.p; }), main = ok.filter(function(x){ return x.kind === 'main_image'; }).length, done = f.filter(function(x){ return x.status === 'done'; }).length;
  var out = '<div class="pd-drop" data-pd-drop><strong>Choose or drop images</strong><span>Name each file by SKU, barcode or supplier code, for example <code>PB-CPC-PHMIN15.jpg</code>. Add <code>-2</code>, <code>-3</code> for more images of the same product. JPG, PNG or WebP.</span><label class="secondary pd-pick">Choose images<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-pd-images hidden></label></div>';
  if (!f.length) return out;
  out += '<div class="si-sum"><div><strong>' + f.length + ' image' + (f.length === 1 ? '' : 's') + ' · ' + ok.length + ' matched</strong><small>' + main + ' as the main image · ' + (ok.length - main) + ' to the gallery' + (f.length - ok.length ? ' · <b class="si-warn">' + (f.length - ok.length) + ' not matched</b>' : '') + (done ? ' · ' + done + ' uploaded' : '') + '</small></div>' +
    (pd.uploading ? '<strong>Uploading ' + pd.uploading.done + ' of ' + pd.uploading.total + '…</strong>' : '<span><button type="button" class="link si-link" data-pd-clear-files>Clear</button> ' + (ok.length - done ? '<button type="button" class="primary" data-pd-upload>Upload ' + (ok.length - done) + ' image' + (ok.length - done === 1 ? '' : 's') + '</button>' : '') + '</span>') + '</div>';
  out += '<div class="cl-table-wrap"><table class="cl-table"><thead><tr><th>File</th><th>Product</th><th>Goes to</th><th>Status</th></tr></thead><tbody>' + f.slice(0, 400).map(function(x){
    return '<tr' + (!x.p || x.status === 'failed' ? ' class="si-flag"' : '') + '><td>' + esc(x.file.name) + '</td><td>' + (x.p ? '<strong>' + esc(x.p.name) + '</strong><small>' + esc(x.p.sku || '') + '</small>' : '<span class="si-warn">' + esc(x.why) + '</span>') + '</td><td>' + (x.p ? (x.kind === 'main_image' ? 'Main image' : 'Gallery') : '—') + '</td><td>' + (x.status === 'done' ? '<span class="si-up">Uploaded</span>' : x.status === 'failed' ? '<span class="si-down">' + esc(x.why) + '</span>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  return out;
}

// ---------- the page ----------
var MODES = [['grid', 'Fill in by hand'], ['import', 'Supplier price list'], ['images', 'Images by file name']];
function page(){
  var c = counts(), out = '<div class="si-page pd-page"><header class="cl-head"><div><h2>Fill the gaps</h2><p>' + c.total.toLocaleString('en-GB') + ' products · ' + GAPS.map(function(g){ return c[g[0]].toLocaleString('en-GB') + ' ' + g[1].replace(/^No /, 'no '); }).join(' · ') + (c.oneOff ? ' · one-off custom items left out' : '') + '</p></div><div class="cl-head-actions"><button type="button" class="secondary" data-pd-close>Back to catalogue</button></div></header>';
  out += '<section class="cl-card"><nav class="pd-modes">' + MODES.map(function(m){ return '<button type="button" class="' + (pd.mode === m[0] ? 'on' : '') + '" data-pd-mode="' + m[0] + '">' + m[1] + '</button>'; }).join('') + '</nav><div class="pd-body">' + (pd.mode === 'import' ? importPage() : pd.mode === 'images' ? imagesPage() : gridPage()) + '</div></section>';
  var hist = (D().productDataChanges || []).slice(-5).reverse();
  if (hist.length) out += '<section class="cl-card si-hist"><div class="si-sum"><strong>Recent changes</strong></div><ul>' + hist.map(function(h){ var n = h.changes.filter(function(x){ return !x.offerSupplier; }).length, prods = {}; h.changes.forEach(function(x){ prods[x.productId] = 1; });
    return '<li><span>' + esc(String(h.at).slice(0, 16).replace('T', ' ')) + ' · ' + esc(h.by) + ' · ' + esc(h.source) + ' · ' + n + ' value' + (n === 1 ? '' : 's') + ' on ' + Object.keys(prods).length + ' product' + (Object.keys(prods).length === 1 ? '' : 's') + (h.undoneAt ? ' · <b>undone</b>' : '') + '</span>' + (h.undoneAt || h.source === 'Images' ? '' : '<button type="button" class="link si-link" data-pd-undo="' + esc(h.id) + '">Undo</button>') + '</li>'; }).join('') + '</ul></section>';
  return out + '</div>';
}

// ---------- wiring ----------
if (typeof renderProducts === 'function') {
  var base = renderProducts;
  renderProducts = function(){
    try { var sub = typeof selectedSubPage === 'function' ? selectedSubPage('products') : ''; if (pd.open && sub === 'Catalogue' && (typeof productView === 'undefined' || productView === 'list')) { var s = document.getElementById('screen-products'), html = page(); if (s) s.innerHTML = html; return html; } } catch (e) { console.warn('Fill gaps fell back', e); }
    return base.apply(this, arguments);
  };
  global.renderProducts = renderProducts;
}
function redraw(){
  var a = document.activeElement, focus = a && a.matches && a.matches('[data-pd-q],[data-pd-margin]') ? { sel: a.hasAttribute('data-pd-q') ? '[data-pd-q]' : '[data-pd-margin]', pos: a.selectionStart } : null;
  if (typeof renderProducts === 'function') renderProducts();
  if (focus) { var el = document.querySelector(focus.sel); if (el) { el.focus(); try { if (focus.pos != null) el.setSelectionRange(focus.pos, focus.pos); } catch (_) {} } }
}
function cellRefresh(input){
  var parts = input.getAttribute('data-pd-cell').split('|'); setDraft(parts[0], parts[1], input.value);
  input.classList.toggle('pd-dirty', !!(pd.draft[parts[0]] && pd.draft[parts[0]][parts[1]] !== undefined));
  var dc = draftCount(), save = document.querySelector('.pd-save');
  if (save) save.innerHTML = dc ? '<button type="button" class="link si-link" data-pd-discard>Discard</button><button type="button" class="primary" data-pd-save>Save ' + dc + ' change' + (dc === 1 ? '' : 's') + '</button>' : '<small>Changes are kept until you save. Paste a column from Excel into a box to fill down.</small>';
  var tr = input.closest('tr'), p = (D().products || []).find(function(x){ return x.id === parts[0]; });
  if (tr && p) { var m = margin(val(p, 'cost'), val(p, 'rrp')), mc = tr.children[6]; if (mc) mc.innerHTML = m == null ? '—' : '<span class="' + (m < 15 ? 'si-down' : '') + '">' + m.toFixed(0) + '%</span>'; }
}
function download(name, rows){ var csv = rows.map(function(r){ return r.map(function(v){ v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function addFiles(list){ var arr = Array.prototype.slice.call(list || []); if (!arr.length) return; pd.files = planFiles(pd.files.filter(function(x){ return x.status !== 'done'; }).map(function(x){ return x.file; }).concat(arr)); redraw(); }
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('[data-pd-open],[data-pd-close],[data-pd-mode],[data-pd-gap],[data-pd-page],[data-pd-save],[data-pd-discard],[data-pd-pfc],[data-pd-preview],[data-pd-apply],[data-pd-undo],[data-pd-unmatched],[data-pd-upload],[data-pd-clear-files]'); if (!t) return;
    e.preventDefault(); var ds = t.dataset;
    if (ds.pdOpen !== undefined) { pd.open = true; if (global.poolShedStockImport) global.poolShedStockImport.open = false; return redraw(); }
    if (ds.pdClose !== undefined) { if (draftCount() && !global.confirm('Leave without saving ' + draftCount() + ' change' + (draftCount() === 1 ? '' : 's') + '?')) return; pd.open = false; pd.draft = {}; return redraw(); }
    if (ds.pdMode) { pd.mode = ds.pdMode; return redraw(); }
    if (ds.pdGap) { pd.gap = ds.pdGap; pd.page = 0; return redraw(); }
    if (ds.pdPage) { pd.page = Math.max(0, pd.page + Number(ds.pdPage)); redraw(); var top = document.querySelector('.pd-modes'); if (top && top.scrollIntoView) top.scrollIntoView({ block: 'start' }); return; }
    if (ds.pdDiscard !== undefined) { pd.draft = {}; return redraw(); }
    if (ds.pdPfc !== undefined) { var n = priceVisibleFromCost(); toast2(n ? n + ' RRP' + (n === 1 ? '' : 's') + ' filled from cost at ' + pd.margin + '% margin. Check them, then save.' : 'No products here have a cost without an RRP.'); return redraw(); }
    if (ds.pdSave !== undefined) { var res = saveDraft(); toast2(res.ok ? res.count + ' value' + (res.count === 1 ? '' : 's') + ' saved. You can undo it from Recent changes.' : res.error); return redraw(); }
    if (ds.pdPreview !== undefined) { pd.plan = buildImport(); return redraw(); }
    if (ds.pdUnmatched !== undefined && pd.plan) return download('price-list-not-matched.csv', [['Row', 'Contents']].concat(pd.plan.unmatched.map(function(u){ return [u.row, u.text]; })));
    if (ds.pdApply !== undefined && pd.plan && pd.plan.lines) {
      var plan = buildImport(), k = plan.lines.length; if (!k) return toast2('Nothing to change.');
      var go = function(){ var rec = applyImport(plan); pd.plan = null; pd.text = ''; toast2(k + ' product' + (k === 1 ? '' : 's') + ' updated. You can undo it from Recent changes.'); redraw(); return rec; };
      if (global.PoolShedDialog) global.PoolShedDialog.confirm({ title: 'Update ' + k + ' product' + (k === 1 ? '' : 's') + '?', message: 'Prices and barcodes change as previewed' + (pd.impSupplier ? ', and ' + pd.impSupplier + '’s offer costs too' : '') + '. You can undo this afterwards if nothing has been changed since.', confirmLabel: 'Update products' }).then(function(yes){ if (yes) go(); });
      else if (global.confirm('Update ' + k + ' products?')) go();
      return;
    }
    if (ds.pdUndo) { var u = undo(ds.pdUndo); toast2(u.ok ? u.count + ' value' + (u.count === 1 ? '' : 's') + ' put back.' : u.error); return redraw(); }
    if (ds.pdUpload !== undefined) { uploadAll(); return; }
    if (ds.pdClearFiles !== undefined) { pd.files = []; return redraw(); }
  }, true);
  document.addEventListener('input', function(e){
    var t = e.target; if (!t.closest) return;
    if (t.matches('[data-pd-q]')) { pd.q = t.value; pd.page = 0; clearTimeout(pd._qt); pd._qt = setTimeout(redraw, 250); return; }
    if (t.matches('[data-pd-margin]')) { pd.margin = num(t.value); return; }
    if (t.matches('[data-pd-text]')) { pd.text = t.value; pd.plan = null; return; }
    if (t.matches('[data-pd-cell]')) cellRefresh(t);
  });
  // paste a column from Excel into one box: fills down the visible rows
  document.addEventListener('paste', function(e){
    var t = e.target; if (!t.matches || !t.matches('[data-pd-cell]')) return;
    var txt = (e.clipboardData || global.clipboardData).getData('text'); if (!/\n/.test(String(txt).trim())) return;
    e.preventDefault(); var vals = String(txt).replace(/\r/g, '').replace(/\n$/, '').split('\n').map(function(l){ return l.split('\t')[0]; });
    var f = t.getAttribute('data-pd-cell').split('|')[1], cells = Array.prototype.slice.call(document.querySelectorAll('[data-pd-cell$="|' + f + '"]')), i0 = cells.indexOf(t);
    vals.forEach(function(v, i){ var c = cells[i0 + i]; if (c && !c.disabled) { c.value = v.trim(); cellRefresh(c); } });
    toast2(Math.min(vals.length, cells.length - i0) + ' boxes filled. Save when ready.');
  });
  document.addEventListener('change', function(e){
    var t = e.target; if (!t.matches) return;
    if (t.matches('[data-pd-oneoff]')) { pd.oneOff = t.checked; pd.page = 0; return redraw(); }
    if (t.matches('[data-pd-supplier]')) { pd.supplier = t.value; pd.page = 0; return redraw(); }
    if (t.matches('[data-pd-impsup]')) { pd.impSupplier = t.value; if (pd.plan) pd.plan = buildImport(); return redraw(); }
    if (t.matches('[data-pd-fill]')) { pd.fill = t.value; if (pd.plan) pd.plan = buildImport(); return redraw(); }
    if (t.matches('[data-pd-file]') && t.files && t.files[0]) { var f = t.files[0]; if (/\.xlsx?$/i.test(f.name)) return toast2('Save the sheet as CSV first, or copy the cells and paste them in.'); f.text().then(function(x){ pd.text = x; pd.plan = buildImport(); redraw(); }); return; }
    if (t.matches('[data-pd-images]')) { addFiles(t.files); t.value = ''; }
  });
  document.addEventListener('dragover', function(e){ if (e.target.closest && e.target.closest('[data-pd-drop]')) { e.preventDefault(); e.target.closest('[data-pd-drop]').classList.add('on'); } });
  document.addEventListener('dragleave', function(e){ var z = e.target.closest && e.target.closest('[data-pd-drop]'); if (z) z.classList.remove('on'); });
  document.addEventListener('drop', function(e){ var z = e.target.closest && e.target.closest('[data-pd-drop]'); if (!z) return; e.preventDefault(); addFiles(e.dataTransfer && e.dataTransfer.files); });
}
global.PoolShedProductData = { counts: counts, missing: missing, barcodeIssue: barcodeIssue, priceFromCost: priceFromCost, setDraft: setDraft, saveDraft: saveDraft, priceVisibleFromCost: priceVisibleFromCost, gridRows: gridRows,
  buildImport: buildImport, applyImport: applyImport, matchFile: matchFile, planFiles: planFiles, undo: undo, page: page, state: pd };
})(typeof window !== 'undefined' ? window : globalThis);
