import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { hash } from './utils.js';

const file=process.env.AZZY_MEMORY_FILE||path.join(os.tmpdir(),'pool-shed-azzy-memory.json');
const keyOf=c=>c?.type&&c?.id?`${c.type}:${c.id}`:null;
const cleanContexts=items=>{
  const out=[],seen=new Set();
  for(const c of items||[]){const key=keyOf(c);if(!key||seen.has(key))continue;seen.add(key);out.push({type:String(c.type),id:String(c.id)});if(out.length>=5)break;}
  return out;
};
function load(){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return {sessions:{},actions:{},audit:[]};}}
function save(data){try{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2));}catch{/* Serverless instances may expose only ephemeral/read-only storage. Keep the in-memory session alive. */}}

class MemoryStore{
  constructor(){this.data=load();this.data.sessions??={};this.data.actions??={};this.data.audit??=[];}
  session(userId){
    const s=this.data.sessions[userId]??={userId,history:[],contexts:[],primaryContext:null,lastIntent:null,lastFactHash:null,lastAnswer:null,lastUserMessage:null,lastSeenAt:null,seenSignals:{},working:{},decisions:[],watches:{},snapshots:{}};
    s.history??=[];s.seenSignals??={};s.working??={};s.decisions??=[];s.watches??={};s.snapshots??={};
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
  persist(){save(this.data);}
}
export const memory=new MemoryStore();
