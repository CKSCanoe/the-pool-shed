import fs from 'node:fs';
import path from 'node:path';
import { hash } from './utils.js';

const normaliseMode=value=>String(value||'file').trim().replace(/^['\"]|['\"]$/g,'').toLowerCase();
const externalMemory=normaliseMode(process.env.AZZY_MEMORY_MODE)==='external';
const readOnlyRuntime=Boolean(process.env.VERCEL);
const file=process.env.AZZY_MEMORY_FILE||path.resolve('runtime/memory.json');
const keyOf=c=>c?.type&&c?.id?`${c.type}:${c.id}`:null;
const cleanContexts=items=>{
  const out=[],seen=new Set();
  for(const c of items||[]){const key=keyOf(c);if(!key||seen.has(key))continue;seen.add(key);out.push({type:String(c.type),id:String(c.id)});if(out.length>=5)break;}
  return out;
};
const conversationId=()=>`CHAT-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const conversationTitle=history=>{
  const first=(history||[]).find(x=>x?.role==='user'&&String(x?.text||'').trim());
  const raw=String(first?.text||'New chat').replace(/\s+/g,' ').trim();
  return raw.length>64?raw.slice(0,61)+'…':raw;
};
const conversationUpdatedAt=history=>String((history||[]).at(-1)?.at||(history||[])[0]?.at||new Date().toISOString());
const clone=v=>structuredClone(v);
function empty(){return {sessions:{},actions:{},audit:[]};}
function load(){if(externalMemory||readOnlyRuntime)return empty();try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return empty();}}
function save(data){if(externalMemory||readOnlyRuntime)return;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2));}

class MemoryStore{
  constructor(){this.data=load();this.data.sessions??={};this.data.actions??={};this.data.audit??=[];}
  session(userId){
    const s=this.data.sessions[userId]??={userId,history:[],contexts:[],primaryContext:null,lastIntent:null,lastFactHash:null,lastAnswer:null,lastUserMessage:null,lastSeenAt:null,seenSignals:{},working:{},decisions:[],watches:{},snapshots:{},conversationId:conversationId(),conversationStartedAt:new Date().toISOString(),conversationHistory:[],lastLoginSessionId:null};
    s.history??=[];s.seenSignals??={};s.working??={};s.decisions??=[];s.watches??={};s.snapshots??={};s.conversationHistory=Array.isArray(s.conversationHistory)?s.conversationHistory:[];
    s.conversationId=String(s.conversationId||conversationId());s.conversationStartedAt=String(s.conversationStartedAt||s.history?.[0]?.at||new Date().toISOString());s.lastLoginSessionId=s.lastLoginSessionId||null;
    s.contexts=Array.isArray(s.contexts)?cleanContexts(s.contexts):[];
    if(!keyOf(s.primaryContext)||!s.contexts.some(c=>keyOf(c)===keyOf(s.primaryContext)))s.primaryContext=s.contexts[0]||null;
    return s;
  }
  syncContexts(userId,contexts,primaryContext=null){
    const s=this.session(userId),clean=cleanContexts(contexts);
    s.contexts=clean;
    if(primaryContext&&s.contexts.some(c=>keyOf(c)===keyOf(primaryContext)))s.primaryContext={type:primaryContext.type,id:primaryContext.id};
    else if(!s.contexts.some(c=>keyOf(c)===keyOf(s.primaryContext)))s.primaryContext=s.contexts[0]||null;
    s.working={...s.working,lastContexts:s.contexts,lastContext:s.primaryContext};this.persist();return s;
  }
  addContexts(userId,contexts,{primary=false}={}){
    const s=this.session(userId),before=s.contexts,merged=cleanContexts([...before,...(contexts||[])]);s.contexts=merged;
    if(primary&&contexts?.[0]&&merged.some(c=>keyOf(c)===keyOf(contexts[0])))s.primaryContext={type:contexts[0].type,id:contexts[0].id};
    this.persist();return s;
  }
  setOnlyContexts(userId,contexts){
    const s=this.session(userId),clean=cleanContexts(contexts);s.contexts=clean;s.primaryContext=s.contexts[0]||null;this.persist();return s;
  }
  removeContext(userId,context){
    const s=this.session(userId),key=keyOf(context);s.contexts=s.contexts.filter(c=>keyOf(c)!==key);if(keyOf(s.primaryContext)===key)s.primaryContext=s.contexts[0]||null;this.persist();return s;
  }
  setPrimaryContext(userId,context){
    const s=this.session(userId),key=keyOf(context);if(!key)return s;if(!s.contexts.some(c=>keyOf(c)===key))s.contexts=cleanContexts([context,...s.contexts]);s.primaryContext={type:context.type,id:context.id};this.persist();return s;
  }
  addMessage(userId,role,text,meta={}){
    const s=this.session(userId);s.history.push({role,text,meta,at:new Date().toISOString()});if(s.history.length>100)s.history.splice(0,s.history.length-100);this.persist();
  }
  updateTurn(userId,{intent,facts,answer,userMessage,working}){
    const s=this.session(userId);s.lastIntent=intent;s.lastFactHash=hash(facts);s.lastAnswer=answer;s.lastUserMessage=userMessage||s.lastUserMessage;s.lastSeenAt=new Date().toISOString();s.working={...s.working,...working};this.persist();return s;
  }

  archiveConversation(userId,{force=false}={}){
    const s=this.session(userId);
    if(!force&&!(s.history||[]).some(x=>x?.role==='user'&&String(x?.text||'').trim()))return null;
    const row={
      id:String(s.conversationId||conversationId()),
      title:conversationTitle(s.history),
      startedAt:String(s.conversationStartedAt||s.history?.[0]?.at||new Date().toISOString()),
      updatedAt:conversationUpdatedAt(s.history),
      messages:clone((s.history||[]).slice(-60)),
      contexts:cleanContexts(s.contexts),
      primaryContext:s.primaryContext?{type:String(s.primaryContext.type),id:String(s.primaryContext.id)}:null,
      lastIntent:s.lastIntent||null,
      lastAnswer:s.lastAnswer||null,
      lastUserMessage:s.lastUserMessage||null
    };
    const index=s.conversationHistory.findIndex(x=>String(x?.id||'')===row.id);
    if(index>=0)s.conversationHistory[index]=row;else s.conversationHistory.unshift(row);
    s.conversationHistory.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    if(s.conversationHistory.length>30)s.conversationHistory.length=30;
    return row;
  }
  startConversation(userId,{preserveContexts=false,loginSessionId=null}={}){
    const s=this.session(userId);
    this.archiveConversation(userId);
    const contexts=preserveContexts?cleanContexts(s.contexts):[];
    const primary=preserveContexts&&s.primaryContext&&contexts.some(c=>keyOf(c)===keyOf(s.primaryContext))?{type:s.primaryContext.type,id:s.primaryContext.id}:null;
    s.history=[];s.contexts=contexts;s.primaryContext=primary;s.lastIntent=null;s.lastFactHash=null;s.lastAnswer=null;s.lastUserMessage=null;s.lastSeenAt=null;s.working={};s.conversationId=conversationId();s.conversationStartedAt=new Date().toISOString();
    if(loginSessionId)s.lastLoginSessionId=String(loginSessionId);
    this.persist();return s;
  }
  ensureLoginConversation(userId,loginSessionId){
    const id=String(loginSessionId||'').trim(),s=this.session(userId);
    if(!id||String(s.lastLoginSessionId||'')===id)return {started:false,session:s};
    return {started:true,session:this.startConversation(userId,{preserveContexts:false,loginSessionId:id})};
  }
  conversationsFor(userId,limit=30){
    const s=this.session(userId),rows=(s.conversationHistory||[]).map(row=>({
      id:String(row.id||''),title:String(row.title||'Chat'),startedAt:row.startedAt||null,updatedAt:row.updatedAt||null,messageCount:Array.isArray(row.messages)?row.messages.length:0,active:false
    }));
    if((s.history||[]).some(x=>x?.role==='user')){
      rows.unshift({id:String(s.conversationId),title:conversationTitle(s.history),startedAt:s.conversationStartedAt,updatedAt:conversationUpdatedAt(s.history),messageCount:s.history.length,active:true});
    }
    return rows.slice(0,Math.max(1,Math.min(50,Number(limit||30))));
  }
  openConversation(userId,id){
    const s=this.session(userId),wanted=String(id||'');
    if(!wanted)return null;
    if(String(s.conversationId)===wanted)return s;
    this.archiveConversation(userId);
    const index=s.conversationHistory.findIndex(x=>String(x?.id||'')===wanted);
    if(index<0)return null;
    const row=s.conversationHistory.splice(index,1)[0];
    s.conversationId=String(row.id||conversationId());s.conversationStartedAt=String(row.startedAt||new Date().toISOString());s.history=clone(Array.isArray(row.messages)?row.messages:[]).slice(-100);s.contexts=cleanContexts(row.contexts);s.primaryContext=row.primaryContext&&s.contexts.some(c=>keyOf(c)===keyOf(row.primaryContext))?{type:row.primaryContext.type,id:row.primaryContext.id}:s.contexts[0]||null;s.lastIntent=row.lastIntent||null;s.lastAnswer=row.lastAnswer||null;s.lastUserMessage=row.lastUserMessage||null;s.lastSeenAt=row.updatedAt||null;s.working={lastContexts:s.contexts,lastContext:s.primaryContext,topic:s.lastIntent};
    this.persist();return s;
  }
  rememberSignal(userId,id,revision){const s=this.session(userId);s.seenSignals[id]=revision;this.persist();}
  addDecision(userId,{text,contexts=[],kind='operational',until=null}){
    const s=this.session(userId),normal=String(text||'').trim();if(!normal)return null;
    const existing=s.decisions.find(x=>x.active!==false&&x.text.toLowerCase()===normal.toLowerCase());if(existing)return existing;
    const d={id:`DEC-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,text:normal,kind,contexts:cleanContexts(contexts),until,active:true,createdAt:new Date().toISOString()};s.decisions.unshift(d);if(s.decisions.length>50)s.decisions.length=50;this.persist();return d;
  }
  decisionsFor(userId,contexts=[]){
    const s=this.session(userId),keys=new Set((contexts||[]).map(keyOf).filter(Boolean));return s.decisions.filter(d=>d.active!==false&&(!keys.size||!d.contexts?.length||d.contexts.some(c=>keys.has(keyOf(c)))));
  }
  watch(userId,contexts=[]){
    const s=this.session(userId),createdAt=new Date().toISOString();for(const c of cleanContexts(contexts)){const key=keyOf(c);s.watches[key]={key,context:c,createdAt,active:true};}this.persist();return Object.values(s.watches).filter(x=>x.active);
  }
  unwatch(userId,contexts=[]){const s=this.session(userId);for(const c of cleanContexts(contexts)){const x=s.watches[keyOf(c)];if(x)x.active=false;}this.persist();return Object.values(s.watches).filter(x=>x.active);}
  watchesFor(userId){return Object.values(this.session(userId).watches||{}).filter(x=>x.active);}
  getSnapshot(userId,entityKey){return this.session(userId).snapshots?.[entityKey]||null;}
  setSnapshot(userId,entityKey,snapshot){const s=this.session(userId);s.snapshots[entityKey]=snapshot;this.persist();}
  saveAction(action){this.data.actions[action.id]=action;this.persist();}
  getAction(id){return this.data.actions[id]||null;}
  audit(userId,type,title,detail,meta={}){const item={id:`AUD-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,userId,type,title,detail,meta,at:new Date().toISOString()};this.data.audit.unshift(item);if(this.data.audit.length>600)this.data.audit.length=600;this.persist();return item;}
  auditFor(userId,limit=80){return this.data.audit.filter(x=>x.userId===userId).slice(0,limit);}
  exportUserState(userId){
    const session=structuredClone(this.session(userId));
    const actions=Object.fromEntries(Object.entries(this.data.actions).filter(([,a])=>String(a?.requestedBy||'')===String(userId)).map(([id,a])=>[id,structuredClone(a)]));
    const audit=structuredClone(this.data.audit.filter(x=>String(x.userId)===String(userId)).slice(0,600));
    return {version:2,session,actions,audit};
  }
  replaceUserState(userId,state={}){
    const id=String(userId);
    const incoming=state&&typeof state==='object'?state:{};
    if(incoming.session&&typeof incoming.session==='object')this.data.sessions[id]={...structuredClone(incoming.session),userId:id};
    else delete this.data.sessions[id];
    for(const [actionId,action] of Object.entries(this.data.actions))if(String(action?.requestedBy||'')===id)delete this.data.actions[actionId];
    if(incoming.actions&&typeof incoming.actions==='object')for(const [actionId,action] of Object.entries(incoming.actions))if(String(action?.requestedBy||id)===id)this.data.actions[actionId]=structuredClone(action);
    this.data.audit=this.data.audit.filter(x=>String(x.userId)!==id);
    if(Array.isArray(incoming.audit))this.data.audit.push(...structuredClone(incoming.audit).filter(x=>String(x.userId||id)===id).map(x=>({...x,userId:id})));
    this.data.audit.sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
    if(this.data.audit.length>600)this.data.audit.length=600;
    return this.session(id);
  }
  clearUserState(userId){
    const id=String(userId);delete this.data.sessions[id];
    for(const [actionId,action] of Object.entries(this.data.actions))if(String(action?.requestedBy||'')===id)delete this.data.actions[actionId];
    this.data.audit=this.data.audit.filter(x=>String(x.userId)!==id);
  }
  persist(){save(this.data);}
}
export const memory=new MemoryStore();
