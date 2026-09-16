import fs from 'node:fs';

const js = fs.readFileSync('public/project-workspace.js','utf8');
const failures = [];
const must = (ok, msg) => { if (!ok) failures.push(msg); };

must(js.includes('>PROJECT DETAILS<'), 'project detail kicker must read PROJECT DETAILS');
must(js.includes('aria-label="Project Details sections"'), 'project detail tab navigation must be labelled Project Details');
must(js.includes('No current Project Details exception is above its configured threshold.'), 'project detail empty health copy must use Project Details wording');
must(js.includes('Project Details links their material demand and costs.'), 'linked Sales Order guidance must use Project Details wording');

for (const visibleLegacy of [
  '>PROJECT 360<',
  'aria-label="Project 360 sections"',
  'No current Project 360 exception is above its configured threshold.',
  'Project 360 links their material demand and costs.'
]) must(!js.includes(visibleLegacy), `staff-facing legacy wording remains: ${visibleLegacy}`);

if (failures.length) {
  console.error('Project Details v1.24 naming failed:');
  failures.forEach((x) => console.error(' - ' + x));
  process.exit(1);
}
console.log('PASS Project Details v1.24 staff-facing naming contract.');
