// v1.51: the ledger's Xero sender is built but locked. Proves: nothing is sent while the switch is off or Xero is not
// connected; bills go before payments; a retry never creates a duplicate bill; problems are recorded, not hidden.
import assert from 'node:assert/strict';
import { pushLedgerOutbox } from '../server/xero-ledger-push.js';

function fakes({ flag, outbox, existingBills = [] }) {
  const calls = [], patches = [];
  const db = async (path, opt = {}) => {
    if (path.startsWith('ps_feature_flags')) return [{ enabled: flag }];
    if (path.startsWith('ps_xero_outbox') && !opt.method) return outbox;
    if (path.startsWith('rpc/ps_xero_prepare_document')) return { problems: [], payload: { Payments: [{ Invoice: { InvoiceID: 'XB-1' }, Account: { Code: '090' }, Date: '2026-11-20', Amount: 480, Reference: 'RUN-000001' }] } };
    if (opt.method === 'PATCH') { patches.push({ path, body: opt.body }); return []; }
    return [];
  };
  const xero = async (c, path, opt = {}) => {
    calls.push((opt.method || 'GET') + ' ' + path.split('?')[0]);
    if (path.startsWith('Invoices?')) return { Invoices: existingBills };
    if (path === 'Invoices') return { Invoices: [{ InvoiceID: 'XB-NEW' }] };
    if (path === 'Payments') return { Payments: [{ PaymentID: 'XP-1' }] };
    return {};
  };
  return { db, xero, calls, patches };
}
const bill = { document_id: 'd-bill', kind: 'bill', attempts: 0, payload: { Reference: 'PS-PINV-000002', Type: 'ACCPAY' } };
const payment = { document_id: 'd-pay', kind: 'supplier_payment', attempts: 0, payload: {} };

// 1. Switch off: nothing is sent.
let f = fakes({ flag: false, outbox: [payment, bill] });
let r = await pushLedgerOutbox('pool-bros-main', { tenant_id: 'T' }, f);
assert.equal(r.sent, 0); assert.match(r.skipped, /off/); assert.deepEqual(f.calls, []);

// 2. Not connected: nothing is sent, even with the switch on.
f = fakes({ flag: true, outbox: [bill] });
r = await pushLedgerOutbox('pool-bros-main', {}, f);
assert.equal(r.connected, false); assert.deepEqual(f.calls, []);

// 3. On and connected: the bill goes first (looked up, then created), then the payment.
f = fakes({ flag: true, outbox: [payment, bill] });
r = await pushLedgerOutbox('pool-bros-main', { tenant_id: 'T' }, f);
assert.equal(r.sent, 2);
assert.deepEqual(f.calls, ['GET Invoices', 'POST Invoices', 'PUT Payments'], 'bill looked up, created, then payment');
assert(f.patches.some(p => p.path.startsWith('ps_ledger_documents?id=eq.d-bill') && p.body.xero_status === 'in_xero'));

// 4. Retry after a timeout: the bill is already in Xero, so it is adopted, not created again.
f = fakes({ flag: true, outbox: [bill], existingBills: [{ InvoiceID: 'XB-EXISTING' }] });
r = await pushLedgerOutbox('pool-bros-main', { tenant_id: 'T' }, f);
assert.deepEqual(f.calls, ['GET Invoices'], 'no second POST');
assert(f.patches.some(p => p.body.xero_id === 'XB-EXISTING'));

// 5. Two Xero bills with the same reference: stop and ask a person, never guess.
f = fakes({ flag: true, outbox: [bill], existingBills: [{ InvoiceID: 'A' }, { InvoiceID: 'B' }] });
r = await pushLedgerOutbox('pool-bros-main', { tenant_id: 'T' }, f);
assert.equal(r.sent, 0);
assert(f.patches.some(p => p.path.startsWith('ps_xero_outbox') && p.body.state === 'needs_attention'));
console.log('Xero ledger push v1.51: locked when off or unlinked; bills before payments; retries never duplicate.');
