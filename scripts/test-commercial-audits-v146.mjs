import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const shell = read('public/assets/js/01-legacy-01.js');
const html = read('public/index.html');
const auditHtml = read('public/commercial-audits/index.html');
const permissionSource = read('public/settings-permissions-engine.js');

assert.match(shell, /id: "audits", label: "Pool Audits"/);
assert.match(html, /id="screen-audits"/);
assert.match(shell, /data-crm-profile-tab="audits"/);
assert.match(shell, /data-new-pool-audit/);
assert.match(shell, /data-open-pool-audit/);
assert.match(auditHtml, /poolShedBridge\.save\(survey\)/);
assert.match(auditHtml, /poolShedMedia\.upload\('customer'/);
assert.match(auditHtml, /await prepareReportMedia\(surveyData\)/);
assert.doesNotMatch(auditHtml, /indexedDB\.open/);
assert.doesNotMatch(auditHtml, /Lucton School|sample-lucton|39 green, 22 amber and 15 red/);
assert.equal(fs.existsSync('public/commercial-audits/src/data/sample_lucton.json'), false);

const babelContext = { module: { exports: {} } };
babelContext.exports = babelContext.module.exports;
vm.runInNewContext(read('public/commercial-audits/vendor/babel.min.js'), babelContext);
const jsx = auditHtml.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)?.[1];
assert.ok(jsx, 'audit application source exists');
new vm.Script(babelContext.module.exports.transform(jsx, { presets: [['react', { runtime: 'classic' }]] }).code);

const data = { customers: [{ id: 'C1', name: 'School pool' }, { id: 'C2', name: 'Hotel pool' }], poolAudits: [] };
const user = { id: 'U1', name: 'Inspector', role: 'Engineer' };
const ctx = {
  window: null, data, navigator: { onLine: true }, localStorage: { getItem: () => null },
  PoolShedSettingsPermissions: { can: () => true }, PoolShedAudit: { record: () => {} },
  currentUser: () => user, canAccessTab: () => true,
  saveAppData: () => true, workspaceLocalSaveFailed: false,
  document: { getElementById: () => null }, URLSearchParams, JSON, Error,
  escapeHtml: value => String(value), toast: () => {}, render: () => {},
  active: 'crm', isAuthenticated: true
};
ctx.window = ctx;
const start = shell.indexOf('      function customerAuditPanel(c) {');
const end = shell.indexOf('      function customerMegaProfile(c) {', start);
assert.ok(start >= 0 && end > start);
vm.createContext(ctx);
vm.runInContext(shell.slice(start, end), ctx);
const bridge = ctx.__POOL_SHED_AUDIT_BRIDGE__;
assert.ok(bridge);
assert.deepEqual(Array.from(bridge.getCustomers(), c => c.id), ['C1', 'C2']);
const record = { id: 'A1', customerId: 'C1', status: 'draft', metadata: { 'site-name': 'Main pool' }, responses: {}, assets: [] };
bridge.save(record);
assert.equal(data.poolAudits.length, 1);
assert.equal(data.poolAudits[0].customerId, 'C1');
record.metadata['site-name'] = 'Changed outside';
assert.equal(data.poolAudits[0].metadata['site-name'], 'Main pool', 'saved record is detached from caller');
assert.match(ctx.customerAuditPanel(data.customers[0]), /Main pool/);
assert.doesNotMatch(ctx.customerAuditPanel(data.customers[1]), /Main pool/);
assert.throws(() => bridge.save({ ...record, customerId: 'C2' }), /cannot be moved/);
assert.throws(() => bridge.save({ ...record, id: 'A2', customerId: 'missing' }), /valid customer/);
assert.throws(() => bridge.save({ ...record, id: 'A3', responses: { x: { image: 'data:image/png;base64,' + 'A'.repeat(501000) } } }), /embedded media/);
ctx.navigator.onLine = false;
assert.equal(bridge.syncState(), 'device');
ctx.isAuthenticated = false;
assert.throws(() => bridge.getAll(), /Sign in/);
assert.throws(() => bridge.save({ ...record, id: 'A4' }), /Sign in/);

const permCtx = { window: null, globalThis: null, localStorage: { getItem: () => null },
  __POOL_SHED_GET_DATA__: () => ({ securityControl: {} }),
  __POOL_SHED_CURRENT_USER__: () => user,
  __POOL_SHED_ALL_USERS__: () => [user],
  __POOL_SHED_SAVE_USERS__: () => {}, console, Date, Math, Set, Map, Intl };
permCtx.window = permCtx; permCtx.globalThis = permCtx;
vm.createContext(permCtx);
vm.runInContext(permissionSource, permCtx);
assert.equal(permCtx.PoolShedSettingsPermissions.can('audits', 'view', user), true);
assert.equal(permCtx.PoolShedSettingsPermissions.can('audits', 'create', user), true);
assert.equal(permCtx.PoolShedSettingsPermissions.can('audits', 'view', { ...user, role: 'Warehouse' }), false);

console.log('PASS commercial audit JSX, navigation, customer profile, save/link protections, secure media wiring and role access');
