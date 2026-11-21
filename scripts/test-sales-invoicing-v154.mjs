// v1.54 sales invoicing: invoice PDF, the email action's safety checks (fake database + fake email provider), screens and wiring.
import fs from 'node:fs';
import vm from 'node:vm';
import { Readable } from 'node:stream';
import assert from 'node:assert/strict';
import { invoicePdf, invoiceEmailText } from '../server/invoice-pdf.js';

// 1. PDF: valid file, right content, £ encoded, negative amounts, page breaks.
const inv = { id: '11111111-1111-4111-8111-111111111111', doc_type: 'sales_invoice', doc_number: 'INV-2049', doc_date: '2026-11-21', due_date: '2026-11-21', source_type: 'sales_order', source_label: 'SO-1',
  customer: { name: 'Example Customer (Test)', email: 'customer@example.test', address: { line1: '1 Test St', postcode: 'TE1 1ST' } },
  company: { name: 'Pool Bros', vat_number: 'GB123456789', bank_name: 'Test Bank', sort_code: '12-34-56', account_number: '12345678', email: 'accounts@example.test' },
  lines: [{ description: 'Pump', qty: 1, unit_net: 100, net: 100, vat_rate: 20, vat: 20 }, { description: 'Less already invoiced (INV-2048)', qty: 1, unit_net: -30, net: -30, vat_rate: 20, vat: -6, deduction: true }],
  groups: [{ rate: 20, net: 70, vat: 14 }], net: 70, vat: 14, gross: 84, open: 84, emails_on: true };
const pdf = Buffer.from(invoicePdf(inv)).toString('latin1');
assert(pdf.startsWith('%PDF-1.4') && pdf.trimEnd().endsWith('%%EOF'), 'PDF header and end');
const xref = Number(pdf.match(/startxref\n(\d+)/)[1]); assert.equal(pdf.slice(xref, xref + 4), 'xref', 'cross-reference table where it says');
for (const o of pdf.match(/\d{10} 00000 n/g).map(x => Number(x.slice(0, 10)))) assert(/^\d+ 0 obj/.test(pdf.slice(o, o + 12)), 'object offsets valid');
for (const t of ['(INVOICE)', '(INV-2049)', '(Example Customer \\(Test\\))', '(Sort code: 12-34-56)', '(Please use INV-2049 as the payment reference.)', '(Balance due)', 'VAT no. GB123456789)'])
  assert(pdf.includes(t), 'PDF shows ' + t);
assert(pdf.includes('(\\24384.00)'), 'pound sign encoded for the standard font');
assert(pdf.includes('(-\\24330.00)'), 'deduction shown as -£30.00');
const many = Buffer.from(invoicePdf({ ...inv, lines: Array.from({ length: 80 }, (_, i) => ({ description: 'Line ' + i, qty: 1, unit_net: 1, net: 1, vat_rate: 20, vat: 0.2 })) })).toString('latin1');
assert(/\/Count [2-9]/.test(many) && many.includes('(Page 1 of '), 'long invoices run over pages, numbered');
const credit = Buffer.from(invoicePdf({ ...inv, doc_type: 'sales_credit', doc_number: 'CRN-000001', reason: 'Returned', credits_invoice: { doc_number: 'INV-2049' } })).toString('latin1');
assert(credit.includes('(CREDIT NOTE)') && credit.includes('(Against invoice)') && !credit.includes('(How to pay)'), 'credit note layout');
const mail = invoiceEmailText(inv);
assert.match(mail.subject, /^Invoice INV-2049 from Pool Bros$/); assert.match(mail.text, /£84\.00, due on receipt/); assert.match(mail.text, /sort code 12-34-56, account 12345678, using INV-2049/);

// 2. Email action: refuses unless switched on, details complete, email set up and a valid address; then sends with the PDF and records it.
Object.assign(process.env, { SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-key', APP_ORIGIN: 'https://app.example.test' });
delete process.env.RESEND_API_KEY; delete process.env.QUOTE_FROM_EMAIL;
const calls = []; let invoice = { ...inv, emails_on: false }, missing = ['VAT registration number'];
global.fetch = async (url, opt = {}) => { calls.push({ url: String(url), opt });
  const reply = (status, body) => ({ ok: status < 300, status, json: async () => body });
  if (String(url).endsWith('/rpc/ps_sales_invoice_get')) return opt.headers.Authorization === 'Bearer user-token' ? reply(200, invoice) : reply(401, { message: 'JWT' });
  if (String(url).endsWith('/rpc/ps_invoice_profile_get')) return reply(200, { missing });
  if (String(url).endsWith('/rpc/ps_sales_invoice_sent')) return reply(200, null);
  if (String(url).startsWith('https://api.resend.com/')) return reply(200, { id: 're_test' });
  return reply(404, {}); };
const { default: handler } = await import('../api/media.js');
async function call(action, body, method = 'POST') {
  const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  Object.assign(req, { method, url: '/api/media?action=' + action + (method === 'GET' ? '&id=' + inv.id : ''), headers: { authorization: 'Bearer user-token', origin: 'https://app.example.test', host: 'app.example.test' } });
  const res = { code: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(v) { this.body = v; return this; }, send(v) { this.body = v; return this; } };
  await handler(req, res); return res;
}
let r = await call('invoice-email', { id: inv.id }); assert.equal(r.code, 409); assert.match(r.body.error, /switched off/);
invoice = { ...inv, emails_on: true };
r = await call('invoice-email', { id: inv.id }); assert.equal(r.code, 409); assert.match(r.body.error, /VAT registration number/);
missing = [];
r = await call('invoice-email', { id: inv.id }); assert.equal(r.code, 503, 'email not set up on the server');
Object.assign(process.env, { RESEND_API_KEY: 'test', QUOTE_FROM_EMAIL: 'office@example.test' });
r = await call('invoice-email', { id: inv.id, to: 'not-an-email' }); assert.equal(r.code, 400);
r = await call('invoice-email', { id: 'nope' }); assert.equal(r.code, 400, 'invoice id checked');
calls.length = 0;
r = await call('invoice-email', { id: inv.id }); assert.equal(r.code, 200); assert.equal(r.body.to, 'customer@example.test');
const sent = JSON.parse(calls.find(c => c.url.startsWith('https://api.resend.com/')).opt.body);
assert.equal(sent.attachments[0].filename, 'INV-2049.pdf'); assert(Buffer.from(sent.attachments[0].content, 'base64').toString('latin1').startsWith('%PDF'), 'PDF attached');
assert.equal(sent.reply_to, 'accounts@example.test');
const rec = calls.find(c => c.url.endsWith('/rpc/ps_sales_invoice_sent')); assert(rec && rec.opt.headers.Authorization === 'Bearer user-token', 'sending is recorded with the user\'s own sign-in');
r = await call('invoice-pdf', null, 'GET'); assert.equal(r.code, 200); assert.equal(r.headers['Content-Type'], 'application/pdf'); assert(Buffer.from(r.body).toString('latin1').startsWith('%PDF'));

// 3. Screens: queue, review, aged debtors and opening-balance CSV.
const ctx = { console, Date, Math, Number, String, JSON, Promise, Intl, URL, Blob: class {}, setTimeout: () => 0, document: { addEventListener() {}, head: null, querySelectorAll() { return []; }, querySelector() { return null; }, getElementById() { return null; } },
  __POOL_SHED_GET_DATA__: () => ({ customers: [{ id: 'C1', companyName: 'Acme Pools' }, { id: 'C2', firstName: 'Jo', lastName: 'Bloggs' }], salesOrders: [] }) };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync('public/sales-invoicing-workspace.js', 'utf8'), ctx);
const ui = ctx.PoolShedSalesUI, st = ui._state;
st.queue = { orders: [{ order_id: 'SO-1', state: 'ready', status: 'Shipped', customer: 'Acme Pools', net: 100, vat: 20, gross: 120, billed_net: 0, billed_vat: 0, remaining_gross: 120, invoices: [] },
                      { order_id: 'SO-2', state: 'in_progress', status: 'Needs Review', customer: 'Jo Bloggs', net: 500, gross: 600, billed_net: 0, billed_vat: 0 },
                      { order_id: 'SO-3', state: 'before_ledger', status: 'Invoiced', customer: 'Acme Pools', gross: 50, legacy_ref: 'INV-2042' }],
             jobs: [{ job_id: 'J1', name: 'New pool', customer: 'Jo Bloggs', contract_net: 10000, billed_net: 2000, remaining_net: 8000, invoices: ['INV-2050'], phases: [] }] };
st.docs = []; st.aged = [{ customer: 'Acme Pools', customer_key: 'id:C1', not_due: 0, d1_30: 120, d31_60: 0, d61_90: 0, d90_plus: 0, on_account: 0, total: 120 }]; st.profile = { missing: ['VAT registration number'], can_edit: true };
let html = ui.readyPage();
assert(/Ready to invoice/.test(html) && /SO-1/.test(html) && /Review &amp; invoice/.test(html), 'ready list');
assert(/Deposit invoice/.test(html) && /SO-2/.test(html), 'deposit for not delivered');
assert(/Stage invoice/.test(html) && /New pool/.test(html), 'project stages');
assert(/Already invoiced before the ledger \(1\)/.test(html) && /INV-2042/.test(html), 'before-ledger shown, not invoiceable');
assert(/add the <strong>invoice details<\/strong>: VAT registration number/.test(html), 'missing invoice details flagged');
st.review = { order_id: 'SO-1', next_number: 'INV-2049', customer: { name: 'Acme Pools' }, terms: 'Due on receipt', lines: [{ description: 'Pump', qty: 1, unit_net: 100, vat_rate: 20, net: 100 }], billed: {}, remaining_net: 100, remaining_gross: 120 };
html = ui.readyPage(); assert(/Invoice INV-2049 for SO-1/.test(html) && /has no email address/.test(html) && /I have checked the customer, the lines and the total/.test(html), 'review panel');
html = ui.agedPage(); assert(/Aged debtors/.test(html) && /Acme Pools/.test(html) && /si-bad/.test(html), 'aged debtors');
const o = ui._readOpening('Contact,Invoice Number,Invoice Date,Due Date,Due\nAcme Pools,INV-1001,01/10/2026,31/10/2026,"1,200.00"\nJo Bloggs,INV-1002,2026-11-01,2026-11-15,50\nUnknown Ltd,INV-9,01/11/2026,01/11/2026,10');
assert.equal(o.rows.length, 2); assert.equal(o.rows[0].customer_key, 'id:C1'); assert.equal(o.rows[0].outstanding_gross, 1200); assert.equal(o.rows[0].invoice_date, '2026-10-01'); assert.equal(JSON.stringify(o.unknown), '["Unknown Ltd"]');

// 4. Wiring.
const fc = fs.readFileSync('public/finance-command-workspace.js', 'utf8'), legacy = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8');
for (const p of ['readyPage', 'invoicesPage', 'paymentsPage', 'agedPage', 'creditsPage']) assert(fc.includes('PoolShedSalesUI.' + p + '()'), 'Accounting page ' + p);
assert(/window\.PoolShedSalesUI\.openForOrder\(handOff\)/.test(legacy) && /__POOL_SHED_OPEN_SUBPAGE__ = function/.test(legacy), 'order Invoice button hands over to the ledger');
const index = fs.readFileSync('public/index.html', 'utf8'), sw = fs.readFileSync('public/service-worker.js', 'utf8');
assert(/sales-invoicing-workspace\.js\?v=\d+\.\d+\.\d+/.test(index) && /sales-invoicing-workspace\.js\?v=\d+\.\d+\.\d+/.test(sw), 'script loaded and cached');
console.log('Sales invoicing v1.54: PDF valid; email only when on, complete and valid, PDF attached and recorded; screens and wiring correct.');
