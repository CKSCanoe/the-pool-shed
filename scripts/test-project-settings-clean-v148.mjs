import fs from 'node:fs';
import assert from 'node:assert/strict';

const workspace=fs.readFileSync('public/project-workspace.js','utf8');
const engine=fs.readFileSync('public/project-engine.js','utf8');
const start=workspace.indexOf('function psProjectSettings(job,p)');
const end=workspace.indexOf('\n\nfunction psProjectWorkspace()',start);
assert(start>=0&&end>start,'Project Settings view must exist');
const settings=workspace.slice(start,end);

assert.match(settings,/data-project-form="project-details"|psProjectForm\(job,'project-details'/,'Project Settings must save project identity through project-details');
assert.match(settings,/Project name/,'Project name must be editable');
assert.match(settings,/Project owner/,'Project owner must remain editable');
assert.match(settings,/Target completion/,'Target completion must remain editable');
assert.match(settings,/Project notes \/ success goal/,'Project notes must remain editable');
for (const legacy of ['quoteNet','remainingNet','riskBufferNet','minimumMargin','warningMargin','targetMargin','lossWarningMargin','invoiceExposureThresholdPct','invoiceExposureThresholdNet']) {
  assert(!settings.includes("'"+legacy+"'")&&!settings.includes('"'+legacy+'"'),'Project Settings must not expose manual commercial field '+legacy);
}
assert.match(settings,/Sales Orders drive customer value/,'Settings must explain the live commercial source');
assert.match(engine,/action==='project-details'/,'Project engine must support identity-only settings saves');
assert.match(engine,/j\.name=text\(v\.name,'the project name'\)/,'Project name must persist through the project engine');

console.log('PASS Project Settings is identity-only and commercial values remain document-driven');
