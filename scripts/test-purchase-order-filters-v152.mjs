import fs from 'node:fs';import assert from 'node:assert/strict';
const js=fs.readFileSync('public/purchase-workspace.js','utf8'),css=fs.readFileSync('public/assets/css/system/44-purchase-order-command.css','utf8'),build=fs.readFileSync('scripts/build.sh','utf8');
for(const token of ['poListFilters','poMatchesListFilters','poListFilterBar','data-po-list-filter="supplier"','data-po-list-filter="status"','data-po-list-filter="payment"','data-po-list-filter="receiving"','data-po-list-filter="health"','data-po-list-filter="expected"','data-po-list-filter="link"','poListFilterSearch','data-po-clear-filters','data-po-quick-filter'])
  assert(js.includes(token),'Purchase Order filter missing '+token);
for(const label of ['All suppliers','All statuses','All payments','All receiving','All health','Any expected date','Sales Order','Project','Custom PO lines','General / unlinked'])
  assert(js.includes(label),'Purchase Order filter option missing '+label);
assert.match(js,/const filtered=all\.filter\(poMatchesListFilters\)/,'PO rows must be filtered from source data');
assert.match(js,/const open=filtered\.filter/,'PO KPI calculations must reflect the filtered view');
assert(js.includes("filtered.length+' of '+all.length+' Purchase Orders"),'Filtered result count must be visible');
assert(css.includes('Purchase Order list filters'),'PO filter styling missing');
assert(build.includes('test-purchase-order-filters-v152.mjs'),'PO filter regression test must run in production build');
console.log('PASS Purchase Order list filters supplier/status/payment/receiving/health/date/link/search and filtered KPIs');
