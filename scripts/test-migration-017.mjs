// Phase 3.3 guard: per-record saves keep every safety rule and can be switched off.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const code = fs.readFileSync('database/017-record-saves.sql', 'utf8').replace(/--.*$/gm, '');
const fn = code.match(/function public\.ps_workspace_save_changes[^]*?end \$\$;/)[0];
assert(/wm\.role in \('admin','operator'\) and p\.active=true/.test(fn), 'same write permission as the full save');
assert(/name='record_saves'/.test(fn), 'kill switch');
assert(/pg_advisory_xact_lock/.test(fn), 'same save lock as the full save');
assert(/perform ps_workspace_validate\(previous\.data, new_data, true\)/.test(fn), 'same safety rules (erase lock, ledger, stock)');
assert(/r\.change_seq > base_seq/.test(fn), 'per-record clash detection');
assert(/'conflicts', conflicts/.test(fn), 'clashes are reported, not overwritten');
assert(/Record keys do not match/.test(fn), 'key rules checked against the server');
assert(/Section type changed/.test(fn), 'list/settings type changes need a full save');
assert(/'fallback', true, 'reason', 'mirror off'/.test(fn), 'falls back when the record copy is off');
assert(/grant execute on function public\.ps_workspace_save_changes\(text,timestamptz,jsonb\) to authenticated/.test(code));
assert(fs.existsSync('database/017-rollback.sql'), 'rollback file exists');
console.log('Migration 017 guard passed.');
