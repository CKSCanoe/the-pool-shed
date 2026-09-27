import fs from 'node:fs';
import assert from 'node:assert/strict';
const sql=fs.readFileSync('database/011-project-extra-quotes.sql','utf8'),dbTest=fs.readFileSync('scripts/test-project-database.mjs','utf8');
for(const needle of ['create or replace function public.ps_project_history_guard()','Accepted project quote linkage and approval evidence must be retained','Quote-linked extra approval requires accepted quote evidence','Accepted extra quote link requires customer acceptance evidence','Approved extra history must be retained','Cost history must be retained; record a reasoned correction','Queued invoice stage must remain unchanged'])assert(sql.includes(needle),'Missing project history guard: '+needle);
assert(dbTest.includes("'011-project-extra-quotes.sql'"),'Database regression runner must apply migration 011');
const executable=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n').trim();assert(executable.startsWith('begin;')&&executable.endsWith('commit;'),'Migration must remain transactional');
console.log('PASS project extra SQL migration wiring and retained history guards');
