import fs from 'node:fs';import assert from 'node:assert/strict';
assert(fs.existsSync('public/product-hub-workspace.js'),'Product Hub workspace authority must exist');
const js=fs.readFileSync('public/product-hub-workspace.js','utf8');const html=fs.readFileSync('public/index.html','utf8');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
for(const token of ['Product Command','Catalogue','Replenishment','Product Groups','Bundle Studio','Imports','Catalogue Health','PRODUCT DETAILS','Identity & Groups','Suppliers & Cost','Price Books','Stock Rules','Accounting','Media & Docs','Bundles & Relations','Movement & Audit']) assert(js.includes(token),`Product Hub workspace missing ${token}`);
for(const token of ['Available','On Hand','Allocated','Inbound','Supplier SKU','Margin','Reorder','Target','MOQ','Suggested']) assert(js.includes(token),`Catalogue/replenishment quick glance missing ${token}`);
// v1.93: the old catalogue table (its Core / Purchasing / Sales / Warehouse presets and row quick view) was retired; the
// catalogue list (catalogue-list.js) and one-page editor (product-editor.js) carry the same glance and more.
const cl=fs.readFileSync('public/catalogue-list.js','utf8'),pe=fs.readFileSync('public/product-editor.js','utf8');
for(const token of ['Kept in stock','Needs ordering','Needs attention','Archived']) assert(cl.includes(token),`Catalogue tab missing ${token}`);
assert(pe.includes('data-pe-all="Overview">All fields'),'Product editor must still open the full record');
assert(js.includes('data-ph-create-replenishment-po'),'Replenishment must create reviewed Draft PO');
assert(html.includes(`./product-hub-engine.js?v=${pkg.version}`),'Product Hub engine must be versioned in runtime');
assert(html.includes(`./product-hub-workspace.js?v=${pkg.version}`),'Product Hub workspace must be versioned in runtime');
console.log('PASS Product Hub Command, catalogue quick-glance and Product Details structure');
