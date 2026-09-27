import fs from 'node:fs';import assert from 'node:assert/strict';const js=fs.readFileSync('public/analytics-command-workspace.js','utf8');
for(const action of ['refresh','save-view','export-view','create-alert','open-credit-control','open-project-risk','open-supplier-performance','open-aged-stock','metric-detail','report-builder','save-report','run-saved','export-dataset','export-current','export-excel','full-export','data-dictionary','record-export'])assert(js.includes(`'${action}'`)||js.includes(`"${action}"`),`missing handler token ${action}`);
assert(js.includes('data-ac-action'));assert(js.includes('data-ac-page'));assert(js.includes('data-ac-report-tab'));assert(!js.includes('Action: '+ '${name}'));
console.log('PASS Analytics Command action coverage contract');
