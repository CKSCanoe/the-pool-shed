import fs from 'node:fs';
const js=fs.readFileSync(new URL('../public/bundle-studio-v222.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/bundle-studio-v222.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const checks=[
  ['catalogue smart search',js.includes('Search by product name')||js.includes('product name, SKU, supplier SKU or barcode')],
  ['links existing product IDs',js.includes('productId:id')&&js.includes('bundleItems')],
  ['wizard integration',js.includes('data-product-step-panel="variants"')&&js.includes('bundleItemsJson')],
  ['profile integration',js.includes("window.productTab==='bundle'")&&js.includes('profileBuilder')],
  ['effective stock summary',js.includes('Effective bundle stock')&&js.includes('limiter')],
  ['no duplicate stock wording',js.includes('No duplicate stock')],
  ['fast indexed search',js.includes('indexCache')&&js.includes('.slice(0,10)')],
  ['responsive branded CSS',css.includes('--bs-blue:#007c9f')&&css.includes('@media(max-width:760px)')],
  ['global lexical catalogue access',js.includes("typeof data!=='undefined'")&&js.includes('Array.isArray(data.products)')],
  ['dropdown layering fix',css.includes('.bs-search-card.results-open')&&css.includes('z-index:10000')],
  ['assets included',html.includes('bundle-studio-v222.css')&&html.includes('bundle-studio-v222.js')]
];
const failed=checks.filter(([,ok])=>!ok);
if(failed.length){console.error(failed.map(([name])=>'FAIL: '+name).join('\n'));process.exit(1)}
console.log('Bundle Studio v2.2.2 checks: Passed');
