import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const shell = read('public/assets/js/01-legacy-01.js');
const html = read('public/index.html');
const auditHtml = read('public/commercial-audits/index.html');
const permissionSource = read('public/settings-permissions-engine.js');
const worker = read('public/service-worker.js');

assert.match(shell, /id: "audits", label: "Pool Audits"/);
assert.match(html, /id="screen-audits"/);
assert.match(html, /commercial-audits\/embedded\.css\?v=1\.46\.0/);
assert.match(shell, /data-crm-profile-tab="audits"/);
assert.match(shell, /data-new-pool-audit/);
assert.match(shell, /data-open-pool-audit/);
assert.match(auditHtml, /poolShedBridge\.save\(survey\)/);
assert.match(auditHtml, /onBlurCapture=\{saveOnFieldExit\}/, 'leaving a field triggers a save');
assert.match(auditHtml, /surveyDataRef\.current/, 'manual saves use the latest edit');
assert.match(auditHtml, /if \(next\.status !== previous\.status\) saveNow\(\)/, 'traffic-light changes save immediately');
assert.match(auditHtml, /poolShedBridge\.openCustomerProfile/, 'audit returns to its customer profile');
assert.match(auditHtml, /poolShedMedia\.upload\('customer'/);
assert.match(auditHtml, /await prepareReportMedia\(savedAudit\)/);
assert.doesNotMatch(auditHtml, /["']\.\/(?:vendor|src|assets)\//, 'clean URLs must not break audit asset paths');
for (const source of auditHtml.matchAll(/(?:src|href)="(\/commercial-audits\/(?:vendor|src|assets)\/[^\"]+)"/g)) {
  assert.ok(fs.existsSync(`public${source[1]}`), `audit asset exists: ${source[1]}`);
}
assert.doesNotMatch(auditHtml, /\.cjs["']/);
assert.match(worker, /commercial-audits\(\?:\\\/\|\\\/index\\\.html\)\?\$/);
assert.match(auditHtml, /startNewFromProfile = poolShedBridge && routeParams\.has\('new'\)/);
assert.match(auditHtml, /restored\.customerId && restored\.customerId !== customer\.id/);
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
const localStore = new Map();
let localWriteAllowed = true;
let indexedWriteAllowed = true;
const localStorage = { getItem: key => localStore.get(key) || null, setItem: (key, value) => localStore.set(key, value) };
const ctx = {
  window: null, data, navigator: { onLine: true }, localStorage,
  PoolShedSettingsPermissions: { can: () => true }, PoolShedAudit: { record: () => {} },
  currentUser: () => user, canAccessTab: () => true,
  saveAppData: () => {
    ctx.workspaceLastLocalPayload = JSON.stringify(data);
    localStore.set('poolshed:v172:localSnapshotMode', localWriteAllowed ? 'localstorage' : 'indexeddb');
    if (localWriteAllowed) localStore.set('poolshed:v172:appData', ctx.workspaceLastLocalPayload);
    else localStore.delete('poolshed:v172:appData');
    localStore.set('poolshed:v172:pendingSync', '1');
    return true;
  },
  writeOfflineSnapshot: async (_pending, _key, _reason, snapshot) => {
    if (indexedWriteAllowed) ctx.lastIndexedSnapshot = snapshot;
    return indexedWriteAllowed;
  },
  document: { getElementById: () => null, querySelector: () => null }, URLSearchParams, JSON, Error,
  escapeHtml: value => String(value), toast: () => {}, render: () => {},
  active: 'crm', activeSubPage: { crm: 'All Customers' }, isAuthenticated: true
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
await bridge.save(record);
assert.equal(data.poolAudits.length, 1);
assert.equal(data.poolAudits[0].customerId, 'C1');
record.metadata['site-name'] = 'Changed outside';
assert.equal(data.poolAudits[0].metadata['site-name'], 'Main pool', 'saved record is detached from caller');
assert.match(ctx.customerAuditPanel(data.customers[0]), /Main pool/);
assert.doesNotMatch(ctx.customerAuditPanel(data.customers[1]), /Main pool/);
assert.equal(JSON.parse(localStorage.getItem('poolshed:v172:appData')).poolAudits[0].customerId, 'C1', 'customer link survives a storage reload');
assert.equal(ctx.lastIndexedSnapshot.poolAudits[0].id, 'A1', 'audit is in the device backup');
await bridge.save({ ...data.poolAudits[0], metadata: { 'site-name': 'Updated pool' } });
assert.match(ctx.customerAuditPanel(data.customers[0]), /Updated pool/, 'customer profile reflects the latest audit');
assert.equal(JSON.parse(localStorage.getItem('poolshed:v172:appData')).poolAudits[0].metadata['site-name'], 'Updated pool');
let auditFrame = '';
ctx.document.getElementById = () => ({ querySelector: () => null, set innerHTML(value) { auditFrame = value; } });
ctx.openCommercialAudit('C1', '', true);
ctx.renderCommercialAudits();
assert.match(auditFrame, /customer=C1&new=/, 'new action requests a fresh audit');
const firstNewFrame = auditFrame;
ctx.openCommercialAudit('C1', '', true);
ctx.renderCommercialAudits();
assert.notEqual(auditFrame, firstNewFrame, 'each new action uses a fresh route');
ctx.openCommercialAudit('C1', 'A1');
ctx.renderCommercialAudits();
assert.match(auditFrame, /customer=C1&audit=A1/);
assert.doesNotMatch(auditFrame, /&new=/);
await assert.rejects(bridge.save({ ...record, customerId: 'C2' }), /cannot be moved/);
await assert.rejects(bridge.save({ ...record, id: 'A2', customerId: 'missing' }), /valid customer/);
await assert.rejects(bridge.save({ ...record, id: 'A3', responses: { x: { image: 'data:image/png;base64,' + 'A'.repeat(501000) } } }), /embedded media/);
localWriteAllowed = false;
await bridge.save({ ...record, id: 'A4', metadata: { 'site-name': 'IndexedDB visit' } });
assert.equal(ctx.lastIndexedSnapshot.poolAudits[0].id, 'A4', 'large-workspace fallback preserves the audit');
indexedWriteAllowed = false;
await assert.rejects(bridge.save({ ...record, id: 'A5' }), /could not save this audit on this device/, 'save must not confirm when both device stores fail');
localWriteAllowed = true;
indexedWriteAllowed = true;
let customerAuditsTabOpened = false;
ctx.document.querySelector = () => ({ click: () => { customerAuditsTabOpened = true; } });
bridge.openCustomerProfile('C1');
assert.equal(ctx.active, 'crm');
assert.equal(customerAuditsTabOpened, true, 'return path selects the customer audit tab');
ctx.navigator.onLine = false;
assert.equal(bridge.syncState(), 'device');
ctx.isAuthenticated = false;
assert.throws(() => bridge.getAll(), /Sign in/);
await assert.rejects(bridge.save({ ...record, id: 'A6' }), /Sign in/);

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
