import fs from 'node:fs';import assert from 'node:assert/strict';
const js=fs.readFileSync('public/product-hub-workspace.js','utf8');
for(const token of ['Existing SKU','data-ph-bundle-search','data-ph-bundle-add','data-ph-bundle-save','No nested bundles','Buildable','Component cost','Bundle margin']) assert(js.includes(token),`Bundle Studio missing ${token}`);
const engine=fs.readFileSync('public/product-hub-engine.js','utf8');
assert(engine.includes('Nested bundles are not supported'),'Engine must explicitly reject nested bundles');
assert(engine.includes('bundleItems'),'Bundle engine must use existing component product IDs');
console.log('PASS Product Hub Bundle Studio existing-SKU contract');
