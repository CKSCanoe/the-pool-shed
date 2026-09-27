import http from 'node:http';
import net from 'node:net';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const freePort=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const ollamaPort=await freePort(),gatewayPort=await freePort();
const token='test-token-that-is-long-enough-123456789';

const mock=http.createServer(async(req,res)=>{
  if(req.method==='GET'&&req.url==='/api/tags'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({models:[{name:'qwen3:8b'},{name:'not-allowed:latest'}]}));}
  if(req.method==='POST'&&req.url==='/api/chat'){
    let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw||'{}');
    if(body.stream){res.setHeader('content-type','application/x-ndjson');res.write(JSON.stringify({message:{content:'Hello '}})+'\n');res.write(JSON.stringify({message:{content:'Aaron'}})+'\n');return res.end();}
    res.setHeader('content-type','application/json');return res.end(JSON.stringify({message:{content:'Hello Aaron'}}));
  }
  res.statusCode=404;res.end();
});
await new Promise(resolve=>mock.listen(ollamaPort,'127.0.0.1',resolve));

const child=spawn(process.execPath,[path.join(root,'azzy-brain-gateway/server.mjs')],{
  cwd:root,
  env:{...process.env,AZZY_GATEWAY_HOST:'127.0.0.1',AZZY_GATEWAY_PORT:String(gatewayPort),AZZY_GATEWAY_TOKEN:token,OLLAMA_URL:`http://127.0.0.1:${ollamaPort}`,AZZY_ALLOWED_MODELS:'qwen3:8b'},
  stdio:['ignore','pipe','pipe']
});
let stderr='';child.stderr.on('data',d=>stderr+=d);

async function wait(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${gatewayPort}/health`,{headers:{Authorization:`Bearer ${token}`}});if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}throw new Error(`Gateway did not start: ${stderr}`);}
await wait();
try{
  let r=await fetch(`http://127.0.0.1:${gatewayPort}/health`);assert.equal(r.status,401);
  r=await fetch(`http://127.0.0.1:${gatewayPort}/health`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(r.status,200);let j=await r.json();assert.deepEqual(j.models,['qwen3:8b']);
  r=await fetch(`http://127.0.0.1:${gatewayPort}/api/tags`,{headers:{Authorization:`Bearer ${token}`}});j=await r.json();assert.deepEqual(j.models.map(x=>x.name),['qwen3:8b']);
  r=await fetch(`http://127.0.0.1:${gatewayPort}/api/chat`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({model:'not-allowed:latest',messages:[]})});assert.equal(r.status,403);
  r=await fetch(`http://127.0.0.1:${gatewayPort}/api/chat`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({model:'qwen3:8b',messages:[{role:'user',content:'Hi'}],stream:false})});assert.equal((await r.json()).message.content,'Hello Aaron');
  r=await fetch(`http://127.0.0.1:${gatewayPort}/api/chat`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({model:'qwen3:8b',messages:[{role:'user',content:'Hi'}],stream:true})});const stream=await r.text();assert.match(stream,/Hello/);assert.match(stream,/Aaron/);
  process.env.AZZY_OLLAMA_URL=`http://127.0.0.1:${gatewayPort}`;process.env.AZZY_OLLAMA_TOKEN=token;process.env.AZZY_OLLAMA_MODEL='qwen3:8b';
  const client=await import(pathToFileURL(path.join(root,'server/azzy/src/local-ai/ollama.js')).href+`?gateway=${Date.now()}`);
  const h=await client.health({force:true});assert.equal(h.connected,true);assert.equal(h.model,'qwen3:8b');
  const narrated=await client.narrateWithLocalModel({model:'qwen3:8b',user:{name:'Aaron'},message:'Hi',intent:'social',facts:[],previousAnswer:null,draftAnswer:'Hi',contexts:[],primaryContext:null,history:[],unchanged:false,decisions:[],deltas:[]});assert.equal(narrated.answer,'Hello Aaron');
  console.log('Azzy brain gateway + hosted client auth: PASS');
}finally{child.kill('SIGTERM');mock.close();}
