import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';

const HOST = process.env.AZZY_GATEWAY_HOST || '127.0.0.1';
const PORT = Number(process.env.AZZY_GATEWAY_PORT || 8787);
const OLLAMA_URL = String(process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/,'');
const TOKEN = String(process.env.AZZY_GATEWAY_TOKEN || '');
const ALLOWED_MODELS = new Set(String(process.env.AZZY_ALLOWED_MODELS || 'qwen3:8b').split(',').map(v=>v.trim()).filter(Boolean));
const MAX_BODY = Number(process.env.AZZY_GATEWAY_MAX_BODY || 1_000_000);
const REQUEST_TIMEOUT_MS = Number(process.env.AZZY_GATEWAY_TIMEOUT_MS || 45_000);
const MAX_CONCURRENT = Math.max(1, Number(process.env.AZZY_GATEWAY_MAX_CONCURRENT || 2));
let active = 0;
const queue = [];

if (!TOKEN || TOKEN.length < 24) {
  console.error('AZZY_GATEWAY_TOKEN must be set to a strong secret of at least 24 characters.');
  process.exit(1);
}

function secureEqual(a,b){
  const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||''));
  return aa.length===bb.length && timingSafeEqual(aa,bb);
}
function bearer(req){
  const h=String(req.headers.authorization||'');
  return h.startsWith('Bearer ')?h.slice(7):'';
}
function securityHeaders(res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
}
function json(res,status,payload){
  securityHeaders(res);res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify(payload));
}
function acquire(){
  if(active<MAX_CONCURRENT){active++;return Promise.resolve();}
  return new Promise(resolve=>queue.push(resolve)).then(()=>{active++;});
}
function release(){active=Math.max(0,active-1);const next=queue.shift();if(next)next();}
async function readJson(req){
  const chunks=[];let size=0;
  for await (const chunk of req){size+=chunk.length;if(size>MAX_BODY)throw Object.assign(new Error('Request too large.'),{statusCode:413});chunks.push(chunk);}
  if(!chunks.length)return {};
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('Invalid JSON.'),{statusCode:400});}
}
function modelAllowed(model){return ALLOWED_MODELS.size===0 || ALLOWED_MODELS.has(String(model||''));}
async function upstream(path,options={}){
  const c=new AbortController();const t=setTimeout(()=>c.abort(),REQUEST_TIMEOUT_MS);
  try{return await fetch(`${OLLAMA_URL}${path}`,{...options,signal:c.signal});}finally{clearTimeout(t);}
}

const server=http.createServer(async(req,res)=>{
  const requestId=randomUUID();
  securityHeaders(res);
  res.setHeader('X-Azzy-Request-Id',requestId);

  if(req.method==='GET'&&req.url==='/health'){
    if(!secureEqual(bearer(req),TOKEN))return json(res,401,{ok:false,error:'Unauthorized'});
    try{
      const r=await upstream('/api/tags');
      if(!r.ok)return json(res,502,{ok:false,error:`Ollama unavailable (${r.status})`});
      const tags=await r.json();
      const models=(tags.models||[]).map(x=>x.name).filter(modelAllowed);
      return json(res,200,{ok:true,ollama:true,models,active,queued:queue.length});
    }catch(e){return json(res,502,{ok:false,error:e.name==='AbortError'?'Ollama timed out.':'Ollama unavailable.'});}
  }

  if(!secureEqual(bearer(req),TOKEN))return json(res,401,{ok:false,error:'Unauthorized'});

  if(req.method==='GET'&&req.url==='/api/tags'){
    try{
      const r=await upstream('/api/tags');
      if(!r.ok)return json(res,502,{error:`Ollama returned ${r.status}`});
      const data=await r.json();
      data.models=(data.models||[]).filter(m=>modelAllowed(m.name));
      return json(res,200,data);
    }catch(e){return json(res,502,{error:e.name==='AbortError'?'Ollama timed out.':'Ollama unavailable.'});}
  }

  if(req.method==='POST'&&req.url==='/api/chat'){
    let body;
    try{body=await readJson(req);}catch(e){return json(res,e.statusCode||400,{error:e.message});}
    if(!body?.model || !modelAllowed(body.model))return json(res,403,{error:'Model is not allowed by the Azzy gateway.'});
    if(!Array.isArray(body.messages))return json(res,400,{error:'messages[] is required.'});
    if(body.messages.length>40)return json(res,400,{error:'Too many chat messages.'});
    await acquire();
    try{
      const r=await upstream('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      if(!r.ok){const text=await r.text().catch(()=> '');return json(res,502,{error:`Ollama returned ${r.status}`,detail:text.slice(0,300)});}
      const contentType=r.headers.get('content-type')||'application/json';
      res.statusCode=200;res.setHeader('content-type',contentType);
      if(body.stream&&r.body){
        const reader=r.body.getReader();
        try{while(true){const {done,value}=await reader.read();if(done)break;res.write(Buffer.from(value));}}finally{reader.releaseLock();}
        return res.end();
      }
      return res.end(Buffer.from(await r.arrayBuffer()));
    }catch(e){return json(res,502,{error:e.name==='AbortError'?'Ollama timed out.':'Ollama unavailable.'});}
    finally{release();}
  }

  return json(res,404,{ok:false,error:'Not found'});
});

server.listen(PORT,HOST,()=>{
  console.log(`Azzy Brain Gateway listening on http://${HOST}:${PORT}`);
  console.log(`Proxying only approved Ollama routes to ${OLLAMA_URL}`);
  console.log(`Allowed model${ALLOWED_MODELS.size===1?'':'s'}: ${[...ALLOWED_MODELS].join(', ')||'all'}`);
});
