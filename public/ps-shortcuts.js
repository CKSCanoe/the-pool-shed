/* Pool Shed keyboard shortcuts (from v1.84). Press ? to see them.
   Ctrl/Command+S saves the open order, purchase order or product; Ctrl/Command+Enter runs the highlighted next step;
   N opens the New menu; / jumps to the page's search box; G then H, O, P, C, I or Q goes to a page; Esc closes menus.
   Single-key shortcuts only work when you are not typing in a box. Each one presses a button that is already on screen. */
(function(global){
'use strict';
if (typeof document === 'undefined') return;
var GO = { h: ['dashboard', '', 'Home'], o: ['salesorders', 'Sales Orders', 'Sales orders'], p: ['purchase', 'Purchase Orders', 'Purchase orders'], c: ['crm', 'All Customers', 'Customers'], i: ['accounting', 'Customer Invoices', 'Invoices'], q: ['quotes', 'Quotes', 'Quotes'] };
var SAVE = ['[data-save-order]', '[data-po-save-action^="save|"]', '[data-save-product]', '[data-save-customer]', '[data-ph-save-product]'];
var NEXT = ['.sof-next', '.pof-next'];
var gWaiting = 0;
function typing(e){ var t = e.target; if (!t) return false; var tag = String(t.tagName || '').toUpperCase(); return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable; }
function dialogOpen(){ return !!document.querySelector('.psd-wrap, #psJump'); }
function visible(sel){ var list = [].slice.call(document.querySelectorAll(sel)); for (var i = 0; i < list.length; i++) { var el = list[i]; if (el.offsetParent !== null && !el.disabled) return el; } return null; }
function first(sels){ for (var i = 0; i < sels.length; i++) { var el = visible(sels[i]); if (el) return el; } return null; }
function toast(m){ try { (global.toast || console.log)(m); } catch (_) {} }
function sheet(){ if (!global.PoolShedDialog) return; var k = function(x){ return '<kbd>' + x + '</kbd>'; }, mod = /Mac|iPhone|iPad/.test((global.navigator || {}).platform || '') ? '⌘' : 'Ctrl';
  var rows = [[k(mod) + ' ' + k('K'), 'Jump to anything'], [k(mod) + ' ' + k('S'), 'Save the open order, purchase order or product'], [k(mod) + ' ' + k('Enter'), 'Do the highlighted next step on an order'],
    [k('N'), 'New… (order, quote, customer, purchase order and more)'], [k('/'), 'Search on this page'], [k('G') + ' then ' + k('H'), 'Home'], [k('G') + ' then ' + k('O'), 'Sales orders'], [k('G') + ' then ' + k('P'), 'Purchase orders'],
    [k('G') + ' then ' + k('C'), 'Customers'], [k('G') + ' then ' + k('I'), 'Invoices'], [k('G') + ' then ' + k('Q'), 'Quotes'], [k('Esc'), 'Close a menu or box'], [k('?'), 'This list']];
  global.PoolShedDialog.info({ title: 'Keyboard shortcuts', html: '<table class="psk-table">' + rows.map(function(r){ return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</table><p class="psk-note">Letters work when you are not typing in a box.</p>' }); }
document.addEventListener('keydown', function(e){
  if (e.defaultPrevented) return;
  var mod = e.ctrlKey || e.metaKey, key = String(e.key || '');
  if (mod && !e.altKey && key.toLowerCase() === 's') { if (dialogOpen()) return; var b = first(SAVE); if (b) { e.preventDefault(); b.click(); toast('Saving…'); } return; }
  if (mod && key === 'Enter') { if (dialogOpen() || typing(e)) return; var n = first(NEXT); if (n) { e.preventDefault(); n.click(); } return; }
  if (mod || e.altKey || typing(e) || dialogOpen()) return;
  if (key === 'Escape') { var menu = document.querySelector('.nav-new-menu:not([hidden])'); if (menu) { menu.hidden = true; var nb = document.querySelector('[data-nav-new]'); if (nb) nb.setAttribute('aria-expanded', 'false'); }
    [].slice.call(document.querySelectorAll('details.mw-more[open], details.be-menu[open]')).forEach(function(d){ d.removeAttribute('open'); }); return; }
  if (gWaiting && Date.now() - gWaiting < 1500) { gWaiting = 0; var g = GO[key.toLowerCase()]; if (g && global.PoolShedFrame && global.PoolShedFrame.openPage) { e.preventDefault(); global.PoolShedFrame.openPage(g[0], g[1]); } return; }
  if (key === 'g' || key === 'G') { gWaiting = Date.now(); return; }
  if (key === '?') { e.preventDefault(); sheet(); return; }
  if (key === 'n' || key === 'N') { var nbtn = document.querySelector('[data-nav-new]'); if (nbtn) { e.preventDefault(); nbtn.click(); var firstItem = document.querySelector('.nav-new-menu:not([hidden]) button'); if (firstItem) firstItem.focus(); } return; }
  if (key === '/') { var screen = document.querySelector('.screen:not(.hidden)') || document; var s = [].slice.call(screen.querySelectorAll('input[type="search"], input[placeholder*="Search" i]')).filter(function(x){ return x.offsetParent !== null; })[0]; if (s) { e.preventDefault(); s.focus(); if (s.select) s.select(); } return; }
});
global.PoolShedShortcuts = { sheet: sheet, GO: GO };
})(typeof window !== 'undefined' ? window : globalThis);
