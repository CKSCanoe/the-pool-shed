import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(p,'utf8');
const pkg=JSON.parse(read('package.json'));
const migration=read('database/010-product-crm-media.sql');
const server=read('server/business-media.js');
const api=read('api/media.js');
const client=read('public/business-media.js');
const product=read('public/product-hub-workspace.js');
const crm=read('public/assets/js/01-legacy-01.js');
const engine=read('public/quote-studio-engine.js');
const quoteApi=read('api/quote.js');
const quoteServer=read('server/quote.js');
const vercel=read('vercel.json');
const index=read('public/index.html');

assert.equal(pkg.version,'1.41.0');
for(const token of [
  'create table if not exists public.ps_product_media',
  'create table if not exists public.ps_customer_media',
  "'product-media','product-media',false",
  "'customer-media','customer-media',false",
  'alter table public.ps_product_media enable row level security',
  'alter table public.ps_customer_media enable row level security',
  'revoke all on public.ps_product_media, public.ps_customer_media from anon,authenticated',
  'grant all on public.ps_product_media, public.ps_customer_media to service_role'
]) assert(migration.includes(token),'010 migration missing '+token);

for(const token of ['uploadBusinessMedia','listBusinessMedia','signBusinessMedia','archiveBusinessMedia','assertBusinessMediaRefs','resolveBusinessMedia','product-media:','customer-media:'])
  assert(server.includes(token),'business media server missing '+token);
for(const token of ["action==='product-upload'","action==='customer-upload'","action==='product-list'","action==='customer-list'","action==='sign'","action==='archive'",'ps_workspace_members'])
  assert(api.includes(token),'media API missing '+token);
for(const token of ['PoolShedBusinessMedia','ensureValue','upload','archive','data-business-media-ref'])
  assert(client.includes(token),'browser media client missing '+token);

for(const token of ['Product presentation','Main product image','Gallery','Brochure','Datasheet','Installation guide','Warranty','uploadProductMedia','removeProductMedia'])
  assert(product.includes(token),'Product Hub media UI missing '+token);
assert(product.includes("p.imageUrl"),'Product Hub must persist a reusable main-image reference');
assert(product.includes("p.brochureUrl"),'Product Hub must persist a reusable brochure reference');

for(const token of ['Files & Site Media','data-crm-media-upload="site_photo"','data-crm-media-upload="drawing"','mediaAttachments','uploadCustomerMedia','removeCustomerMedia'])
  assert(crm.includes(token),'CRM secure media UI missing '+token);

assert(engine.includes("image:p.image||p.imageUrl||''"),'Quote Studio must inherit Product Hub main imagery');
assert(engine.includes("brochure:p.brochureUrl||p.datasheetUrl||''"),'Quote Studio must inherit approved Product Hub documents');
assert(quoteApi.includes('assertBusinessMediaRefs'),'Quote publish must reject broken Product/CRM media refs');
assert(quoteServer.includes('resolveBusinessMedia'),'Customer proposal must resolve secure Product/CRM media refs server-side');
assert(index.includes('business-media.js?v=1.41.0'),'Product/CRM secure media client must load before product media rendering');
assert(vercel.includes('"api/media.js"'),'Vercel must expose the secure media API');

assert(!migration.includes('create policy') || !/to\s+anon/i.test(migration),'Product/CRM storage must not create anonymous access policies');
console.log('PASS v1.41.0 private Product Hub + CRM media, reusable quote assets and service-role-only storage');
