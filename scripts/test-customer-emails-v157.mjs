// v1.57 customer emails from fulfilment: wording and tracking links, the send action's checks (fake database and email
// provider), and the "Email the customer?" card taking over only the customer-facing steps.
import fs from 'node:fs';
import vm from 'node:vm';
import { Readable } from 'node:stream';
import assert from 'node:assert/strict';
import { customerEmail, trackingLink } from '../server/customer-email.js';

// 1. Wording and links.
assert.equal(trackingLink('DPD next day', 'AB 12'), 'https://track.dpd.co.uk/parcels/AB%2012');
assert.equal(trackingLink('Royal Mail Tracked 24', 'RM1'), 'https://www.royalmail.com/track-your-item#/tracking-results/RM1');
assert.equal(trackingLink('Our van', 'X'), ''); assert.equal(trackingLink('DPD', 'Tracking pending'), '');
const ctx = { trigger: 'Ship', order_id: 'SO-9', customer: { name: 'Acme Pools', email: 'buyer@example.test' }, company: { name: 'Pool Bros', phone: '01234 000000', email: 'office@example.test' },
  rule: { subject: 'Your Pool Bros order {order} has shipped', body: 'Hi {customer},\n\nYour order {order} has shipped. Courier: {courier}. Tracking: {tracking}.\n\nThanks,\nPool Bros', enabled: true }, emails_on: true };
let m = customerEmail(ctx, { courier: 'DPD', tracking: '1550' });
assert.equal(m.subject, 'Your Pool Bros order SO-9 has shipped');
assert.match(m.text, /Hi Acme Pools/); assert.match(m.text, /Courier: DPD\. Tracking: 1550/); assert.match(m.text, /Track your parcel: https:\/\/track\.dpd\.co\.uk\/parcels\/1550\n\nThanks/);
assert.match(m.text, /Pool Bros · 01234 000000 · office@example\.test$/);
m = customerEmail({ ...ctx, trigger: 'Part Ship' }, { courier: 'DPD', tracking: '1' }); assert.match(m.subject, /^Part of your Pool Bros order SO-9/); assert.match(m.text, /rest follows/);
m = customerEmail({ ...ctx, trigger: 'Collection' }, {}); assert.match(m.subject, /has been collected/);

// 2. The send action.
Object.assign(process.env, { SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'k', APP_ORIGIN: 'https://app.example.test' });
delete process.env.RESEND_API_KEY; delete process.env.QUOTE_FROM_EMAIL;
let context = { ...ctx, emails_on: false }; const calls = [];
global.fetch = async (url, opt = {}) => { calls.push({ url: String(url), opt }); const reply = (s, b) => ({ ok: s < 300, status: s, json: async () => b });
  if (String(url).endsWith('/rpc/ps_customer_email_context')) { const b = JSON.parse(opt.body); if (b.trig === 'Invoice') return reply(400, { message: 'That step does not email customers' }); return reply(200, context); }
  if (String(url).endsWith('/rpc/ps_customer_email_sent')) return reply(200, null);
  if (String(url).startsWith('https://api.resend.com/')) return reply(200, { id: 're_1' }); return reply(404, {}); };
const { default: handler } = await import('../api/media.js');
async function call(action, body) { const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  Object.assign(req, { method: 'POST', url: '/api/media?action=' + action, headers: { authorization: 'Bearer user', origin: 'https://app.example.test', host: 'app.example.test' } });
  const res = { code: 0, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(v) { this.body = v; return this; }, send(v) { this.body = v; return this; } };
  await handler(req, res); return res; }
const req = { orderId: 'SO-9', trigger: 'Ship', goodsNoteId: 'GN-1', courier: 'DPD', tracking: '1550', to: 'attacker@example.test' };
let r = await call('customer-email-preview', req); assert.equal(r.code, 200); assert.equal(r.body.to, 'buyer@example.test', 'recipient from the customer record'); assert.equal(r.body.emails_on, false);
r = await call('customer-email', req); assert.equal(r.code, 409); assert.match(r.body.error, /switched off/);
context = { ...ctx, emails_on: true };
r = await call('customer-email', req); assert.equal(r.code, 503, 'email not set up');
Object.assign(process.env, { RESEND_API_KEY: 'x', QUOTE_FROM_EMAIL: 'office@example.test' });
context = { ...ctx, customer: { name: 'No Email Ltd', email: null } }; r = await call('customer-email', req); assert.equal(r.code, 400);
context = { ...ctx }; calls.length = 0; r = await call('customer-email', req); assert.equal(r.code, 200);
const sent = JSON.parse(calls.find(c => c.url.startsWith('https://api.resend.com/')).opt.body);
assert.deepEqual(sent.to, ['buyer@example.test'], 'never the address the screen sent'); assert.equal(sent.reply_to, 'office@example.test');
assert(calls.some(c => c.url.endsWith('/rpc/ps_customer_email_sent') && c.opt.headers.Authorization === 'Bearer user'), 'logged with the person\'s own sign-in');
r = await call('customer-email', { ...req, trigger: 'Invoice' }); assert.equal(r.code, 403, 'only fulfilment steps');

// 3. The card: customer steps go to the card (ticked from Settings); internal notes go the old way.
const store = { notifications: [], salesOrders: [{ id: 'SO-9', customerId: 'C1', lines: [{ productId: 'P', qty: 2 }] }], customers: [{ id: 'C1', name: 'Acme Pools' }],
  goodsNotes: [], customerNotificationRules: [{ trigger: 'Pick', enabled: false }, { trigger: 'Ship', enabled: true }] };
let originalCalls = 0;
const ctx2 = { console, Date, Math, Number, String, JSON, Object, Array, Promise, setTimeout: () => 0, document: { addEventListener() {}, head: null },
  __POOL_SHED_GET_DATA__: () => store };
ctx2.window = ctx2; vm.createContext(ctx2);
ctx2.__orig = () => { originalCalls++; return true; };
vm.runInContext('var addNotification = function(){ return __orig(); };', ctx2);
vm.runInContext(fs.readFileSync('public/customer-emails.js', 'utf8'), ctx2);
ctx2.addNotification({ id: 'GN-1', salesOrderId: 'SO-9', lines: [{ productId: 'P', qty: 2 }] }, 'Hold', 'x', 'Internal only');
assert.equal(originalCalls, 1, 'internal notes unchanged');
ctx2.addNotification({ id: 'GN-1', salesOrderId: 'SO-9', courier: 'DPD', trackingRef: '1550', lines: [{ productId: 'P', qty: 1 }] }, 'Ship', 'x', 'Ready to send');
ctx2.addNotification({ id: 'GN-2', salesOrderId: 'SO-9', lines: [{ productId: 'P', qty: 2 }] }, 'Pick', 'x', 'Ready to send');
const q = ctx2.PoolShedCustomerEmails._queue();
assert.equal(q.length, 2); assert.equal(q[0].trig, 'Part Ship', 'one of two shipped: part shipment'); assert.equal(q[0].tick, true, 'Ship ticked from Settings');
assert.equal(q[1].tick, false, 'Pick unticked from Settings'); assert.equal(store.notifications.length, 2); assert.equal(store.notifications[0].status, 'Waiting for your choice');
// Wiring.
const index = fs.readFileSync('public/index.html', 'utf8'), sql = fs.readFileSync('database/030-customer-emails.sql', 'utf8');
assert(index.indexOf('customer-emails.js') > index.indexOf('fulfilment-workspace.js'), 'loads after fulfilment');
assert(/values \('customer_emails', false,/.test(sql) && /in \('', 'Engineer'\)/.test(sql) && /revoke all on public\.ps_customer_email_log from anon, authenticated/.test(sql), 'switch off, engineers excluded, log private');
console.log('Customer emails v1.57: wording and tracking links, recipient always from the customer record, switch and checks, card per step correct.');
