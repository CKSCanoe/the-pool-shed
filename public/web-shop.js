/* Pool Shed v1.95.0 — ready for a web shop (any platform), before the website exists.
   Sales → Web Orders: orders sent by the website wait here. Each shows whether the customer is already on file (by
   email) and whether every item's SKU is found; one click turns it into a normal sales order (customer created if
   new, prices as paid before VAT, delivery charge, payment recorded if paid). Nothing is imported on its own.
   Settings → Web Shop: switch (starts off), platform, the shop secret, the two addresses to give the website, a test
   order, which products sell online, and a catalogue check (SKUs, prices, pictures, stock).
   When a web order is shipped, part shipped or collected, the update (with courier and tracking) is queued for the
   shop; it is sent once the platform is connected. Customer emails keep working as before. */
(function(global){
  'use strict';
  var PLATFORMS = { none: 'Not chosen yet', shopify: 'Shopify', woocommerce: 'WooCommerce', other: 'Another website' }, SOURCE_NAMES = { test: 'Test order' };
  var DATA = function(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? (global.__POOL_SHED_GET_DATA__() || {}) : {}; };
  var esc = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); };
  var num = function(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; };
  var r2 = function(n){ return Math.round(num(n) * 100) / 100; };
  var cash = function(v){ return '£' + num(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var W = function(){ return typeof global.__POOL_SHED_WORKSPACE_ID__ === 'function' ? global.__POOL_SHED_WORKSPACE_ID__() : 'pool-bros-main'; };
  var DB = function(){ return typeof global.__POOL_SHED_DB__ === 'function' ? global.__POOL_SHED_DB__() : null; };
  async function rpc(name, args){ var db = DB(); if (!db) throw new Error('Not connected. Sign in again.'); var r = await db.rpc(name, args); if (r.error) throw new Error(String(r.error.message || r.error).replace(/^.*?ERROR:\s*/, '')); return r.data; }
  function save(){ try { if (typeof global.__POOL_SHED_SAVE_APP_DATA__ === 'function') global.__POOL_SHED_SAVE_APP_DATA__(); } catch (_) {} }
  function redraw(){ try { if (typeof global.render === 'function') global.render(); } catch (_) {} }
  function notify(m){ try { if (typeof global.toast === 'function') global.toast(m); } catch (_) {} }
  var inbox = { which: 'new', rows: null, loading: false, msg: null, custom: {}, at: 0 };
  var setup = { s: null, loading: false, msg: null, secret: '', outbox: null, filter: '', reveal: false };

  // ---------- Matching ----------
  function bySku(){ var m = new Map(); (DATA().products || []).forEach(function(p){ var k = String(p.sku || '').trim().toLowerCase(); if (k && !m.has(k)) m.set(k, p); }); return m; }
  function customerByEmail(email){ email = String(email || '').trim().toLowerCase(); if (!email) return null; return (DATA().customers || []).find(function(c){ return String(c.email || '').trim().toLowerCase() === email; }) || null; }
  function check(o){
    var skus = bySku(), lines = (o.lines || []).map(function(l){ var p = skus.get(String(l.sku || '').trim().toLowerCase()); return { line: l, product: p || null }; });
    var cust = customerByEmail(o.customer && o.customer.email), net = lines.reduce(function(t, x){ return t + num(x.line.net); }, 0) + num(o.shipping && o.shipping.net);
    return { lines: lines, missing: lines.filter(function(x){ return !x.product; }), customer: cust, net: r2(net), differs: o.totals && o.totals.net != null && Math.abs(r2(net) - num(o.totals.net)) > 0.02 };
  }
  function taxCode(rate){ rate = num(rate); return rate === 20 ? '20% VAT' : rate === 0 ? 'No VAT (zero rated)' : rate + '% VAT'; }
  function addr(a){ a = a || {}; return { line1: a.line1 || '', line2: a.line2 || '', city: a.town || '', county: a.county || '', postcode: a.postcode || '', country: a.country === 'GB' || !a.country ? 'United Kingdom' : a.country, phone: a.phone || '', name: a.name || '', company: a.company || '' }; }
  function newCustomer(o){
    var d = DATA(), c = o.customer || {}, b = addr(o.billing_address), s = addr(o.shipping_address);
    var id = typeof global.nextCustomerId === 'function' ? global.nextCustomerId() : 'C-WEB-' + Date.now();
    var cust = { id: id, code: typeof global.nextCustomerCode === 'function' ? global.nextCustomerCode() : id, name: c.company || c.name || b.name || c.email, contact: c.name || '', email: c.email || '', phone: c.phone || b.phone || '',
      priceList: 'rrp', tags: ['Web shop'], source: 'Web shop', addresses: { primary: b, billing: b, delivery: s }, customFields: {}, created: new Date().toISOString().slice(0, 10) };
    (d.customers = d.customers || []).push(cust); return cust;
  }
  function charge(type, name, price){
    if (typeof global.createNonStockProduct === 'function') return global.createNonStockProduct(type, name, price, 0, '').id;
    var d = DATA(), id = (type === 'shipping' ? 'SHIP-' : 'CUSTOM-') + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
    (d.products = d.products || []).push({ id: id, sku: id, name: name, rrp: price, cost: 0, productType: type === 'shipping' ? 'Shipping charge' : 'Custom charge', stockTracked: false, hiddenFromCatalogue: true, status: 'Live' }); return id;
  }
  // Build the sales order (not yet saved), so it can be dropped if the web order was taken by someone else meanwhile.
  function buildOrder(o, allowCustom){
    var c = check(o); if (c.missing.length && !allowCustom) throw new Error(c.missing.length + ' item(s) have a SKU Pool Shed does not know: ' + c.missing.map(function(x){ return x.line.sku || '(no SKU) ' + x.line.name; }).join(', ') + '. Add the SKU to the product, or tick "add unknown items as custom lines".');
    var d = DATA(), cust = c.customer || newCustomer(o), today = new Date().toISOString().slice(0, 10), date = String(o.order_date || '').slice(0, 10) || today;
    var lines = c.lines.map(function(x){ var l = x.line, qty = Math.max(1, num(l.qty)), unit = qty ? r2(num(l.net) / qty) : num(l.unit_net);
      if (x.product) return { productId: x.product.id, qty: qty, allocated: 0, picked: 0, packed: 0, shipped: 0, specialPrice: unit, unitPrice: unit, taxCode: taxCode(l.vat_rate), description: l.name || x.product.name || '', customerDiscountExempt: true };
      var pid = charge('custom', l.name || l.sku || 'Web item', unit);
      return { productId: pid, lineType: 'custom', customProductName: l.name || l.sku, description: l.name || l.sku, qty: qty, allocated: qty, picked: 0, packed: 0, unitPrice: unit, specialPrice: unit, unitCost: 0, taxCode: taxCode(l.vat_rate), accountCode: '4000 Sales', customerDiscountExempt: true, note: l.sku ? 'Web SKU ' + l.sku : '' }; });
    var sh = o.shipping || {};
    if (num(sh.net) > 0 || sh.method) { var sp = charge('shipping', sh.method || 'Delivery', r2(sh.net));
      lines.push({ productId: sp, lineType: 'shipping', shippingMethod: sh.method || 'Delivery', description: sh.method || 'Delivery', qty: 1, allocated: 1, picked: 0, packed: 0, unitPrice: r2(sh.net), unitCost: 0, specialPrice: r2(sh.net), accountCode: '4040 Shipping Income', taxCode: taxCode(sh.vat_rate), customerDiscountExempt: true }); }
    var s = addr(o.shipping_address), id = typeof global.nextSalesOrderId === 'function' ? global.nextSalesOrderId('SO') : 'SO-WEB-' + Date.now(), pay = o.payment || {};
    var order = { id: id, customerId: cust.id, quoteRef: 'Web ' + (o.external_number || o.external_id), customerPo: o.external_number || o.external_id, xeroRef: 'Draft', source: 'Web shop', channel: 'Web',
      status: 'New Order', tags: ['Web shop'].concat(o.test ? ['Test'] : []), priceList: 'rrp', priceOverrideReason: 'Price paid on the web shop', created: today, date: date, due: today,
      shipTo: [s.name, s.company, s.line1, s.line2, s.city, s.postcode].filter(Boolean).join(', '), carrier: 'Main Warehouse A1', webOrder: { id: o.id, externalId: o.external_id, number: o.external_number, platform: o.platform, test: !!o.test },
      lines: lines, payments: pay.status === 'paid' && num(pay.amount) > 0 ? [{ id: 'PAY-' + id.replace(/[^A-Za-z0-9_-]/g, '') + '-001', date: date, type: 'Web shop' + (pay.method ? ' (' + pay.method + ')' : ''), reference: pay.reference || o.external_number || '', amount: r2(pay.amount) }] : [],
      notifications: [], notes: o.note ? 'Customer note: ' + o.note : '' };
    return { order: order, customer: cust, newCustomer: !c.customer, check: c };
  }
  async function importOne(o, allowCustom){
    var d = DATA(), b = buildOrder(o, allowCustom), custBefore = (d.customers || []).length;
    (d.salesOrders = d.salesOrders || []).unshift(b.order);
    try { await rpc('ps_shop_order_mark', { w: W(), order_id: o.id, new_status: 'imported', sales_order: b.order.id, reason: null }); }
    catch (e) { d.salesOrders = d.salesOrders.filter(function(x){ return x !== b.order; }); if (b.newCustomer) d.customers = d.customers.filter(function(x){ return x !== b.customer; }); throw e; }
    try { if (typeof global.addSalesOrderNotification === 'function') global.addSalesOrderNotification(b.order, 'Web order', b.order.id + ' created from web order ' + (o.external_number || o.external_id) + (b.newCustomer ? ' (new customer ' + b.customer.name + ')' : '') + '.', 'Internal note'); } catch (_) {}
    save(); return b;
  }

  // ---------- Inbox (Sales → Web Orders) ----------
  async function loadInbox(force){
    if (inbox.loading || (!force && inbox.rows && Date.now() - inbox.at < 30000)) return; inbox.loading = true;
    try { inbox.rows = await rpc('ps_shop_orders_list', { w: W(), which: inbox.which, max_rows: 300 }); inbox.at = Date.now(); } catch (e) { inbox.rows = []; inbox.msg = { ok: false, html: esc(e.message) }; }
    inbox.loading = false; redraw();
  }
  function inboxPage(){
    if (!inbox.rows) loadInbox(false);
    var rows = inbox.rows || [], ready = rows.filter(function(o){ return o.status === 'new' && !check(o).missing.length; });
    var body = rows.map(function(o){ var c = check(o), pay = o.payment || {}, t = o.totals || {}, cust = o.customer || {}, sa = o.shipping_address || {};
      return '<tr><td><strong>' + esc(o.external_number || o.external_id) + '</strong>' + (o.test ? ' <span class="ws-pill">test</span>' : '') + '<small>' + esc(PLATFORMS[o.platform] || SOURCE_NAMES[o.platform] || o.platform) + ' · ' + esc(String(o.order_date || o.received_at || '').slice(0, 16).replace('T', ' ')) + '</small></td>' +
        '<td>' + esc(cust.name || cust.email) + '<small>' + esc(cust.email || '') + (c.customer ? ' · on file (' + esc(c.customer.id) + ')' : ' · <b>new customer</b>') + '</small><small>' + esc([sa.town, sa.postcode].filter(Boolean).join(' ')) + '</small></td>' +
        '<td>' + (o.lines || []).length + ' item' + ((o.lines || []).length === 1 ? '' : 's') + (c.missing.length ? '<small class="ws-bad">' + c.missing.length + ' SKU not found: ' + esc(c.missing.map(function(x){ return x.line.sku || x.line.name; }).join(', ')) + '</small>' : '<small class="ws-good">all SKUs found</small>') + '</td>' +
        '<td class="num">' + cash(t.gross) + '<small>' + cash(t.net) + ' before VAT' + (c.differs ? ' · <span class="ws-bad">lines add up to ' + cash(c.net) + '</span>' : '') + '</small></td>' +
        '<td><span class="ws-pill ' + (pay.status === 'paid' ? 'good' : 'warn') + '">' + esc(pay.status === 'paid' ? 'Paid' : 'Not paid (' + (pay.status || 'pending') + ')') + '</span></td>' +
        '<td class="ws-actions">' + (o.status === 'new' ? (c.missing.length ? '<label class="ws-inline"><input type="checkbox" data-ws-custom="' + esc(o.id) + '"' + (inbox.custom[o.id] ? ' checked' : '') + '> add unknown items as custom lines</label>' : '') +
            '<button type="button" class="primary small" data-ws-import="' + esc(o.id) + '"' + (c.missing.length && !inbox.custom[o.id] ? ' disabled' : '') + '>Create sales order</button><button type="button" class="link" data-ws-ignore="' + esc(o.id) + '">Ignore</button>'
          : o.status === 'imported' ? 'Sales order <button type="button" class="link" data-ws-open="' + esc(o.sales_order_id) + '">' + esc(o.sales_order_id) + '</button>'
          : 'Ignored: ' + esc(o.handled_note || '') + ' <button type="button" class="link" data-ws-restore="' + esc(o.id) + '">Bring back</button>') + '</td></tr>'; }).join('');
    return '<section class="so-list-page ws-page" aria-label="Web orders"><div class="so-list-commandbar"><div class="so-list-command-copy"><span>WEB SHOP</span><strong>Web Orders</strong><small>Orders sent by the website wait here until someone creates the sales order. Nothing is imported on its own.</small></div>' +
      '<div>' + (ready.length > 1 ? '<button type="button" class="primary" data-ws-import-all>Create ' + ready.length + ' sales orders</button> ' : '') + '<button type="button" class="secondary" data-ws-refresh>Refresh</button></div></div>' +
      (inbox.msg ? '<div class="ws-msg ' + (inbox.msg.ok ? 'ok' : 'bad') + '" role="status">' + inbox.msg.html + '</div>' : '') +
      '<div class="ws-tabs">' + [['new', 'Waiting'], ['imported', 'Created'], ['ignored', 'Ignored'], ['all', 'All']].map(function(x){ return '<button type="button" class="pill ' + (inbox.which === x[0] ? 'blue' : 'dark') + '" data-ws-which="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="panel">' + (inbox.loading && !inbox.rows ? '<p class="muted">Loading…</p>' : body ? '<div class="table-wrap"><table class="ws-table"><thead><tr><th>Web order</th><th>Customer</th><th>Items</th><th class="num">Total</th><th>Payment</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>'
        : '<p class="muted">' + (inbox.which === 'new' ? 'No web orders waiting. Once the website is connected (Settings → Web Shop), its orders appear here. You can send a test order from there.' : 'Nothing here.') + '</p>') + '</div></section>';
  }
  function openOrder(id){ try { if (typeof selectedSalesOrderId !== 'undefined') selectedSalesOrderId = id; if (typeof salesOrderView !== 'undefined') salesOrderView = 'detail'; if (typeof activeSubPage !== 'undefined') activeSubPage.salesorders = 'Sales Orders'; } catch (_) {} redraw(); }

  // ---------- Settings → Web Shop ----------
  async function loadSetup(){
    if (setup.loading) return; setup.loading = true;
    try { var r = await Promise.all([rpc('ps_shop_settings_get', { w: W() }), rpc('ps_shop_outbox_list', { w: W(), max_rows: 30 })]); setup.s = r[0]; setup.outbox = r[1]; }
    catch (e) { setup.s = { error: e.message }; }
    setup.loading = false; redraw();
  }
  function randomSecret(){ var a = new Uint8Array(30); (global.crypto || {}).getRandomValues(a); return Array.from(a, function(b){ return 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[b % 57]; }).join(''); }
  function catalogue(){
    var ps = (DATA().products || []).filter(function(p){ return p && p.productType !== 'Custom charge' && p.productType !== 'Shipping charge' && !p.hiddenFromCatalogue && p.status !== 'Archived' && !p.deleted; });
    var online = ps.filter(function(p){ return p.sellOnline === true; }), count = {}; ps.forEach(function(p){ var k = String(p.sku || '').trim().toLowerCase(); if (k) count[k] = (count[k] || 0) + 1; });
    var stock = {}; (DATA().stock || []).forEach(function(s){ stock[s.productId] = (stock[s.productId] || 0) + Math.max(0, num(s.qty) - num(s.allocated)); });
    return { all: ps.length, online: online.length, noSku: online.filter(function(p){ return !String(p.sku || '').trim(); }).length, dupSku: online.filter(function(p){ return count[String(p.sku || '').trim().toLowerCase()] > 1; }).length,
      noPrice: online.filter(function(p){ return !(num(p.rrp) > 0); }).length, noPicture: online.filter(function(p){ return !(p.imageUrl || (p.images && p.images.length) || p.image || p.mediaRef); }).length,
      noStock: online.filter(function(p){ return !(stock[p.id] > 0); }).length, products: ps };
  }
  function matches(p, f){ f = String(f || '').trim().toLowerCase(); if (!f) return false; return [p.sku, p.name, p.brand, p.category, p.productType].join(' ').toLowerCase().indexOf(f) >= 0; }
  function settingsBody(){
    if (!setup.s && !setup.loading) loadSetup();
    var s = setup.s || {}, origin = (global.location && global.location.origin) || 'https://the-pool-shed.vercel.app', w = encodeURIComponent(W());
    if (s.error) return '<div class="ws-msg bad">' + esc(s.error) + '</div>';
    var cat = catalogue(), hit = setup.filter ? cat.products.filter(function(p){ return matches(p, setup.filter); }) : [];
    var orderUrl = origin + '/api/media?action=shop-order&workspace=' + w, stockUrl = origin + '/api/media?action=shop-stock&workspace=' + w;
    var steps = { shopify: 'In Shopify: Settings → Notifications → Webhooks → Create webhook: event "Order creation", format JSON, URL as below; add a second for "Order payment". Shopify shows the signing secret on that page: paste it into "Shop secret" here.',
      woocommerce: 'In WooCommerce: Settings → Advanced → Webhooks → Add webhook: topic "Order created", delivery URL as below, and a secret: generate one here, save, then paste the same secret into WooCommerce.',
      other: 'Give your web developer the order address and the secret. Each order is sent as JSON (POST), signed with an X-PoolShed-Signature header: base64 HMAC-SHA256 of the body with the secret. The stock address is read with GET and the header "Authorization: Bearer <secret>".',
      none: 'Choose the platform when the website is ready. Everything below works the same for any platform.' };
    var out = (setup.outbox || []).slice(0, 15).map(function(x){ return '<tr><td>' + esc(String(x.created_at || '').slice(0, 16).replace('T', ' ')) + '</td><td>' + esc(x.sales_order_id) + ' / web ' + esc(x.external_number || x.external_id) + (x.test ? ' (test)' : '') + '</td><td>' + esc(x.kind.replace('_', ' ')) + '</td><td>' + esc([x.payload && x.payload.courier, x.payload && x.payload.tracking].filter(Boolean).join(' ')) + '</td><td>' + esc(x.status) + '</td></tr>'; }).join('');
    return '<div class="ws-setup">' + (setup.msg ? '<div class="ws-msg ' + (setup.msg.ok ? 'ok' : 'bad') + '" role="status">' + setup.msg.html + '</div>' : '') +
      '<section class="settings-panel"><header><div><h2>Connection</h2><p>' + (s.enabled ? '<span class="ws-pill good">On</span> Pool Shed accepts orders from the website and gives it stock levels.' : '<span class="ws-pill">Off</span> The website cannot send orders or read stock until this is switched on.') + '</p></div></header>' +
      '<form data-ws-settings class="ws-grid"><label>Platform<select name="platform">' + Object.keys(PLATFORMS).map(function(k){ return '<option value="' + k + '"' + ((s.platform || 'none') === k ? ' selected' : '') + '>' + PLATFORMS[k] + '</option>'; }).join('') + '</select></label>' +
      '<label>Shop name<input name="shop_name" value="' + esc(s.shop_name || '') + '" placeholder="e.g. Pool Bros Shop"></label><label>Shop address<input name="shop_url" value="' + esc(s.shop_url || '') + '" placeholder="https://shop.example.co.uk"></label>' +
      '<label class="ws-wide">Shop secret ' + (s.has_secret ? '<small>(set ' + esc(String(s.secret_set_at || '').slice(0, 10)) + ', ends …' + esc(s.secret_hint) + '; leave empty to keep it)</small>' : '<small>(not set yet)</small>') +
        '<span class="ws-row"><input name="secret" value="' + esc(setup.secret) + '" autocomplete="off" spellcheck="false" placeholder="Paste the secret from the shop, or generate one"><button type="button" class="secondary" data-ws-gen>Generate</button></span>' +
        (setup.secret ? '<small class="ws-warn">Copy this secret now and keep it safe: after saving, Pool Shed only shows its last 4 characters.</small>' : '') + '</label>' +
      '<label class="ws-check"><input type="checkbox" name="enabled"' + (s.enabled ? ' checked' : '') + '> Accept orders from the website and give it stock levels</label>' +
      '<div class="ws-wide"><button type="submit" class="primary">Save</button></div></form></section>' +
      '<section class="settings-panel"><header><div><h2>Give these to the website</h2><p>' + esc(steps[s.platform || 'none']) + '</p></div></header>' +
      '<table class="ws-table"><tbody><tr><td>Orders (POST)</td><td><code>' + esc(orderUrl) + '</code> <button type="button" class="link" data-ws-copy="' + esc(orderUrl) + '">Copy</button></td></tr>' +
      '<tr><td>Stock levels (GET)</td><td><code>' + esc(stockUrl) + '</code> <button type="button" class="link" data-ws-copy="' + esc(stockUrl) + '">Copy</button></td></tr></tbody></table>' +
      '<p class="muted">Stock levels are warehouse stock less what is allocated, for products marked "sell online" only. Van, quarantine and receiving stock is not offered.</p>' +
      '<div class="ws-row"><button type="button" class="secondary" data-ws-test>Send a test order</button><span class="muted">Puts a pretend order in Sales → Web Orders (marked test) so you can try the whole flow now.</span></div></section>' +
      '<section class="settings-panel"><header><div><h2>Products to sell online</h2><p>' + cat.online + ' of ' + cat.all + ' products are marked to sell online.</p></div></header>' +
      '<div class="ws-checks">' + [['No SKU', cat.noSku, 'the website matches products by SKU'], ['SKU used twice', cat.dupSku, 'each SKU must be unique'], ['No price', cat.noPrice, 'RRP is the online price'], ['No picture', cat.noPicture, ''], ['None in stock', cat.noStock, 'the website will show them as sold out']].map(function(x){
        return '<div class="ws-check ' + (x[1] ? 'warn' : 'good') + '"><strong>' + x[1] + '</strong><span>' + esc(x[0]) + '</span><small>' + esc(x[2]) + '</small></div>'; }).join('') + '</div>' +
      '<div class="ws-row"><input data-ws-filter value="' + esc(setup.filter) + '" placeholder="Find products by SKU, name, brand or category" aria-label="Find products">' +
        (setup.filter ? '<button type="button" class="secondary" data-ws-mark="on">Sell these ' + hit.length + ' online</button><button type="button" class="secondary" data-ws-mark="off">Stop selling these online</button>' : '') + '</div>' +
      (setup.filter ? '<p class="muted">' + hit.slice(0, 12).map(function(p){ return esc((p.sku || '—') + ' ' + (p.name || '')) + (p.sellOnline ? ' ✓' : ''); }).join(' · ') + (hit.length > 12 ? ' … and ' + (hit.length - 12) + ' more' : '') + '</p>' : '') + '</section>' +
      '<section class="settings-panel"><header><div><h2>Updates waiting for the shop</h2><p>When a web order is shipped or collected, the update (courier and tracking) is kept here and sent to the shop once the platform is connected. ' + (s.outbox_waiting ? s.outbox_waiting + ' waiting.' : '') + '</p></div></header>' +
      (out ? '<table class="ws-table"><thead><tr><th>When</th><th>Order</th><th>What</th><th>Tracking</th><th>Status</th></tr></thead><tbody>' + out + '</tbody></table>' : '<p class="muted">Nothing yet.</p>') + '</section></div>';
  }
  function testOrder(){
    var ps = catalogue().products.filter(function(p){ return p.sku && num(p.rrp) > 0; }), pick = ps.filter(function(p){ return p.sellOnline; }).concat(ps).slice(0, 2);
    if (!pick.length) throw new Error('No products with a SKU and a price to put on a test order.');
    var lines = pick.map(function(p, i){ var qty = i + 1, net = r2(num(p.rrp) * qty); return { sku: p.sku, name: p.name, qty: qty, net: net, vat: r2(net * 0.2), unit_net: num(p.rrp), vat_rate: 20 }; });
    var net = lines.reduce(function(t, l){ return t + l.net; }, 0) + 4.95, vat = lines.reduce(function(t, l){ return t + l.vat; }, 0) + 0.99;
    var a = { name: 'Test Customer', line1: '1 Test Street', town: 'Testville', postcode: 'TE1 1ST', country: 'GB' };
    return { customer: { name: 'Test Customer', email: 'web-test@example.test' }, billing_address: a, shipping_address: a, lines: lines, shipping: { method: 'Standard delivery', net: 4.95, vat: 0.99, vat_rate: 20 },
      totals: { net: r2(net), vat: r2(vat), gross: r2(net + vat) }, payment: { status: 'paid', method: 'Test card', reference: 'TEST', amount: r2(net + vat) }, note: 'Test order from Settings → Web Shop', order_date: new Date().toISOString() };
  }

  // ---------- Hooks ----------
  if (typeof global.addNotification === 'function' || typeof addNotification === 'function') {
    var originalNotify = typeof addNotification === 'function' ? addNotification : global.addNotification;
    var wrapped = function(note, trigger){
      try { var kind = { Ship: 'shipped', 'Part Ship': 'part_shipped', Collection: 'collected' }[trigger], o = note && (DATA().salesOrders || []).find(function(x){ return x.id === note.salesOrderId; });
        if (kind && o && o.source === 'Web shop') rpc('ps_shop_outbox_add', { w: W(), sales_order: o.id, kind: kind, payload: { courier: note.courier || note.shippingMethod || '', tracking: note.trackingRef || '', goods_note: note.id, at: new Date().toISOString() } }).catch(function(){}); } catch (_) {}
      return originalNotify.apply(this, arguments);
    };
    try { addNotification = wrapped; } catch (_) {} global.addNotification = wrapped;
  }
  if (typeof global.render === 'function' || typeof render === 'function') {
    var originalRender = typeof render === 'function' ? render : global.render;
    var wrappedRender = function(){ var out = originalRender.apply(this, arguments);
      try { if (typeof active !== 'undefined' && active === 'salesorders' && typeof activeSubPage !== 'undefined' && activeSubPage.salesorders === 'Web Orders') { var el = document.getElementById('screen-salesorders'); if (el) el.innerHTML = inboxPage(); } } catch (_) {}
      return out; };
    try { render = wrappedRender; } catch (_) {} global.render = wrappedRender;
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function(e){
      var t = e.target && e.target.closest ? e.target : null; if (!t) return; var b;
      if ((b = t.closest('[data-ws-which]'))) { inbox.which = b.dataset.wsWhich; inbox.rows = null; inbox.msg = null; redraw(); return; }
      if (t.closest('[data-ws-refresh]')) { inbox.msg = null; loadInbox(true); return; }
      if ((b = t.closest('[data-ws-open]'))) { openOrder(b.dataset.wsOpen); return; }
      if ((b = t.closest('[data-ws-import]')) || t.closest('[data-ws-import-all]')) {
        var list = b ? (inbox.rows || []).filter(function(o){ return o.id === b.dataset.wsImport; }) : (inbox.rows || []).filter(function(o){ return o.status === 'new' && !check(o).missing.length; });
        (async function(){ var made = [], errs = [];
          for (var i = 0; i < list.length; i++) { try { var r = await importOne(list[i], !!inbox.custom[list[i].id]); made.push(r.order.id + (r.newCustomer ? ' (new customer)' : '')); } catch (err) { errs.push((list[i].external_number || list[i].external_id) + ': ' + err.message); } }
          inbox.msg = { ok: !errs.length, html: (made.length ? 'Created ' + made.map(esc).join(', ') + '. ' : '') + (errs.length ? 'Not created: ' + errs.map(esc).join('; ') : '') };
          if (made.length) notify(made.length + ' web order' + (made.length > 1 ? 's' : '') + ' created.'); inbox.rows = null; loadInbox(true); })(); return; }
      if ((b = t.closest('[data-ws-ignore]'))) { var why = global.prompt ? global.prompt('Why ignore this web order? (for example: duplicate, test, cancelled on the website)') : ''; if (!why) return;
        rpc('ps_shop_order_mark', { w: W(), order_id: b.dataset.wsIgnore, new_status: 'ignored', sales_order: null, reason: why }).then(function(){ inbox.msg = { ok: true, html: 'Ignored.' }; inbox.rows = null; loadInbox(true); }).catch(function(err){ inbox.msg = { ok: false, html: esc(err.message) }; redraw(); }); return; }
      if ((b = t.closest('[data-ws-restore]'))) { rpc('ps_shop_order_mark', { w: W(), order_id: b.dataset.wsRestore, new_status: 'new', sales_order: null, reason: null }).then(function(){ inbox.rows = null; loadInbox(true); }).catch(function(err){ inbox.msg = { ok: false, html: esc(err.message) }; redraw(); }); return; }
      if (t.closest('[data-ws-gen]')) { var f = t.closest('form'), inp = f && f.querySelector('input[name="secret"]'); if (!inp) return; inp.value = setup.secret = randomSecret();
        var warn = f.querySelector('.ws-warn'); if (!warn) { warn = document.createElement('small'); warn.className = 'ws-warn'; inp.parentNode.parentNode.appendChild(warn); }
        warn.textContent = 'Copy this secret now and keep it safe: after saving, Pool Shed only shows its last 4 characters.'; return; }
      if ((b = t.closest('[data-ws-copy]'))) { try { global.navigator.clipboard.writeText(b.dataset.wsCopy); notify('Copied.'); } catch (_) {} return; }
      if (t.closest('[data-ws-test]')) { var p; try { p = testOrder(); } catch (err) { setup.msg = { ok: false, html: esc(err.message) }; redraw(); return; }
        rpc('ps_shop_test_order', { w: W(), p: p }).then(function(){ setup.msg = { ok: true, html: 'Test order sent. Open Sales → Web Orders to create its sales order.' }; inbox.rows = null; loadSetup(); }).catch(function(err){ setup.msg = { ok: false, html: esc(err.message) }; redraw(); }); return; }
      if ((b = t.closest('[data-ws-mark]'))) { var on = b.dataset.wsMark === 'on', hit = catalogue().products.filter(function(x){ return matches(x, setup.filter); });
        if (hit.length > 50 && global.confirm && !global.confirm((on ? 'Sell ' : 'Stop selling ') + hit.length + ' products online?')) return;
        hit.forEach(function(x){ x.sellOnline = on; }); save(); setup.msg = { ok: true, html: hit.length + ' product' + (hit.length === 1 ? '' : 's') + (on ? ' marked to sell online.' : ' no longer sold online.') }; redraw(); return; }
    });
    document.addEventListener('change', function(e){ var t = e.target; if (t && t.matches && t.matches('[data-ws-custom]')) { inbox.custom[t.dataset.wsCustom] = t.checked; redraw(); } });
    document.addEventListener('input', function(e){ var t = e.target; if (t && t.matches && t.matches('[data-ws-filter]')) { clearTimeout(setup._ft); setup._ft = setTimeout(function(){ setup.filter = t.value; redraw(); var el = document.querySelector('[data-ws-filter]'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 350); } });
    document.addEventListener('submit', function(e){ var f = e.target; if (!f || !f.matches || !f.matches('[data-ws-settings]')) return; e.preventDefault();
      var fd = new FormData(f), p = { platform: fd.get('platform'), shop_name: fd.get('shop_name'), shop_url: fd.get('shop_url'), enabled: fd.get('enabled') === 'on' }, sec = String(fd.get('secret') || '').trim(); if (sec) p.secret = sec;
      rpc('ps_shop_settings_save', { w: W(), p: p }).then(function(s){ setup.s = s; setup.secret = ''; setup.msg = { ok: true, html: 'Saved.' + (s.enabled ? ' The web shop connection is on.' : '') }; redraw(); })
        .catch(function(err){ setup.msg = { ok: false, html: esc(err.message) }; redraw(); }); });
  }
  if (typeof document !== 'undefined' && document.head && !document.getElementById('ws-styles')) {
    var st = document.createElement('style'); st.id = 'ws-styles';
    st.textContent = '.ws-page small,.ws-setup small{display:block;color:var(--color-text-secondary);font-size:12.5px}.ws-table{width:100%;border-collapse:collapse}.ws-table td,.ws-table th{padding:7px 8px;border-top:1px solid rgba(0,0,0,.06);vertical-align:top;text-align:left}.ws-table .num{text-align:right;white-space:nowrap}' +
      '.ws-pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:12.5px;background:rgba(15,76,87,.08)}.ws-pill.good{background:var(--color-status-success-bg);color:var(--color-status-success-text)}.ws-pill.warn{background:var(--color-status-attention-bg);color:var(--color-status-attention-text)}' +
      '.ws-good{color:var(--color-status-success-text)!important}.ws-bad{color:var(--color-status-danger-text)!important}.ws-warn{color:var(--color-status-attention-text)!important}.ws-msg{border-radius:10px;padding:10px 12px;margin:10px 0}.ws-msg.ok{background:var(--color-status-success-bg)}.ws-msg.bad{background:var(--color-status-danger-bg)}' +
      '.ws-tabs{display:flex;gap:6px;margin:10px 0}.ws-actions{white-space:nowrap}.ws-actions .link,.ws-setup .link{background:none;border:0;padding:0 6px;text-decoration:underline;cursor:pointer;color:inherit;min-height:0}.ws-inline{display:flex;gap:6px;align-items:center;font-size:12.5px;margin-bottom:4px}' +
      '.ws-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px 14px}.ws-grid label{display:flex;flex-direction:column;gap:4px;font-size:13.5px}.ws-wide{grid-column:1/-1}.ws-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}.ws-row input{flex:1;min-width:220px}' +
      '.ws-grid .ws-check{flex-direction:row;align-items:center;grid-column:1/-1}.ws-checks{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0}.ws-checks .ws-check{border:1px solid rgba(15,76,87,.16);border-radius:10px;padding:8px 10px}.ws-checks .ws-check strong{display:block;font-size:20px}.ws-checks .ws-check.warn strong{color:var(--color-status-attention-text)}.ws-checks .ws-check.good strong{color:var(--color-status-success-text)}' +
      '.ws-setup code{font-size:12.5px;word-break:break-all}';
    document.head.appendChild(st);
  }
  global.PoolShedWebShop = { inboxPage: inboxPage, settingsBody: settingsBody, check: check, buildOrder: buildOrder, importOne: importOne, catalogue: catalogue, testOrder: testOrder, _inbox: inbox, _setup: setup, _randomSecret: randomSecret };
})(typeof window !== 'undefined' ? window : globalThis);
