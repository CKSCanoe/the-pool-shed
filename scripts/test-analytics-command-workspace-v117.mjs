import fs from 'node:fs';import assert from 'node:assert/strict';
assert(fs.existsSync('public/analytics-command-workspace.js'),'Analytics workspace missing');assert(fs.existsSync('public/assets/css/system/51-analytics-command.css'),'Analytics CSS authority module missing');
const js=fs.readFileSync('public/analytics-command-workspace.js','utf8'),css=fs.readFileSync('public/assets/css/system/51-analytics-command.css','utf8');
for(const token of ['Analytics Command','Overview','Business Performance','Sales','Projects','Operations','Purchasing & Suppliers','Inventory','Finance','Customers','Products','Metric Library','Reports & Data Export'])assert(js.includes(token),`missing Analytics page ${token}`);
for(const token of ['Management Attention','KPI Watchlist','Business Pulse','What is driving the change?','Data quality'])assert(js.includes(token),`missing Overview control ${token}`);
for(const token of ['Report Builder','Saved Reports','Management Reports','Data Export Centre','All System Data','Export History'])assert(js.includes(token),`missing reporting area ${token}`);
for(const token of ['Preview','Choose Fields','Filter','Download','Full System Export','Data Dictionary'])assert(js.includes(token),`missing export workflow ${token}`);
for(const token of ['.analytics-command','.analytics-metrics','.analytics-attention','.analytics-report-tabs','.analytics-data-catalogue'])assert(css.includes(token),`missing CSS token ${token}`);
new Function(js);console.log('PASS Analytics Command workspace, reporting areas and visual authority selectors');
