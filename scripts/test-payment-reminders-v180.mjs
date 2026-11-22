// v1.80 Payment reminders on Accounts › Credit control: chase list, staged reminder wording, history; nothing sent by Pool Shed.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const src = fs.readFileSync('public/sales-invoicing-workspace.js', 'utf8');
const pick = name => { const i = src.indexOf('  function ' + name + '('); assert.ok(i > 0, name); const j = src.indexOf('\n', i); return src.slice(i, j); };
const store = { customers: [{ id: 'C-1', name: 'Matthew White', email: 'm@example.com' }], paymentReminders: [] };
const s = { profile: { profile: { legal_name: 'Pool Bros Ltd', sort_code: '00-00-00', account_number: '00000000' }, company: {} } };
const env = { DATA: () => store, s, cash: v => '£' + Number(v).toFixed(2) };
const code = [pick('reminderLog'), pick('chasedFor'), pick('customerFor'), pick('stageFor'), "var STAGE = { 1: 'Friendly reminder', 2: 'Second reminder', 3: 'Final reminder' };", pick('daysText'), pick('ukDate'),
  src.slice(src.indexOf('  function reminderText('), src.indexOf('  function chaseList('))].join('\n') + '\nreturn { reminderText, stageFor, daysText };';
const R = new Function('DATA', 's', 'cash', code)(env.DATA, env.s, env.cash);
const doc = { id: 'D1', doc_number: 'INV-2051', doc_date: '2026-11-21', due_date: '2026-11-21', open: 1800, days_overdue: 1, customer_key: 'id:C-1', customer: 'Matthew White' };
let r = R.reminderText(doc);
assert.equal(r.stage, 1); assert.equal(r.to, 'm@example.com'); assert.ok(r.subject.startsWith('Reminder: invoice INV-2051 (£1800.00'));
assert.ok(r.body.startsWith('Hello Matthew,') && r.body.includes('Sort code: 00-00-00') && r.body.includes('Reference: INV-2051') && r.body.endsWith('Pool Bros Ltd'));
assert.equal(R.stageFor({ ...doc, days_overdue: 20 }), 2, 'over 14 days: second reminder');
assert.equal(R.stageFor({ ...doc, days_overdue: 50 }), 3, 'over 44 days: final reminder');
store.paymentReminders.push({ doc_id: 'D1', stage: 1, at: '2026-11-22' });
assert.equal(R.stageFor(doc), 2, 'after one reminder the next is the second');
store.paymentReminders.push({ doc_id: 'D1', stage: 2, at: '2026-11-29' }, { doc_id: 'D1', stage: 3, at: '2026-12-06' });
r = R.reminderText({ ...doc, days_overdue: 16 }); assert.equal(r.stage, 3); assert.ok(r.body.includes('16 days overdue') && r.body.includes('pause further work'));
assert.equal(R.daysText(1), '1 day');
s.profile.profile = {}; r = R.reminderText({ ...doc, id: 'D2' }); assert.ok(r.body.includes('Please quote INV-2051 as the payment reference.') && !r.body.includes('Sort code'), 'no bank details until they are filled in');
// Nothing is sent by Pool Shed: the only way out is the user's own email app, and only when the customer has an email.
assert.ok(src.includes("global.location.href = 'mailto:' + encodeURIComponent(r1.to)"));
assert.ok(src.includes("if (!r1.to) return notify('Add an email address to this customer first.');"));
assert.ok(!/fetch\([^)]*remind/i.test(src), 'no server call for reminders');
assert.ok(src.includes("metric('On account', cash(tot.on_account), 'Unused payments and credits') + '</div>' + chaseList()"));
console.log('Payment reminders v1.80: chase list, friendly/second/final wording, history, bank details when set, nothing sent by Pool Shed.');
