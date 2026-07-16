import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const required = [
  'Catalogue','Create Product','Import Catalogue','Pricing','Catalogue Health',
  'All Customers','Create Customer','Profile Details','Pricing & Credit','Addresses','History',
  'Purchase Orders','Suppliers','Supplier Catalogues','Supplier Backorders','Linked Sales Orders','Forecasting',
  'Goods In','QC Checks','Label Printing','Guided Putaway','Returns','Damaged','Stock Counts',
  'Goods Notes','Picking List','Pick','Pack','Ship','Tracking',
  'Invoice Ready','Supplier Bills','COGS','Stock Valuation','Credits',
  'Menu Layout','My Profile','My Settings','Training','Statuses','Tags','Integrations'
];
for (const label of required) assert.ok(html.includes(label), `Missing page/menu label: ${label}`);
assert.ok(html.includes('pool-shed-operational-v172'), 'Offline database/cache version not updated');
assert.ok(html.includes('poolshed:v172:appData'), 'v172 app storage missing');
assert.ok(html.includes('operationalEmptyState'), 'Empty-state protection missing');
assert.ok(!html.includes('Reset clean slate'), 'Demo reset control still present');
assert.ok(!html.includes('poolbros123'), 'Demo password still present');
console.log('Page, offline and demo-removal audit passed');
