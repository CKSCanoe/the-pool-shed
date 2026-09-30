import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(p,'utf8');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const html=read('public/index.html');
const host=read('public/azzy-jarvis-host.js');
const css=read('public/azzy-jarvis.css');
const automation=read('public/automation-command-workspace.js');
const api=read('api/azzy.js');
const backend=read('server/azzy-pool-shed.js');
const sw=read('public/service-worker.js');

for(const retired of ['public/assistant-engine.js','public/azzy-live.js','public/azzy-live.css']) assert.equal(fs.existsSync(retired),false,`${retired} must be physically removed`);
assert.match(html,/azzy-jarvis-host\.js\?v=1\.45\.1/);
assert.doesNotMatch(html,/assistant-engine|azzy-live/);
assert.match(sw,/azzy-jarvis-host\.js\?v=1\.45\.1/);
assert.match(sw,/azzy-jarvis\.css\?v=1\.45\.1/);
assert.doesNotMatch(sw,/assistant-engine|azzy-live/);

assert.match(host,/attachShadow\(\{mode:'open'\}\)/,'Azzy must be visually isolated in Shadow DOM');
for(const token of ['Woof woof','Talking about','Needs you','History','Ask Azzy…','azzy-jarvis.png','PoolShedAzzyJarvis','newChatBtn','historyNewChatBtn','new-conversation','open-conversation','authSessionId','Pool Shed mode','conversationList']) assert(host.includes(token),`missing finished Azzy UI token: ${token}`);
assert.ok(sha('public/azzy-jarvis.css').length===64,'Azzy stylesheet must remain a valid tracked asset');
assert.match(css,/--red:#c91f32/);assert.match(css,/\.azzy-panel\{/);assert.match(css,/\.message\.user \.bubble\{background:#202630/);assert.match(css,/\.conversation-item/);assert.match(css,/\.new-chat-btn/);assert.match(css,/\.azzy-status i\.core/);
assert.doesNotMatch(automation,/PoolShedAssistantEngine|azzyFloating|assistantMode|Find Anything|Guide Me|Training/);
assert.match(automation,/PoolShedAzzyJarvis/);
assert.match(api,/action==='context'/);assert.match(api,/action==='new-conversation'/);assert.match(api,/action==='open-conversation'/);assert.match(api,/safeMemory/);assert.match(api,/ensureLoginConversation/);assert.match(api,/approveAzzyActionFromPoolShed/);assert.doesNotMatch(api,/previewMode|read-only Preview|executionEnabled:false/);
assert.match(backend,/actions\.prepare/);assert.match(backend,/actions\.approve/);assert.match(backend,/r\.status===401\|\|r\.status===403/);assert.doesNotMatch(backend,/Preview rollout/);

const runtimeRoots=['public','api','server'];
const retiredTerms=['PoolShedAssistantEngine','assistant-engine.js','azzy-live.js','azzy-live.css','Read-only Preview','Secure workspace unavailable','Writes disabled in Preview'];
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of runtimeRoots.flatMap(walk).filter(f=>/\.(js|css|html|mjs)$/.test(f))){const src=read(file);for(const term of retiredTerms)assert.equal(src.includes(term),false,`retired Azzy term ${term} remains in ${file}`);}
assert.doesNotThrow(()=>new Function(host),'Azzy browser host must parse after chat-session changes');
console.log('PASS Azzy Jarvis: Shadow DOM, live Pool Shed paths, fresh chats, history and resilient core-mode UI retained');
