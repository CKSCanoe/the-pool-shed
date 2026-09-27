import fs from 'node:fs';import assert from 'node:assert/strict';import pkg from '../package.json' with {type:'json'};
const release=pkg.version,html=fs.readFileSync('public/index.html','utf8'),sw=fs.readFileSync('public/service-worker.js','utf8'),legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8'),build=fs.readFileSync('scripts/css-modules.mjs','utf8');
const [major,minor]=release.split('.').map(Number);assert(major>1||(major===1&&minor>=18));
for(const f of ['automation-command-engine.js','automation-command-workspace.js']){assert(html.includes(`./${f}?v=${release}`),`missing ${f}`);assert(sw.includes(`./${f}?v=${release}`),`service worker missing ${f}`);}
assert.match(html,/\.\/azzy-jarvis-host\.js\?v=1\.45\.1-jarvis-final/);assert.match(sw,/azzy-jarvis-host\.js\?v=1\.45\.1-jarvis-final/);
assert.equal(fs.existsSync('public/assistant-engine.js'),false);assert.equal(fs.existsSync('public/azzy-live.js'),false);assert.equal(fs.existsSync('public/azzy-live.css'),false);
assert(html.includes(`app.css?v=${release}`));assert(sw.includes(`pool-shed-v${release}-`));assert(legacy.includes('{ id: "automation", label: "Automation"'));assert(legacy.includes('__POOL_SHED_CAN_ACCESS__'));assert(build.includes('system/52-automation-command.css'));
console.log(`PASS Automation + single Azzy Jarvis runtime retained on v${release}`);
