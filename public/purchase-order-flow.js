/* Pool Shed purchase order flow (from v1.83), the same idea as the sales order flow bar.
   A progress line under the purchase order header: Drafted → Approved → Sent → Confirmed → Received → Paid, worked out
   from the order itself, and one next-step button that uses the existing controls (the status picker, Email / Print,
   Book delivery, the Cost & payments tab). Nothing is stored separately and every rule stays where it was. */
(function(global){
  'use strict';
  if (typeof purchaseOrderDetailPage !== 'function') return;
  var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var SENT = ['Sent', 'Supplier Confirmed', 'Part Received', 'Received'], CONFIRMED = ['Supplier Confirmed', 'Part Received', 'Received'], DRAFT = ['Draft - Review', 'Draft', ''];
  function units(po){ var o = 0, r = 0; (po.lines || []).forEach(function(l){ o += Number(l.qty || 0); r += Math.min(Number(l.qty || 0), Number(l.received || 0)); }); return { ordered: o, received: r }; }
  function payState(po){ try { return typeof purchaseOrderPaymentStatus === 'function' ? purchaseOrderPaymentStatus(po) : ''; } catch (_) { return ''; } }
  function flow(po){
    var st = String(po.status || 'Draft - Review'), u = units(po), pay = payState(po), received = u.ordered > 0 && u.received >= u.ordered;
    var steps = [
      { key: 'drafted', label: 'Drafted', done: (po.lines || []).length > 0 },
      { key: 'approved', label: 'Approved', done: DRAFT.indexOf(st) < 0 || u.received > 0 },
      { key: 'sent', label: 'Sent', done: SENT.indexOf(st) >= 0 || u.received > 0 },
      { key: 'confirmed', label: 'Confirmed', done: CONFIRMED.indexOf(st) >= 0 || !!(po.supplierReference || po.supplierRef) || u.received > 0 },
      { key: 'received', label: 'Received', done: received || st === 'Received' },
      { key: 'paid', label: 'Paid', done: pay === 'Paid' || pay === 'Overpaid' }
    ];
    return { steps: steps, current: steps.filter(function(x){ return !x.done; })[0] || null, units: u, status: st, pay: pay };
  }
  function nextHtml(po, f){
    var id = esc(po.id), cur = f.current && f.current.key;
    if (f.status === 'Cancelled') return '<span class="pof-note">Cancelled.</span>';
    if (f.status === 'On Hold') return '<span class="pof-note">On hold: change the status to carry on.</span>';
    if (!cur) return '<span class="pof-done">Complete: received and paid.</span>';
    if (cur === 'drafted') return '<span class="pof-note">Add items to start the order.</span>';
    if (cur === 'approved') return '<button type="button" class="primary pof-next" title="Ctrl+Enter" data-pof-status="' + id + '|Ready to Order">Approve order</button>';
    if (cur === 'sent') return '<button type="button" class="primary pof-next" title="Ctrl+Enter" data-pof-email="' + id + '">Send to supplier</button><button type="button" class="link pof-alt" data-pof-status="' + id + '|Sent">Already sent? Mark as sent</button>';
    if (cur === 'confirmed') return '<button type="button" class="primary pof-next" title="Ctrl+Enter" data-pof-status="' + id + '|Supplier Confirmed">Supplier confirmed</button><button type="button" class="link pof-alt" data-pof-receive="' + id + '">Goods arrived? Receive delivery</button>';
    if (cur === 'received') return '<button type="button" class="primary pof-next" title="Ctrl+Enter" data-pof-receive="' + id + '">Receive delivery' + (f.units.received ? ' (' + (f.units.ordered - f.units.received) + ' still to come)' : '') + '</button>';
    if (cur === 'paid') return '<button type="button" class="primary pof-next" title="Ctrl+Enter" data-pof-pay="' + id + '">Record payment</button>';
    return '';
  }
  function bar(po){
    var f = flow(po), rail = f.steps.map(function(x){ var cls = x.done ? 'done' : (f.current && f.current.key === x.key ? 'now' : ''); return '<li class="' + cls + '"><span>' + esc(x.label) + '</span></li>'; }).join('');
    return '<section class="pof-bar" aria-label="Where this purchase order is"><ol class="pof-rail">' + rail + '</ol><div class="pof-row">' + nextHtml(po, f) + '</div></section>';
  }
  var previous = purchaseOrderDetailPage;
  purchaseOrderDetailPage = function(po){
    var html = previous.apply(this, arguments);
    try { if (po && typeof html === 'string') { var at = html.indexOf('</header>'); html = at >= 0 ? html.slice(0, at + 9) + bar(po) + html.slice(at + 9) : bar(po) + html; } }
    catch (e) { console.warn('Purchase order flow bar skipped', e); }
    return html;
  };
  global.purchaseOrderDetailPage = purchaseOrderDetailPage;
  function setStatus(id, status){ var sel = document.querySelector('[data-po-status="' + (global.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); if (!sel) return false;
    if (![].some.call(sel.options, function(o){ return o.value === status; })) return false; sel.value = status; sel.dispatchEvent(new Event('change', { bubbles: true })); return true; }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function(e){ var t = e.target && e.target.closest ? e.target : null; if (!t) return;
      var s = t.closest('[data-pof-status]'), em = t.closest('[data-pof-email]'), rc = t.closest('[data-pof-receive]'), pay = t.closest('[data-pof-pay]');
      if (s) { e.preventDefault(); var p = s.dataset.pofStatus.split('|'); if (!setStatus(p[0], p.slice(1).join('|'))) try { global.toast('Change the status with the status picker at the top.'); } catch (_) {} return; }
      if (em) { e.preventDefault(); var b = document.querySelector('[data-po-save-action="email|' + em.dataset.pofEmail + '"]'); if (b) b.click(); return; }
      if (rc) { e.preventDefault(); var r = document.querySelector('[data-po-open-receiving="' + rc.dataset.pofReceive + '"]'); if (r) r.click(); return; }
      if (pay) { e.preventDefault(); var tab = [].filter.call(document.querySelectorAll('[data-po-command-tab]'), function(x){ return x.dataset.poCommandTab.indexOf('costs|') === 0; })[0]; if (tab) { tab.click(); setTimeout(function(){ var sec = document.querySelector('.po-command-body'); if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60); } return; }
    }, true);
  }
  global.PoolShedPurchaseFlow = { flow: flow, bar: bar };
})(typeof window !== 'undefined' ? window : globalThis);
