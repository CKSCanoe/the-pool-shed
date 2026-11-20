// v1.49 per-record saves: the app's change detection (computeWorkspaceChanges) sends exactly what changed.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8');
const pick = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to); assert(a > 0 && b > a, from); return src.slice(a, b); };
const ctx = { crypto: globalThis.crypto, TextEncoder, Map, Set, Array, Object, Number, String, Uint8Array, Error, JSON };
vm.createContext(ctx);
vm.runInContext(pick('      function workspaceKeyText(', '      async function refreshSharedWorkspaceByDelta('), ctx);
vm.runInContext(pick('      function workspaceDeepEqual(', '      // Returns { status: "saved"'), ctx);
const diff = (a, b) => JSON.parse(JSON.stringify(ctx.computeWorkspaceChanges(a, b)));
const base = { customers: [{ id: 'C1', name: 'Ann', tags: ['a'] }, { id: 'C2', name: 'Bob' }, { id: 'C3', name: 'Cat' }], brands: ['X'], companySettings: { name: 'PB' } };
const clone = v => JSON.parse(JSON.stringify(v));

// Nothing changed (field order differs, as it does for server copies): nothing sent.
assert.deepEqual(diff(base, { companySettings: { name: 'PB' }, brands: ['X'], customers: [{ tags: ['a'], name: 'Ann', id: 'C1' }, { name: 'Bob', id: 'C2' }, { id: 'C3', name: 'Cat' }] }).sections, []);

// One edited record: only that record, no key list.
{ const b = clone(base); b.customers[1].name = 'Bobby';
  assert.deepEqual(diff(base, b).sections, [{ s: 'customers', kind: 'list', upserts: [['id:C2', { id: 'C2', name: 'Bobby' }]], deletes: [], order: null }]); }

// Deleted record: only the key, no key list.
{ const b = clone(base); b.customers.splice(1, 1);
  assert.deepEqual(diff(base, b).sections, [{ s: 'customers', kind: 'list', upserts: [], deletes: ['id:C2'], order: null }]); }

// Appended record: the record only, no key list.
{ const b = clone(base); b.customers.push({ id: 'C4' });
  assert.deepEqual(diff(base, b).sections[0].order, null); assert.deepEqual(diff(base, b).sections[0].upserts, [['id:C4', { id: 'C4' }]]); }

// Inserted at the top or moved: key list sent.
{ const b = clone(base); b.customers.unshift({ id: 'C0' });
  assert.deepEqual(diff(base, b).sections[0].order, ['id:C0', 'id:C1', 'id:C2', 'id:C3']); }
{ const b = clone(base); b.customers.reverse();
  const s = diff(base, b).sections[0]; assert.deepEqual(s.upserts, []); assert.deepEqual(s.order, ['id:C3', 'id:C2', 'id:C1']); }

// Settings object and new section.
{ const b = clone(base); b.companySettings.name = 'Pool Bros'; b.newList = [{ id: 'N1' }];
  const s = diff(base, b).sections;
  assert.deepEqual(s.find(x => x.s === 'companySettings'), { s: 'companySettings', kind: 'settings', data: { name: 'Pool Bros' } });
  assert.deepEqual(s.find(x => x.s === 'newList').upserts, [['id:N1', { id: 'N1' }]]); }

// Cases the per-record path refuses (the app then uses the full save).
assert.throws(() => ctx.computeWorkspaceChanges(base, { customers: base.customers, brands: base.brands }), /removed/);
assert.throws(() => ctx.computeWorkspaceChanges(base, Object.assign(clone(base), { misc: [{ colour: 'red' }] })), /stable key/);
assert.throws(() => ctx.computeWorkspaceChanges(base, Object.assign(clone(base), { brands: { a: 1 } })), /type changed/);

// The save path tries per-record first and keeps the full save as the fallback.
const save = src.slice(src.indexOf('async function saveRemoteWorkspace('), src.indexOf('let workspaceRefreshInFlight = false;'));
assert(/saveWorkspaceRecords\(localSnapshot\)/.test(save) && /rpc\("ps_workspace_save", \{/.test(save), 'per-record first, full save as fallback');
console.log('Per-record save v1.49 behaviour test passed.');

// saveRemoteWorkspace with per-record saves: saved, clash, nothing to send, and fallback to the full save.
{
  const block = src.slice(src.indexOf('      async function saveRemoteWorkspace('), src.indexOf('      async function refreshSharedWorkspaceFromRemote(', src.indexOf('      async function saveRemoteWorkspace(')));
  const run = async ({ local, raw, reply }) => {
    const store = new Map(), calls = [];
    const st = {
      data: local, workspaceBaseSnapshot: clone(raw), workspaceRemoteRaw: raw, workspaceLocalRevisionCounter: 1,
      remoteWorkspaceUpdatedAt: 'R1', workspaceSaveInFlight: false, workspaceSyncConflict: false, sharedWorkspaceReady: true,
      supabaseClient: { async rpc(name, args) { calls.push(name); return reply(name, args); } },
      supabaseSession: { user: { id: 'U1' } }, navigator: { onLine: true }, WORKSPACE_ID: 'pool-bros-main',
      localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
      normalizeAppData: v => v, clone, writeOfflineSnapshot: async () => true, queueRemoteWorkspaceSave() {}, updateOfflineStatus() {},
      resolveSharedWorkspaceConflict: async () => false, toast() {}, render() {}, console: { warn() {}, log() {} },
      crypto: globalThis.crypto, TextEncoder, structuredClone
    };
    st.window = st;
    vm.createContext(st); vm.runInContext(block, st);
    const ok = await st.saveRemoteWorkspace(false);
    return { ok, calls, st };
  };
  const raw = { customers: [{ id: 'C1', name: 'Ann' }, { id: 'C2', name: 'Bob' }] };
  const edited = clone(raw); edited.customers[1].name = 'Bobby';

  let r = await run({ local: edited, raw, reply: () => ({ data: { updated_at: 'R2', merged: false }, error: null }) });
  assert.equal(r.ok, true); assert.deepEqual(r.calls, ['ps_workspace_save_changes'], 'only the changed record is sent');
  assert.equal(r.st.remoteWorkspaceUpdatedAt, 'R2'); assert.deepEqual(JSON.parse(JSON.stringify(r.st.workspaceRemoteRaw)), edited, 'server copy now matches what was saved');

  r = await run({ local: clone(raw), raw, reply: () => { throw new Error('nothing should be sent'); } });
  assert.equal(r.ok, true); assert.deepEqual(r.calls, [], 'nothing changed: nothing sent');

  r = await run({ local: edited, raw, reply: () => ({ data: { conflicts: [{ s: 'customers', k: 'id:C2' }] }, error: null }) });
  assert.equal(r.ok, false); assert.equal(r.st.workspaceSyncConflict, true, 'a real clash goes to the existing clash handling');

  r = await run({ local: edited, raw, reply: name => name === 'ps_workspace_save_changes' ? { data: { fallback: true }, error: null } : { data: { updated_at: 'R3' }, error: null } });
  assert.equal(r.ok, true); assert.deepEqual(r.calls, ['ps_workspace_save_changes', 'ps_workspace_save'], 'switched off: full save as before');

  r = await run({ local: edited, raw, reply: name => name === 'ps_workspace_save_changes' ? { data: null, error: { message: 'boom' } } : { data: { updated_at: 'R4' }, error: null } });
  assert.deepEqual(r.calls, ['ps_workspace_save_changes', 'ps_workspace_save'], 'error: full save as before');
  console.log('Per-record save path in saveRemoteWorkspace passed.');
}
