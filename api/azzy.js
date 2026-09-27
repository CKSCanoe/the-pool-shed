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

export const config={maxDuration:60};
const send=(res,status,value)=>{res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');return res.status(status).json(value);};
const bodyOf=req=>req.body&&typeof req.body==='object'?req.body:{};
const runtimeOpts=ctx=>({workspace:ctx.workspace,user:ctx.user,permissions:ctx.permissions,revision:ctx.revision,updatedAt:ctx.updatedAt});

export default async function handler(req,res){
  const origin=process.env.APP_ORIGIN||'http://localhost',url=new URL(req.url,origin),action=url.searchParams.get('action')||'bootstrap';
  try{
    if(req.method==='OPTIONS'){res.setHeader('Allow','GET, POST, OPTIONS');return res.status(204).end();}
    if(req.method==='POST'&&!azzyOriginAllowed(req))return send(res,403,{ok:false,error:'Invalid origin.'});
    const ctx=await loadAzzyPoolShedContext(req),opts=runtimeOpts(ctx);

    if(action==='bootstrap'){
      if(req.method!=='GET')return send(res,405,{ok:false,error:'GET required.'});
      const out=await bootstrapAzzyForPoolShed(opts);
      return send(res,200,{ok:true,...out,workspaceId:ctx.workspaceId,memoryMode:'per-user-session'});
    }

    if(action==='chat'){
      if(req.method!=='POST')return send(res,405,{ok:false,error:'POST required.'});
      const p=bodyOf(req),message=String(p.message||'').trim();
      if(!message)return send(res,400,{ok:false,error:'Message is required.'});
      const out=await askAzzyFromPoolShed({...opts,message:message.slice(0,4000),context:p.context||null,contexts:Array.isArray(p.contexts)?p.contexts.slice(0,5):null});
      return send(res,200,{ok:true,...out});
    }

    if(action==='context'){
      if(req.method!=='POST')return send(res,405,{ok:false,error:'POST required.'});
      const p=bodyOf(req),operation=String(p.action||'add');
      if(!['add','remove','primary','only'].includes(operation))return send(res,400,{ok:false,error:'Invalid context operation.'});
      const out=updateAzzyContextForPoolShed(opts,{action:operation,context:p.context||null,contexts:Array.isArray(p.contexts)?p.contexts.slice(0,5):undefined});
      return send(res,200,{ok:true,...out});
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
      return send(res,200,markAzzyAttentionSeenForPoolShed(opts,ids));
    }

    if(action==='approve-action'){
      if(req.method!=='POST')return send(res,405,{ok:false,error:'POST required.'});
      const actionId=String(bodyOf(req).actionId||'').trim();
      if(!actionId)return send(res,400,{ok:false,error:'Action ID is required.'});
      const out=await approveAzzyActionFromPoolShed(opts,actionId);
      return send(res,out.ok?200:403,{...out,ok:Boolean(out.ok)});
    }

    return send(res,404,{ok:false,error:'Unknown Azzy operation.'});
  }catch(e){
    console.error('Azzy API error',e);
    const status=e.statusCode||500;
    return send(res,status,{ok:false,error:status<500?e.message:'Azzy could not read the current Pool Shed workspace. Please try again.'});
  }
}
