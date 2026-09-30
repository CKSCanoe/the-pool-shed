import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('public/assets/css/system/42-sales-order-parity.css','utf8');
const sales = fs.readFileSync('public/sales-workspace.js','utf8');

for (const panel of ['custom','shipping']) {
  assert(
    sales.includes('data-line-composer-panel="'+panel+'"'),
    panel+' sales-order entry panel is missing'
  );
  assert(
    css.includes('data-line-composer-panel="'+panel+'"]'),
    panel+' card-specific layout override is missing'
  );
}

assert.match(
  css,
  /\.so4-tool-body\.so-line-form\[data-line-composer-panel="custom"\][\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/,
  'custom sales line must use a two-column card grid'
);
assert.match(
  css,
  /\.so4-tool-body\.so-line-form\[data-line-composer-panel="shipping"\][\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/,
  'shipping line must use a two-column card grid'
);
assert.match(css,/min-width:0!important/,'entry controls need shrink-safe fields');
assert.match(css,/box-sizing:border-box!important/,'entry controls must remain inside their cards');
assert.match(
  css,
  /@media\(max-width:620px\)[\s\S]*?grid-template-columns:1fr!important/,
  'custom and shipping forms must collapse to one column on small screens'
);
assert.match(
  css,
  /@media\(max-width:1180px\)[\s\S]*?\.so4-secondary-tools[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/,
  'secondary tool cards must use a roomier two-column layout before mobile'
);

console.log('PASS Sales Order custom and shipping entry cards use a responsive non-overlapping layout');
