import fs from 'node:fs';
import assert from 'node:assert/strict';

const productionFiles=[
  'public/assets/js/01-legacy-01.js','public/project-workspace.js','public/project-engine.js',
  'public/inventory-control-engine.js','public/product-hub-engine.js','public/analytics-command-engine.js',
  'public/action-source-adapters.js','public/assistant-engine.js','public/settings-permissions-engine.js'
];
const source=productionFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const retired=[
  'Engineer'+' Requests','Engineer'+' Request','engineer'+'Requests','engineer'+'-request','#/'+'engineer','engineer'+'RequestId'
];
for(const phrase of retired) assert.equal(source.includes(phrase),false,'Retired request-layer identifier must not remain in production modules');
const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
assert.match(legacy,/\{ id: "quotes", label: "Quotes"/);
assert.match(legacy,/Dashboard → CRM → Quotes → Sales Orders → Projects → Product Hub → Inventory → Purchasing/);
assert.match(legacy,/data-create-quote-customer/,'CRM must expose direct quote creation');
const project=fs.readFileSync('public/project-workspace.js','utf8');
assert.match(project,/Open Sales Orders/);
assert.match(project,/Purchase Orders/);
const quote=fs.readFileSync('public/quote-studio-workspace.js','utf8');
assert.match(quote,/newQuoteForCustomer/);
console.log('PASS v1.31 Quotes-first flow and direct Sales Order / Project purchasing authority');
