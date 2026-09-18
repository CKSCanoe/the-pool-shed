import fs from 'node:fs';
import assert from 'node:assert/strict';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const release=pkg.version;
const [major,minor]=release.split('.').map(Number);
const index=fs.readFileSync('public/index.html','utf8');
const sw=fs.readFileSync('public/service-worker.js','utf8');
const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const readiness=fs.readFileSync('public/production-readiness-engine.js','utf8');
const buildCss=fs.readFileSync('scripts/build-css.mjs','utf8');
assert(major>1||(major===1&&minor>=26),'Foundation Authority requires v1.26.0 or newer');
assert.match(sw,new RegExp(`pool-shed-v${release.replace(/\\./g,'\\\\.')}-`));
assert.match(readiness,new RegExp(`VERSION='${release.replace(/\\./g,'\\\\.')}'`));
assert.match(legacy,new RegExp(`Pool Shed v${release.replace(/\\./g,'\\\\.')} · Pool Bros Ltd`));
assert.match(legacy,new RegExp(`service-worker\\.js\\?v=${release.replace(/\\./g,'\\\\.')}`));
for(const f of ['identity-authority.js','audit-authority.js','record-router.js']){
  assert(index.includes(`./${f}?v=${release}`),`index missing retained ${f}`);
  assert(sw.includes(`./${f}?v=${release}`),`service worker missing retained ${f}`);
}
const order=['identity-authority.js','audit-authority.js','assets/js/01-legacy-01.js','settings-permissions-engine.js','record-router.js','notifications-command-workspace.js'];
let pos=-1;for(const token of order){const i=index.indexOf(token);assert(i>pos,token+' must load after preceding foundation authority');pos=i;}
assert.match(buildCss,/58-foundation-authority\.css/);
assert.match(pkg.scripts['test:foundation']||'',/test-foundation-audit-integration-v126\.mjs/);
assert.match(pkg.scripts['test:foundation']||'',/test-foundation-release-v126\.mjs/);
assert.match(pkg.scripts.validate||'',/test:foundation/);
assert.match(pkg.scripts['test:database']||'',/test-accounting-database\.mjs/);
assert.match(pkg.scripts['test:database']||'',/test-workspace-database\.mjs/);
assert.match(pkg.scripts['test:database']||'',/test-project-database\.mjs/);
assert.match(pkg.scripts['test:browser']||'',/test-browser-smoke\.cjs/);
assert.equal(fs.existsSync('public/notifications-command-engine.js'),true,'v1.25 Notifications must remain');
assert.equal(fs.existsSync('public/notifications-command-workspace.js'),true,'v1.25 Notifications workspace must remain');
console.log(`PASS v1.26 Foundation Authority retained on v${release}`);
