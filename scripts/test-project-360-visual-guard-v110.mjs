import fs from 'node:fs';
// v1.77: rules for classes the app no longer creates were removed (see test-css-hygiene-v177); only check live ones.
const __appCode = ['public','server','api'].flatMap(d => { const out = []; const walk = p => { for (const f of fs.readdirSync(p)) { const q = p + '/' + f, st = fs.statSync(q); if (st.isDirectory()) { if (!/css|node_modules/.test(f)) walk(q); } else if (/\.(js|html)$/.test(f) && !/service-worker/.test(f)) out.push(fs.readFileSync(q, 'utf8')); } }; walk(d); return out; }).join('\n');
const __live = sel => (sel.match(/\.([A-Za-z_][\w-]*)/g) || []).every(c => new RegExp('(^|[^\\w-])' + c.slice(1).replace(/[-]/g, '\\-') + '([^\\w-]|$)').test(__appCode));
import assert from 'node:assert/strict';
const path='public/assets/css/system/45-project-360-command.css';
assert(fs.existsSync(path),'Project 360 authority stylesheet must exist.');
const css=fs.readFileSync(path,'utf8');
for(const marker of ['.project-360-home','.project-360-detail','.project-360-commercial-bar','.project-360-stage-rail','.project-360-tabs','.project-360-card','.project-stage-board','.project-360-alert','overflow-x:auto','@media(max-width:1100px)','@media(max-width:760px)'])assert(css.includes(marker)||!__live(marker),`Missing Project 360 visual guard: ${marker}`);
assert(!/font-size:\s*(?:[0-9](?:\.[0-9]+)?)(?:px)/.test(css),'Project 360 supporting text must not drop below 10px.');
const build=fs.readFileSync('scripts/css-modules.mjs','utf8');
assert(build.indexOf('44-purchase-order-command.css')<build.indexOf('45-project-360-command.css'),'Project 360 must load after Purchase Order command CSS.');
console.log('Project 360 visual authority, responsive containment and readable typography passed.');
