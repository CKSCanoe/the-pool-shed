import fs from 'node:fs';
const index=fs.readFileSync('public/index.html','utf8');
const css=fs.readFileSync('public/pool-shed-overhaul.css','utf8');
const js=fs.readFileSync('public/pool-shed-overhaul.js','utf8');
const engine=fs.readFileSync('public/bundle-engine.js','utf8');
const intelligence=fs.readFileSync('public/bundle-sales-intelligence.js','utf8');
const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const sw=fs.readFileSync('public/service-worker.js','utf8');
const checks=[
 ['overhaul assets linked', index.includes('pool-shed-overhaul.css')&&index.includes('pool-shed-overhaul.js')],
 ['clean boot shell enabled', index.includes('class="ps-booting"')&&index.includes('psBootScreen')],
 ['large bundle intelligence panel disabled', intelligence.includes('large legacy panel is intentionally not mounted')],
 ['bundle components carry zero sales-order cost', engine.includes('unitPrice:0,unitCost:0')],
 ['bundle save preserves master product cost', engine.includes('p.bundleComponentCost=totals.cost')&&!engine.includes('p.cost=totals.cost')],
 ['cost tab respects bundle component zero cost', legacy.includes('line.bundleRole === "component" ? 0')],
 ['sales toolbar is sticky and compact', css.includes('record-card.sales-order-compact > .record-top')&&css.includes('position:sticky')],
 ['bundle hierarchy styles exist', css.includes('tr.bundle-line-child')&&css.includes('.ps-bundle-toggle')],
 ['additional charge composer collapses', css.includes('.so-line-composer:not(.is-open)')&&js.includes('data-ps-line-composer')],
 ['sales product search watchdog present', js.includes('searchWatchdog')],
 ['fulfilment sequence is explicit', legacy.includes('Print, Pick, Pack & Ship')&&legacy.includes('Print · Pick · Pack · Ship')],
 ['offline cache includes overhaul assets', sw.includes('pool-shed-overhaul.css')&&sw.includes('pool-shed-overhaul.js')]
];
for(const [name,ok] of checks){if(!ok){console.error('FAIL',name);process.exit(1)}console.log('PASS',name)}
console.log('Production overhaul checks passed.');
