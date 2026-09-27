import fs from 'node:fs';import assert from 'node:assert/strict';
const host=fs.readFileSync('public/azzy-jarvis-host.js','utf8');const backend=fs.readFileSync('server/azzy-pool-shed.js','utf8');const automation=fs.readFileSync('public/automation-command-engine.js','utf8');const analytics=fs.readFileSync('public/analytics-command-engine.js','utf8');const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
assert(host.includes('__POOL_SHED_AUTH_TOKEN__'),'Azzy must use the signed-in Pool Shed token');
assert(backend.includes('deriveAzzyPermissions'),'Azzy server must derive permissions from Pool Shed');
assert(backend.includes('securityControl'),'Azzy permission derivation must honour central security control');
assert(automation.includes('__POOL_SHED_CAN_ACCESS__')||automation.includes('PoolShedSettingsPermissions'),'automation must enforce central permissions');
assert(analytics.includes('__POOL_SHED_CAN_ACCESS__')||analytics.includes('PoolShedSettingsPermissions'),'analytics must enforce central permissions');
assert(legacy.includes('__POOL_SHED_CAN_ACCESS__'),'permission bridge missing');
console.log('PASS Settings permission integration hooks for Azzy, automation and analytics');
