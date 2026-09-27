import fs from 'node:fs';import assert from 'node:assert/strict';const js=fs.readFileSync('public/analytics-command-workspace.js','utf8'),legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
for(const token of ['salesorders','jobs','purchase','locations','accounting','products','crm'])assert(js.includes(token),`missing drill-down route ${token}`);
assert(legacy.includes('__POOL_SHED_CURRENT_USER__'),'legacy bridge must expose current user to Analytics export permissions');assert(legacy.includes('__POOL_SHED_IS_ADMIN__'),'legacy bridge must expose Admin permission check');
assert(js.includes('Full System Export'));assert(js.includes('__POOL_SHED_IS_ADMIN__'));
console.log('PASS Analytics cross-module drill-down and export permission bridge');
