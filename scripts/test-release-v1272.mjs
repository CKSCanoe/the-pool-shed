import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const index = fs.readFileSync('public/index.html','utf8');
const sw = fs.readFileSync('public/service-worker.js','utf8');
const legacy = fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const readiness = fs.readFileSync('public/production-readiness-engine.js','utf8');
const current = fs.readFileSync('CURRENT-RELEASE.txt','utf8');
const build = fs.readFileSync('scripts/build.sh','utf8');
const css = fs.readFileSync('public/assets/css/system/52-automation-command.css','utf8');

assert.equal(pkg.version,'1.27.2');
assert.match(current,/Pool Shed v1\.27\.2 - Azzy Contrast & Readability Fix/);
assert.match(index,/app\.css\?v=1\.27\.2/);
assert.doesNotMatch(index,/\?v=1\.27\.1/);
assert.match(sw,/pool-shed-v1\.27\.2-my-work-action-authority/);
assert.doesNotMatch(sw,/\?v=1\.27\.1/);
assert.match(legacy,/Pool Shed v1\.27\.2 · Pool Bros Ltd/);
assert.match(legacy,/service-worker\.js\?v=1\.27\.2/);
assert.match(readiness,/VERSION='1\.27\.2'/);
assert.match(css,/v1\.27\.2 Azzy floating assistant contrast authority/);
assert.match(pkg.scripts['test:deployment']||'',/test-azzy-contrast-v1272\.mjs/);
assert.match(pkg.scripts['test:deployment']||'',/test-release-v1272\.mjs/);
assert.match(build,/test-azzy-contrast-v1272\.mjs/);
assert.match(build,/test-release-v1272\.mjs/);

console.log('PASS v1.27.2 release identity, cache busting and Azzy release guards');
