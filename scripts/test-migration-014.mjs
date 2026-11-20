// Phase 2 guard: migration 014 keeps the save safety rules and does not undo the v1.48 egress fix.
// Behaviour against a real database is tested on staging with scripts/phase2/test-014-staging.sql.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const sql = fs.readFileSync('database/014-save-safety-and-revision-retention.sql', 'utf8');
const code = sql.replace(/--.*$/gm, '');
assert(!/alter\s+publication/i.test(code), '014 must not re-enable realtime on workspace_snapshots');
assert(!/replica\s+identity/i.test(code), '014 must not change replica identity');
assert(!/delete\s+from\s+(public\.)?workspace_snapshots/i.test(code), '014 must never delete workspace data');
assert(!/update\s+(public\.)?workspace_snapshots\s+set\s+data\s*=\s*(?!snapshot)/i.test(code), '014 only writes the snapshot it was given');
const saves = code.match(/function public\.ps_(quote_)?workspace_save[^]*?end \$\$;/g) || [];
assert.equal(saves.length, 2, 'both save paths are defined');
for (const fn of saves) assert(/perform ps_workspace_validate\(previous\.data, snapshot/.test(fn), 'every save path validates');
assert(/Safety lock: refusing to erase all/.test(code), 'erase safety lock present');
assert(/md5\(e::text\)/.test(code) && /where c=m\.e/.test(code), 'ledger check uses hashes with exact fallback');
assert(/newest_rank>20/.test(code) && /interval '7 days'/.test(code) && /interval '90 days'/.test(code), 'retention keeps newest 20, 7 days, daily to 90 days, monthly after');
assert(/grant execute on function public\.ps_workspace_revisions_prune\(text,boolean\) to service_role/.test(code), 'prune callable by service role only');
assert(!/grant execute on function public\.ps_workspace_revisions_prune[^;]*authenticated/.test(code), 'staff cannot call prune directly');
assert(fs.existsSync('database/014-rollback.sql'), 'rollback file exists');
console.log('Migration 014 guard passed.');
