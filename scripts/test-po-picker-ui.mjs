import fs from 'node:fs';
const js = fs.readFileSync(new URL('../public/catalogue-intelligence.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/catalogue-intelligence.css', import.meta.url), 'utf8');
const checks = [
  [js.includes('Add selected products to PO'), 'missing clear PO confirmation action'],
  [js.includes('basketTotalCost'), 'missing selected basket total calculation'],
  [js.includes('ci-po-actionbar'), 'missing sticky PO action bar'],
  [js.includes("data-ci-basket-confirm"), 'missing PO commit handler target'],
  [css.includes('.ci-po-confirm-button'), 'missing branded PO confirmation styling'],
  [css.includes('max-height: min(76vh, 680px)'), 'PO selector is not viewport safe'],
  [css.includes('min-height: 68px'), 'PO result rows are not compact'],
  [css.includes('overflow-y: auto'), 'PO results are not independently scrollable']
];
for (const [ok, message] of checks) if (!ok) throw new Error(message);
console.log('PO compact picker UI checks passed.');
