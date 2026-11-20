// Vans & Fleet files: engineers add photos and signatures to their own van only; documents and removal are for managers.
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
Object.assign(process.env,{SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-test',SUPABASE_PUBLISHABLE_KEY:'pub',APP_ORIGIN:'https://app.invalid'});
const OWN='11111111-1111-1111-1111-111111111111', OTHER='22222222-2222-2222-2222-222222222222', FILE='33333333-3333-3333-3333-333333333333';
let manager=false, uploads=0;
global.fetch=async(url,opt={})=>{
  const u=String(url);let value=[];
  if(u.includes('/auth/v1/user'))value={id:'44444444-4444-4444-4444-444444444444'};
  else if(u.includes('ps_workspace_members'))value=[{role:'operator'}];
  else if(u.includes('rpc/ps_fleet_media_allowed')){const b=JSON.parse(opt.body);value=manager||(b.van===OWN&&!['v5','insurance','mot','service','other'].includes(b.kind));}
  else if(u.includes('/storage/v1/object/sign/'))value={signedURL:'/object/sign/fleet-media/x?token=t'};
  else if(u.includes('/storage/v1/object/fleet-media/'))uploads++;
  else if(u.includes('ps_fleet_media?')&&u.includes('select=van_id'))value=[{van_id:OTHER}];
  else if(u.includes('ps_fleet_media?'))value=[{id:FILE,van_id:OTHER,asset_kind:'damage_photo',storage_path:'p'}];
  return {ok:true,status:200,json:async()=>value,text:async()=>JSON.stringify(value)};
};
const {default:handler}=await import('../api/media.js');
async function call(action,qs,method='GET',body){
  const req=Readable.from(body?[body]:[]);Object.assign(req,{method,url:'/api/media?action='+action+'&workspace=pool-bros-main'+qs,headers:{authorization:'Bearer t',origin:'https://app.invalid','content-type':'image/jpeg'}});
  const res={setHeader(){},status(c){this.code=c;return this},json(v){this.body=v;return this}};await handler(req,res);return res;
}
const img=Buffer.from([0xff,0xd8,0xff,0xe0]);
assert.equal((await call('fleet-upload','&vanId='+OWN+'&kind=damage_photo','POST',img)).code,200,'engineer: photo on own van');
assert.equal((await call('fleet-upload','&vanId='+OWN+'&kind=signature','POST',img)).code,200,'engineer: signature on own van');
assert.equal((await call('fleet-upload','&vanId='+OTHER+'&kind=damage_photo','POST',img)).code,403,'engineer: not another van');
assert.equal((await call('fleet-upload','&vanId='+OWN+'&kind=v5','POST',img)).code,403,'engineer: no V5/insurance documents');
assert.equal(Object.keys((await call('fleet-sign','&refs='+encodeURIComponent('fleet-media:'+FILE))).body.urls).length,0,'engineer: cannot open another van\'s photos');
assert.equal((await call('archive','&ref='+encodeURIComponent('fleet-media:'+FILE),'POST')).code,403,'engineer: cannot remove van files');
manager=true;
assert.equal((await call('fleet-upload','&vanId='+OTHER+'&kind=insurance','POST',img)).code,200,'manager: documents on any van');
assert.equal(Object.keys((await call('fleet-sign','&refs='+encodeURIComponent('fleet-media:'+FILE))).body.urls).length,1,'manager: opens any van file');
assert.equal(uploads,3);
console.log('Fleet media v1.52: engineers own-van photos and signatures only; documents and removal for managers.');
