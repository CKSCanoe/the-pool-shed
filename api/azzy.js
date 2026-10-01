import {loadAzzyPoolShedContext,azzyOriginAllowed} from '../server/azzy-pool-shed.js';
import {
  askAzzyFromPoolShed,
  bootstrapAzzyForPoolShed,
  updateAzzyContextForPoolShed,
  markAzzyAttentionSeenForPoolShed,
  approveAzzyActionFromPoolShed,
  withPoolShedRuntime
} from '../server/azzy/integration/pool-shed-server-runtime.js';
import {recordView} from '../server/azzy/src/core/record-links.js';
import {snapshot as runtimeSnapshot,currentUser} from '../server/azzy/src/data/runtime-data.js';
import {hydrateAzzyMemory,persistAzzyMemory,azzyMemoryMode} from '../server/azzy-memory.js';
import {memory} from '../server/azzy/src/core/memory.js';

export const config={maxDuration:60};
const send=(res,status,value)=>{res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');return res.status(status).json(value);};
const bodyOf=req=>req.body&&typeof req.body==='object'?req.body:{};
const runtimeOpts=ctx=>({workspace:ctx.workspace,user:ctx.user,permissions:ctx.permissions,revision:ctx.revision,updatedAt:ctx.updatedAt});
const safeMemory=async(fn,label)=>{try{return {ok:true,...(await fn())};}catch(error){console.warn(`Azzy ${label} unavailable`,error?.message||error);return {ok:false,error:String(error?.message||error||'Memory unavailable')};}};

export default async function handler(req,res){
  const origin=process.env.APP_ORIGIN||'http://localhost',url=new URL(req.url,origin),action=url.searchParams.get('action')||'bootstrap';
  try{
    if(req.method==='OPTIONS'){res.setHeader('Allow','GET, POST, OPTIONS');return res.status(204).end();}
    if(req.method==='POST'&&!azzyOriginAllowed(req))return send(res,403,{ok:false,error:'Invalid origin. APP_ORIGIN must be the Pool Shed app origin, not the Azzy/Ollama gateway.'});
    const ctx=await loadAzzyPoolShedContext(req),opts=runtimeOpts(ctx);
    const memoryLoad=action==='record'?{ok:true,skipped:true}:await safeMemory(()=>hydrateAzzyMemory(req,ctx),'memory load');

    if(action==='diagnostics'){
      if(req.method!=='GET')return send(res,405,{ok:false,error:'GET required.'});
      const w=ctx.workspace||{};
      return send(res,200,{ok:true,workspaceId:ctx.workspaceId,workspaceUpdatedAt:ctx.updatedAt,accessMode:ctx.accessMode||'unknown',role:ctx.user?.role||'',permissions:ctx.permissions||[],counts:{projects:Array.isArray(w.jobs||w.projects)?(w.jobs||w.projects).length:0,salesOrders:Array.isArray(w.salesOrders)?w.salesOrders.length:0,purchaseOrders:Array.isArray(w.purchaseOrders)?w.purchaseOrders.length:0,products:Array.isArray(w.products)?w.products.length:0,suppliers:Array.isArray(w.suppliers)?w.suppliers.length:0},memoryMode:azzyMemoryMode(),memoryHealthy:Boolean(memoryLoad.ok)});
    }

    if(action==='bootstrap'){
      if(req.method!=='GET')return send(res,405,{ok:false,error:'GET required.'});
      const loginSession=String(url.searchParams.get('loginSession')||'').trim().slice(0,160);
      if(loginSession)memory.ensureLoginConversation(ctx.user.id,loginSession);
      const out=await bootstrapAzzyForPoolShed(opts);
      const memorySave=await safeMemory(()=>persistAzzyMemory(req,ctx),'memory save');
      return send(res,200,{ok:true,...out,workspaceId:ctx.workspaceId,memoryMode:azzyMemoryMode(),memoryHealthy:Boolean(memoryLoad.ok&&memorySave.ok)});
    }

    if(action==='chat'){
      if(req.method!=='POST')return send(res,405,{ok:false,error:'POST required.'});
      const p=bodyOf(req),message=String(p.message||'').trim();
      if(!message)return send(res,400,{ok:false,error:'Message is required.'});
      const out=await askAzzyFromPoolShed({...opts,message:message.slice(0,4000),context:p.context||null,contexts:Array.isArray(p.contexts)?p.contexts.slice(0,5):null});
      const memorySave=await safeMemory(()=>persistAzzyMemory(req,ctx),'memory save');
      return send(res,200,{ok:true,...out,memoryHealthy:Boolean(memoryLoad.ok&&memorySave.ok)});
    }

    if(action==='context'){
      if(req.method!=='POST')return send(res,405,{ok:false,error:'POST required.'});
      const p=bodyOf(req),operation=String(p.action||'add');
      if(!['add','remove','primary','only'].includes(operation))return send(res,400,{ok:false,error:'Invalid context operation.'});
      const out=updateAzzyContextForPoolShed(opts,{action:operation,context:p.context||null,contexts:Array.isArray(p.contexts)?p.contexts.slice(0,5):undefined});
      const memorySave=await safeMemory(()=>persistAzzyMemory(req,ctx),'memory save');
      return send(res,200,{ok:true,...out,memoryHealthy:Boolean(memoryLoad.ok&&memorySave.ok)});
    }

    if(action==='new-conversation'){
      if(req.method!=='POST')return send(res,405,{ok:false,error:'POST required.'});
      const p=bodyOf(req),session=memory.startConversation(ctx.user.id,{preserveContexts:Boolean(p.preserveContexts)});
      const memorySave=await safeMemory(()=>persistAzzyMemory(req,ctx),'memory save');
      return send(res,200,{ok:true,conversationId:session.conversationId,conversationStartedAt:session.conversationStartedAt,conversation:[],conversations:memory.conversationsFor(ctx.user.id),activeContexts:session.contexts,primaryContext:session.primaryContext,memoryHealthy:Boolean(memoryLoad.ok&&memorySave.ok)});
    }

    if(action==='open-conversation'){
      if(req.method!=='POST')return send(res,405,{ok:false,error:'POST required.'});
      const conversationId=String(bodyOf(req).conversationId||'').trim();
      if(!conversationId)return send(res,400,{ok:false,error:'Conversation ID is required.'});
      const session=memory.openConversation(ctx.user.id,conversationId);
      if(!session)return send(res,404,{ok:false,error:'That Azzy conversation is no longer available.'});
      const memorySave=await safeMemory(()=>persistAzzyMemory(req,ctx),'memory save');
      return send(res,200,{ok:true,conversationId:session.conversationId,conversationStartedAt:session.conversationStartedAt,conversation:session.history.slice(-60),conversations:memory.conversationsFor(ctx.user.id),activeContexts:session.contexts,primaryContext:session.primaryContext,memoryHealthy:Boolean(memoryLoad.ok&&memorySave.ok)});
    }

    if(action==='record'){
      if(req.method!=='GET')return send(res,405,{ok:false,error:'GET required.'});
      const type=String(url.searchParams.get('type')||''),id=String(url.searchParams.get('id')||'');
      if(!type||!id)return send(res,400,{ok:false,error:'Record type and ID are required.'});
      const out=withPoolShedRuntime(opts,()=>recordView(runtimeSnapshot(),currentUser(ctx.user.id),type,id));
      return send(res,out.ok?200:(out.status||404),out);
    }

    if(action==='attention-seen'){
      if(req.method!=='POST')return send(res,405,{ok:false,error:'POST required.'});
      const ids=Array.isArray(bodyOf(req).ids)?bodyOf(req).ids.slice(0,100):[];
      const out=markAzzyAttentionSeenForPoolShed(opts,ids);
      await safeMemory(()=>persistAzzyMemory(req,ctx),'memory save');
      return send(res,200,out);
    }

    if(action==='approve-action'){
      if(req.method!=='POST')return send(res,405,{ok:false,error:'POST required.'});
      const actionId=String(bodyOf(req).actionId||'').trim();
      if(!actionId)return send(res,400,{ok:false,error:'Action ID is required.'});
      const out=await approveAzzyActionFromPoolShed(opts,actionId);
      await safeMemory(()=>persistAzzyMemory(req,ctx),'memory save');
      return send(res,out.ok?200:403,{...out,ok:Boolean(out.ok)});
    }

    return send(res,404,{ok:false,error:'Unknown Azzy operation.'});
  }catch(e){
    console.error('Azzy API error',e);
    const status=e.statusCode||500,raw=String(e?.message||'');
    const stage=status===401?'authentication':status===403?'workspace-access':/workspace|data service|snapshot/i.test(raw)?'workspace-data':'runtime';
    const code=status===401?'AZZY_AUTH_REQUIRED':status===403?'AZZY_WORKSPACE_DENIED':status===503?'AZZY_DEPENDENCY_UNAVAILABLE':'AZZY_RUNTIME_ERROR';
    return send(res,status,{ok:false,code,stage,error:status<500?raw:(status===503&&raw?raw:'Azzy could not read the current Pool Shed workspace. Please try again.')});
  }
}
