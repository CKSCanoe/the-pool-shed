// v1.49 delta refresh: behaviour test.
// Runs the real refresh and delta functions from 01-legacy-01.js against a fake Supabase client.
// Proves: changed records are applied exactly; anything that does not line up falls back to the full download;
// the server copy is never mutated; a tab that is editing is never overwritten.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const source = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8');
const start = source.indexOf('      let workspaceRefreshInFlight = false;');
const end = source.indexOf('      function queueRemoteWorkspaceSave(', start);
assert(start > 0 && end > start, 'sync functions found');
const block = source.slice(start, end);

const sha = text => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const keysOf = (section, items, ctx) => ctx.workspaceSectionKeys(section, items);

function harness({ raw, feed, full }) {
  const calls = [];
  const applied = [];
  const store = new Map();
  const state = {
    remoteWorkspaceUpdatedAt: 'A',
    workspaceRemoteRaw: raw,
    workspaceSaveInFlight: false,
    workspacePollTimer: null,
    workspaceRealtimeChannel: null,
    editing: false,
    SHARED_WORKSPACE_CHECK_MS: 8000,
    WORKSPACE_ID: 'pool-bros-main',
    navigator: { onLine: true },
    document: { hidden: false },
    window: { crypto: globalThis.crypto },
    crypto: globalThis.crypto,
    TextEncoder,
    structuredClone,
    Map, Set, Array, Object, Number, String, Uint8Array, Error, Promise, JSON,
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    supabaseSession: { user: { id: 'U1' } },
    clone: v => JSON.parse(JSON.stringify(v)),
    supabaseClient: {
      async rpc(name, args) { calls.push(['rpc', name, args.since]); return typeof feed === 'function' ? feed() : { data: feed, error: null }; },
      from() {
        let columns = '';
        const q = {
          select(c) { columns = c; calls.push(['select', c]); return q; },
          eq() { return q; },
          async maybeSingle() {
            if (columns === 'updated_at') return { data: { updated_at: 'B' }, error: null };
            return { data: { updated_at: 'B', data: full }, error: null };
          }
        };
        return q;
      }
    },
    workspaceFieldIsBeingEdited() { return state.editing; },
    async applyRemoteWorkspaceSnapshot(row, render, rawData) { applied.push({ row, rawData }); state.remoteWorkspaceUpdatedAt = row.updated_at; state.workspaceRemoteRaw = rawData || null; },
    toast() {}, console: { warn() {}, log: console.log },
    setInterval() { return 1; }, clearInterval() {}
  };
  vm.createContext(state);
  vm.runInContext(block, state);
  return { state, calls, applied };
}

const raw = {
  customers: [{ id: 'C1', name: 'Ann' }, { id: 'C2', name: 'Bob' }],
  stock: [{ productId: 'P1', locationId: 'L1', qty: 1, allocated: 0 }],
  suppliers: [{ name: 'Acme' }, { name: 'Bolt' }],
  brands: ['Bayrol', 'Zodiac'],
  companySettings: { name: 'Pool Bros' }
};
const frozen = JSON.stringify(raw);

// The key rules must match the server (database/015 ps_section_items).
{
  const h = harness({ raw, feed: null, full: raw });
  assert.deepEqual([...keysOf('customers', raw.customers, h.state)], ['id:C1', 'id:C2']);
  assert.deepEqual([...keysOf('stock', raw.stock, h.state)], ['stock:P1|L1']);
  assert.deepEqual([...keysOf('suppliers', raw.suppliers, h.state)], ['name:Acme', 'name:Bolt']);
  assert.deepEqual([...keysOf('brands', ['X', 'X', 'Y'], h.state)], ['text:X', 'text:X#2', 'text:Y']);
  assert.throws(() => keysOf('misc', [{ colour: 'red' }], h.state), /stable key/, 'records without a stable key force a full download');
}

// 1. One edited customer + a setting: applied exactly, raw untouched, no full download.
{
  const expected = JSON.parse(frozen);
  expected.customers[1].name = 'Bobby';
  expected.companySettings = { name: 'Pool Bros Ltd' };
  const feed = { updated_at: 'B', sections: [
    { s: 'customers', kind: 'list', keys: null, keys_sha: sha('id:C1\nid:C2'), records: [['id:C2', { id: 'C2', name: 'Bobby' }]] },
    { s: 'companySettings', kind: 'settings', data: { name: 'Pool Bros Ltd' } }
  ] };
  const h = harness({ raw, feed, full: null });
  assert.equal(await h.state.refreshSharedWorkspaceFromRemote({ silent: true }), true);
  assert.deepEqual(h.calls.map(c => c[0] + ':' + c[1]), ['select:updated_at', 'rpc:ps_records_changes']);
  assert.equal(h.calls[1][2], 'A', 'asks for changes since the revision it holds');
  assert.deepEqual(JSON.parse(JSON.stringify(h.applied[0].row.data)), expected);
  assert.equal(JSON.stringify(raw), frozen, 'server copy never mutated');
  assert.notEqual(h.applied[0].row.data, h.applied[0].rawData, 'the app gets its own copy to normalise');
}

// 2. Added and removed records with a new key list.
{
  const feed = { updated_at: 'B', sections: [
    { s: 'customers', kind: 'list', keys: ['id:C3', 'id:C1'], keys_sha: sha('id:C3\nid:C1'), records: [['id:C3', { id: 'C3', name: 'Cat' }]] },
    { s: 'brands', kind: 'absent' }
  ] };
  const h = harness({ raw, feed, full: null });
  assert.equal(await h.state.refreshSharedWorkspaceFromRemote({ silent: true }), true);
  const got = h.applied[0].row.data;
  assert.deepEqual(got.customers.map(c => c.id), ['C3', 'C1']);
  assert.equal('brands' in got, false);
}

// 3. Fallbacks: each of these must download in full, exactly as before v1.49.
const fallbackCases = {
  'feed disabled': { full: true, reason: 'disabled' },
  'rpc error': () => ({ data: null, error: { message: 'function missing' } }),
  'order check mismatch': { updated_at: 'B', sections: [{ s: 'customers', kind: 'list', keys: null, keys_sha: 'bad', records: [] }] },
  'unknown record without key list': { updated_at: 'B', sections: [{ s: 'customers', kind: 'list', keys: null, keys_sha: sha('id:C1\nid:C2'), records: [['id:C9', { id: 'C9' }]] }] },
  'key list names a missing record': { updated_at: 'B', sections: [{ s: 'customers', kind: 'list', keys: ['id:C1', 'id:C7'], keys_sha: sha('id:C1\nid:C7'), records: [] }] }
};
for (const [label, feed] of Object.entries(fallbackCases)) {
  const fullData = { customers: [{ id: 'C1' }] };
  const h = harness({ raw, feed, full: fullData });
  assert.equal(await h.state.refreshSharedWorkspaceFromRemote({ silent: true }), true, label);
  assert.deepEqual(h.calls.map(c => c[1]), ['updated_at', 'ps_records_changes', 'data,updated_at'], label + ': full download');
  assert.equal(h.applied[0].row.data, fullData, label);
  assert.equal(JSON.stringify(raw), frozen, label + ': server copy never mutated');
}

// 4. No exact server copy (e.g. restored offline): straight to the full download, no feed call.
{
  const h = harness({ raw: null, feed: null, full: { customers: [] } });
  await h.state.refreshSharedWorkspaceFromRemote({ silent: true });
  assert.deepEqual(h.calls.map(c => c[1]), ['updated_at', 'data,updated_at']);
}

// 5. The user starts typing while the feed is in flight: nothing is applied.
{
  const feed = { updated_at: 'B', sections: [] };
  let h;
  h = harness({ raw, feed: () => { h.state.editing = true; return { data: feed, error: null }; }, full: null });
  assert.equal(await h.state.refreshSharedWorkspaceFromRemote({ silent: true }), false);
  assert.equal(h.applied.length, 0, 'never overwrite a tab mid-edit');
}

console.log('Delta refresh v1.49 behaviour test passed.');
