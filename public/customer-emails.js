/* Pool Shed v1.66.0 — "Email the customer?" at each fulfilment step (blueprint step 3).
   Whenever an order is picked, packed, shipped (in full or in part) or collected, from any screen or batch action, a card
   asks whether to email the customer, with a tick box per order (starting ticked or not from Settings → customer
   notification rules) and a preview. The server sends to the order's customer email only, and logs it. Every choice is
   recorded on the order's activity, so anyone can answer "has the customer been told?". */
(function(global){
  'use strict';
  if (typeof addNotification !== 'function') return;
  var CUSTOMER_STEPS = { Pick: 'is being prepared', Pack: 'is packed', Ship: 'has shipped', 'Part Ship': 'has partly shipped', Collection: 'has been collected' };
  var queue = [], busy = false, info = null;
  var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); };
  var DATA = function(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? (global.__POOL_SHED_GET_DATA__() || {}) : {}; };
  var W = function(){ return typeof global.__POOL_SHED_WORKSPACE_ID__ === 'function' ? global.__POOL_SHED_WORKSPACE_ID__() : 'pool-bros-main'; };
  function token(){ return typeof global.__POOL_SHED_AUTH_TOKEN__ === 'function' ? global.__POOL_SHED_AUTH_TOKEN__() : Promise.resolve(''); }
  function save(){ try { if (typeof global.__POOL_SHED_SAVE_APP_DATA__ === 'function') global.__POOL_SHED_SAVE_APP_DATA__(); } catch (_) {} }
  function ruleOn(trig){ var key = trig === 'Part Ship' || trig === 'Collection' ? 'Ship' : trig;
    var r = (DATA().customerNotificationRules || []).find(function(x){ return x.trigger === key; }); return !!(r && r.enabled); }
  function partShip(note){ // shipping this note leaves items still to ship on the order
    var d = DATA(), order = (d.salesOrders || []).find(function(o){ return o.id === note.salesOrderId; }); if (!order) return false;
    var shipped = {}, add = function(n){ (n.lines || []).forEach(function(l){ shipped[l.productId] = (shipped[l.productId] || 0) + Number(l.shipped || l.qty || 0); }); };
    (d.goodsNotes || []).forEach(function(n){ if (n !== note && n.id !== note.id && n.salesOrderId === order.id && n.shipped) add(n); }); add(note);
    return (order.lines || []).some(function(l){ return !l.lineType && Number(l.qty || 0) > (shipped[l.productId] || 0); });
  }

  // Keep the original for internal notes; take over the customer-facing steps.
  var original = addNotification;
  addNotification = function(note, trigger, subject, status){
    if (!CUSTOMER_STEPS[trigger] || /internal|saved/i.test(String(status || '')) || !note) return original.apply(this, arguments);
    var trig = trigger === 'Ship' && partShip(note) ? 'Part Ship' : trigger;
    var d = DATA(), order = (d.salesOrders || []).find(function(o){ return o.id === note.salesOrderId; }) || {};
    if (!Array.isArray(d.notifications)) d.notifications = [];
    var rec = { id: 'N-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), goodsNoteId: note.id, salesOrderId: note.salesOrderId, customerId: order.customerId,
      trigger: trig, subject: 'Order ' + note.salesOrderId + ' ' + CUSTOMER_STEPS[trig], body: '', channel: 'Email', status: 'Waiting for your choice',
      date: new Date().toISOString().slice(0, 16).replace('T', ' ') };
    d.notifications.push(rec);
    queue.push({ rec: rec, orderId: note.salesOrderId, noteId: note.id, trig: trig, tick: ruleOn(trig), courier: note.courier || note.shippingMethod || note.dispatchMode || '', tracking: note.trackingRef || '' ,
                 customer: ((d.customers || []).find(function(c){ return c.id === order.customerId; }) || {}).name || '' });
    setTimeout(paint, 0);
    return true;
  };
  global.addNotification = addNotification;

  function paint(){
    if (typeof document === 'undefined') return;
    var box = document.getElementById('cust-email-card');
    if (!queue.length) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('aside'); box.id = 'cust-email-card'; box.className = 'cec'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Email the customer'); document.body.appendChild(box); }
    if (!info) { info = { loading: true }; preview(queue[0]).then(function(p){ info = p || { emails_on: false }; paint(); }).catch(function(){ info = { emails_on: false, error: true }; paint(); }); }
    var off = info && info.emails_on === false && !info.loading;
    box.innerHTML = '<header><strong>Email the customer' + (queue.length > 1 ? 's' : '') + '?</strong><button type="button" class="cec-x" data-cec="skip" aria-label="Don’t send">×</button></header>' +
      (off ? '<p class="cec-warn">Customer emails are switched off (owner’s setting), so nothing will be sent. Your choice is still noted on the order.</p>' : '') +
      '<ul>' + queue.map(function(q, i){ return '<li><label><input type="checkbox" data-cec-tick="' + i + '"' + (q.tick ? ' checked' : '') + (q.result ? ' disabled' : '') + '> <span><b>' + esc(q.orderId) + '</b> ' + esc(q.customer) + ' · ' + esc(CUSTOMER_STEPS[q.trig]) +
        (q.trig === 'Ship' || q.trig === 'Part Ship' ? (q.tracking ? ' · ' + esc(q.courier) + ' ' + esc(q.tracking) : ' · <em>no tracking number</em>') : '') + '</span></label>' +
        (q.result ? '<small class="' + (q.ok ? 'ok' : 'bad') + '">' + esc(q.result) + '</small>' : '<button type="button" class="link" data-cec-preview="' + i + '">Preview</button>') + (q.previewText ? '<pre>' + esc(q.previewText) + '</pre>' : '') + '</li>'; }).join('') + '</ul>' +
      '<footer>' + (queue.every(function(q){ return q.result; }) ? '<button type="button" class="primary" data-cec="done">Done</button>'
        : '<button type="button" class="primary" data-cec="send"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Sending…' : off ? 'OK' : 'Send ticked') + '</button><button type="button" class="secondary" data-cec="skip">Don’t send</button>') + '</footer>';
  }
  function preview(q){
    return token().then(function(t){ return fetch('/api/media?action=customer-email-preview&workspace=' + encodeURIComponent(W()), { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: q.orderId, trigger: q.trig, goodsNoteId: q.noteId, courier: q.courier, tracking: q.tracking }) }); })
      .then(function(r){ return r.json().then(function(b){ if (!r.ok) throw new Error(b.error || 'Preview failed'); return b; }); });
  }
  function finish(q, status, extra){ q.rec.status = status; Object.assign(q.rec, extra || {}); }
  function sendAll(){
    if (busy) return; busy = true; paint();
    var off = info && info.emails_on === false;
    var jobs = queue.filter(function(q){ return !q.result; }).map(function(q){
      if (!q.tick) { q.result = 'Not emailed'; q.ok = true; finish(q, 'Not sent (staff chose not to)'); return Promise.resolve(); }
      if (off) { q.result = 'Not sent: emails are off'; q.ok = false; finish(q, 'Not sent (customer emails switched off)'); return Promise.resolve(); }
      return token().then(function(t){ return fetch('/api/media?action=customer-email&workspace=' + encodeURIComponent(W()), { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: q.orderId, trigger: q.trig, goodsNoteId: q.noteId, courier: q.courier, tracking: q.tracking }) }); })
        .then(function(r){ return r.json().then(function(b){ if (!r.ok) throw new Error(b.error || 'Not sent'); return b; }); })
        .then(function(b){ q.result = 'Sent to ' + b.to; q.ok = true; finish(q, 'Sent', { sentTo: b.to, subject: b.subject, sentAt: new Date().toISOString() }); })
        .catch(function(e){ q.result = String(e.message || e); q.ok = false; finish(q, 'Not sent: ' + q.result); });
    });
    Promise.all(jobs).then(function(){ busy = false; save(); paint(); });
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function(e){
      var t = e.target && e.target.closest ? e.target : null; if (!t) return;
      var b = t.closest('[data-cec]'), pv = t.closest('[data-cec-preview]');
      if (pv) { var q = queue[Number(pv.dataset.cecPreview)]; if (q) preview(q).then(function(p){ q.previewText = 'To: ' + (p.to || 'no email on the customer record') + '\nSubject: ' + p.subject + '\n\n' + p.text; paint(); }).catch(function(err){ q.previewText = String(err.message || err); paint(); }); return; }
      if (!b) return;
      if (b.dataset.cec === 'send') sendAll();
      if (b.dataset.cec === 'skip') { queue.forEach(function(q){ if (!q.result) finish(q, 'Not sent (staff chose not to)'); }); queue = []; info = null; save(); paint(); }
      if (b.dataset.cec === 'done') { queue = []; info = null; paint(); }
    });
    document.addEventListener('change', function(e){ var c = e.target; if (c && c.matches && c.matches('[data-cec-tick]')) { var q = queue[Number(c.dataset.cecTick)]; if (q) q.tick = c.checked; } });
  }
  if (typeof document !== 'undefined' && document.head && !document.getElementById('cec-styles')) {
    var st = document.createElement('style'); st.id = 'cec-styles';
    st.textContent = '.cec{position:fixed;right:18px;bottom:18px;z-index:1100;width:min(420px,calc(100vw - 36px));max-height:70vh;overflow:auto;background:var(--surface,#fff);color:inherit;border:1px solid rgba(15,76,87,.25);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.22);padding:12px 14px}' +
      '.cec header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.cec-x{border:0;background:none;font-size:22px;cursor:pointer;min-height:0;color:inherit}' +
      '.cec ul{list-style:none;margin:0;padding:0}.cec li{padding:8px 0;border-top:1px solid rgba(0,0,0,.08)}.cec label{display:flex;gap:8px;align-items:flex-start;font-size:14px}.cec input[type=checkbox]{width:18px;height:18px;margin-top:2px}' +
      '.cec .link{background:none;border:0;text-decoration:underline;cursor:pointer;font-size:13px;padding:2px 0 0 26px;min-height:0;color:inherit}.cec small{display:block;padding-left:26px;font-size:13px}.cec small.ok{color:#1d7a4c}.cec small.bad{color:#b9474f}' +
      '.cec pre{white-space:pre-wrap;font:13px/1.45 inherit;background:rgba(15,76,87,.05);border-radius:8px;padding:8px;margin:6px 0 0 26px}.cec-warn{font-size:13.5px;background:rgba(168,98,0,.1);border-radius:8px;padding:8px;margin:0 0 6px}' +
      '.cec footer{display:flex;gap:8px;margin-top:10px}';
    document.head.appendChild(st);
  }
  global.PoolShedCustomerEmails = { _queue: function(){ return queue; }, _paint: paint, steps: CUSTOMER_STEPS };
})(typeof window !== 'undefined' ? window : globalThis);
