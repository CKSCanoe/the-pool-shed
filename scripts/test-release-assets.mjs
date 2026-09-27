import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const html=fs.readFileSync('public/index.html','utf8');let count=0;
for(const m of html.matchAll(/(?:src|href)="\.\/([^"?#]+)[^"]*"/g)){assert(fs.existsSync(path.join('public',m[1])),m[1]+' is missing');count++;}
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else if(file.endsWith('.js')){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}}}
['public','server','api'].forEach(walk);
console.log('All '+count+' referenced assets exist; every public/server/API JavaScript file parses.');
