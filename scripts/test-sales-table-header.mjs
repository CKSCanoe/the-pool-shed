import fs from 'node:fs';
const css=fs.readFileSync('public/pool-shed-overhaul.css','utf8');
const sw=fs.readFileSync('public/service-worker.js','utf8');
const checks=[
  ['sales lines have bounded scroll region', /#screen-salesorders \.order-lines-scroll \{[\s\S]*max-height:clamp\(360px,58vh,680px\)/],
  ['table header sticks to scroll container top', /#screen-salesorders \.order-lines-table thead th \{[\s\S]*position:sticky;[\s\S]*top:0;/],
  ['legacy viewport offset removed', !css.includes('top:78px')],
  ['new service worker cache is used', sw.includes('pool-shed-app-v1-po-picker-modal-final-sales-table-header-fix')]
];
let failed=0;
for (const [name,test] of checks){ const ok=typeof test==='boolean'?test:test.test(css); console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++; }
if(failed) process.exit(1);
