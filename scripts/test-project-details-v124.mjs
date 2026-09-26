import fs from 'node:fs';

const js = fs.readFileSync('public/project-workspace.js','utf8');
const failures = [];
const must = (ok, msg) => { if (!ok) failures.push(msg); };

const current=fs.readFileSync('public/project-design-parity.js','utf8');
must(current.includes('PROJECT WORKSPACE'), 'current project workspace heading missing');
must(current.includes('aria-label="This project"'), 'current record navigation must be labelled');
must(current.includes('What needs attention'), 'current project health panel missing');
must(js.includes('Sales orders · cost & selling prices'), 'linked pricing workspace missing');

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
