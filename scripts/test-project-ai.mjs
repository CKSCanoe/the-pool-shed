import assert from 'node:assert/strict';import {Readable} from 'node:stream';import handler from '../api/project-review.js';
Object.assign(process.env,{OPENAI_API_KEY:'test',PROJECT_AI_MODEL:'configured-test-model',APP_ORIGIN:'https://app.invalid',SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-test'});
let sent,permitted=true;global.fetch=async(url,options)=>{
 let value=[];
 if(url.includes('/auth/v1/user'))value={id:'user'};
 else if(url.includes('ps_workspace_members'))value=[{role:'operator'}];
 else if(url.includes('workspace_snapshots'))value=[{updated_at:'2026-09-08',data:{jobs:[{id:'J',name:'PRIVATE CUSTOMER',project:{quoteNet:1000,targetMargin:30,quoteAccepted:true,remainingNet:700,phases:[],documents:[{name:'PRIVATE INVOICE'}]}}],products:[],salesOrders:[],purchaseOrders:[],toolAssignments:[]}}];
 else if(url.includes('ps_project_ai_claim'))value=permitted;
 else if(url.includes('api.openai.com')){sent=JSON.parse(options.body);value={status:'completed',output:[{content:[{type:'output_text',text:'Review the remaining costs before billing.'}]}]};}
 return {ok:true,status:200,json:async()=>value};
};
async function call(){const req=Readable.from([Buffer.from(JSON.stringify({workspace:'W',jobId:'J'}))]);Object.assign(req,{method:'POST',headers:{origin:'https://app.invalid',authorization:'Bearer user'}});const res={setHeader(){},status(c){this.code=c;return this},json(v){this.body=v}};await handler(req,res);return res;}
assert.equal((await call()).code,200);assert.equal(sent.store,false);assert(!sent.input.includes('PRIVATE'));assert.equal(JSON.parse(sent.input).targetMargin,30);permitted=false;assert.equal((await call()).code,400);
console.log('Optional AI: manager auth path, bounded summary without documents/customer names, explicit non-storage and rate-limit guard passed (mock provider).');
