import fs from 'node:fs';

const legacy = fs.readFileSync(new URL('../public/assets/js/01-legacy-01.js', import.meta.url), 'utf8');
const workspace = fs.readFileSync(new URL('../public/product-hub-workspace.js', import.meta.url), 'utf8');

function requireText(source, token, message) {
  if (!source.includes(token)) throw new Error(message + ` (missing ${token})`);
}

// Legacy product workflows must retain authority while their dedicated view is active.
requireText(workspace, "['create','bulk','prices','health'].includes(productView)", 'Product Hub must delegate legacy create/import/pricing/health views instead of replacing them on rerender');
requireText(workspace, 'return legacyRenderProducts()', 'Product Hub must call the proven legacy product renderer for delegated views');

// Bulk CSV must carry the replenishment and supplier buying rules introduced in v1.11.0.
for (const field of [
  'mpn',
  'aliases',
  'restockTo',
  'replenishmentEnabled',
  'minimumOrderQuantity',
  'orderMultiple',
  'leadTimeDays',
  'preferredSupplier'
]) {
  requireText(legacy, `"${field}"`, `CSV import/export must include ${field}`);
}

requireText(legacy, '"restockTo", "minimumOrderQuantity", "orderMultiple", "leadTimeDays"', 'Bulk import must parse replenishment quantities and lead time as numbers');
requireText(legacy, '"trackBatch", "trackSerial", "replenishmentEnabled"', 'Bulk import must parse replenishmentEnabled as a boolean');

console.log('Product Hub v1.11.0 import/replenishment regression passed.');
