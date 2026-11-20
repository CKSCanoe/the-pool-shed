// v1.51: supplier invoices and receipts are finance documents. Only Admin, Management and Accounts may upload or open them.
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
Object.assign(process.env,{SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-test',APP_ORIGIN:'https://app.invalid'});
let role='Sales', uploads=0, signed=0;
global.fetch=async(url,opt={})=>{
  const u=String(url); let value=[];
  if(u.includes('/auth/v1/user'))value={id:'11111111-1111-1111-1111-111111111111'};
  else if(u.includes('ps_workspace_members'))value=[{role:'operator'}];
  else if(u.includes('user_profiles'))value=[{role,active:true}];
  else if(u.includes('/storage/v1/object/sign/'))value={signedURL:'/object/sign/finance-media/x?token=t'},signed++;
  else if(u.includes('/storage/v1/object/finance-media/'))uploads++;
  else if(u.includes('ps_finance_media')&&(opt.method||'GET')==='GET')value=[{id:'22222222-2222-2222-2222-222222222222',storage_path:'pool-bros-main/name_X/2222.pdf'}];
  return {ok:true,status:200,json:async()=>value,text:async()=>JSON.stringify(value)};
};
const {default:handler}=await import('../api/media.js');
async function call(action,method='GET',body){
  const qs=action==='finance-upload'?'&supplierKey=name%3AAcme&kind=supplier_invoice&name=inv.pdf':'&refs='+encodeURIComponent('finance-media:22222222-2222-2222-2222-222222222222');
  const req=Readable.from(body?[body]:[]);Object.assign(req,{method,url:'/api/media?action='+action+'&workspace=pool-bros-main'+qs,headers:{authorization:'Bearer t',origin:'https://app.invalid','content-type':'application/pdf'}});
  const res={setHeader(){},status(c){this.code=c;return this},json(v){this.body=v;return this}};
  await handler(req,res);return res;
}
for(const r of ['Sales','Warehouse','Engineer','Office']){
  role=r;
  assert.equal((await call('finance-upload','POST',Buffer.from('%PDF-1.4'))).code,403,r+' cannot upload supplier invoices');
  assert.equal((await call('finance-sign')).code,403,r+' cannot open supplier invoices');
}
assert.equal(uploads,0);assert.equal(signed,0);
for(const r of ['Admin','Accounts']){
  role=r;
  const up=await call('finance-upload','POST',Buffer.from('%PDF-1.4'));
  assert.equal(up.code,200,r+' can upload: '+JSON.stringify(up.body));assert.match(up.body.ref,/^finance-media:/);
  const sg=await call('finance-sign');assert.equal(sg.code,200,r+' can open');assert.ok(Object.keys(sg.body.urls).length===1);
}
console.log('Finance media v1.51: only Admin, Management and Accounts can upload or open supplier invoices.');
