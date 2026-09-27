import fs from 'node:fs';import assert from 'node:assert/strict';
const file='public/settings-command-workspace.js';assert(fs.existsSync(file),'Settings Command workspace must exist');const src=fs.readFileSync(file,'utf8');
for(const page of ['Overview','Users','Roles & Permissions','Approval Limits','Locations & Access','Financial Visibility','Automation & Assistant','Integrations','Notifications','Company Settings','Audit & Security'])assert(src.includes(page),`missing ${page}`);
for(const text of ['Security Health','View system as','Full System Export','Financial Visibility','Approval Limits','Assistant permissions','Audit & Security'])assert(src.includes(text),`missing ${text}`);
for(const action of ['preview-user','edit-user','save-role','save-approval','save-location-scope','save-financial-visibility','save-notifications','open-audit'])assert(src.includes(action),`missing action ${action}`);
assert(src.includes('PoolShedSettingsPermissions'),'workspace must use central permission engine');
console.log('PASS Settings Command approved Option C structure and action coverage');
