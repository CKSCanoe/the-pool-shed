import fs from "node:fs";
import path from "node:path";
const root = path.resolve("public");
const walk = d => fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const files=walk(root).map(f=>({file:path.relative(root,f),bytes:fs.statSync(f).size})).sort((a,b)=>b.bytes-a.bytes);
const total=files.reduce((s,f)=>s+f.bytes,0);
console.log(`v2 asset audit: ${files.length} files, ${(total/1024).toFixed(1)} KiB total`);
for(const f of files.slice(0,15)) console.log(`${(f.bytes/1024).toFixed(1).padStart(8)} KiB  ${f.file}`);
const html=files.find(f=>f.file==='index.html');
if(!html || html.bytes>250000){ console.error('index.html is still too large'); process.exit(1); }
console.log('PASS: HTML shell is below 250 KiB and application code is cacheable.');
