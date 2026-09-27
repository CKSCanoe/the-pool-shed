import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import handler from '../api/quote.js';
const oldFetch=global.fetch,oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_URL='https://example.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
const writes=[];
global.fetch=async(url,options)=>{
 const path=String(url).split('/rest/v1/')[1];const body=options.body?JSON.parse(options.body):null;
 if(path.startsWith('ps_quote_publications?token_hash='))return {ok:true,status:200,json:async()=>[{id:'PUB1',workspace_id:'TEST',quote_id:'Q1',version_number:2,version_hash:'exact-version-hash',status:'live',public_payload:{termsVersion:'T1',vatRate:20,sections:[]},commercial_payload:{operationalLines:[{qty:1,unitPrice:100}]},customer_state:{}}]};
 writes.push({path,body});let result=[];
 if(path==='rpc/ps_quote_accept_atomic')result=[{acceptance_id:'A1',accepted_at:'2026-09-24T10:00:00Z'}];
 if(path==='rpc/ps_quote_conversion_claim')result=[{status:'done',conversion:{salesOrderId:'SO1',workflow:'quick'}}];
 return{ok:true,status:200,json:async()=>result};
};
async function accept(extra){const req=Readable.from([Buffer.from(JSON.stringify({signer:'Test Customer',contact:{email:'test@example.invalid',address:{line1:'Test address',postcode:'TEST'}},termsVersion:'T1',termsAccepted:true,selections:{},...extra}))]);req.url='/api/quote?action=accept&token=abcdefghijklmnopqrstuvwxyz';req.method='POST';req.headers={};const response={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}};await handler(req,response);return response}
try{
 for(const signature of [{method:'typed',text:'Test Customer'},{method:'drawn',strokes:[[[.1,.2],[.4,.6]]]}]){
  const result=await accept({signature});assert.equal(result.code,200);assert.equal(result.body.accepted,true);
  const saved=writes.filter(x=>x.path==='rpc/ps_quote_accept_atomic').at(-1).body;
  assert.equal(saved.p_evidence.signature.method,signature.method);assert.equal(saved.p_evidence.quoteHash,'exact-version-hash');assert.equal(saved.p_evidence.termsAccepted,true);assert.equal(saved.p_terms,'T1');assert.equal(saved.p_evidence.acceptedTotals.gross,120);
  assert(!JSON.stringify(result.body).includes('strokes'),'Public response must not disclose the saved signature');
 }
 const before=writes.filter(x=>x.path==='rpc/ps_quote_accept_atomic').length;
 for(const extra of [{},{signature:{method:'drawn',strokes:[]}},{signature:{method:'typed',text:'Test Customer'},termsAccepted:false},{signature:{method:'typed',text:'Test Customer'},termsVersion:'OLD'}])assert.equal((await accept(extra)).code,400);
 assert.equal(writes.filter(x=>x.path==='rpc/ps_quote_accept_atomic').length,before,'Invalid signing requests cannot reach the acceptance write');
 console.log('PASS real API handler stores signature with version, terms, customer and totals in atomic private evidence; invalid requests never write');
}finally{global.fetch=oldFetch;if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey}
