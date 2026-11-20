// v1.50 (Phase 3.4): the app side of role-based visibility.
// Restricted users: their own copy is reduced to the permitted view before changes are worked out, app defaults for
// hidden fields (e.g. cost: 0) are not mistaken for edits, and a full save is never attempted.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8');
const block = src.slice(src.indexOf('      async function saveRemoteWorkspace('), src.indexOf('      async function refreshSharedWorkspaceFromRemote(', src.indexOf('      async function saveRemoteWorkspace(')));
const clone = v => JSON.parse(JSON.stringify(v));
const rules = { restricted: true, role: 'Warehouse', keys: '^(cost|costs|[a-z]*cost|[a-z]*margin|payment|payments)$', hidden_sections: ['quotes', 'financeCommand'] };

async function run({ local, raw, reply, access }) {
  const store = new Map(), calls = [];
  const st = {
    data: local, workspaceBaseSnapshot: clone(raw), workspaceRemoteRaw: raw, workspaceLocalRevisionCounter: 1,
    remoteWorkspaceUpdatedAt: 'R1', workspaceSaveInFlight: false, workspaceSyncConflict: false, sharedWorkspaceReady: true,
    supabaseClient: { async rpc(name, args) { calls.push([name, args]); return reply(name, args); } },
    supabaseSession: { user: { id: 'U1' } }, navigator: { onLine: true }, WORKSPACE_ID: 'pool-bros-main',
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    normalizeAppData: v => v, clone, writeOfflineSnapshot: async () => true, queueRemoteWorkspaceSave() {}, updateOfflineStatus() {},
    resolveSharedWorkspaceConflict: async () => false, toast() {}, render() {}, console: { warn() {}, log() {} },
    crypto: globalThis.crypto, TextEncoder, structuredClone
  };
  st.window = st;
  vm.createContext(st); vm.runInContext(block, st);
  vm.runInContext('workspaceAccessRules = __rules;', Object.assign(st, { __rules: access }));
  const ok = await st.saveRemoteWorkspace(false);
  return { ok, calls, st };
}

// What a Warehouse user was given (no cost, no payments, no quotes) ...
const raw = { products: [{ id: 'P1', name: 'Pump' }, { id: 'P2', name: 'Filter' }], salesOrders: [{ id: 'S1', lines: [{ id: 'L1', qty: 1 }] }] };
// ... and the app's own copy after its normal defaults: cost: 0 on products, empty payments, an empty quotes list.
const local = { products: [{ id: 'P1', name: 'Pump', cost: 0 }, { id: 'P2', name: 'Filter v2', cost: 0 }],
                salesOrders: [{ id: 'S1', lines: [{ id: 'L1', qty: 1, unitCost: 0 }], payments: [] }], quotes: [], financeCommand: {} };

// 1. Only the genuinely edited record is sent, without hidden fields or sections.
let r = await run({ local, raw, access: rules, reply: () => ({ data: { updated_at: 'R2', merged: false }, error: null }) });
assert.equal(r.ok, true);
assert.equal(r.calls.length, 1); assert.equal(r.calls[0][0], 'ps_workspace_save_changes');
const sent = r.calls[0][1].changes.sections;
assert.deepEqual(JSON.parse(JSON.stringify(sent)), [{ s: 'products', kind: 'list', upserts: [['id:P2', { id: 'P2', name: 'Filter v2' }]], deletes: [], order: null }],
  'defaults for hidden fields are not edits; hidden fields and sections are never sent');
assert.deepEqual(JSON.parse(JSON.stringify(r.st.workspaceRemoteRaw)).products[1], { id: 'P2', name: 'Filter v2' }, 'server copy kept in the permitted view');

// 2. If the per-record save cannot be used, a restricted user does NOT fall back to a full save.
r = await run({ local, raw, access: rules, reply: name => name === 'ps_workspace_save_changes' ? { data: { fallback: true }, error: null } : { data: { updated_at: 'R3' }, error: null } });
assert.equal(r.ok, false, 'kept on the device for a retry');
assert.deepEqual(r.calls.map(c => c[0]), ['ps_workspace_save_changes'], 'no full save from a restricted role');

// 3. Unrestricted users are unchanged: full save remains the fallback.
r = await run({ local: clone(raw), raw: { products: [] }, access: null, reply: name => name === 'ps_workspace_save_changes' ? { data: { fallback: true }, error: null } : { data: { updated_at: 'R4' }, error: null } });
assert.deepEqual(r.calls.map(c => c[0]), ['ps_workspace_save_changes', 'ps_workspace_save']);

console.log('Role view v1.50 behaviour test passed.');
