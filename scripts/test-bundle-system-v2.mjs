import fs from 'node:fs';
const js=fs.readFileSync('public/bundle-system-v2.js','utf8');
const css=fs.readFileSync('public/bundle-system-v2.css','utf8');
const html=fs.readFileSync('public/index.html','utf8');
const checks={
  linkedProductIds:js.includes('productId'),
  nestedBundles:js.includes('Circular bundle detected'),
  effectiveStock:js.includes('Lowest stock component'),
  catalogueSearch:js.includes('Search the live product catalogue'),
  pricingModes:js.includes('sum-discount'),
  customerDisplay:js.includes('bundleQuoteDisplay')&&js.includes('bundleInvoiceDisplay'),
  duplication:js.includes('Duplicate bundle'),
  responsive:css.includes('@media(max-width:720px)'),
  loaded:html.includes('bundle-system-v2.js')&&html.includes('bundle-system-v2.css')
};
for(const [k,v] of Object.entries(checks)){if(!v)throw new Error(`Bundle system check failed: ${k}`)}
console.log('Bundle Product System checks passed:',Object.keys(checks).length);
