import fs from 'node:fs';
import assert from 'node:assert/strict';

const app=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const recovery=fs.readFileSync('public/recovery.js','utf8');
const publish=fs.readFileSync('api/workspace-recovery-publish.js','utf8');
const access=fs.readFileSync('api/workspace-access.js','utf8');

assert(app.includes('/api/workspace-access?workspace='),'sign-in must enrol active staff into the shared workspace');
assert(app.includes('poolshed:v172:recoveryHold'),'recovery hold must block shared reads/writes');
assert(app.includes('stale-local-workspace-on-sign-in'),'stale browser state must be preserved as recovery');
assert(app.includes('.channel("pool-shed-workspace-'),'shared workspace must subscribe to realtime changes');
assert(app.includes('setInterval(function()'),'polling fallback must exist');
assert(app.includes('refreshSharedWorkspaceFromRemote({ silent: true })'),'polling/online refresh must use the shared master');

const loadStart=app.indexOf('      async function loadRemoteWorkspace()');
const saveStart=app.indexOf('      async function saveRemoteWorkspace(',loadStart);
assert(loadStart>=0&&saveStart>loadStart,'workspace load/save functions must exist');
const load=app.slice(loadStart,saveStart);
assert(load.indexOf('from("workspace_snapshots").select("data,updated_at")')>=0,'load must read server first');
assert(load.includes('localBaseRevision && localBaseRevision === remoteRevision'),'pending local edits may upload only from the exact server base');
assert(!/return saveRemoteWorkspace\(true\);\s*if \(!supabaseClient/.test(load),'pending browser state must not upload before reading server');

const saveEnd=app.indexOf('      async function refreshSharedWorkspaceFromRemote',saveStart);
const save=app.slice(saveStart,saveEnd);
assert(save.includes('supabaseClient.rpc("ps_workspace_save"'),'all workspace saves must use revision-safe RPC');
assert(!save.includes('.from("workspace_snapshots").update('),'direct snapshot update fallback must not exist');
assert(!save.includes('.from("workspace_snapshots").insert('),'direct snapshot insert fallback must not exist');
assert(save.includes('Another user saved Pool Shed first'),'stale save conflict must preserve local work');

assert(access.includes("profile.role==='Admin'?'admin':'operator'"),'Admin must map to shared admin access');
assert(access.includes('ps_workspace_members'),'staff membership must be server-provisioned');

assert(publish.includes("profile.role!=='Admin'"),'only Admin can promote recovered workspace');
assert(publish.includes("ps_workspace_save"),'recovery publish must use versioned RPC');
assert(publish.includes('mergeImmutableLedger'),'recovery publish must preserve immutable receipt/putaway ledgers');
assert(!publish.includes("workspace_snapshots?workspace_id=eq.'+eq(WORKSPACE_ID),{method:'PATCH'"),'recovery publish must not directly overwrite snapshot');

assert(recovery.includes('Make this the shared master'),'recovery UI must expose explicit promotion');
assert(recovery.includes('Download backup JSON'),'recovery UI must keep downloadable backup');
assert(recovery.includes("localStorage.removeItem(HOLD_KEY)"),'sync hold may be removed only after successful publish');
assert(recovery.includes('/api/workspace-recovery-publish?workspace=pool-bros-main'),'publish must go through protected server endpoint');

console.log('PASS safe shared workspace: recovery hold, explicit promotion, revision history, server-first load, membership, realtime and stale-write protection');
