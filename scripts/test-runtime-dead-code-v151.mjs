import fs from 'node:fs';import assert from 'node:assert/strict';
const html=fs.readFileSync('public/index.html','utf8'),refs=[...html.matchAll(/<script[^>]+src="\.\/([^"?]+\.js)/g)].map(m=>m[1]);
assert.equal(new Set(refs).size,refs.length,'index.html contains duplicate runtime script includes');
for(const file of ['public/purchase-workspace.js','public/sales-workspace.js','public/supplier-command-workspace.js','public/azzy-jarvis-host.js']){
 const src=fs.readFileSync(file,'utf8'),names=[...src.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]),seen=new Set(),dupes=new Set();
 for(const n of names){if(seen.has(n))dupes.add(n);seen.add(n);}assert.equal(dupes.size,0,file+' contains duplicate function declarations: '+[...dupes].join(', '));
}
const purchase=fs.readFileSync('public/purchase-workspace.js','utf8');assert.equal((purchase.match(/function poProFormaFundingGap/g)||[]).length,1,'Duplicate Pro Forma funding guard reintroduced');
const host=fs.readFileSync('public/azzy-jarvis-host.js','utf8');assert(!host.includes('azzy-live.png'),'Retired Azzy image asset is referenced by runtime code');
console.log('PASS runtime includes are unique and critical workspaces contain no duplicate/dead guard implementations');
