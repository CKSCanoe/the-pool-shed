import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const workspace=fs.readFileSync('public/quote-studio-workspace.js','utf8');
const engineSource=fs.readFileSync('public/quote-studio-engine.js','utf8');
const portal=fs.readFileSync('public/quote-customer-portal.js','utf8');
const css=fs.readFileSync('public/assets/css/system/59-quote-studio.css','utf8');
const customerCss=fs.readFileSync('public/quote-customer-portal.css','utf8');
assert.match(pkg.version,/^1\.(?:32\.[1-9]\d*|(?:3[3-9]|[4-9]\d)\.\d+)$/);
for(const token of ['Media library','Upload project image','data-qs-upload-target','quoteImageData','qsImageUpload','CLIENT CANVAS','Review & Publish','quick section','Add image']){
  assert(workspace.toLowerCase().includes(token.toLowerCase()),`workspace missing elite builder capability: ${token}`);
}
for(const token of ['addMedia','removeMedia','mediaLibrary','heroImage','heroImagePosition'])assert(engineSource.includes(token),`engine missing ${token}`);
for(const token of ['pc-option-image','pc-gallery','pc-block-image','--pc-hero-image','layout-comparison'])assert(portal.includes(token)||customerCss.includes(token),`customer portal missing ${token}`);
for(const token of ['qs-builder','qs-media-grid','qs-upload-zone','qs-option-image','qs-builder-nav'])assert(css.includes(token),`app CSS missing ${token}`);

const data={customers:[{id:'C1',name:'Design Client',address:'Pool House'}],products:[{id:'P1',sku:'PB-COV-1',name:'Automatic Cover',supplier:'Supplier A',supplierSku:'A-COV',cost:2500,rrp:6500,image:'https://example.test/cover.jpg'}],quotes:[],quoteTemplates:[],quoteSettings:{minimumMargin:20},jobs:[],salesOrders:[],purchaseOrders:[],stock:[],allocations:[],movements:[]};
const ctx={console,crypto:webcrypto,TextEncoder,TextDecoder,Date,Math,Intl,URLSearchParams,navigator:{onLine:false},sessionStorage:{setItem(){},getItem(){return null}},__POOL_SHED_GET_DATA__:()=>data,__POOL_SHED_SAVE_APP_DATA__:()=>true,__POOL_SHED_CURRENT_USER__:()=>({id:'U1',name:'Aaron'}),__POOL_SHED_WORKSPACE_ID__:()=> 'pool-bros-main'};
vm.createContext(ctx);vm.runInContext(engineSource,ctx);const qs=ctx.PoolShedQuoteStudio;
const q=qs.createQuote({customerId:'C1',projectName:'Elite quote',workflow:'quick'});
assert(Array.isArray(q.mediaLibrary));assert.equal(q.presentation.heroImage,'');
const media=qs.addMedia(q.id,{name:'Pool visual.jpg',type:'image/jpeg',url:'data:image/jpeg;base64,AAAA',size:4});
assert.equal(q.mediaLibrary.length,1);q.presentation.heroImage=media.url;
const section=q.sections[0];const opt=qs.addProductOption(q.id,section.id,'P1');opt.image=media.url;opt.selected=true;
qs.addBlock(q.id,section.id,'gallery',{images:[media.url,media.url]});
const snap=qs.customerSnapshot(q),txt=JSON.stringify(snap);
assert.equal(snap.presentation.heroImage,media.url,'hero media must survive safe customer snapshot');
assert.equal(snap.sections[0].options[0].image,media.url,'option media must survive safe customer snapshot');
assert.equal(snap.sections[0].blocks[0].images.length,2,'gallery media must survive safe customer snapshot');
for(const forbidden of ['costSnapshot','supplierSnapshot','supplierSkuSnapshot','commercialSnapshot','unitCost'])assert(!txt.includes(forbidden),'customer snapshot leaked '+forbidden);
qs.removeMedia(q.id,media.id);assert.equal(q.mediaLibrary.length,0);
console.log('PASS v1.41.1 elite visual quote builder, working media library, customer-safe imagery and proposal layouts');
