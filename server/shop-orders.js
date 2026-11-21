// Pool Shed v1.65.0 — web shop messages (any platform), checked and put into one shape.
// Shopify and WooCommerce sign each webhook with the shop secret (HMAC-SHA256 of the exact body, base64). Any other
// website can sign the same way (X-PoolShed-Signature) or send the secret as a Bearer token. Prices are worked out
// before VAT per line after discounts, so the sales order matches what the customer paid.
import crypto from 'node:crypto';

const n = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const r2 = v => Math.round(n(v) * 100) / 100;
const s = v => (v == null ? '' : String(v)).trim();
function same(a, b){ const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y); }
export function sign(secret, raw){ return crypto.createHmac('sha256', String(secret)).update(raw).digest('base64'); }

// Which platform sent it, and is it really from the shop?
export function verify(headers, raw, secret){
  const lower = {}; Object.keys(headers || {}).forEach(k => { lower[k.toLowerCase()] = headers[k]; });
  const h = k => String(lower[k] || '');
  if (!secret) return { ok: false, error: 'The web shop secret is not set' };
  const shopify = h('x-shopify-hmac-sha256'), woo = h('x-wc-webhook-signature'), own = h('x-poolshed-signature'), auth = h('authorization');
  if (shopify) return same(shopify, sign(secret, raw)) ? { ok: true, platform: 'shopify', topic: h('x-shopify-topic') } : { ok: false, error: 'Signature does not match' };
  if (woo) return same(woo, sign(secret, raw)) ? { ok: true, platform: 'woocommerce', topic: h('x-wc-webhook-topic') } : { ok: false, error: 'Signature does not match' };
  if (own) return same(own, sign(secret, raw)) ? { ok: true, platform: 'other' } : { ok: false, error: 'Signature does not match' };
  if (auth.startsWith('Bearer ')) return same(auth.slice(7), secret) ? { ok: true, platform: 'other' } : { ok: false, error: 'Key does not match' };
  return { ok: false, error: 'The message is not signed' };
}
function address(a, fallback){
  a = a || {}; fallback = fallback || {};
  const name = s(a.name) || [s(a.first_name), s(a.last_name)].filter(Boolean).join(' ');
  return { name: name || s(fallback.name), company: s(a.company), line1: s(a.address1 || a.address_1 || a.line1), line2: s(a.address2 || a.address_2 || a.line2),
    town: s(a.city || a.town), county: s(a.province || a.state || a.county), postcode: s(a.zip || a.postcode), country: s(a.country_code || a.country), phone: s(a.phone || fallback.phone) };
}
function rateOf(net, vat, given){ if (given != null && given !== '') return r2(n(given) <= 1 ? n(given) * 100 : n(given)); return net > 0 ? Math.round(vat / net * 100) : 0; }

export function fromShopify(o){
  const incl = !!o.taxes_included, lines = (o.line_items || []).map(l => {
    const qty = n(l.quantity), disc = (l.discount_allocations || []).reduce((t, d) => t + n(d.amount), 0) || n(l.total_discount);
    const tax = (l.tax_lines || []).reduce((t, x) => t + n(x.price), 0), total = n(l.price) * qty - disc, net = incl ? total - tax : total;
    return { sku: s(l.sku), name: [s(l.title), s(l.variant_title)].filter(Boolean).join(' - '), qty, net: r2(net), vat: r2(tax), unit_net: qty ? r2(net / qty) : 0, vat_rate: rateOf(net, tax, (l.tax_lines || [])[0] && l.tax_lines[0].rate) };
  });
  const ship = (o.shipping_lines || []).reduce((acc, l) => { const tax = (l.tax_lines || []).reduce((t, x) => t + n(x.price), 0), g = n(l.discounted_price != null ? l.discounted_price : l.price), net = incl ? g - tax : g;
    acc.net += net; acc.vat += tax; acc.method = acc.method || s(l.title); return acc; }, { method: '', net: 0, vat: 0 });
  const c = o.customer || {}, paid = ['paid', 'partially_refunded'].includes(s(o.financial_status));
  return { external_id: s(o.id), external_number: s(o.name || o.order_number), order_date: s(o.created_at), currency: s(o.currency) || 'GBP', note: s(o.note),
    customer: { name: [s(c.first_name), s(c.last_name)].filter(Boolean).join(' ') || address(o.billing_address).name, email: s(o.email || c.email).toLowerCase(), phone: s(o.phone || c.phone), company: s((o.billing_address || {}).company) },
    billing_address: address(o.billing_address), shipping_address: address(o.shipping_address || o.billing_address), lines,
    shipping: { method: ship.method, net: r2(ship.net), vat: r2(ship.vat), vat_rate: rateOf(ship.net, ship.vat) },
    totals: { gross: r2(o.total_price), vat: r2(o.total_tax), net: r2(n(o.total_price) - n(o.total_tax)) },
    payment: { status: paid ? 'paid' : s(o.financial_status) || 'pending', method: s((o.payment_gateway_names || [])[0] || o.gateway), reference: s(o.checkout_token || o.token).slice(0, 40), amount: paid ? r2(o.total_price) : 0 } };
}
export function fromWooCommerce(o){
  const lines = (o.line_items || []).map(l => { const qty = n(l.quantity), net = n(l.total), vat = n(l.total_tax);
    return { sku: s(l.sku), name: s(l.name), qty, net: r2(net), vat: r2(vat), unit_net: qty ? r2(net / qty) : 0, vat_rate: rateOf(net, vat) }; });
  const ship = (o.shipping_lines || []).reduce((acc, l) => { acc.net += n(l.total); acc.vat += n(l.total_tax); acc.method = acc.method || s(l.method_title); return acc; }, { method: '', net: 0, vat: 0 });
  const b = o.billing || {}, paid = !!o.date_paid || ['processing', 'completed'].includes(s(o.status));
  return { external_id: s(o.id), external_number: s(o.number || o.id), order_date: s(o.date_created_gmt ? o.date_created_gmt + 'Z' : o.date_created), currency: s(o.currency) || 'GBP', note: s(o.customer_note),
    customer: { name: [s(b.first_name), s(b.last_name)].filter(Boolean).join(' '), email: s(b.email).toLowerCase(), phone: s(b.phone), company: s(b.company) },
    billing_address: address(b), shipping_address: address(o.shipping && (o.shipping.address_1 || o.shipping.postcode) ? o.shipping : b, { phone: b.phone }), lines,
    shipping: { method: ship.method, net: r2(ship.net), vat: r2(ship.vat), vat_rate: rateOf(ship.net, ship.vat) },
    totals: { gross: r2(o.total), vat: r2(o.total_tax), net: r2(n(o.total) - n(o.total_tax)) },
    payment: { status: paid ? 'paid' : s(o.status) || 'pending', method: s(o.payment_method_title), reference: s(o.transaction_id), amount: paid ? r2(o.total) : 0 } };
}
// Any other website: { id, number?, date?, customer:{name,email,phone,company}, billing_address, shipping_address,
//   lines:[{sku, name, qty, unit_price, vat_rate?}], prices_include_vat?, shipping:{method, price}, payment:{status, method, reference, amount}, note }
export function fromOther(o){
  const incl = !!o.prices_include_vat;
  const split = (price, qty, rate) => { const total = n(price) * qty, net = incl ? total / (1 + rate / 100) : total; return { net: r2(net), vat: r2(net * rate / 100) }; };
  const lines = (o.lines || []).map(l => { const qty = n(l.qty || l.quantity || 1), rate = l.vat_rate == null ? 20 : n(l.vat_rate), x = split(l.unit_price != null ? l.unit_price : l.price, qty, rate);
    return { sku: s(l.sku), name: s(l.name), qty, net: x.net, vat: x.vat, unit_net: qty ? r2(x.net / qty) : 0, vat_rate: rate }; });
  const sh = o.shipping || {}, sr = sh.vat_rate == null ? 20 : n(sh.vat_rate), sx = split(sh.price || 0, 1, sr);
  const net = lines.reduce((t, l) => t + l.net, 0) + sx.net, vat = lines.reduce((t, l) => t + l.vat, 0) + sx.vat, p = o.payment || {};
  return { external_id: s(o.id), external_number: s(o.number || o.id), order_date: s(o.date), currency: s(o.currency) || 'GBP', note: s(o.note),
    customer: { name: s((o.customer || {}).name), email: s((o.customer || {}).email).toLowerCase(), phone: s((o.customer || {}).phone), company: s((o.customer || {}).company) },
    billing_address: address(o.billing_address, o.customer), shipping_address: address(o.shipping_address || o.billing_address, o.customer), lines,
    shipping: { method: s(sh.method), net: sx.net, vat: sx.vat, vat_rate: sr }, totals: { net: r2(net), vat: r2(vat), gross: r2(net + vat) },
    payment: { status: s(p.status) || 'pending', method: s(p.method), reference: s(p.reference), amount: r2(p.amount) } };
}
export function normalise(platform, body){
  const o = platform === 'shopify' ? fromShopify(body) : platform === 'woocommerce' ? fromWooCommerce(body) : fromOther(body);
  if (!o.external_id) throw Object.assign(Error('The order has no id'), { statusCode: 422 });
  if (!o.lines.length) throw Object.assign(Error('The order has no lines'), { statusCode: 422 });
  return o;
}
