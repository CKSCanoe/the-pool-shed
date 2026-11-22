/* Pool Shed saved list views and bulk selection (from v1.79).
   Sales orders, purchase orders and Stock › Catalogue get a "Views" bar: save the current tab, search and filters
   under a name, shared with the team, and apply it again with one click. Purchase orders and the catalogue also get
   tick-boxes with "Export selected" (sales orders already have their own bulk bar).
   A view records the list's own filter controls and restores them the way a person would, so each list keeps
   working exactly as before. */
(function(global){
'use strict';
if (typeof document === 'undefined') return;
var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var data = function(){ return global.__POOL_SHED_GET_DATA__ ? global.__POOL_SHED_GET_DATA__() : (global.data || {}); };
var save = function(){ try { if (global.__POOL_SHED_SAVE_APP_DATA__) global.__POOL_SHED_SAVE_APP_DATA__(); } catch (_) {} };
var toast = function(m){ try { (global.toast || console.log)(m); } catch (_) {} };
var me = function(){ try { var u = global.__POOL_SHED_CURRENT_USER__ ? global.__POOL_SHED_CURRENT_USER__() : null; return (u && (u.name || u.email)) || 'Team'; } catch (_) { return 'Team'; } };
var sub = function(tab){ try { return (typeof activeSubPage !== 'undefined' && activeSubPage[tab]) || ''; } catch (_) { return ''; } };
function cur(tab){ try { return typeof active !== 'undefined' && active === tab; } catch (_) { return false; } }
function soList(){ try { return typeof salesOrderView === 'undefined' || salesOrderView === 'list'; } catch (_) { return true; } }
function poList(){ try { return typeof purchaseOrderView === 'undefined' || purchaseOrderView === 'list'; } catch (_) { return true; } }
// One entry per list: where it lives, which controls make up a view, the tab buttons, and rows for bulk selection.
var LISTS = [
  { id: 'salesorders', label: 'sales orders', screen: 'screen-salesorders', when: function(){ return cur('salesorders') && (sub('salesorders') || 'Sales Orders') === 'Sales Orders' && soList(); },
    anchor: '.so-list-tabs', controls: '[data-so-list-search],[data-so-list-status],[data-so-list-due],[data-so-list-stock],[data-so-list-source],[data-so-list-channel]', tab: 'data-so-filter', bulk: false },
  { id: 'purchase', label: 'purchase orders', screen: 'screen-purchase', when: function(){ return cur('purchase') && (sub('purchase') || 'Purchase Orders') === 'Purchase Orders' && poList(); },
    anchor: '#poListFilterSearch', controls: '#poListFilterSearch,[data-po-list-filter]', tab: '', bulk: { row: '[data-open-po-detail]', idAttr: 'data-open-po-detail', noun: 'purchase order', exportRows: exportPos } },
  { id: 'catalogue', label: 'catalogue', screen: 'screen-products', when: function(){ return cur('products') && sub('products') === 'Catalogue'; },
    anchor: '[data-ph-filter="query"]', controls: '[data-ph-filter]', tab: 'data-ph-preset', bulk: { row: '[data-ph-open-product]', idAttr: 'data-ph-open-product', noun: 'product', exportRows: exportProducts } }
];
function views(listId){ var d = data(); d.savedViews = Array.isArray(d.savedViews) ? d.savedViews : []; return d.savedViews.filter(function(v){ return v && v.list === listId; }); }
function keyOf(el){ if (el.id) return '#' + el.id; for (var i = 0; i < el.attributes.length; i++) { var a = el.attributes[i]; if (a.name.indexOf('data-') === 0) return a.value ? '[' + a.name + '="' + a.value + '"]' : '[' + a.name + ']'; } return ''; }
function rootOf(L){ return document.getElementById(L.screen); }
function snapshot(L){ var root = rootOf(L), out = { controls: {}, tab: '' }; if (!root) return out;
  root.querySelectorAll(L.controls).forEach(function(el){ var k = keyOf(el); if (k) out.controls[k] = el.value; });
  if (L.tab) { var on = root.querySelector('[' + L.tab + '].active,[' + L.tab + '][aria-pressed="true"],[' + L.tab + '][aria-selected="true"]'); out.tab = on ? on.getAttribute(L.tab) : ''; }
  return out; }
function same(L, v){ var s = snapshot(L); if ((v.tab || '') !== (s.tab || '')) return false; var keys = Object.keys(v.controls || {}); return keys.length && keys.every(function(k){ return String(s.controls[k] == null ? '' : s.controls[k]) === String(v.controls[k] == null ? '' : v.controls[k]); }); }
var wait = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
async function apply(L, v){ var root = rootOf(L); if (!root) return;
  if (L.tab && v.tab) { var b = root.querySelector('[' + L.tab + '="' + CSS.escape(v.tab) + '"]'); if (b && !b.classList.contains('active')) { b.click(); await wait(150); } }
  for (var k of Object.keys(v.controls || {})) { root = rootOf(L); var el = root && root.querySelector(k); if (!el || el.value === v.controls[k]) continue;
    if (el.tagName === 'SELECT' && ![].some.call(el.options, function(o){ return o.value === v.controls[k]; })) continue;   // that option no longer exists
    el.value = v.controls[k]; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); await wait(120); }
  mountAll(); }
function barHtml(L){ var vs = views(L.id); return '<div class="sv-bar" data-sv-bar="' + L.id + '"><span class="sv-label">Views</span>' +
  vs.map(function(v){ return '<span class="sv-chip' + (same(L, v) ? ' on' : '') + '"><button type="button" data-sv-apply="' + esc(v.id) + '" title="Saved by ' + esc(v.by || 'Team') + '">' + esc(v.name) + '</button><button type="button" class="sv-x" data-sv-delete="' + esc(v.id) + '" aria-label="Delete the view ' + esc(v.name) + '">×</button></span>'; }).join('') +
  '<button type="button" class="sv-save" data-sv-save="' + L.id + '">+ Save this view</button></div>'; }
// ---------- bulk selection (purchase orders and catalogue) ----------
var picked = {};
function selected(L){ return Object.keys(picked[L.id] || {}).filter(function(k){ return picked[L.id][k]; }); }
function bulkHtml(L){ var n = selected(L).length; return '<div class="sv-bulk" data-sv-bulk="' + L.id + '"' + (n ? '' : ' hidden') + '><strong>' + n + ' ' + L.bulk.noun + (n === 1 ? '' : 's') + ' selected</strong><button type="button" data-sv-export="' + L.id + '">Export selected</button><button type="button" class="sv-link" data-sv-clear="' + L.id + '">Clear</button></div>'; }
function addChecks(L, root){ var rows = root.querySelectorAll(L.bulk.row); var sel = picked[L.id] || (picked[L.id] = {});
  rows.forEach(function(btn){ var tr = btn.closest('tr'); if (!tr || tr.querySelector('.sv-check')) return; var id = btn.getAttribute(L.bulk.idAttr); var td = document.createElement('td'); td.className = 'sv-check';
    td.innerHTML = '<input type="checkbox" data-sv-pick="' + L.id + '" value="' + esc(id) + '" aria-label="Select ' + esc(id) + '"' + (sel[id] ? ' checked' : '') + '>'; tr.insertBefore(td, tr.firstChild);
    var table = tr.closest('table'), head = table && table.querySelector('thead tr'); if (head && !head.querySelector('.sv-check')) { var th = document.createElement('th'); th.className = 'sv-check'; th.innerHTML = '<input type="checkbox" data-sv-pick-all="' + L.id + '" aria-label="Select all shown">'; head.insertBefore(th, head.firstChild); } });
  var table = root.querySelector(L.bulk.row) && root.querySelector(L.bulk.row).closest('table');
  if (table && !root.querySelector('[data-sv-bulk="' + L.id + '"]')) { var wrap = table.closest('.table-wrap,.po-list-table-wrap,.ph-table-wrap') || table; wrap.insertAdjacentHTML('afterend', bulkHtml(L)); } }
function refreshBulk(L){ var el = document.querySelector('[data-sv-bulk="' + L.id + '"]'); if (el) el.outerHTML = bulkHtml(L); }
function csv(rows){ return rows.map(function(r){ return r.map(function(v){ v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n'); }
function download(name, text){ var blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function exportPos(ids){ var set = new Set(ids), out = [['PO', 'Supplier', 'Status', 'Expected', 'Source', 'Lines', 'Units ordered', 'Units received', 'Net', 'Linked sales orders']];
  (data().purchaseOrders || []).filter(function(po){ return set.has(String(po.id)); }).forEach(function(po){ var lines = po.lines || [], ord = 0, rec = 0, net = 0, so = {};
    lines.forEach(function(l){ ord += Number(l.qty || 0); rec += Number(l.received || 0); net += Number(l.qty || 0) * Number(l.unitCost != null ? l.unitCost : l.cost || 0); if (l.salesOrderId) so[l.salesOrderId] = 1; });
    out.push([po.id, po.supplier, po.status, po.due, po.source || 'Manual PO', lines.length, ord, rec, (Math.round(net * 100) / 100).toFixed(2), Object.keys(so).join(' ')]); });
  return out; }
function exportProducts(ids){ var set = new Set(ids), out = [['SKU', 'Name', 'Category', 'Supplier', 'Supplier SKU', 'Cost', 'RRP', 'Barcode']];
  (data().products || []).filter(function(p){ return set.has(String(p.id)); }).forEach(function(p){ out.push([p.sku, p.name, p.category, p.supplier, p.supplierSku, p.cost, p.rrp, p.barcode]); });
  return out; }
// ---------- mounting ----------
var busy = false;
function mountAll(){ if (busy) return; busy = true; try { LISTS.forEach(function(L){ var root = rootOf(L); if (!root) return; var on = L.when();
    var bar = root.querySelector('[data-sv-bar="' + L.id + '"]');
    if (!on) { if (bar) bar.remove(); return; }
    var anchor = root.querySelector(L.anchor); if (!anchor) return;
    var host = L.id === 'salesorders' ? anchor : (anchor.closest('.po-list-filters,.ph-filters,.ph-filter-bar,.filters,.toolbar') || anchor.parentElement);
    if (!bar) { host.insertAdjacentHTML('beforebegin', barHtml(L)); }
    else { var fresh = barHtml(L); if (bar.outerHTML !== fresh) bar.outerHTML = fresh; }
    if (L.bulk) addChecks(L, root); }); } catch (err) { console.warn('Saved views', err); } finally { busy = false; } }
var timer = 0; function soon(){ clearTimeout(timer); timer = setTimeout(mountAll, 60); }
new MutationObserver(function(list){ if (busy) return; for (var i = 0; i < list.length; i++) { var t = list[i].target; if (t && t.closest && t.closest('.sv-bar,.sv-bulk')) continue; soon(); return; } }).observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('change', function(e){ var t = e.target; if (!t || !t.closest) return;
  var pick = t.closest('[data-sv-pick]'); if (pick) { var L = LISTS.filter(function(x){ return x.id === pick.dataset.svPick; })[0]; (picked[L.id] = picked[L.id] || {})[pick.value] = pick.checked; refreshBulk(L); return; }
  var all = t.closest('[data-sv-pick-all]'); if (all) { var L2 = LISTS.filter(function(x){ return x.id === all.dataset.svPickAll; })[0], root = rootOf(L2); picked[L2.id] = picked[L2.id] || {};
    root.querySelectorAll('[data-sv-pick="' + L2.id + '"]').forEach(function(cb){ cb.checked = all.checked; picked[L2.id][cb.value] = all.checked; }); refreshBulk(L2); return; }
  // any filter change: the "on" view marker follows
  if (LISTS.some(function(L){ return t.matches && t.matches(L.controls); })) soon(); }, true);
document.addEventListener('click', function(e){ var t = e.target && e.target.closest && e.target.closest('[data-sv-apply],[data-sv-delete],[data-sv-save],[data-sv-export],[data-sv-clear]'); if (!t) return; e.preventDefault();
  var d = t.dataset, findL = function(id){ return LISTS.filter(function(x){ return x.id === id; })[0]; };
  if (d.svSave) { var L = findL(d.svSave), s = snapshot(L), name = (global.prompt ? global.prompt('Name this view of ' + L.label + ' (everyone on the team will see it)', '') : '') || ''; name = name.trim().slice(0, 40); if (!name) return;
    var all = data().savedViews = Array.isArray(data().savedViews) ? data().savedViews : []; var existing = all.filter(function(v){ return v.list === L.id && v.name.toLowerCase() === name.toLowerCase(); })[0];
    if (existing) { existing.controls = s.controls; existing.tab = s.tab; existing.at = new Date().toISOString(); existing.by = me(); } else all.push({ id: 'VIEW-' + Date.now().toString(36).toUpperCase(), list: L.id, name: name, tab: s.tab, controls: s.controls, by: me(), at: new Date().toISOString() });
    save(); toast('View “' + name + '” saved for the team.'); mountAll(); return; }
  if (d.svApply) { var v = (data().savedViews || []).filter(function(x){ return x.id === d.svApply; })[0]; if (v) apply(findL(v.list), v); return; }
  if (d.svDelete) { var all2 = data().savedViews || [], i = all2.findIndex(function(x){ return x.id === d.svDelete; }); if (i < 0) return; if (global.confirm && !global.confirm('Delete the view “' + all2[i].name + '” for everyone?')) return; all2.splice(i, 1); save(); mountAll(); return; }
  if (d.svExport) { var L3 = findL(d.svExport), ids = selected(L3); if (!ids.length) return; download('pool-shed-' + L3.id + '-' + new Date().toISOString().slice(0, 10) + '.csv', csv(L3.bulk.exportRows(ids))); toast(ids.length + ' exported.'); return; }
  if (d.svClear) { var L4 = findL(d.svClear); picked[L4.id] = {}; var root = rootOf(L4); if (root) root.querySelectorAll('[data-sv-pick],[data-sv-pick-all]').forEach(function(cb){ cb.checked = false; }); refreshBulk(L4); } });
global.PoolShedSavedViews = { LISTS: LISTS, snapshot: snapshot, apply: apply, mountAll: mountAll, csv: csv, exportPos: exportPos, exportProducts: exportProducts };
})(typeof window !== 'undefined' ? window : globalThis);
