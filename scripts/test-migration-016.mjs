// Phase 3.2 guard: the change feed is read-only, permission-checked, switchable, and cannot block saves.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const code = fs.readFileSync('database/016-record-change-feed.sql', 'utf8').replace(/--.*$/gm, '');
assert(!/(update|delete\s+from|insert\s+into)\s+(public\.)?workspace_snapshots\b/i.test(code), '016 never writes workspace data');
const feed = code.match(/function public\.ps_records_changes[^]*?end \$\$;/)[0];
assert(/stable security definer/.test(feed), 'feed is read-only and reads one consistent snapshot');
assert(/if not ps_workspace_can_read\(w\) then raise exception/.test(feed), 'feed checks workspace access first');
assert(/name='delta_refresh'/.test(feed), 'feed has a kill switch');
assert(/'full', true, 'reason', 'mirror incomplete'/.test(feed), 'a missed mirror forces a full download');
assert(/grant execute on function public\.ps_records_changes\(text,timestamptz\) to authenticated/.test(code), 'staff can call the feed');
assert(!/grant execute on function public\.ps_records_sync[^;]*authenticated/.test(code), 'staff cannot call the mirror directly');
const trig = code.match(/function public\.ps_records_after_snapshot\(\)[^]*?end \$\$;/)[0];
assert(/exception when others then[^]*ps_record_sync_issues[^]*needs_full=true/.test(trig), 'mirror failures are logged and trigger a full re-mirror');
const stamp = code.match(/function public\.ps_workspace_snapshot_stamp\(\)[^]*?end \$\$;/)[0];
assert(/new\.updated_at > old\.updated_at/.test(stamp) && /new\.updated_at := now\(\)/.test(stamp), 'stamp kept only when explicitly newer');
assert(fs.existsSync('database/016-rollback.sql'), 'rollback file exists');
console.log('Migration 016 guard passed.');
