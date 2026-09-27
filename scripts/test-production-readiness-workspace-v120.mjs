import fs from 'node:fs';import assert from 'node:assert/strict';
const file='public/settings-command-workspace.js';const src=fs.readFileSync(file,'utf8');
for(const text of ['Production Readiness','Critical Journeys','Release Health','Operational Attention','Environment & Integrations','Go-Live Checklist'])assert(src.includes(text),`missing ${text}`);
for(const action of ['run-readiness-check','open-readiness-issue','export-readiness-report'])assert(src.includes(action),`missing action ${action}`);
assert(src.includes('PoolShedProductionReadiness'),'Settings must use Production Readiness authority');
console.log('PASS v1.20 Production Readiness Settings surface and action coverage');
