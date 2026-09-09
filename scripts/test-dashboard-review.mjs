import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import '../public/project-engine.js';import '../public/dashboard-review-engine.js';
import handler from '../api/project-review.js';
const fixture={salesOrders:[{id:'PRIVATE-ID',customerId:'PRIVATE-CONTACT',created:'2026-01-01',due:'2026-02-01',status:'Shipped'},{status:'Cancelled',due:'2020-01-01'}],notifications:[],jobs:[],purchaseOrders:[{due:'2026-01-01',status:'Sent'}]};
const before=JSON.stringify(fixture);const summary=globalThis.PoolShedDashboardReview.summary(fixture,Date.parse('2026-09-09'));
assert.equal(summary.openOrders,1);assert.equal(summary.overdueOrderDates,1);assert.equal(summary.ordersWithNoRecentDatedActivity,1);assert.equal(summary.shippedOrdersToReviewForBilling,1);assert.equal(summary.latePurchaseDeliveries,1);assert.equal(JSON.stringify(fixture),before);assert(!JSON.stringify(summary).includes('PRIVATE'));
Object.assign(process.env,{OPENAI_API_KEY:'test',PROJECT_AI_MODEL:'test-model',APP_ORIGIN:'https://app.invalid',SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'test'});
let role='admin',claim=true,sent,providerOK=true;
global.fetch=async(url,opt)=>{let value=[];if(url.includes('/auth/v1/user'))value={id:'test-user'};else if(url.includes('ps_workspace_members'))value=[{role}];else if(url.includes('workspace_snapshots'))value=[{data:fixture,updated_at:'2026-09-09'}];else if(url.includes('ps_project_ai_claim'))value=claim;else if(url.includes('api.openai.com')){sent=JSON.parse(opt.body);value={status:'completed',output:[{content:[{type:'output_text',text:'Review outstanding orders.'}]}]};if(!providerOK)return {ok:false,status:503};}return {ok:true,status:200,json:async()=>value};};
async function call(origin='https://app.invalid'){const req=Readable.from([Buffer.from(JSON.stringify({scope:'dashboard',workspace:'test'}))]);Object.assign(req,{method:'POST',headers:{origin,authorization:'Bearer test'}});const res={setHeader(){},status(c){this.code=c;return this},json(v){this.body=v}};await handler(req,res);return res;}
assert.equal((await call()).code,200);assert.equal(sent.store,false);assert(!sent.input.includes('PRIVATE'));assert.equal(sent.tools,undefined);
role='operator';assert.equal((await call()).code,400);role='admin';claim=false;assert.equal((await call()).code,400);claim=true;providerOK=false;assert.equal((await call()).code,400);assert.equal((await call('https://wrong.invalid')).code,403);
delete process.env.OPENAI_API_KEY;assert.equal((await call()).code,503);
console.log('Dashboard review: counts, read-only summary, personal-data exclusion, admin restriction, throttling, provider/config/origin failures passed.');
