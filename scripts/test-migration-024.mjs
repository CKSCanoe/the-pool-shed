// O1/O2 guard: finance files and the screen lists are finance-roles only.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const code = fs.readFileSync('database/024-finance-media-and-lists.sql', 'utf8').replace(/--.*$/gm, '');
assert(/insert into storage\.buckets\(id, name, public\) values \('finance-media', 'finance-media', false\)/.test(code), 'private bucket');
assert(/revoke all on public\.ps_finance_media from anon, authenticated/.test(code), 'no direct staff access to finance file records');
for (const fn of ['ps_purchase_list', 'ps_payment_runs_list', 'ps_ledger_settings_get', 'ps_payment_run_cancel'])
  assert(new RegExp('function public\\.' + fn + '[^]*?ps_ledger_require_finance\\(w\\)').test(code), fn + ' checks a finance role');
assert(/function public\.ps_payment_run_lines[^]*?perform ps_ledger_require_finance\(w\)/.test(code), 'payment list checks a finance role');
console.log('Migration 024 guard passed.');
