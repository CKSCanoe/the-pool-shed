/* Pool Shed jump-to-anything (from v1.78). Ctrl+K (Command+K on a Mac) or "Jump to" in the menu opens one box:
   type a page, a record (order, quote, PO, product, customer, project, supplier, stock location, delivery note)
   or an action ("new quote"), use the arrow keys and press Enter. Recent items are listed when the box is empty.
   Records come from the same search as the top search bar, plus quotes; nothing new is read or stored on a server. */
(function(global){
'use strict';
if (typeof document === 'undefined') return;
var RECENT = 'poolshed:jump-recent', MAX_RECENT = 8;
var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var NEW = [['sales-order', 'Sales order'], ['quote', 'Quote'], ['customer', 'Customer'], ['purchase-order', 'Purchase order'], ['product', 'Product'], ['contract', 'Contract'], ['project', 'Project']];
var TYPE_LABEL = { salesOrder: 'Sales order', purchaseOrder: 'Purchase order', product: 'Product', customer: 'Customer', job: 'Project', location: 'Stock location', goodsNote: 'Delivery note', supplier: 'Supplier', quote: 'Quote' };
var state = { open: false, items: [], index: 0, timer: 0, lastFocus: null };

function frame(){ return global.PoolShedFrame || null; }
function can(tab){ try { return typeof global.__POOL_SHED_CAN_ACCESS__ === 'function' ? global.__POOL_SHED_CAN_ACCESS__(tab) !== false : true; } catch (_) { return true; } }
function recent(){ try { var r = JSON.parse(global.localStorage.getItem(RECENT) || '[]'); return Array.isArray(r) ? r.slice(0, MAX_RECENT) : []; } catch (_) { return []; } }
function remember(item){ if (!item || item.kind === 'new') return; try { var key = item.kind + '|' + item.id, r = recent().filter(function(x){ return x.kind + '|' + x.id !== key; });
  r.unshift({ kind: item.kind, action: item.action || '', id: item.id, title: String(item.title || '').slice(0, 120), type: item.type, tab: item.tab || '', sub: item.sub || '' }); global.localStorage.setItem(RECENT, JSON.stringify(r.slice(0, MAX_RECENT))); } catch (_) {} }
function words(q){ return String(q || '').toLowerCase().split(/\s+/).filter(Boolean); }
function hits(text, ws){ var t = String(text || '').toLowerCase(); return ws.every(function(w){ return t.indexOf(w) >= 0; }); }

function pages(ws){ var f = frame(), out = []; if (!f || !f.MENU) return out;
  f.MENU.forEach(function(area){ area.pages.forEach(function(p){ if (!can(p[0])) return; var label = area.label + ' › ' + p[2];
    if (!ws.length || hits(label + ' ' + (p[1] || ''), ws)) out.push({ kind: 'page', id: p[0] + '|' + (p[1] || ''), tab: p[0], sub: p[1] || '', title: p[2], meta: area.label, type: 'Page' }); }); });
  return out; }
function actions(ws){ return NEW.filter(function(x){ return !ws.length || hits('new create add ' + x[1], ws); }).map(function(x){ return { kind: 'new', id: x[0], title: 'New ' + x[1].toLowerCase(), meta: 'Create', type: 'Action' }; }); }
function records(q){ var out = [], box = document.getElementById('globalSearch');
  if (q.length >= 2 && box && typeof global.globalSearchResults === 'function') {
    var before = box.value; try { box.value = q; (global.globalSearchResults() || []).forEach(function(r){ if (r.action === 'product' && typeof global.product === 'function') { var p = global.product(r.id); if (p && (p.hiddenFromCatalogue || p.virtual)) return; } out.push({ kind: 'record', action: r.action, id: r.id, title: r.title, meta: r.snippet, type: TYPE_LABEL[r.action] || r.type }); }); }
    catch (_) {} finally { box.value = before; } }
  var qs = global.PoolShedQuoteStudio, ws = words(q);
  if (q.length >= 2 && qs && typeof qs.listQuotes === 'function') { try { qs.listQuotes().forEach(function(x){ var c = qs.customer ? qs.customer(x.customerId) : null, name = c ? (c.name || c.companyName || '') : '';
      if (hits([x.id, x.projectName, name, x.status].join(' '), ws)) out.push({ kind: 'record', action: 'quote', id: x.id, title: x.id + ' - ' + (x.projectName || 'Quote'), meta: [name, x.status].filter(Boolean).join(' · '), type: 'Quote' }); }); } catch (_) {} }
  // exact reference first (typing SO-2063 puts SO-2063 at the top)
  var exact = String(q).trim().toLowerCase();
  var RANK = { Customer: 1, Supplier: 2, Quote: 3, Project: 4, 'Sales order': 5, 'Purchase order': 6, Product: 7, 'Stock location': 8, 'Delivery note': 9 };
  out = out.map(function(x, i){ return [x, i]; }).sort(function(a, b){ var ea = String(a[0].id).toLowerCase() === exact, eb = String(b[0].id).toLowerCase() === exact; if (ea !== eb) return eb - ea; return ((RANK[a[0].type] || 10) - (RANK[b[0].type] || 10)) || (a[1] - b[1]); }).map(function(p){ return p[0]; });
  // at most 5 of each kind, so a common name does not hide the quotes or customers behind a page of orders
  var per = {}; out = out.filter(function(x){ per[x.type] = (per[x.type] || 0) + 1; return per[x.type] <= 5 || String(x.id).toLowerCase() === exact; });
  return out.slice(0, 24); }
function build(q){ var ws = words(q), list = [];
  if (!ws.length) { recent().forEach(function(r){ list.push(Object.assign({}, r, { group: 'Recent', meta: '' })); });
    list = list.concat(actions([]).map(function(x){ x.group = 'Create'; return x; })); return list; }
  var p = pages(ws).slice(0, 6).map(function(x){ x.group = 'Pages'; return x; }), r = records(q).map(function(x){ x.group = 'Records'; return x; }), a = actions(ws).slice(0, 3).map(function(x){ x.group = 'Create'; return x; });
  var looksLikeRef = /^[a-z]{1,4}-?\d/i.test(String(q).trim());
  return looksLikeRef ? r.concat(p, a) : p.concat(r, a); }

function render(){ var root = document.getElementById('psJump'); if (!root) return; var list = root.querySelector('.ps-jump-list'), q = root.querySelector('input').value;
  state.items = build(q); if (state.index >= state.items.length) state.index = 0;
  var html = '', group = '';
  state.items.forEach(function(it, i){ if (it.group !== group) { group = it.group; html += '<li class="ps-jump-group" role="presentation">' + esc(group) + '</li>'; }
    html += '<li role="option" id="psJumpOpt' + i + '" class="ps-jump-item' + (i === state.index ? ' on' : '') + '" aria-selected="' + (i === state.index) + '" data-jump-index="' + i + '"><span class="ps-jump-type">' + esc(it.type || '') + '</span><span class="ps-jump-title">' + esc(it.title) + '</span><span class="ps-jump-meta">' + esc(it.meta || '') + '</span></li>'; });
  if (!state.items.length) html = '<li class="ps-jump-empty">' + (q.trim().length < 2 ? 'Type at least two letters.' : 'Nothing found for “' + esc(q.trim()) + '”. Try an order number, a name, a postcode or a product code.') + '</li>';
  list.innerHTML = html; root.querySelector('input').setAttribute('aria-activedescendant', state.items.length ? 'psJumpOpt' + state.index : ''); }
function move(d){ if (!state.items.length) return; state.index = (state.index + d + state.items.length) % state.items.length; var root = document.getElementById('psJump');
  root.querySelectorAll('.ps-jump-item').forEach(function(li){ var on = Number(li.dataset.jumpIndex) === state.index; li.classList.toggle('on', on); li.setAttribute('aria-selected', String(on)); if (on) li.scrollIntoView({ block: 'nearest' }); });
  root.querySelector('input').setAttribute('aria-activedescendant', 'psJumpOpt' + state.index); }
function go(it){ if (!it) return; close(); var f = frame();
  try {
    if (it.kind === 'new') { if (f && f.create) f.create(it.id); return; }
    remember(it);
    if (it.kind === 'page') { if (f && f.openPage) f.openPage(it.tab, it.sub); return; }
    if (it.action === 'quote') { if (f && f.openPage) f.openPage('quotes', 'Quotes'); setTimeout(function(){ var ws = global.PoolShedQuoteStudioWorkspace; if (ws && ws.openQuote) ws.openQuote(it.id); }, 60); return; }
    if (typeof global.openGlobalSearchResult === 'function') global.openGlobalSearchResult(it.action, it.id);
  } catch (err) { try { (global.toast || console.log)(err.message || String(err)); } catch (_) {} } }
function open(){ if (state.open) return; state.open = true; state.index = 0; state.lastFocus = document.activeElement;
  var root = document.createElement('div'); root.id = 'psJump'; root.className = 'ps-jump';
  root.innerHTML = '<div class="ps-jump-scrim" data-jump-close></div><div class="ps-jump-box" role="dialog" aria-modal="true" aria-label="Jump to anything"><div class="ps-jump-field"><input type="search" placeholder="Jump to a page, order, quote, customer, product… or type “new quote”" aria-label="Jump to" role="combobox" aria-expanded="true" aria-controls="psJumpList" aria-autocomplete="list" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></div><ul class="ps-jump-list" id="psJumpList" role="listbox"></ul><div class="ps-jump-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Ctrl</kbd><kbd>K</kbd> any time</span></div></div>';
  document.body.appendChild(root); var input = root.querySelector('input'); input.focus(); render();
  input.addEventListener('input', function(){ clearTimeout(state.timer); state.index = 0; state.timer = setTimeout(render, 120); });
  input.addEventListener('keydown', function(e){ if (e.key === 'ArrowDown') { e.preventDefault(); move(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (state.timer) { clearTimeout(state.timer); state.timer = 0; render(); } go(state.items[state.index]); } else if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'Tab') { e.preventDefault(); move(e.shiftKey ? -1 : 1); } });
  root.addEventListener('mousedown', function(e){ var li = e.target.closest('[data-jump-index]'); if (li) { e.preventDefault(); go(state.items[Number(li.dataset.jumpIndex)]); } else if (e.target.closest('[data-jump-close]')) { e.preventDefault(); close(); } });
  root.addEventListener('mousemove', function(e){ var li = e.target.closest('[data-jump-index]'); if (li && Number(li.dataset.jumpIndex) !== state.index) { state.index = Number(li.dataset.jumpIndex); move(0); } }); }
function close(){ var root = document.getElementById('psJump'); if (root) root.remove(); state.open = false; clearTimeout(state.timer); state.timer = 0;
  try { if (state.lastFocus && state.lastFocus.focus && document.contains(state.lastFocus)) state.lastFocus.focus(); } catch (_) {} }
// Ctrl/Command+K opens the box from anywhere (it used to jump into the top search bar); a second press closes it.
document.addEventListener('keydown', function(e){ if ((e.ctrlKey || e.metaKey) && !e.altKey && String(e.key).toLowerCase() === 'k') { e.preventDefault(); e.stopImmediatePropagation(); if (state.open) close(); else open(); } }, true);
document.addEventListener('click', function(e){ var b = e.target && e.target.closest && e.target.closest('[data-jump-open]'); if (b) { e.preventDefault(); open(); } });
global.PoolShedJump = { open: open, close: close, build: build, remember: remember, go: go };
})(typeof window !== 'undefined' ? window : globalThis);
