// Vans & Fleet guard: the report and sign-off rules live in the database.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const code = fs.readFileSync('database/026-fleet-vans.sql', 'utf8').replace(/--.*$/gm, '');
for (const [re, why] of [
  [/You can only report on the van assigned to you/, 'engineers only report on their own van'],
  [/unique \(van_id, period\)/, 'one report per van per month'],
  [/This report has been submitted and is locked/, 'submitted reports are locked'],
  [/is lower than last recorded/, 'mileage cannot go backwards'],
  [/Add a note for each failed check/, 'failed checks need a note'],
  [/Add at least one photo of the damage/, 'damage needs a photo'],
  [/Sign the report and type your name/, 'engineer signature required'],
  [/A different person must sign off a report you submitted/, 'no self sign-off'],
  [/Only Admin or Management can manage vans and sign off reports/, 'managers manage and sign off'],
  [/case when \(me->>'manager'\)::boolean then v\.insurance_policy else null end/, 'policy number hidden from engineers'],
]) assert(re.test(code), why);
assert(/revoke all on public\.ps_vans, public\.ps_van_kit, public\.ps_van_checklist_items, public\.ps_van_reports, public\.ps_van_damage from anon, authenticated/.test(code), 'no direct staff access');
console.log('Migration 026 guard passed (Vans & Fleet).');
