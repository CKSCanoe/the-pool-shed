import fs from 'node:fs';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const index=fs.readFileSync('public/index.html','utf8');
const sw=fs.readFileSync('public/service-worker.js','utf8');
const js=fs.readFileSync('public/sales-workspace.js','utf8');
const css=fs.readFileSync('public/assets/css/system/41-sales-order-command.css','utf8');

const checks=[
  ['release version',pkg.version==='1.7.5'],
  ['single app stylesheet remains authoritative',index.includes('assets/css/app.css?v=1.7.5') && !index.includes('sales-order-command.css')],
  ['final sales-order module is last in css build order',fs.readFileSync('scripts/build-css.mjs','utf8').indexOf('41-sales-order-command.css')>fs.readFileSync('scripts/build-css.mjs','utf8').indexOf('40-design-system.css')],
  ['sales workspace versioned',index.includes('sales-workspace.js?v=1.7.5')],
  ['service worker cache advanced',sw.includes('pool-shed-v1.7.5-ui-ownership')],
  ['service worker precaches versioned app css',sw.includes('assets/css/app.css?v=1.7.5')],
  ['direct command shell',js.includes('so3-command-header') && js.includes('so3-summary-grid') && js.includes('so3-order-workspace')],
  ['three core cards',js.includes('so2CustomerCard(order,c)') && js.includes('so3-order-details') && js.includes('so3-fulfilment')],
  ['save order command',js.includes('data-save-order=') && js.includes('Save Order')],
  ['payment remains beside authoritative totals',js.includes('Take / Record Payment') && js.includes('salesOrderTotalsBox')],
  ['selected precision row retained',js.includes('so2-lines-table') && js.includes('so2LineRows(order)')],
  ['separate variant column',js.includes('so2-variant-head') && js.includes('data-so2-variant')],
  ['variant lifecycle lock',js.includes('Release allocation and fulfilment activity before changing variant.')],
  ['line menu top layer',css.includes('body .so2-line-menu') && css.includes('z-index:2147483600')],
  ['product intelligence neutralized',css.includes('#salesOrderProductResults') && css.includes('background:#fff!important')],
  ['no legacy transform shell used as final output',!js.includes("template.innerHTML = originalDetail(order).replace('sales-order-compact'")],
];

let failed=0;
for(const [name,ok] of checks){
  console.log(`${ok?'PASS':'FAIL'} ${name}`);
  if(!ok) failed++;
}
if(failed) process.exit(1);
