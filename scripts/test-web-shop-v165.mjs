// v1.65 web shop readiness: signed messages only (Shopify, WooCommerce, other), orders put into one shape with prices
// before VAT after discounts, web order → sales order (customer matched by email or created, SKUs matched, custom
// lines only when allowed, delivery line, payment), dispatch updates queued, database guards, wiring.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { verify, sign, fromShopify, fromWooCommerce, fromOther, normalise } from '../server/shop-orders.js';

const secret = 'abcdefghijklmnopqrstuvwxyz123456', raw = Buffer.from('{"id":1}');
assert.equal(verify({ 'x-shopify-hmac-sha256': sign(secret, raw) }, raw, secret).platform, 'shopify');
assert.equal(verify({ 'X-WC-Webhook-Signature': sign(secret, raw) }, raw, secret).platform, 'woocommerce');
assert.equal(verify({ 'x-poolshed-signature': sign(secret, raw) }, raw, secret).platform, 'other');
assert.equal(verify({ authorization: 'Bearer ' + secret }, Buffer.alloc(0), secret).ok, true);
assert.equal(verify({ 'x-shopify-hmac-sha256': sign('wrong-secret-wrong-secret-xx', raw) }, raw, secret).ok, false, 'wrong secret refused');
assert.equal(verify({ 'x-shopify-hmac-sha256': sign(secret, raw) }, Buffer.from('{"id":2}'), secret).ok, false, 'changed body refused');
assert.equal(verify({}, raw, secret).ok, false, 'unsigned refused'); assert.equal(verify({ authorization: 'Bearer x' }, raw, '').ok, false, 'no secret set: refused');

// Shopify, prices including VAT, a discount and delivery.
const sh = fromShopify({ id: 555, name: '#1001', created_at: '2026-12-01T10:00:00Z', email: 'Jo@Example.com', taxes_included: true, currency: 'GBP', financial_status: 'paid', payment_gateway_names: ['shopify_payments'],
  customer: { first_name: 'Jo', last_name: 'Bloggs' }, billing_address: { first_name: 'Jo', last_name: 'Bloggs', address1: '1 High St', city: 'Leeds', zip: 'LS1 1AA', country_code: 'GB' },
  line_items: [{ sku: 'CHL-5', title: 'Chlorine', variant_title: '5kg', quantity: 2, price: '30.00', discount_allocations: [{ amount: '6.00' }], tax_lines: [{ rate: 0.2, price: '9.00' }] }],
  shipping_lines: [{ title: 'Standard', price: '6.00', tax_lines: [{ price: '1.00' }] }], total_price: '60.00', total_tax: '10.00' });
assert.equal(sh.external_number, '#1001'); assert.equal(sh.customer.email, 'jo@example.com');
assert.deepEqual(JSON.parse(JSON.stringify(sh.lines[0])), { sku: 'CHL-5', name: 'Chlorine - 5kg', qty: 2, net: 45, vat: 9, unit_net: 22.5, vat_rate: 20 });
assert.equal(sh.shipping.net, 5); assert.equal(sh.payment.status, 'paid'); assert.equal(sh.payment.amount, 60); assert.equal(sh.shipping_address.postcode, 'LS1 1AA', 'billing used when no delivery address');
// WooCommerce, prices before VAT.
const wc = fromWooCommerce({ id: 77, number: '77', status: 'processing', date_created_gmt: '2026-12-02T09:00:00', billing: { first_name: 'Ann', last_name: 'Lee', email: 'ann@example.com', postcode: 'B1 1AA' }, shipping: { address_1: '2 Road', postcode: 'B2 2BB' },
  line_items: [{ sku: 'PUMP', name: 'Pump', quantity: 1, total: '400.00', total_tax: '80.00' }], shipping_lines: [{ method_title: 'Courier', total: '10.00', total_tax: '2.00' }], total: '492.00', total_tax: '82.00', payment_method_title: 'Card' });
assert.equal(wc.lines[0].net, 400); assert.equal(wc.lines[0].vat_rate, 20); assert.equal(wc.shipping_address.postcode, 'B2 2BB'); assert.equal(wc.payment.status, 'paid'); assert.equal(wc.totals.net, 410);
// Any other website, prices including VAT.
const ot = fromOther({ id: 'A9', customer: { name: 'Sam', email: 'sam@example.com' }, prices_include_vat: true, lines: [{ sku: 'TAB', name: 'Tablets', qty: 3, unit_price: 12 }], shipping: { method: 'Post', price: 6 } });
assert.equal(ot.lines[0].net, 30); assert.equal(ot.lines[0].vat, 6); assert.equal(ot.shipping.net, 5); assert.equal(ot.totals.gross, 42);
assert.throws(() => normalise('other', { id: 'X', lines: [] }), /no lines/); assert.throws(() => normalise('other', { lines: [{ sku: 'a' }] }), /no id/);

// App: web order → sales order.
const data = { customers: [{ id: 'C-001', name: 'Jo Bloggs', email: 'jo@example.com' }], products: [{ id: 'P1', sku: 'CHL-5', name: 'Chlorine 5kg', rrp: 25 }, { id: 'P2', sku: 'PUMP', name: 'Pump', rrp: 400 }], salesOrders: [], stock: [{ productId: 'P2', qty: 3, allocated: 1 }] };
let saves = 0, marks = [], outbox = [], n = 3000, prev = [];
const ctx = { console, Date, Math, Number, String, JSON, Object, Array, Map, Intl, RegExp, Promise, setTimeout, clearTimeout, Uint8Array, crypto: globalThis.crypto,
  __POOL_SHED_GET_DATA__: () => data, __POOL_SHED_SAVE_APP_DATA__: () => { saves++; },
  __POOL_SHED_DB__: () => ({ rpc: async (name, args) => { if (name === 'ps_shop_order_mark') { if (args.order_id === 'taken') return { error: { message: 'Web order #9 is already sales order SO-1' } }; marks.push(args); return { data: {} }; }
    if (name === 'ps_shop_outbox_add') { outbox.push(args); return { data: { id: 'x' } }; } return { data: [] }; } }),
  nextSalesOrderId: () => 'SO-' + (n++), nextCustomerId: () => 'C-00' + (data.customers.length + 1), nextCustomerCode: () => 'CUST-' + (data.customers.length + 1),
  createNonStockProduct: (type, name, price) => { const p = { id: (type === 'shipping' ? 'SHIP-' : 'CUSTOM-') + data.products.length, name, rrp: price, productType: type === 'shipping' ? 'Shipping charge' : 'Custom charge', stockTracked: false }; data.products.push(p); return p; },
  addSalesOrderNotification: () => {}, addNotification: (...a) => { prev.push(a); return 'original'; }, render: () => {}, document: { addEventListener() {}, head: null } };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync('public/web-shop.js', 'utf8'), ctx);
const S = ctx.PoolShedWebShop;
const shop1 = Object.assign({ id: 'w1', platform: 'shopify', status: 'new' }, sh);
let c = S.check(shop1); assert.equal(c.customer.id, 'C-001', 'customer matched by email'); assert.equal(c.missing.length, 0); assert.equal(c.differs, false, 'lines add up to the order');
let r = await S.importOne(shop1, false);
const so = data.salesOrders[0];
assert.equal(so.id, r.order.id); assert.equal(so.customerId, 'C-001'); assert.equal(so.source, 'Web shop'); assert.equal(so.status, 'New Order'); assert.equal(so.customerPo, '#1001');
assert.equal(so.lines[0].productId, 'P1'); assert.equal(so.lines[0].specialPrice, 22.5, 'price paid before VAT, after discount'); assert.equal(so.lines[0].customerDiscountExempt, true); assert.equal(so.lines[0].taxCode, '20% VAT');
assert.equal(so.lines[1].lineType, 'shipping'); assert.equal(so.lines[1].specialPrice, 5);
assert.equal(so.payments.length, 1); assert.equal(so.payments[0].amount, 60); assert(/Web shop \(shopify_payments\)/.test(so.payments[0].type));
assert.deepEqual(JSON.parse(JSON.stringify(marks[0])), { w: 'pool-bros-main', order_id: 'w1', new_status: 'imported', sales_order: so.id, reason: null }); assert(saves > 0);
// New customer, unknown SKU: refused unless custom lines are allowed.
const shop2 = Object.assign({ id: 'w2', platform: 'other', status: 'new' }, fromOther({ id: 'B1', customer: { name: 'New Person', email: 'new@example.com' }, billing_address: { line1: '9 Lane', postcode: 'N1 1AA' }, lines: [{ sku: 'PUMP', qty: 1, unit_price: 400 }, { sku: 'ZZZ', name: 'Mystery', qty: 1, unit_price: 10 }] }));
assert.equal(S.check(shop2).missing.length, 1);
await assert.rejects(S.importOne(shop2, false), /SKU Pool Shed does not know: ZZZ/);
assert.equal(data.customers.length, 1, 'nothing created when refused');
r = await S.importOne(shop2, true);
assert.equal(r.newCustomer, true); assert.equal(data.customers.length, 2); assert.equal(data.customers[1].email, 'new@example.com'); assert.deepEqual(Array.from(data.customers[1].tags), ['Web shop']);
assert.equal(r.order.lines[1].lineType, 'custom'); assert.equal(r.order.payments.length, 0, 'not paid: no payment recorded');
// Taken by someone else meanwhile: the order and the new customer are dropped again.
const before = { o: data.salesOrders.length, c: data.customers.length };
const shop3 = Object.assign({ id: 'taken', platform: 'other', status: 'new' }, fromOther({ id: 'C9', customer: { name: 'Late', email: 'late@example.com' }, lines: [{ sku: 'PUMP', qty: 1, unit_price: 400 }] }));
await assert.rejects(S.importOne(shop3, false), /already sales order/);
assert.equal(data.salesOrders.length, before.o); assert.equal(data.customers.length, before.c);
// Dispatch: web orders queue an update, then the earlier handler still runs; other orders do not queue.
data.salesOrders.push({ id: 'SO-OTHER', source: 'Phone' });
assert.equal(ctx.addNotification({ id: 'GN1', salesOrderId: so.id, courier: 'DPD', trackingRef: 'TRK1' }, 'Ship', 's', 'x'), 'original');
ctx.addNotification({ id: 'GN2', salesOrderId: 'SO-OTHER' }, 'Ship', 's', 'x'); ctx.addNotification({ id: 'GN3', salesOrderId: so.id }, 'Pick', 's', 'x');
await new Promise(res => setTimeout(res, 0));
assert.equal(outbox.length, 1); assert.equal(outbox[0].kind, 'shipped'); assert.equal(outbox[0].payload.tracking, 'TRK1'); assert.equal(prev.length, 3, 'earlier handler always runs');
// Settings helpers.
assert.equal(S._randomSecret().length, 30); const cat = S.catalogue(); assert.equal(cat.online, 0);
data.products[1].sellOnline = true; assert.equal(S.catalogue().online, 1); assert.equal(S.catalogue().noStock, 0, 'pump has 2 free');
const t = S.testOrder(); assert(t.lines.length >= 1 && t.payment.status === 'paid' && t.totals.gross > 0);

// Database and server guards.
const sql = fs.readFileSync('database/035-web-shop.sql', 'utf8').replace(/--.*$/gm, ''), media = fs.readFileSync('api/media.js', 'utf8');
assert(/enabled boolean not null default false/.test(sql), 'starts off');
assert(/revoke all on public\.ps_shop_settings, public\.ps_shop_orders, public\.ps_shop_outbox from anon, authenticated/.test(sql), 'tables not readable directly (secret hidden)');
for (const fn of ['ps_shop_order_receive\\(text,text,jsonb,jsonb,boolean\\)', 'ps_shop_stock\\(text\\)', 'ps_shop_require\\(text,boolean\\)']) assert(new RegExp('revoke all on function public\\.' + fn + ' from public, anon, authenticated;').test(sql), fn + ' server only');
assert(/unique \(workspace_id, platform, external_id\)/.test(sql) && /on conflict \(workspace_id, platform, external_id\) do nothing/.test(sql), 'same order received once');
assert(/Set the shop secret before switching the web shop on/.test(sql) && /at least 24 characters/.test(sql));
assert(/sellOnline', 'false'\) = 'true'/.test(sql) && /greatest\(0, coalesce\(ps_num\(r\.data->'qty'\), 0\) - coalesce\(ps_num\(r\.data->'allocated'\), 0\)\)/.test(sql), 'stock feed: sell-online products, free stock');
assert(/if\(!cfg\|\|!cfg\.enabled\)return send\(res,503/.test(media) && /check=verifyShop\(req\.headers,raw,cfg\.secret\);if\(!check\.ok\)return send\(res,401/.test(media), 'server: off means off; unsigned refused');
// Wiring.
const legacy = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8'), set = fs.readFileSync('public/settings-command-workspace.js', 'utf8'), index = fs.readFileSync('public/index.html', 'utf8'), sw = fs.readFileSync('public/service-worker.js', 'utf8');
assert(/"Contracts", "Web Orders", "Sales Credits"/.test(legacy) && /'Integrations','Web Shop',/.test(set) && /'Web Shop':webShopPage/.test(set));
assert(index.indexOf('web-shop.js') > index.indexOf('customer-emails.js'), 'loads after customer emails so both run on dispatch');
assert(/web-shop\.js\?v=1\.87\.0/.test(sw));
console.log('Web shop v1.65: signed orders only, any platform, web order → sales order, dispatch updates queued, stock feed, starts off.');
