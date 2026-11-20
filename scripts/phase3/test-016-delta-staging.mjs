// Phase 3.2 end-to-end proof on STAGING ONLY.
// Makes real saves of every kind through ps_workspace_save (as a real staff account), then rebuilds the
// workspace with the app's own delta code from ps_records_changes, and checks the result is identical to the
// server's snapshot. Finally restores staging to its starting content.
// Usage: node scripts/phase3/test-016-delta-staging.mjs
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
const PSQL = '/opt/homebrew/opt/libpq/bin/psql';
const AS_STAFF = "select set_config('request.jwt.claims', json_build_object('sub',(select user_id from ps_workspace_members where role='admin' limit 1),'role','authenticated')::text, false);";
function sql(query) {
  return execFileSync(PSQL, [url, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', AS_STAFF, '-c', query], { encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\n').filter(l => l && l.trim() !== '' && !/^\s*$/.test(l)).filter(l => !/^\{"sub"|^$/.test(l)).join('\n').replace(/^.*?\n(?=[{\[])/s, '');
}
const snapshot = () => JSON.parse(sql("select json_build_object('updated_at',updated_at,'data',data) from workspace_snapshots where workspace_id='pool-bros-main'"));
const canonical = v => Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}' : JSON.stringify(v);

// The app's own delta code.
const src = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8');
const block = src.slice(src.indexOf('      function workspaceKeyText('), src.indexOf('      async function refreshSharedWorkspaceByDelta('));
const ctx = { crypto: globalThis.crypto, TextEncoder, Map, Array, Object, Number, String, Uint8Array, Error, JSON };
vm.createContext(ctx); vm.runInContext(block, ctx);

function save(label, expr) {
  const out = sql(`select ps_workspace_save('pool-bros-main',(select updated_at from workspace_snapshots where workspace_id='pool-bros-main'),
      (select ${expr} from workspace_snapshots where workspace_id='pool-bros-main'))::text;`);
  assert(out.includes('updated_at'), label + ': save accepted');
}
const feed = since => JSON.parse(sql(`select ps_records_changes('pool-bros-main','${since}')::text`));

const start = snapshot();
let held = start;            // what one open tab holds
const results = [];
const edits = [
  ['edit a customer', `jsonb_set(data,'{customers,0,notes}','"delta proof"')`],
  ['delete a customer', `data #- '{customers,1}'`],
  ['add a sales order', `jsonb_set(data,'{salesOrders}',(data->'salesOrders')||'[{"id":"SO-DELTA-PROOF","lines":[],"payments":[]}]')`],
  ['edit a product price', `jsonb_set(data,'{products,250,rrp}','99.99')`],
  ['add a product at the start', `jsonb_set(data,'{products}','[{"id":"P-DELTA-PROOF","name":"Proof"}]'::jsonb||(data->'products'))`],
  ['delete a product', `data #- '{products,500}'`],
  ['reorder suppliers', `jsonb_set(data,'{suppliers}',(select jsonb_agg(e order by e->>'name' desc) from jsonb_array_elements(data->'suppliers') e))`],
  ['edit stock (no ids)', `jsonb_set(data,'{stock,0,qty}',to_jsonb(((data->'stock'->0->>'qty')::numeric)+2))`],
  ['change a setting', `jsonb_set(data,'{companySettings,deltaProof}','true')`],
  ['duplicate brand text', `jsonb_set(data,'{brands}',(data->'brands')||jsonb_build_array(data->'brands'->0))`],
  ['several sections at once', `jsonb_set(jsonb_set(data,'{customers,0,notes}','"again"'),'{notifications}','[{"id":"N-DELTA","title":"Proof"}]'::jsonb||(data->'notifications'))`]
];

for (const [label, expr] of edits) {
  save(label, expr);
  const now = snapshot();
  const f = feed(held.updated_at);
  assert(!f.full, label + ': feed available (' + (f.reason || '') + ')');
  const rebuilt = await ctx.applyWorkspaceDelta(held.data, f);
  const same = canonical(rebuilt) === canonical(now.data);
  const bytes = JSON.stringify(f).length;
  results.push(`${same ? 'IDENTICAL' : 'DIFFERENT'}  ${label.padEnd(28)} feed ${String(bytes).padStart(7)} bytes vs full ${JSON.stringify(now.data).length} bytes`);
  assert(same, label + ': rebuilt workspace equals the server');
  assert.equal(f.updated_at, now.updated_at);
  held = { updated_at: now.updated_at, data: rebuilt };
}

// A tab that missed every save catches up in one step.
{
  const now = snapshot();
  const f = feed(start.updated_at);
  const rebuilt = await ctx.applyWorkspaceDelta(start.data, f);
  assert.equal(canonical(rebuilt), canonical(now.data), 'catch-up from the start equals the server');
  results.push(`IDENTICAL  catch-up across all ${edits.length} saves  feed ${JSON.stringify(f).length} bytes`);
}

// Restore staging: a full save of the starting data, sent from a private temporary file (too big for a command line).
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-restore-'));
  const file = path.join(tmp, 'restore.sql');
  fs.writeFileSync(file, `${AS_STAFF}\nselect ps_workspace_save('pool-bros-main',(select updated_at from workspace_snapshots where workspace_id='pool-bros-main'),'${JSON.stringify(start.data).replace(/'/g, "''")}'::jsonb);`, { mode: 0o600 });
  try { execFileSync(PSQL, [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', file]); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
assert.equal(canonical(snapshot().data), canonical(start.data), 'staging restored');
const verify = JSON.parse(sql("select ps_records_verify('pool-bros-main')::text"));
assert.equal(verify.ok, true, 'mirror still equals the snapshot');

console.log(results.join('\n'));
console.log('Staging restored; mirror verified. Delta end-to-end proof passed.');
