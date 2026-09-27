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
assert.match(html,/azzy-jarvis-host\.js\?v=1\.45\.1-jarvis-final/);
assert.doesNotMatch(html,/assistant-engine|azzy-live/);
assert.match(sw,/azzy-jarvis-host\.js\?v=1\.45\.1-jarvis-final/);
assert.match(sw,/azzy-jarvis\.css\?v=1\.45\.1-jarvis-final/);
assert.doesNotMatch(sw,/assistant-engine|azzy-live/);

assert.match(host,/attachShadow\(\{mode:'open'\}\)/,'Azzy must be visually isolated in Shadow DOM');
for(const token of ['Woof woof','Talking about','Needs you','History','Ask Azzy…','azzy-jarvis.png','PoolShedAzzyJarvis']) assert(host.includes(token),`missing finished Azzy UI token: ${token}`);
assert.equal(sha('public/azzy-jarvis.css'),'4720322244dcb3c0647a444419e787cd8ef96b4e78a849d3d659eca3d0bc52d3','Azzy CSS must remain the exact uploaded visual foundation transformed only for Shadow DOM host scoping');
assert.match(css,/--red:#c91f32/);assert.match(css,/\.azzy-panel\{/);assert.match(css,/\.message\.user \.bubble\{background:#202630/);
assert.doesNotMatch(automation,/PoolShedAssistantEngine|azzyFloating|assistantMode|Find Anything|Guide Me|Training/);
assert.match(automation,/PoolShedAzzyJarvis/);
assert.match(api,/action==='context'/);assert.match(api,/approveAzzyActionFromPoolShed/);assert.doesNotMatch(api,/previewMode|read-only Preview|executionEnabled:false/);
assert.match(backend,/actions\.prepare/);assert.match(backend,/actions\.approve/);assert.doesNotMatch(backend,/Preview rollout/);

const runtimeRoots=['public','api','server'];
const retiredTerms=['PoolShedAssistantEngine','assistant-engine.js','azzy-live.js','azzy-live.css','Read-only Preview','Secure workspace unavailable','Writes disabled in Preview'];
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of runtimeRoots.flatMap(walk).filter(f=>/\.(js|css|html|mjs)$/.test(f))){const src=read(file);for(const term of retiredTerms)assert.equal(src.includes(term),false,`retired Azzy term ${term} remains in ${file}`);}
console.log('PASS exact Azzy Jarvis transplant: old assistant removed, uploaded CSS preserved, Shadow DOM isolation, live API/context/action paths retained');
