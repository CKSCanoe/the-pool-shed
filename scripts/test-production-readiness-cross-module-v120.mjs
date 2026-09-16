import fs from 'node:fs';import assert from 'node:assert/strict';
const readiness=fs.readFileSync('public/production-readiness-engine.js','utf8');
const settings=fs.readFileSync('public/settings-command-workspace.js','utf8');
for(const route of ['accounting','purchase','jobs','warehouse','locations','automation','analytics'])assert(readiness.includes(`module:'${route}'`)||readiness.includes(`module: '${route}'`),`missing authority route ${route}`);
for(const state of ['Paid','Part Paid','Overdue','Shipped','Collected','Short','BLOCK PAYMENT','Approval Required'])assert(readiness.includes(state)||settings.includes(state),`shared lifecycle term missing ${state}`);
assert(!settings.includes('data-readiness-action="delete"'),'Production Readiness diagnostics must remain read-only');
console.log('PASS v1.20 cross-module authority routes, lifecycle terminology and read-only diagnostics');
