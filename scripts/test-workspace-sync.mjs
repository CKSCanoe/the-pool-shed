import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8');
const start = source.indexOf('      async function saveRemoteWorkspace(');
const end = source.indexOf('      async function refreshSharedWorkspaceFromRemote(', start);
assert(start > 0 && end > start);

const store = new Map([
  ['poolshed:v172:pendingSync', '1'],
  ['poolshed:v172:appData', JSON.stringify({ name: 'Original' })]
]);
let response = { data: { updated_at: '2026-10-24T10:00:00Z' }, error: null };
let rpcArgs;
let queued = 0;
let statusUpdates = 0;
const messages = [];
const state = {
  data: { name: 'Original' },
  workspaceBaseSnapshot: { name: 'Previous' },
  workspaceLocalRevisionCounter: 1,
  remoteWorkspaceUpdatedAt: '2026-10-23T10:00:00Z',
  workspaceSaveInFlight: false,
  workspaceSyncConflict: false,
  sharedWorkspaceReady: true,
  supabaseClient: { async rpc(name, args) { assert.equal(name, 'ps_workspace_save'); rpcArgs = args; return response; } },
  supabaseSession: { user: { id: 'U1' } },
  navigator: { onLine: true },
  WORKSPACE_ID: 'pool-shed',
  localStorage: {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key)
  },
  normalizeAppData: value => value,
  clone: value => structuredClone(value),
  writeOfflineSnapshot: async () => true,
  queueRemoteWorkspaceSave: () => { queued += 1; },
  updateOfflineStatus: () => { statusUpdates += 1; },
  resolveSharedWorkspaceConflict: async () => false,
  toast: message => messages.push(message),
  render: () => {},
  console
};
vm.createContext(state);
vm.runInContext(source.slice(start, end), state);

assert.equal(await state.saveRemoteWorkspace(false), true);
assert.equal(rpcArgs.w, 'pool-shed');
assert.equal(rpcArgs.expected, '2026-10-23T10:00:00Z');
assert.equal(rpcArgs.snapshot.name, 'Original');
assert.equal(store.has('poolshed:v172:pendingSync'), false, 'only the confirmed revision is marked shared');
assert.equal(state.workspaceSaveInFlight, false);
assert(statusUpdates >= 1, 'save status refreshes after the in-flight flag is cleared');

store.set('poolshed:v172:pendingSync', '1');
store.set('poolshed:v172:appData', JSON.stringify({ name: 'Newer edit' }));
state.workspaceLocalRevisionCounter += 1;
response = { data: { updated_at: '2026-10-24T10:01:00Z' }, error: null };
assert.equal(await state.saveRemoteWorkspace(false), true);
assert.equal(store.get('poolshed:v172:pendingSync'), '1', 'a newer local edit stays pending');
assert.equal(queued, 1, 'a newer local edit is queued for a further upload');

response = { data: null, error: null };
assert.equal(await state.saveRemoteWorkspace(false), false);
assert.equal(state.workspaceSyncConflict, true, 'a revision collision blocks unconfirmed sharing');
assert.equal(store.get('poolshed:v172:pendingSync'), '1');
state.workspaceSyncConflict = false;
state.navigator.onLine = false;
assert.equal(await state.saveRemoteWorkspace(false), false, 'offline changes cannot be called shared');
assert.equal(store.get('poolshed:v172:pendingSync'), '1');
assert(messages.some(message => message.includes('Another user saved')), 'a conflict remains visible to staff');

console.log('PASS confirmed shared save, newer edit retention, revision conflict and offline protection');
