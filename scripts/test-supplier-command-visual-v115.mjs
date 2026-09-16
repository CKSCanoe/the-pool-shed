import fs from 'node:fs';import assert from 'node:assert/strict';
const path='public/assets/css/system/49-supplier-command.css';assert(fs.existsSync(path),'Supplier Command CSS authority must exist');const css=fs.readFileSync(path,'utf8');
for(const token of ['.supplier-command-page','.supplier-command-grid','.supplier-command-queue','.supplier-details-card','.supplier-attention-rail','.supplier-credit-meter','.supplier-smart-flag','.supplier-product-table','.supplier-detail-tabs'])assert(css.includes(token),`missing Supplier Command selector ${token}`);
assert(css.includes('var(--color-brand-navy)')&&css.includes('var(--color-action-focus)'),'Supplier Command must use governed design tokens');
console.log('PASS Supplier Command Option C visual authority selectors');
