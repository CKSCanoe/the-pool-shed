// v1.48 egress fix: behaviour test for the shared-workspace sync.
// Runs the real refresh/live-sync functions from 01-legacy-01.js against a fake Supabase client
// and counts what would be downloaded.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8');
const start = source.indexOf('      let workspaceRefreshInFlight = false;');
const end = source.indexOf('      function queueRemoteWorkspaceSave(', start);
assert(start > 0 && end > start, 'sync functions found');
const block = source.slice(start, end);
const intervalMatch = source.match(/const SHARED_WORKSPACE_CHECK_MS = (\d+);/);
assert(intervalMatch, 'check interval constant exists');
const CHECK_MS = Number(intervalMatch[1]);

assert(!/postgres_changes/.test(block), 'no realtime subscription that pushes the full row');
assert(!/setInterval\([^]*?,\s*5000\)/.test(block), 'old 5 s full-download poll removed');

function harness() {
  const selects = [];
  const applied = [];
  const timers = [];
  let remoteStamp = '2026-11-19T20:00:00Z';
  const store = new Map();
  const state = {
    remoteWorkspaceUpdatedAt: '2026-11-19T20:00:00Z',
    workspaceRemoteRaw: null,
    clone: v => JSON.parse(JSON.stringify(v)),
    workspaceSaveInFlight: false,
    workspacePollTimer: null,
    workspaceRealtimeChannel: null,
    editing: false,
    SHARED_WORKSPACE_CHECK_MS: CHECK_MS,
    WORKSPACE_ID: 'pool-bros-main',
    navigator: { onLine: true },
    document: { hidden: false },
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    supabaseSession: { user: { id: 'U1' } },
    supabaseClient: {
      channel() { throw new Error('realtime channel must not be opened'); },
      removeChannel() {},
      from(table) {
        assert.equal(table, 'workspace_snapshots');
        let columns = '';
        const q = {
          select(cols) { columns = cols; selects.push(cols); return q; },
          eq() { return q; },
          async maybeSingle() {
            if (columns === 'updated_at') return { data: { updated_at: remoteStamp }, error: null };
            return { data: { updated_at: remoteStamp, data: { customers: [] } }, error: null };
          }
        };
        return q;
      }
    },
    workspaceFieldIsBeingEdited() { return state.editing; },
    async applyRemoteWorkspaceSnapshot(row) { applied.push(row.updated_at); state.remoteWorkspaceUpdatedAt = row.updated_at; },
    toast() {},
    console,
    setInterval(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    clearInterval() {}
  };
  vm.createContext(state);
  vm.runInContext(block, state);
  return { state, selects, applied, timers, setRemote: s => { remoteStamp = s; } };
}

// 1. Nothing changed: only the tiny revision stamp is requested.
{
  const h = harness();
  assert.equal(await h.state.refreshSharedWorkspaceFromRemote({ silent: true }), false);
  assert.deepEqual(h.selects, ['updated_at'], 'unchanged revision downloads no workspace data');
}

// 2. Another user saved: data downloaded exactly once and applied.
{
  const h = harness();
  h.setRemote('2026-11-19T21:00:00Z');
  assert.equal(await h.state.refreshSharedWorkspaceFromRemote({ silent: true }), true);
  assert.deepEqual(h.selects, ['updated_at', 'data,updated_at']);
  assert.deepEqual(h.applied, ['2026-11-19T21:00:00Z']);
  // A second check after applying is cheap again.
  await h.state.refreshSharedWorkspaceFromRemote({ silent: true });
  assert.deepEqual(h.selects.slice(2), ['updated_at']);
}

// 3. Newer revision exists but the user is typing: never overwrite mid-edit, never download.
{
  const h = harness();
  h.setRemote('2026-11-19T21:00:00Z');
  h.state.editing = true;
  assert.equal(await h.state.refreshSharedWorkspaceFromRemote({ silent: true }), false);
  assert.equal(h.selects.filter(s => s.includes('data')).length, 0);
}

// 4. Live sync: no realtime channel; the timer does nothing while the tab is hidden.
{
  const h = harness();
  h.state.startSharedWorkspaceLiveSync();
  assert.equal(h.timers.length, 1, 'one revision-check timer');
  assert(h.timers[0].ms >= 5000, 'check interval is not faster than before');
  h.state.document.hidden = true;
  h.timers[0].fn();
  await new Promise(r => setImmediate(r));
  assert.equal(h.selects.length, 0, 'hidden tab makes no requests');
}

// 5. Egress budget: one idle hour with no changes downloads the workspace zero times.
{
  const h = harness();
  h.state.startSharedWorkspaceLiveSync();
  const ticks = Math.floor(3600000 / h.timers[0].ms);
  for (let i = 0; i < ticks; i += 1) { h.timers[0].fn(); await new Promise(r => setImmediate(r)); }
  const full = h.selects.filter(s => s.includes('data')).length;
  assert.equal(full, 0, 'idle hour: zero full downloads (was 720 with the 5 s full poll)');
  assert.equal(h.selects.length, ticks, 'one stamp check per tick');
  console.log(`idle hour: ${ticks} revision checks, ${full} full downloads (before v1.48: 720 full downloads)`);
}

// 6. Focus + online + timer firing together: only one download.
{
  const h = harness();
  h.setRemote('2026-11-19T21:00:00Z');
  await Promise.all([1, 2, 3].map(() => h.state.refreshSharedWorkspaceFromRemote({ silent: true })));
  assert.equal(h.selects.filter(s => s.includes('data')).length, 1, 'simultaneous refreshes download once');
}

// 7. Stock-count reminders: one open reminder per alert, not a new copy (and a full save) every day.
{
  const engine = fs.readFileSync('public/inventory-control-engine.js', 'utf8');
  const g = { notifications: [], saves: 0 };
  const ctx = { console, Date };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(engine, ctx);
  const api = ctx.PoolShedInventoryControl || ctx.window.PoolShedInventoryControl;
  if (api && typeof api.ensureReminders === 'function') {
    ctx.__POOL_SHED_GET_DATA__ = () => g;
    ctx.saveAppData = () => { g.saves += 1; };
    const fake = [{ id: 'COUNT:L-WH-MAIN', severity: 'warning', title: 'Stock count due', locationId: 'L-WH-MAIN', reason: 'r', action: 'a' }];
    const src = engine.match(/function ensureReminders\(opts\)\{[^]*?return added;\}/)[0];
    const run = new Function('store', 'alerts', 'global', src + '; return ensureReminders;')(() => g, () => fake, ctx);
    assert.equal(run({ today: '2026-11-19' }), 1, 'first day adds the reminder');
    assert.equal(run({ today: '2026-11-19' }), 0, 'same day: no duplicate');
    assert.equal(run({ today: '2026-11-20' }), 0, 'next day: still open, no duplicate and no save');
    g.notifications[0].archived = true;
    assert.equal(run({ today: '2026-11-21' }), 1, 'after it is dealt with, a new reminder may be raised');
    assert.equal(g.saves, 2, 'only real changes trigger a save');
  } else {
    throw new Error('PoolShedInventoryControl.ensureReminders not found');
  }
}

console.log('Egress sync v1.48 behaviour test passed.');
