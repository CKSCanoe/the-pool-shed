// v1.67 catalogue speed, carried into the v1.92 catalogue list (the old table was retired in v1.93): only one page of
// products is drawn at a time with Previous / Next and "x–y of n"; search, filters and sort cover the whole catalogue and
// send you back to page 1; the page stays within range when the list shrinks.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const js = fs.readFileSync('public/catalogue-list.js', 'utf8'), hubJs = fs.readFileSync('public/product-hub-workspace.js', 'utf8');
assert(/var PAGE = 50;/.test(js), '50 products per page');
assert(/var shown = rows\.slice\(\(st\.page - 1\) \* PAGE, st\.page \* PAGE\)/.test(js) && /shown\.map\(famRow\)/.test(js), 'only the current page is drawn');
assert(/var rows = sorted\(fams\.filter\(function\(f\)\{ return inTab\(f, st\.tab\) && matches\(f\); \}\)\)/.test(js), 'search and filters run over every product');
assert(/data-cl-page="' \+ \(st\.page - 1\)/.test(js) && /data-cl-page="' \+ \(st\.page \+ 1\)/.test(js) && / of ' \+ rows\.length/.test(js), 'pager');
assert((js.match(/st\.page = 1;/g) || []).length >= 3, 'search, filters and tabs go back to page 1');
assert(/st\.page = Math\.min\(Math\.max\(1, st\.page\), pages\)/.test(js), 'page kept within range when the list shrinks');
assert(/PoolShedCatalogueList\.listPage\(\)/.test(hubJs) && !/function cataloguePage\(/.test(hubJs), 'the old catalogue table is retired; the hub hands Catalogue to the new list');
console.log('Catalogue paging v1.67 (now v1.92 list): 50 products drawn at a time, filters over everything, back to page 1 on change.');
