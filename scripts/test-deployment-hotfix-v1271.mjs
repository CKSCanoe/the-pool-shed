import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const index = fs.readFileSync('public/index.html','utf8');
const sw = fs.readFileSync('public/service-worker.js','utf8');
const legacy = fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const readiness = fs.readFileSync('public/production-readiness-engine.js','utf8');
const current = fs.readFileSync('CURRENT-RELEASE.txt','utf8');
const build = fs.readFileSync('scripts/build.sh','utf8');

assert.match(pkg.version, /^1\.27\.[1-9]\d*$/, 'deployment hotfix must remain on a v1.27.x patch release');
assert.match(current, /Pool Shed v1\.27\.[1-9]\d* - /);
assert.match(index, new RegExp('app\\.css\\?v=' + pkg.version.replace(/\./g,'\\.')));
assert.doesNotMatch(index, /\?v=1\.27\.0/);
assert.match(sw, new RegExp('pool-shed-v' + pkg.version.replace(/\./g,'\\.')));
assert.doesNotMatch(sw, /v1\.27\.0/);
assert.match(legacy, new RegExp('Pool Shed v' + pkg.version.replace(/\./g,'\\.') + ' · Pool Bros Ltd'));
assert.match(legacy, new RegExp('service-worker\\.js\\?v=' + pkg.version.replace(/\./g,'\\.')));
assert.match(readiness, new RegExp("VERSION='" + pkg.version.replace(/\./g,'\\.') + "'"));
assert.match(pkg.scripts['test:deployment'] || '', /test-deployment-lock-v1271\.mjs/);
assert.match(pkg.scripts['test:deployment'] || '', /test-deployment-hotfix-v1271\.mjs/);
assert.match(build, /test-deployment-lock-v1271\.mjs/, 'build must verify manifest-lock synchronisation before producing dist');

console.log('PASS retained v1.27 deployment hotfix version, cache and lockfile guard wiring');
