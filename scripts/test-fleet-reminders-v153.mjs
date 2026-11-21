// v1.53 monthly van report reminders: email sender (fake mail) and in-app reminder rules.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { runFleetReminders, engineerEmail } from '../server/fleet-reminders.js';

const due = (enabled) => ({ enabled, period: '2026-12-01', day: 8,
  engineers: [{ user_id: 'E1', name: 'Dave', email: 'dave@example.test', registration: 'PB21 VAN', van: 'Ford Transit', status: 'not started' },
              { user_id: 'E2', name: 'Mitch', email: 'mitch@example.test', registration: 'PB22 VAN', van: 'Ford Transit', status: 'returned', review_note: 'Photo the tyre' }],
  managers: [{ user_id: 'M1', name: 'Boss', email: 'boss@example.test' }],
  outstanding: [{ registration: 'PB21 VAN', engineer: 'Dave', status: 'not started' }, { registration: 'PB23 VAN', engineer: 'Lee', status: 'submitted' }] });
function fakes(enabled) {
  const mails = [], logs = [];
  const db = async (path, opt) => { if (path === 'rpc/ps_fleet_reminders_due') return due(enabled); if (path === 'rpc/ps_fleet_reminder_sent') { logs.push(opt.body); return null; } };
  const send = async (to, subject, text) => { mails.push({ to, subject, text }); };
  return { db, send, mails, logs };
}
// 1. Switch off: nothing sent; reports what it would do.
let f = fakes(false); delete process.env.RESEND_API_KEY;
let r = await runFleetReminders({ db: f.db, send: f.send, today: '2026-12-08', appUrl: 'https://app.test' });
assert.match(r.skipped, /off/); assert.deepEqual(r.wouldEmail, { engineers: 2, managers: 1 }); assert.equal(f.mails.length, 0);
// 2. Switch on, email not configured: nothing sent.
f = fakes(true);
r = await runFleetReminders({ db: f.db, send: f.send, today: '2026-12-08' });
assert.match(r.skipped, /not configured/); assert.equal(f.mails.length, 0);
// 3. On and configured: engineers get the right email; managers get the digest; each is logged.
process.env.RESEND_API_KEY = 'test'; process.env.QUOTE_FROM_EMAIL = 'office@example.test';
f = fakes(true);
r = await runFleetReminders({ db: f.db, send: f.send, today: '2026-12-08', appUrl: 'https://app.test' });
assert.equal(r.sent, 3);
assert.match(f.mails[0].subject, /van report for December 2026 is due \(PB21 VAN\)/);
assert.match(f.mails[1].subject, /was sent back/); assert.match(f.mails[1].text, /Photo the tyre/);
assert.match(f.mails[2].subject, /Van reports for December 2026: 2 still open/); assert.match(f.mails[2].text, /PB23 VAN \(Lee\): waiting for your sign-off/);
assert.deepEqual(f.logs.map(l => l.kind), ['engineer', 'engineer', 'manager']);
assert.match(engineerEmail(due(true).engineers[0], '2026-12-01', 'https://app.test').text, /https:\/\/app\.test/);

// 4. In-app reminder rules.
const ctx = { console, Date, Math, Number, String, JSON, Promise, Intl, localStorage: { getItem() { return null; }, setItem() {} },
  __POOL_SHED_CURRENT_USER__: () => ({ id: 'E1', role: 'Engineer' }) };
ctx.window = ctx; ctx.globalThis = ctx;
ctx.document = { addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; }, getElementById() { return null; }, readyState: 'complete', hidden: true };
ctx.setTimeout = () => 0; ctx.setInterval = () => 0;
vm.createContext(ctx); vm.runInContext(fs.readFileSync('public/fleet-workspace.js', 'utf8'), ctx);
const ui = ctx.PoolShedFleetUI;
ui._state.vans = [{ id: 'V1', registration: 'PB21 VAN', assigned_user: 'E1', report_status: 'not started' },
                  { id: 'V2', registration: 'PB22 VAN', assigned_user: 'E2', report_status: 'submitted' }];
let rem = JSON.parse(JSON.stringify(ui._reminders()));
assert.equal(rem.count, 1, 'engineer: only their own van'); assert.match(rem.items[0].text, /PB21 VAN is due/);
ui._state.vans[0].report_status = 'returned'; ui._state.vans[0].report_review_note = 'Photo the dent';
rem = JSON.parse(JSON.stringify(ui._reminders())); assert.match(rem.items[0].text, /was sent back: Photo the dent/); assert.equal(rem.items[0].cta, 'Update report');
ui._state.vans[0].report_status = 'signed_off'; assert.equal(ui._reminders().count, 0, 'engineer: nothing once signed off');
ctx.__POOL_SHED_CURRENT_USER__ = () => ({ id: 'BOSS', role: 'Admin' });
rem = JSON.parse(JSON.stringify(ui._reminders()));
assert(rem.items.some(i => /1 van report is waiting for your sign-off/.test(i.text)), 'manager: sign-off reminder');
console.log('Fleet reminders v1.53: emails only when switched on and configured; right wording; in-app rules correct.');
