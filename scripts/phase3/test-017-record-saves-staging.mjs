// Phase 3.3 end-to-end proof on STAGING ONLY: two tabs saving records with the app's own change detection.
// Usage: node scripts/phase3/test-017-record-saves-staging.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { loadEnv } from '../phase0/lib.mjs';

loadEnv();
const url = process.env.STAGING_SUPABASE_DB_URL || '';
if (!url.includes('rcmbqegxardafopurwdu') || url.includes('bbbqwalsaikxoirczpng')) throw new Error('Refusing: staging only');
const AS_STAFF = "select set_config('request.jwt.claims', json_build_object('sub',(select user_id from ps_workspace_members where role='admin' limit 1),'role','authenticated')::text, false);";
const sql = q => execFileSync('/opt/homebrew/opt/libpq/bin/psql', [url, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', AS_STAFF, '-c', q], { encoding: 'utf8', maxBuffer: 1 << 28 })
  .split('\n').filter(l => l.trim() && !l.startsWith('{"sub"')).join('\n');
const snapshot = () => JSON.parse(sql("select json_build_object('updated_at',updated_at,'data',data) from workspace_snapshots where workspace_id='pool-bros-main'"));
const canonical = v => Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}' : JSON.stringify(v);
const clone = v => JSON.parse(JSON.stringify(v));

const src = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8');
const pick = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const ctx = { crypto: globalThis.crypto, TextEncoder, Map, Set, Array, Object, Number, String, Uint8Array, Error, JSON };
vm.createContext(ctx);
vm.runInContext(pick('      function workspaceKeyText(', '      async function refreshSharedWorkspaceByDelta('), ctx);
vm.runInContext(pick('      function workspaceDeepEqual(', '      // Returns { status: "saved"'), ctx);

function saveChanges(expected, changes) {
  const body = JSON.stringify(changes);
  assert(!body.includes('$j$'));
  const t0 = Date.now();
  const out = JSON.parse(sql(`select ps_workspace_save_changes('pool-bros-main','${expected}',$j$${body}$j$::jsonb)::text`));
  return { out, ms: Date.now() - t0, bytes: body.length };
}

const start = snapshot();
const S0 = start.data;
const lines = [];

// Tab A: several kinds of change at once.
const A = clone(S0);
A.customers[0].notes = 'tab A ' + Date.now();
A.salesOrders.unshift({ id: 'SO-REC-PROOF', lines: [], payments: [] });
A.products.splice(700, 1);
A.customers.push({ id: 'C-REC-PROOF', name: 'Appended customer' });
A.companySettings = Object.assign({}, A.companySettings, { recordSaveProof: true });
const changesA = ctx.computeWorkspaceChanges(S0, A);
const a = saveChanges(start.updated_at, changesA);
assert(a.out.updated_at && a.out.merged === false, 'tab A saved: ' + JSON.stringify(a.out));
assert.equal(canonical(snapshot().data), canonical(A), 'server equals tab A');
lines.push(`tab A, 4 kinds of change: saved in ${a.ms} ms, sent ${a.bytes} bytes (a full save sends ${JSON.stringify(A).length})`);

// Tab B: still holds S0, edits OTHER records. Must merge, keeping tab A's work.
const B = clone(S0);
B.customers[1].notes = 'tab B ' + Date.now();
B.stock[0].qty = Number(B.stock[0].qty) + 3;
const b = saveChanges(start.updated_at, ctx.computeWorkspaceChanges(S0, B));
assert(b.out.updated_at && b.out.merged === true, 'tab B merged: ' + JSON.stringify(b.out));
const expected = clone(A);
expected.customers[1].notes = B.customers[1].notes;
expected.stock[0].qty = B.stock[0].qty;
assert.equal(canonical(snapshot().data), canonical(expected), 'server keeps both tabs\' changes');
lines.push(`tab B on the old copy, different records: merged in ${b.ms} ms, both tabs' changes kept (today: rejected as a clash)`);

// Tab B again from S0, editing the SAME customer as tab A: a real clash.
const C = clone(S0);
C.customers[0].notes = 'tab B clash';
const c = saveChanges(start.updated_at, ctx.computeWorkspaceChanges(S0, C));
assert(Array.isArray(c.out.conflicts) && c.out.conflicts.length === 1, 'same record is a clash: ' + JSON.stringify(c.out));
assert.equal(canonical(snapshot().data), canonical(expected), 'a clash changes nothing');
lines.push(`tab B on the old copy, same customer: reported as a clash (${JSON.stringify(c.out.conflicts)}), nothing overwritten`);

const verify = JSON.parse(sql("select ps_records_verify('pool-bros-main')::text"));
assert.equal(verify.ok, true, 'record copy equals the snapshot');

// Restore staging: a full save of the starting data, sent from a private temporary file (too big for a command line).
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-restore-'));
  const file = path.join(tmp, 'restore.sql');
  fs.writeFileSync(file, `${AS_STAFF}\nselect ps_workspace_save('pool-bros-main',(select updated_at from workspace_snapshots where workspace_id='pool-bros-main'),'${JSON.stringify(S0).replace(/'/g, "''")}'::jsonb);`, { mode: 0o600 });
  try { execFileSync('/opt/homebrew/opt/libpq/bin/psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', file]); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
assert.equal(canonical(snapshot().data), canonical(S0), 'staging restored');
console.log(lines.join('\n'));
console.log('Record copy verified; staging restored. Per-record save proof passed.');
