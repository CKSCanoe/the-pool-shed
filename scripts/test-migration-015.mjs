// Phase 3.1 guard: the shadow record store can never change or block the workspace snapshot.
// Behaviour against a real database: scripts/phase3/test-015-staging.sql (staging only).
import fs from 'node:fs';
import assert from 'node:assert/strict';
const sql = fs.readFileSync('database/015-record-store-shadow.sql', 'utf8');
const code = sql.replace(/--.*$/gm, '');
assert(!/(update|delete\s+from|insert\s+into)\s+(public\.)?workspace_snapshots\b/i.test(code), '015 never writes the snapshot');
assert(!/alter\s+publication/i.test(code), '015 does not enable realtime');
const trigger = code.match(/function public\.ps_records_after_snapshot\(\)[^]*?end \$\$;/);
assert(trigger, 'mirror trigger function exists');
assert(/exception when others then[^]*?insert into ps_record_sync_issues/.test(trigger[0]), 'mirror failures are logged, never raised');
assert(/return null;/.test(trigger[0]), 'AFTER trigger cannot alter the saved row');
assert(/after insert or update of data on public\.workspace_snapshots/i.test(code), 'mirror runs after the save');
for (const t of ['ps_records', 'ps_record_history', 'ps_settings', 'ps_record_sync_issues']) {
  assert(new RegExp(`alter table public\\.${t} enable row level security`).test(code), `${t} has row level security`);
}
assert(/revoke all on public\.ps_records, public\.ps_record_history, public\.ps_settings, public\.ps_record_sync_issues from anon, authenticated/.test(code), 'staff and anonymous users cannot read the new tables yet');
assert(/where old_data is null or o\.key is null or n\.key is null or o\.value<>n\.value/.test(code), 'unchanged sections are skipped');
assert(fs.existsSync('database/015-rollback.sql'), 'rollback file exists');
console.log('Migration 015 guard passed.');
