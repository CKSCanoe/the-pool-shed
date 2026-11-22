// v1.67 catalogue speed: the Catalogue page draws 100 products at a time (it drew all ~6,800), with Previous / Next and
// "Showing x–y of n"; search, filters and sort still cover the whole catalogue and send you back to page 1.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const js = fs.readFileSync('public/product-hub-workspace.js', 'utf8'), css = fs.readFileSync('public/assets/css/app.css', 'utf8');
assert(/const size=100,pages=Math\.max\(1,Math\.ceil\(rows\.length\/size\)\)/.test(js), '100 per page');
assert(/shown=rows\.slice\(from,from\+size\)/.test(js) && /catalogueTable\(shown\)/.test(js) && !/\+catalogueTable\(rows\)/.test(js), 'only the current page is drawn');
assert(/const rows=catalogueRows\(\)/.test(js), 'search and filters still run over every product');
assert(/Showing '\+\(from\+1\)\+'–'\+\(from\+shown\.length\)\+' of '/.test(js) && /data-ph-page="'\+\(page-1\)/.test(js) && /data-ph-page="'\+\(page\+1\)/.test(js), 'pager');
assert((js.match(/phState\.catalogPage=1;/g) || []).length >= 2, 'filters and search go back to page 1');
assert(/closest\('\[data-ph-page\]'\);if\(pg&&!pg\.disabled\)/.test(js), 'page buttons handled');
assert(/Math\.min\(Math\.max\(1,Number\(phState\.catalogPage\)\|\|1\),pages\)/.test(js), 'page kept within range when the list shrinks');
assert(/\.ph-pager\{/.test(css));
console.log('Catalogue paging v1.67: 100 products drawn at a time, filters over everything, back to page 1 on change.');
