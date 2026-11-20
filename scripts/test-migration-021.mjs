// Phase 3.5a guard: the record-built workspace is read-only and service-role only.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const code = fs.readFileSync('database/021-workspace-from-records.sql', 'utf8').replace(/--.*$/gm, '');
assert(!/(insert|update|delete)\s+(into\s+)?(public\.)?(workspace_snapshots|ps_records|ps_settings)\b/i.test(code), '021 writes nothing');
assert(/function public\.ps_workspace_document\(w text\)[^]*?stable security definer/.test(code), 'read-only function');
assert(/grant execute on function public\.ps_workspace_document\(text\) to service_role/.test(code), 'service role only');
assert(!/grant execute on function public\.ps_workspace_document[^;]*authenticated/.test(code), 'staff cannot read the unfiltered document');
assert(/r\.deleted_at is null/.test(code) && /order by r\.ord/.test(code), 'live records in app order');
console.log('Migration 021 guard passed.');
