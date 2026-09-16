import fs from 'node:fs';import assert from 'node:assert/strict';const js=fs.readFileSync('public/automation-command-workspace.js','utf8');
for(const token of ['Assistant & Automation','Assistant name','PNG avatar','image/png','Knowledge Library','Aliases & Search Terms','Answer only from Pool Shed'])assert(js.includes(token),`missing assistant setting ${token}`);
assert(js.includes('FileReader'),'avatar upload should use browser FileReader');assert(js.includes('data:image/png'),'PNG avatar guard missing');
console.log('PASS Assistant profile, transparent PNG, knowledge and Pool Shed-only settings contract');
