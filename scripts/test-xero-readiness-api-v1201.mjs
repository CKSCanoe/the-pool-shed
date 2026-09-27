import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';
import handler from '../api/finance.js';

Object.assign(process.env,{
 SUPABASE_URL:'https://database.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-test',APP_ORIGIN:'https://app.invalid',
 XERO_CLIENT_ID:'test',XERO_CLIENT_SECRET:'test',XERO_TOKEN_KEY:randomBytes(32).toString('base64'),
 CRON_SECRET:'cron-test',XERO_WEBHOOK_KEY:'webhook-test',XERO_INTEGRATION_MODE:'ready'
});
let providerCalls=0;
global.fetch=async(url,options={})=>{
 const u=new URL(url);
 if(u.hostname.includes('xero.com')){providerCalls++;throw new Error('Ready mode must not call Xero');}
 let value=[];
 if(u.pathname==='/auth/v1/user')value={id:'actor'};
 else if(u.pathname.endsWith('ps_finance_members'))value=[{role:'admin'}];
 else if(u.pathname.endsWith('ps_finance_connections'))value=[];
 else if(u.pathname.endsWith('ps_finance_documents'))value=[];
 else if(u.pathname.endsWith('ps_finance_jobs'))value=[];
 return {ok:true,status:200,json:async()=>value,headers:new Headers()};
};
async function call(action,{method='GET',body={},origin='https://app.invalid'}={}){
 const raw=JSON.stringify(body),req=Readable.from(method==='POST'?[Buffer.from(raw)]:[]);
 Object.assign(req,{url:'/api/finance?action='+action,method,headers:{authorization:'Bearer user',origin}});
 const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.body=v;return this;},end(){}};
 await handler(req,res);return res;
}
const status=await call('status');
assert.equal(status.code,200);
assert.equal(status.body.integration.mode,'ready');
assert.equal(status.body.integration.liveEnabled,false);
assert.equal(status.body.integration.readyToConnect,true);
assert.equal(status.body.connection,null);

for(const action of ['connect','sync']){
 const r=await call(action,{method:'POST'});
 assert.equal(r.code,423,action+' must be hard-locked while integration mode is Ready');
 assert.match(r.body.error,/ready|locked|live/i);
}
assert.equal(providerCalls,0,'Ready-mode API calls must not contact Xero');
console.log('PASS Xero API remains status-visible but provider-locked in Ready mode');
