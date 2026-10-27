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
assert.match(html, /commercial-audits\/embedded\.css\?v=1\.47\.6/);
assert.match(shell, /data-crm-profile-tab="audits"/);
assert.match(shell, /data-new-pool-audit/);
assert.match(shell, /data-open-pool-audit/);
assert.match(auditHtml, /poolShedBridge\.save\(survey, options\)/);
assert.match(auditHtml, /useState\(linkedCustomerId \|\| ''\)/, 'new visits require an explicit CRM customer selection');
assert.match(auditHtml, /Choose the customer before starting an audit/);
assert.match(auditHtml, /catch \{ record = auditModel\.normalise\(surveyDataRef\.current\); emergency = true; \}/, 'visible answers can be backed up if save fails');
assert.match(auditHtml, /Audit save failed: \$\{error\.message\}/, 'save failures show the actual cause');
assert.match(auditHtml, /id="metadata-org-name" value=\{surveyData\.customerId \|\| ''\}/, 'organisation dropdown uses the CRM customer ID');
assert.match(auditHtml, /onChange=\{event => changeOrganisation\(event\.target\.value\)\}/, 'selecting an organisation updates its profile link');
assert.match(auditHtml, /"id": "org-name", "label": "Organisation Name", "type": "crm-customer"/, 'organisation is configured as a CRM selector');
assert.match(auditHtml, /onBlurCapture=\{saveOnFieldExit\}/, 'leaving a field triggers a save');
assert.match(auditHtml, /surveyDataRef\.current/, 'manual saves use the latest edit');
assert.match(auditHtml, /if \(next\.status !== previous\.status\) saveNow\(\)/, 'traffic-light changes save immediately');
assert.match(auditHtml, /poolShedBridge\.openCustomerProfile/, 'audit returns to its customer profile');
assert.match(auditHtml, /poolShedMedia\.queueAuditPhoto\(activeAuditCustomerId/);
assert.match(auditHtml, /if \(onPersist\) await onPersist\(\)/, 'new photograph links save immediately');
assert.match(auditHtml, /poolShedBridge\.prepareOffline\(surveyDataRef\.current\.id\)/, 'selected audit must be prepared before the visit');
assert.match(auditHtml, /upgradeDraft: draft/, 'upgrade proposals persist while they are being written');
assert.match(shell, /cacheAuditPhotos\(selectedAudit\)/, 'existing audit photographs are downloaded for offline use');
assert.match(shell, /writeOfflineSnapshot\(false, 'shared-base', 'verified-merge-base'/, 'offline merge base is stored before departure');
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

const data = { customers: [{ id: 'C1', name: 'School pool', companyName: 'School Trust' }, { id: 'C2', name: 'Hotel pool' }], poolAudits: [] };
const user = { id: 'U1', name: 'Inspector', role: 'Engineer' };
const localStore = new Map();
let localWriteAllowed = true;
let indexedWriteAllowed = true;
const localStorage = { getItem: key => localStore.get(key) || null, setItem: (key, value) => localStore.set(key, value) };
const ctx = {
  window: null, data, navigator: { onLine: true }, localStorage,
  PoolShedSettingsPermissions: { can: (_module, operation, actor) => operation !== 'delete' || actor.role === 'Admin' }, PoolShedAudit: { record: event => { ctx.lastAuditEvent = event; } },
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
assert.equal(data.poolAudits[0].metadata['org-name'], 'School Trust', 'report organisation comes from the CRM company name');
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
assert.equal(bridge.canRelink(data.poolAudits.find(item => item.id === 'A1')), true);
const moved = await bridge.save({ ...data.poolAudits.find(item => item.id === 'A1'), customerId: 'C2' }, { relinkCustomer: true });
assert.equal(moved.metadata['org-name'], 'Hotel pool');
assert.doesNotMatch(ctx.customerAuditPanel(data.customers[0]), /Updated pool/, 'old profile no longer lists the moved visit');
assert.match(ctx.customerAuditPanel(data.customers[1]), /Updated pool/, 'new profile lists the moved visit');
assert.equal(JSON.parse(localStorage.getItem('poolshed:v172:appData')).poolAudits.find(item => item.id === 'A1').customerId, 'C2', 'CRM link persists after reload');
assert.equal(ctx.lastAuditEvent.action, 'Commercial audit linked to another customer');
// A delayed shared snapshot can still contain the old, empty draft. An explicit
// relink that was already approved must be recoverable by the next autosave.
data.poolAudits[0] = { ...data.poolAudits[0], customerId: 'C1', metadata: { ...data.poolAudits[0].metadata, 'org-name': 'School Trust' } };
const recovered = await bridge.save({ ...moved, responses: { poolside: { status: 'green' } } });
assert.equal(recovered.customerId, 'C2', 'approved customer relink is retried after a stale shared copy');
assert.equal(data.poolAudits[0].customerId, 'C2');
assert.equal(data.poolAudits[0].responses.poolside.status, 'green', 'captured answers survive the retry');
await assert.rejects(bridge.save({ ...recovered, customerId: 'C1' }), /cannot be moved/, 'an unrelated move still needs explicit approval');
ctx.sharedWorkspaceReady = true;
ctx.supabaseSession = { user: { id: 'U1' } };
ctx.workspaceLocalSaveFailed = false;
ctx.workspaceSyncConflict = false;
ctx.WORKSPACE_ID = 'test-workspace';
ctx.flushSharedWorkspaceSave = async () => { localStore.delete('poolshed:v172:pendingSync'); return true; };
let sharedAudit = JSON.parse(JSON.stringify(data.poolAudits.find(item => item.id === 'A1')));
ctx.supabaseClient = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { data: { poolAudits: [sharedAudit] } }, error: null }) }) }) }) };
ctx.PoolShedBusinessMedia = { refsFrom: value => [...JSON.stringify(value).matchAll(/customer-media:[0-9a-f-]{36}/g)].map(match => match[0]) };
ctx.__POOL_SHED_AUTH_TOKEN__ = async () => 'test-token';
ctx.fetch = async (_url, options) => options?.method === 'HEAD' ? { ok: true } : { ok: true, json: async () => ({ urls: { 'customer-media:00000000-0000-0000-0000-000000000001': 'https://example.test/photo' } }) };
let handover = await bridge.verifyHandover('A1', 'C2');
assert.equal(handover.photos, 0, 'shared audit without photos can be handed over');
sharedAudit = { ...sharedAudit, metadata: { ...sharedAudit.metadata, 'site-name': 'Stale shared copy' } };
await assert.rejects(bridge.verifyHandover('A1', 'C2'), /does not yet match/, 'stale server copy is not called safe');
sharedAudit = JSON.parse(JSON.stringify(data.poolAudits.find(item => item.id === 'A1')));
sharedAudit.photo = 'customer-media:00000000-0000-0000-0000-000000000001';
data.poolAudits.find(item => item.id === 'A1').photo = sharedAudit.photo;
handover = await bridge.verifyHandover('A1', 'C2');
assert.equal(handover.photos, 1, 'handover confirms linked photo');
ctx.fetch = async (_url, options) => options?.method === 'HEAD' ? { ok: false } : { ok: true, json: async () => ({ urls: { [sharedAudit.photo]: 'https://example.test/photo' } }) };
await assert.rejects(bridge.verifyHandover('A1', 'C2'), /could not be opened/, 'broken shared photo blocks handover');
ctx.navigator.onLine = false;
await assert.rejects(bridge.verifyHandover('A1', 'C2'), /offline/, 'offline device cannot confirm handover');
ctx.navigator.onLine = true;
const ownDraft = { ...record, id: 'A7', createdBy: { id: user.id }, metadata: { 'site-name': 'Test draft' } };
await bridge.save(ownDraft);
assert.equal(bridge.canDelete(ownDraft), true, 'engineers may delete their own draft');
assert.equal(bridge.canDelete({ ...ownDraft, createdBy: { id: 'OTHER' } }), false, 'engineers cannot delete another author’s draft');
assert.equal(bridge.canDelete({ ...ownDraft, status: 'approved' }), false, 'engineers cannot delete approved reports');
await assert.rejects(bridge.delete('A7', 'C2'), /no longer linked/, 'deletion requires the matching customer');
await bridge.delete('A7', 'C1');
assert.equal(data.poolAudits.some(item => item.id === 'A7'), false);
assert.equal(JSON.parse(localStorage.getItem('poolshed:v172:appData')).poolAudits.some(item => item.id === 'A7'), false, 'deletion persists locally');
assert.equal(ctx.lastIndexedSnapshot.poolAudits.some(item => item.id === 'A7'), false, 'deletion persists in device backup');
assert.doesNotMatch(ctx.customerAuditPanel(data.customers[0]), /Test draft/, 'deleted audit disappears from customer profile');
assert.equal(ctx.lastAuditEvent.action, 'Commercial audit deleted');
assert.equal(ctx.lastAuditEvent.before.customerId, 'C1');
await assert.rejects(bridge.delete('A7', 'C1'), /no longer linked/, 'repeat deletion does not affect another audit');
ctx.renderCommercialAudits();
assert.match(auditFrame, /customer=C2&audit=A1/, 'reopening the active visit uses the new profile route');
await assert.rejects(bridge.save({ ...moved, customerId: 'C1', responses: { check: { status: 'red' } } }, { relinkCustomer: true }), /findings, assets or evidence/);
await assert.rejects(bridge.save({ ...record, id: 'A2', customerId: 'missing' }), /valid customer/);
await assert.rejects(bridge.save({ ...record, id: 'A3', responses: { x: { image: 'data:image/png;base64,' + 'A'.repeat(501000) } } }), /embedded media/);
localWriteAllowed = false;
await bridge.save({ ...record, id: 'A4', metadata: { 'site-name': 'IndexedDB visit' } });
assert.equal(ctx.lastIndexedSnapshot.poolAudits[0].id, 'A4', 'large-workspace fallback preserves the audit');
ctx.navigator.onLine = false;
await bridge.save({ ...ownDraft, id: 'A8', metadata: { 'site-name': 'Offline test visit' } });
await bridge.delete('A8', 'C1');
assert.equal(ctx.lastIndexedSnapshot.poolAudits.some(item => item.id === 'A8'), false, 'offline deletion is saved for later sync');
ctx.navigator.onLine = true;
await bridge.save({ ...ownDraft, id: 'A9', metadata: { 'site-name': 'Keep on failure' } });
indexedWriteAllowed = false;
await assert.rejects(bridge.delete('A9', 'C1'), /could not save this deletion/, 'deletion is not reported as complete without a device copy');
assert.equal(data.poolAudits.some(item => item.id === 'A9'), true, 'failed deletion restores the audit in memory');
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
