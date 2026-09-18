import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const index = fs.readFileSync('public/index.html','utf8');
const sw = fs.readFileSync('public/service-worker.js','utf8');
const legacy = fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const readiness = fs.readFileSync('public/production-readiness-engine.js','utf8');
const current = fs.readFileSync('CURRENT-RELEASE.txt','utf8');
const build = fs.readFileSync('scripts/build.sh','utf8');

assert.equal(pkg.version, '1.27.1', 'deployment hotfix must identify as v1.27.1');
assert.match(current, /Pool Shed v1\.27\.1 - Deployment Lockfile Hotfix/);
assert.match(index, /app\.css\?v=1\.27\.1/);
assert.doesNotMatch(index, /\?v=1\.27\.0/);
assert.match(sw, /pool-shed-v1\.27\.1-my-work-action-authority/);
assert.doesNotMatch(sw, /v1\.27\.0/);
assert.match(legacy, /Pool Shed v1\.27\.1 · Pool Bros Ltd/);
assert.match(legacy, /service-worker\.js\?v=1\.27\.1/);
assert.match(readiness, /VERSION='1\.27\.1'/);
assert.match(pkg.scripts['test:deployment'] || '', /test-deployment-lock-v1271\.mjs/);
assert.match(pkg.scripts['test:deployment'] || '', /test-deployment-hotfix-v1271\.mjs/);
assert.match(build, /test-deployment-lock-v1271\.mjs/, 'build must verify manifest-lock synchronisation before producing dist');

console.log('PASS v1.27.1 deployment hotfix version, cache and lockfile guard wiring');
