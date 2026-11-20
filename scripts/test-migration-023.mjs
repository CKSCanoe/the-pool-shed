// O1/O2 guard: purchase and payment controls live in the database.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const code = fs.readFileSync('database/023-purchases-and-payment-runs.sql', 'utf8').replace(/--.*$/gm, '');
for (const [re, why] of [
  [/is a pro-forma supplier \(paid up front\)/, 'pro-forma suppliers paid up front'],
  [/is already recorded/, 'duplicate supplier invoice refused'],
  [/Choose the job, or a cost category/, 'job or category required'],
  [/VAT is more than 20%%/, 'VAT sanity check'],
  [/cannot be in the future/, 'no future-dated bills'],
  [/A different person must approve a purchase you recorded/, 'no self-approval of purchases'],
  [/A different person must approve a payment run you created/, 'no self-approval of payment runs'],
  [/Only an approved payment run can be marked paid/, 'runs must be approved before paying'],
  [/'Invoice copy missing'/, 'invoice copy required before payment'],
  [/c\.payment_basis = 'on_account' and d\.due_date <= up_to/, 'runs contain due on-account bills only'],
]) assert(re.test(code), why);
assert(!/(update|delete\s+from|insert\s+into)\s+(public\.)?workspace_snapshots\b/i.test(code), '023 does not touch workspace data');
console.log('Migration 023 guard passed.');
