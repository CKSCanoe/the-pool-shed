import fs from 'node:fs';import assert from 'node:assert/strict';
const assistant=fs.readFileSync('public/assistant-engine.js','utf8');const automation=fs.readFileSync('public/automation-command-engine.js','utf8');const analytics=fs.readFileSync('public/analytics-command-engine.js','utf8');const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
assert(assistant.includes('__POOL_SHED_CAN_ACCESS__'),'assistant must enforce central permission adapter');
assert(automation.includes('PoolShedSettingsPermissions')||automation.includes('__POOL_SHED_CAN_ACCESS__'),'automation must enforce central permission adapter');
assert(analytics.includes('PoolShedSettingsPermissions')||analytics.includes('__POOL_SHED_CAN_ACCESS__'),'analytics exports must enforce central permission adapter');
assert(legacy.includes('PoolShedSettingsPermissions'),'legacy sidebar access must delegate to central permission engine when available');
console.log('PASS Settings permission integration hooks for UI, assistant, automation and analytics');
