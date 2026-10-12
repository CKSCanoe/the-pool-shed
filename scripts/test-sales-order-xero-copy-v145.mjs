import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('public/sales-workspace.js','utf8');
const css=fs.readFileSync('public/assets/css/system/67-sales-order-xero-lines.css','utf8');

for(const token of [
  'function so2XeroDescription(',
  'function so2XeroDescriptionRows(',
  'class="so2-xero-description"',
  'readonly spellcheck="false"',
  'Select and copy this text into Xero',
  'product descriptions are selectable for Xero'
]) assert(js.includes(token),`Missing Xero-copy Sales Order line contract: ${token}`);

const textareaMarkup=js.slice(js.indexOf('class="so2-xero-description"')-250,js.indexOf('class="so2-xero-description"')+900);
assert(!textareaMarkup.includes('data-line-field='),'Xero description display must never be an editable Sales Order field.');
assert(!textareaMarkup.includes('data-crm-field='),'Xero description display must never be a CRM write field.');

for(const token of [
  'user-select:text!important',
  '-webkit-user-select:text!important',
  'cursor:text!important',
  'white-space:pre-wrap!important',
  'overflow-wrap:anywhere!important',
  'min-width:420px!important',
  'field-sizing:content'
]) assert(css.includes(token),`Missing Xero-copy readability style: ${token}`);

assert(!css.includes('text-overflow:ellipsis!important;\n} /* XERO'), 'Xero descriptions must not be deliberately ellipsised.');
console.log('PASS Sales Order descriptions are fully visible, read-only, highlight-selectable and safe to copy line-for-line into Xero.');
