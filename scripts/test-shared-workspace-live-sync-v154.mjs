import fs from 'node:fs';
import assert from 'node:assert/strict';

const app=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const api=fs.readFileSync('api/workspace-access.js','utf8');

assert(app.includes('/api/workspace-access?workspace='),'sign-in must verify shared workspace membership');
assert(app.includes('stale-local-workspace-on-sign-in'),'stale local state must be preserved as recovery, not pushed over shared data');
assert(app.includes('poolshed:v172:recovery:'),'recovery copy must be retained for unsynced local work');
assert(app.includes('.channel("pool-shed-workspace-'),'shared workspace must subscribe to realtime changes');
assert(app.includes('.on("postgres_changes"'),'realtime must listen for database changes');
assert(app.includes('table: "workspace_snapshots"'),'realtime must subscribe to the shared snapshot');
assert(app.includes('refreshSharedWorkspaceFromRemote({ silent: true })'),'polling fallback must refresh the shared workspace');

const loadStart=app.indexOf('      async function loadRemoteWorkspace()');
const saveStart=app.indexOf('      async function saveRemoteWorkspace(',loadStart);
assert(loadStart>=0&&saveStart>loadStart,'workspace load/save functions must exist');
const load=app.slice(loadStart,saveStart);
const selectPos=load.indexOf('from("workspace_snapshots").select("data,updated_at")');
const savePos=load.indexOf('saveRemoteWorkspace(true)');
assert(selectPos>=0,'workspace load must read server snapshot');
assert(savePos>selectPos,'workspace load must read shared state before attempting a local upload');
assert(load.includes('localBaseRevision === remoteRevision'),'pending edits may upload only from the exact shared base revision');

assert(api.includes("profile.role==='Admin'?'admin':'operator'"),'Admin maps to shared admin and active staff map to operator');
assert(api.includes('ps_workspace_members'),'workspace membership must be provisioned server-side');
assert(api.includes('profile.active!==true'),'inactive accounts must be denied');
assert(api.includes('appOriginAllowed'),'membership mutation must enforce application origin');
assert(api.includes('supabaseServerKey'),'membership mutation must remain server-side');

console.log('PASS shared workspace membership, server-first loading, recovery safety, realtime refresh and polling fallback');
