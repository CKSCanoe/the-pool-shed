import fs from 'node:fs';import assert from 'node:assert/strict';
const eng=fs.readFileSync('public/inventory-control-engine.js','utf8');const ui=fs.readFileSync('public/inventory-workspace.js','utf8');
for(const token of ['Standard Service Van','Installation Van','Summer Service','Winter Service','countCadenceDays','profilePreview','ensureReminders','repeated-variance','over-max']) assert((eng+ui).includes(token),`Engineer stock feature missing ${token}`);
assert((eng+ui).includes('Review suggestion'),'Smart thresholds must remain advisory');
assert(!(eng+ui).includes('autoApplyThreshold'),'Thresholds must not self-edit');
console.log('PASS engineer van profiles, reminders and advisory stock intelligence');
