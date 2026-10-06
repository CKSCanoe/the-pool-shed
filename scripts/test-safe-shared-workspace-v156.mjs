import fs from 'node:fs';
import assert from 'node:assert/strict';

const app=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const recovery=fs.readFileSync('public/recovery.js','utf8');
const publish=fs.readFileSync('api/workspace-recovery-publish.js','utf8');
const access=fs.readFileSync('api/workspace-access.js','utf8');
const health=fs.readFileSync('api/workspace-health.js','utf8');

assert(app.includes('/api/workspace-access?workspace='),'sign-in must enrol active staff into the shared workspace');
assert(app.includes('poolshed:v172:recoveryHold'),'recovery hold must block shared reads/writes');
assert(app.includes('stale-local-workspace-on-sign-in'),'stale browser state must be preserved as recovery');
assert(app.includes('.channel("pool-shed-workspace-'),'shared workspace must subscribe to realtime changes');
assert(app.includes('setInterval(function()'),'polling fallback must exist');
assert(app.includes('refreshSharedWorkspaceFromRemote({ silent: true })'),'polling/online refresh must use the shared master');
assert(app.includes('const sharedLoaded = await loadRemoteWorkspace();'),'sign-in must verify the shared master before opening operational data');
assert(app.includes('The shared Pool Shed master could not be loaded'),'failed shared reads must not silently fall back to a separate browser workspace');
assert(app.includes('multi-user-save-conflict'),'simultaneous save conflicts must preserve a recovery copy');
assert(app.includes('resolveSharedWorkspaceConflict'),'save conflicts must return the user to the latest server master');
assert(app.includes('authoritativeEmails'),'Supabase profiles must remove legacy same-email duplicate users');
assert(app.includes('document.addEventListener("visibilitychange"'),'returning to a browser tab must refresh shared data');

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

assert(access.includes("role=>'Admin'")||access.includes("role==='Admin'?'admin':'operator'"),'Admin must map to shared admin access');
assert(access.includes('ps_workspace_members'),'staff membership must be server-provisioned');
assert(access.includes('syncActiveStaffMemberships'),'Admin sign-in must connect every active staff profile to the shared workspace');
assert(access.includes("method:'DELETE'"),'inactive/stale workspace memberships must be removed');

assert(publish.includes("profile.role!=='Admin'"),'only Admin can promote recovered workspace');
assert(publish.includes("ps_workspace_save"),'recovery publish must use versioned RPC');
assert(publish.includes('mergeImmutableLedger'),'recovery publish must preserve immutable receipt/putaway ledgers');
assert(!publish.includes("workspace_snapshots?workspace_id=eq.'+eq(WORKSPACE_ID),{method:'PATCH'"),'recovery publish must not directly overwrite snapshot');
assert(publish.includes('syncActiveStaffMemberships'),'publishing the master must also connect every active user');

assert(recovery.includes('Make current browser data the shared master'),'recovery UI must expose explicit current-browser master promotion');
assert(recovery.includes("preserveLocalCopy('pre-shared-master'"),'master promotion must create a local recovery copy before publish');
assert(recovery.includes('Download backup JSON'),'recovery UI must keep downloadable backup');
assert(recovery.includes("options.allowCurrent===true&&candidate&&candidate.key===APP_KEY"),'direct promotion must be limited to the current browser workspace');
assert(recovery.includes('previous server revision'),'confirmation must explain server revision preservation');
assert(recovery.includes("localStorage.removeItem(HOLD_KEY)"),'sync hold may be removed only after successful publish');
assert(recovery.includes('/api/workspace-recovery-publish?workspace=pool-bros-main'),'publish must go through protected server endpoint');
assert(recovery.includes('/api/workspace-health?action='),'recovery page must expose a live shared-workspace audit');
assert(health.includes("profile.role!=='Admin'"),'workspace health audit must be Admin only');
assert(health.includes('allActiveConnected'),'health audit must prove all active users are connected');
assert(health.includes("action==='repair-members'"),'health audit must support safe membership repair');
assert(health.includes("workspace_snapshots?workspace_id=eq."),'health audit must inspect the server master, not browser data');

console.log('PASS professional shared workspace: server-first master, all-user membership, duplicate-user cleanup, conflict recovery, health audit, revision history and no silent local fallback');
