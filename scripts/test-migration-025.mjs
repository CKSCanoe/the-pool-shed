// v1.51 guard: the Xero hand-off is ready but NOT linked.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const code = fs.readFileSync('database/025-xero-outbox-ready-not-linked.sql', 'utf8').replace(/--.*$/gm, '');
assert(/values \('xero_push', false,/.test(code), 'the send switch starts OFF');
assert(!/update\s+(public\.)?ps_feature_flags\s+set\s+enabled\s*=\s*true/i.test(code), '025 never switches sending on');
assert(!/http|net\.http_post|pg_net/i.test(code), 'the database never calls Xero itself');
assert(/'opening', true/.test(code) && /xero_status = 'not_required'/.test(code), 'opening balances are never sent back to Xero');
assert(/Waits until the bill it pays is in Xero/.test(code), 'payments wait for their bills');
assert(/revoke all on public\.ps_xero_tax_map, public\.ps_xero_contact_map, public\.ps_xero_outbox from anon, authenticated/.test(code), 'no direct staff access');
const sender = fs.readFileSync('server/xero-ledger-push.js', 'utf8');
assert(/if \(!\(await ledgerPushEnabled\(db\)\)\) return \{ skipped: 'xero_push is off'/.test(sender), 'sender checks the switch first');
const api = fs.readFileSync('api/finance.js', 'utf8');
assert(/if\(\['webhook','callback','cron'\]\.includes\(action\)\)requireXeroLive\(\)/.test(api), 'the scheduled run still requires the Xero live lock');
console.log('Migration 025 guard passed (Xero ready, not linked).');
