import fs from 'node:fs';import assert from 'node:assert/strict';
assert(fs.existsSync('public/assets/css/system/48-fulfilment-command.css'),'Fulfilment Command CSS module must exist');
const css=fs.readFileSync('public/assets/css/system/48-fulfilment-command.css','utf8');
for(const token of ['.fulfilment-command-v113','.ff-head','.ff-subnav','.ff-metrics','.ff-table-wrap','.ff-table','.ff-two-col','.ff-attention','.ff-timeline','.ff-detail-grid','.ff-gate','@media(max-width:1080px)','@media(max-width:760px)'])assert(css.includes(token),`Fulfilment CSS missing ${token}`);
assert(!/(?:^|})\s*(button|input|select|textarea|table|th|td)\s*\{/m.test(css),'Fulfilment CSS must not reclaim shared base selectors');
for(const tiny of css.matchAll(/font-size:\s*([0-9.]+)px/g)){assert(Number(tiny[1])>=10,`Fulfilment microcopy below 10px: ${tiny[0]}`);}
const build=fs.readFileSync('scripts/build-css.mjs','utf8');assert(build.includes('system/48-fulfilment-command.css'),'CSS build must include Fulfilment authority last');
console.log('PASS Fulfilment Command scoped visual authority, readability and responsive guards');
