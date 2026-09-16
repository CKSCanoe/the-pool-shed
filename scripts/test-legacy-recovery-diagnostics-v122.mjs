import fs from 'node:fs';
import assert from 'node:assert/strict';

const settings=fs.readFileSync('public/settings-command-workspace.js','utf8');

assert(settings.includes('function legacyRecoveryDiagnostics'), 'Settings must expose legacy recovery diagnostics');
assert(settings.includes('Recovery Diagnostics'), 'Legacy migration page must visibly show recovery diagnostics');
assert(settings.includes('__POOL_SHED_LEGACY_REMOTE_DIAGNOSTICS__'), 'Settings diagnostics must read the runtime legacy table diagnostic state');
assert(settings.includes('Legacy tables checked'), 'Diagnostics must report how many normalized legacy tables were checked');
assert(settings.includes('Readable tables'), 'Diagnostics must report readable legacy table count');
assert(settings.includes('Unavailable tables'), 'Diagnostics must report unavailable legacy table count');
assert(settings.includes('Legacy rows found'), 'Diagnostics must report legacy row count');
assert(settings.includes('No recoverable legacy data was found'), 'Empty scan message must describe recoverable data, not only snapshots');
assert(!settings.includes('No legacy snapshots were found in this browser or connected workspace.'), 'Old snapshot-only empty message must be removed');
assert(settings.includes('v1.22 migration authority'), 'Migration unavailable copy must name the current v1.22 authority');
assert(settings.includes('<b>'+"'+summary.jobs+'"+'</b>Projects'), 'Migration source summary must include projects');
assert(settings.includes('<b>'+"'+summary.suppliers+'"+'</b>Suppliers'), 'Migration source summary must include suppliers');

console.log('PASS v1.22 recovery diagnostics are visible and truthful in Settings');
