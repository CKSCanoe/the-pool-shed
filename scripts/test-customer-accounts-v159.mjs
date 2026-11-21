// v1.59 customer Account tab, statement PDF and Accounts home: finance roles only, ledger figures, grouped menu, wiring.
import fs from 'node:fs';
import vm from 'node:vm';
import { Readable } from 'node:stream';
import assert from 'node:assert/strict';
import { statementPdf } from '../server/invoice-pdf.js';
// 1. Statement PDF.
const acct = { terms: 'Due on receipt', customer: { name: 'Example Ltd (Test)', address: { line1: '1 Test St' } }, aged: { not_due: 10, d1_30: 5 },
  statement: { from: '2026-10-01', to: '2026-11-21', opening: 20, closing: 35, lines: [{ date: '2026-11-01', doc_number: 'INV-2049', doc_type: 'sales_invoice', debit: 15, credit: 0, balance: 35 }] } };
const pdf = Buffer.from(statementPdf(acct, { company: { name: 'Pool Bros' }, profile: { sort_code: '12-34-56', account_number: '12345678' } })).toString('latin1');
assert(pdf.startsWith('%PDF-1.4') && pdf.trimEnd().endsWith('%%EOF'));
for (const t of ['(STATEMENT)', '(Example Ltd \\(Test\\))', '(Opening balance 1 Oct 2026)', '(INV-2049)', '(Balance due)', '(\\24335.00)']) assert(pdf.includes(t), 'statement shows ' + t);
// 2. Server action uses the person's own sign-in and the ledger.
Object.assign(process.env, { SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'k', APP_ORIGIN: 'https://app.example.test' });
const calls = []; global.fetch = async (url, opt = {}) => { calls.push({ url: String(url), opt }); const ok = b => ({ ok: true, status: 200, json: async () => b });
  if (String(url).endsWith('/rpc/ps_customer_account')) return ok(acct); if (String(url).endsWith('/rpc/ps_invoice_profile_get')) return ok({ profile: {}, company: { name: 'Pool Bros' } }); return { ok: false, status: 404, json: async () => ({}) }; };
const { default: handler } = await import('../api/media.js');
const req = Readable.from([]); Object.assign(req, { method: 'GET', url: '/api/media?action=statement-pdf&customer=id%3AC1&from=2026-10-01&to=bad', headers: { authorization: 'Bearer user' } });
const res = { code: 0, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(v) { this.body = v; return this; }, send(v) { this.body = v; return this; } };
await handler(req, res); assert.equal(res.code, 200); assert.equal(res.headers['Content-Type'], 'application/pdf');
const sentBody = JSON.parse(calls.find(c => c.url.endsWith('/rpc/ps_customer_account')).opt.body);
assert.equal(sentBody.customer_key, 'id:C1'); assert.equal(sentBody.period_from, '2026-10-01'); assert.equal(sentBody.period_to, null, 'bad dates ignored');
assert.equal(calls[0].opt.headers.Authorization, 'Bearer user', 'with the person\'s own sign-in');
// 3. Account tab only for finance roles; added beside the existing tabs.
let role = 'Sales';
const ctx = { console, Date, Math, Number, String, JSON, Object, Array, Promise, Intl, document: { addEventListener() {}, head: null, querySelector: () => null },
  __POOL_SHED_CURRENT_USER__: () => ({ role }), __POOL_SHED_DB__: () => ({ rpc: async () => ({ data: { balance: 253.68, terms: 'Due on receipt', customer: {}, aged: { d1_30: 0 }, documents: [], statement: { from: '2026-08-23', to: '2026-11-21', opening: 0, closing: 253.68, lines: [] } } }) }) };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext('var customerMegaProfile = function(c){ return \'<nav><button class="active" data-crm-profile-tab="overview">Overview</button><button data-crm-profile-tab="orders">Orders</button></nav><div class="crm-profile-page active" data-crm-profile-page="overview"></div><div class="crm-profile-page" data-crm-profile-page="orders"></div>\'; };', ctx);
vm.runInContext(fs.readFileSync('public/customer-account.js', 'utf8'), ctx);
assert(!/data-crm-profile-tab="account"/.test(ctx.customerMegaProfile({ id: 'C1' })), 'no Account tab for Sales');
role = 'Accounts'; const html = ctx.customerMegaProfile({ id: 'C1' });
assert(/data-crm-profile-tab="account">Account/.test(html) && /data-crm-profile-page="account"/.test(html) && /data-ca-box="id:C1"/.test(html), 'Account tab for finance');
ctx.PoolShedCustomerAccount._cache['id:C1'] = { data: { balance: 253.68, terms: 'Due on receipt', customer: { credit_limit: 100 }, aged: { d1_30: 50 }, documents: [{ id: 'd1', doc_type: 'sales_invoice', doc_number: 'INV-1', gross: 300, open: 253.68, overdue: true }, { id: 'd2', doc_type: 'customer_receipt', doc_number: 'RCPT-1', gross: 46.32, open: 0 }], statement: { from: '2026-08-23', to: '2026-11-21', opening: 0, closing: 253.68, lines: [] } } };
const body = ctx.PoolShedCustomerAccount._body('id:C1');
assert(/£253\.68/.test(body) && /over the limit/.test(body) && /Overdue<\/span>/.test(body) && /Applied/.test(body) && /Statement PDF/.test(body), 'account figures and states');
// 4. Accounts home: grouped menu keeps every page.
const ctx2 = { console, Date, Math, Number, String, JSON, Object, Array, Promise, Intl, document: { addEventListener() {}, head: null, getElementById: () => null } };
ctx2.window = ctx2; vm.createContext(ctx2); vm.runInContext(fs.readFileSync('public/accounts-home.js', 'utf8'), ctx2);
const pages = ['Overview','Customer Accounts','Customer Invoices','Payments & Allocations','Credit Control','Supplier Accounts','Record a Purchase','Payables','Supplier Bills','Payment Runs','Order Profit','Credits & Returns','Three-Way Match','Invoice Ready','Xero Sync','Reconciliation','Month End','Reports','Something New'];
const navHtml = ctx2.PoolShedAccountsHome.nav('Payment Runs', pages);
for (const p of pages) assert(navHtml.includes('data-fc-page="' + p.replace('&', '&amp;') + '"'), 'page reachable: ' + p);
assert(/>Money in</.test(navHtml) && />Money out</.test(navHtml) && />The books</.test(navHtml) && />More</.test(navHtml), 'groups');
ctx2.PoolShedAccountsHome._state.data = { queue: { orders: [{ state: 'ready', remaining_gross: 100 }] }, docs: [{ doc_type: 'sales_invoice', open: 50, state: 'overdue' }], purchases: [{ state: 'Waiting for approval', gross: 1200 }], bills: [], runs: [{ status: 'draft' }], outbox: [], tb: [{ debit: 10, credit: 10 }] };
const home = ctx2.PoolShedAccountsHome._body();
assert(/ready to invoice/.test(home) && /purchases to approve/.test(home) && /Balanced/.test(home) && /1 to approve, 0 to pay/.test(home), 'home queues');
const fc = fs.readFileSync('public/finance-command-workspace.js', 'utf8');
assert(/PoolShedAccountsHome\.nav\(p,pages\)/.test(fc) && /Earlier order-based overview \(before the ledger\)/.test(fc), 'wired, old overview kept');
const sql = fs.readFileSync('database/032-customer-account.sql', 'utf8');
assert(/ps_ledger_require_finance\(w\)/.test(sql) && /revoke all on function public\.ps_customer_account\(text,text,date,date\) from public, anon;/.test(sql), '032 finance only');
console.log('Customer accounts v1.59: statement PDF, Account tab for finance only, Accounts home and grouped menu correct.');
