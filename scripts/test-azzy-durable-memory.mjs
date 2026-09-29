import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.env.AZZY_MEMORY_MODE='external';
const url=pathToFileURL(path.join(root,'server/azzy/src/core/memory.js')).href+`?test=${Date.now()}`;
const {memory}=await import(url);

const user='11111111-1111-1111-1111-111111111111';
memory.addMessage(user,'user','Hello');
memory.addMessage(user,'assistant','Hi Aaron');
memory.addDecision(user,{text:'Do not order until approved',contexts:[{type:'project',id:'PRJ-1'}]});
memory.saveAction({id:'ACT-1',type:'draft_po',requestedBy:user,status:'prepared'});
memory.audit(user,'answer','Answered','Test');
const exported=memory.exportUserState(user);
assert.equal(exported.session.history.length,2);
assert.equal(exported.session.decisions.length,1);
assert.equal(exported.actions['ACT-1'].status,'prepared');
assert.equal(exported.audit.length,1);
memory.clearUserState(user);
assert.equal(memory.session(user).history.length,0);
memory.replaceUserState(user,exported);
assert.equal(memory.session(user).history[1].text,'Hi Aaron');
assert.equal(memory.getAction('ACT-1').requestedBy,user);
assert.equal(memory.auditFor(user).length,1);

const previousMode=process.env.AZZY_MEMORY_MODE,previousVercel=process.env.VERCEL,previousFile=process.env.AZZY_MEMORY_FILE;
const serverlessFile=path.join(root,'runtime','memory-serverless-test.json');
try{fs.rmSync(serverlessFile,{force:true});}catch{}
process.env.AZZY_MEMORY_MODE='file';process.env.VERCEL='1';process.env.AZZY_MEMORY_FILE=serverlessFile;
const serverlessUrl=pathToFileURL(path.join(root,'server/azzy/src/core/memory.js')).href+`?serverless=${Date.now()}`;
const {memory:serverlessMemory}=await import(serverlessUrl);
serverlessMemory.addMessage(user,'user','Serverless write guard');
assert.equal(fs.existsSync(serverlessFile),false);
if(previousMode===undefined)delete process.env.AZZY_MEMORY_MODE;else process.env.AZZY_MEMORY_MODE=previousMode;
if(previousVercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=previousVercel;
if(previousFile===undefined)delete process.env.AZZY_MEMORY_FILE;else process.env.AZZY_MEMORY_FILE=previousFile;

const migration=fs.readFileSync(path.join(root,'database/012-azzy-memory.sql'),'utf8');
assert.match(migration,/create table if not exists public\.ps_azzy_memory/i);
assert.match(migration,/revoke all on public\.ps_azzy_memory from public, anon, authenticated/i);
assert.match(migration,/grant all on public\.ps_azzy_memory to service_role/i);
assert.doesNotMatch(migration,/ps_workspace_can_read/i);
const memoryServer=fs.readFileSync(path.join(root,'server/azzy-memory.js'),'utf8');
assert.match(memoryServer,/raw=await r\.text\(\)/);
assert.match(memoryServer,/if\(!raw\.trim\(\)\)return null/);
assert.match(memoryServer,/SUPABASE_SERVICE_ROLE_KEY/);
assert.match(memoryServer,/authenticated Pool Shed request/);
assert.doesNotMatch(memoryServer,/SUPABASE_PUBLISHABLE_KEY|SUPABASE_ANON_KEY/);
const api=fs.readFileSync(path.join(root,'api/azzy.js'),'utf8');
assert.match(api,/hydrateAzzyMemory/);
assert.match(api,/persistAzzyMemory/);
console.log('Azzy durable per-user memory: PASS');
