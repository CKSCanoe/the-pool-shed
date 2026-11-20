// O1 guard: the ledger's safety rules live in the database.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const code = fs.readFileSync('database/022-ledger-foundation.sql', 'utf8').replace(/--.*$/gm, '');
assert(/does not balance/.test(code) && /d <> c or d = 0/.test(code), 'posting must balance');
assert(/Posted ledger documents cannot be changed/.test(code) && /Posted ledger documents cannot be deleted/.test(code), 'posted documents are permanent');
assert(/Lines of a posted ledger document cannot be changed/.test(code), 'posted lines are permanent');
assert(/is closed; post into an open month/.test(code), 'closed months are locked');
assert(/Only Admin, Management or Accounts can make ledger entries/.test(code), 'finance roles only');
assert(/A reason is required to reverse/.test(code) && /is already reversed/.test(code), 'reversals need a reason and happen once');
assert(/revoke all on public\.ps_ledger_accounts, public\.ps_ledger_periods, public\.ps_ledger_documents, public\.ps_ledger_lines/.test(code), 'no direct staff access to ledger tables');
assert(/revoke all on function public\.ps_ledger_post\(text,jsonb,jsonb\) from public, anon, authenticated/.test(code), 'posting only through business functions');
assert(!/(update|delete\s+from|insert\s+into)\s+(public\.)?workspace_snapshots\b/i.test(code), '022 does not touch workspace data');
console.log('Migration 022 guard passed.');
