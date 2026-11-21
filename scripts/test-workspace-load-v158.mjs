// v1.58 workspace start-up: one full load at a time, start from the device copy plus the change feed when the person's
// access is unchanged, calmer retries; restock rules keyed by product + location in the app and the database alike.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const legacy = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8');
const sql = fs.readFileSync('database/031-van-stock.sql', 'utf8');
assert(/let workspaceMasterInFlight = null;[\s\S]{0,400}if \(workspaceMasterInFlight\)/.test(legacy), 'one full load at a time');
assert(/structuredClone\(result\.data\)/.test(legacy), 'callers sharing a load each get their own copy');
assert(/if \(!access \|\| access !== copy\.access\) return null;/.test(legacy), 'device copy only when access is unchanged');
assert(/fetchWorkspaceByDelta\(copy\.updated_at, copy\.raw\)/.test(legacy), 'device copy plus the change feed');
assert(/writeServerCopy\(keepRaw, keepStamp\)/.test(legacy), 'exact server copy kept after each verified load');
assert(/response = await fetchSharedMaster\(true\);/.test(legacy), 'start-up prefers the device copy');
assert(/setTimeout\(resolve, 2000 \* \(attempt \+ 1\)/.test(legacy), 'calmer retries');
// Key rules: app and database must agree.
const i = legacy.indexOf('function workspaceKeyText'), j = legacy.indexOf('async function workspaceSha256Hex');
const ctx = {}; vm.createContext(ctx); vm.runInContext(legacy.slice(i, j) + ';this.keys = workspaceSectionKeys;', ctx);
const keys = ctx.keys('restockRules', [{ productId: 'P1', locationId: 'L-VAN-1', min: 1 }, { productId: 'P1', locationId: 'L-VAN-1', min: 2 }, { productId: 'P2', locationId: 'L-WH' }]);
assert.deepEqual(Array.from(keys), ['rule:P1|L-VAN-1', 'rule:P1|L-VAN-1#2', 'rule:P2|L-WH'], 'restock rules keyed in the app');
assert.equal(ctx.keys('stock', [{ productId: 'P1', locationId: 'L1' }])[0], 'stock:P1|L1', 'stock keys unchanged');
assert(/case when section='restockRules' and jsonb_typeof\(value\)='object' then 'rule:'\|\|coalesce\(value->>'productId',''\)\|\|'\|'\|\|coalesce\(value->>'locationId',value->>'location',''\) end/.test(sql), 'same rule in the database');
assert(/update public\.ps_snapshot_seq set seq = v/.test(sql), 're-key reported by the change feed');
console.log('Workspace load v1.58: single load, device copy plus changes, calmer retries, restock rule keys match.');
