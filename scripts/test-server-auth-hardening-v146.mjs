import fs from 'node:fs';
import assert from 'node:assert/strict';

const files=[
  'api/finance.js','api/media.js','api/project-email.js','api/project-review.js','api/quote.js',
  'server/accounting.js','server/business-media.js','server/quote.js','server/azzy-memory.js','server/azzy-pool-shed.js'
];
const source=Object.fromEntries(files.map(file=>[file,fs.readFileSync(file,'utf8')]));

for(const [file,text] of Object.entries(source)){
  assert.doesNotMatch(text,/apikey\s*:\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY/,'direct legacy apikey usage remains in '+file);
  assert.doesNotMatch(text,/Authorization\s*:\s*['"]Bearer ['"]\s*\+\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY/,'legacy service_role is still forced into Bearer in '+file);
}
for(const file of ['api/finance.js','api/media.js','api/project-email.js','api/project-review.js','api/quote.js']){
  assert.doesNotMatch(source[file],/req\.headers\.origin\s*!==\s*process\.env\.APP_ORIGIN/,'brittle exact-origin comparison remains in '+file);
}
assert.match(source['api/finance.js'],/supabaseServerKey/);
assert.match(source['api/media.js'],/appOriginAllowed/);
assert.match(source['api/project-email.js'],/appOriginAllowed/);
assert.match(source['api/project-review.js'],/appOriginAllowed/);
assert.match(source['api/quote.js'],/appOriginAllowed/);
assert.match(source['server/business-media.js'],/elevatedSupabaseHeaders/);
assert.match(source['server/quote.js'],/elevatedSupabaseHeaders/);
console.log('PASS server APIs consistently support modern Supabase keys and shared origin policy');
