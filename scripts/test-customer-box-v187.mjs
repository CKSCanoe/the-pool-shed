// v1.87: the customer box on a sales order is one search line, not a second card inside the card.
import fs from 'node:fs';
const js = fs.readFileSync('public/sales-order-customer-picker.js', 'utf8');
const css = fs.readFileSync('public/assets/css/system/76-overhaul-flows.css', 'utf8');
const fail = m => { console.error('FAIL customer box v1.87: ' + m); process.exit(1); };
const markup = js.slice(js.indexOf('function pickerMarkup('), js.indexOf("if (typeof customerProfileCard === 'function')"));
if (!/so-cp-compact/.test(markup)) fail('compact picker class missing');
for (const gone of ['so-customer-picker-head', 'so-customer-current', '<kbd>', 'Find or create a CRM customer']) if (markup.includes(gone)) fail('old part still in the picker: ' + gone);
if (!/placeholder="Change customer…"/.test(markup)) fail('short placeholder missing');
if (!/data-so-customer-search=/.test(markup) || !/data-so-new-customer=/.test(markup) || !/data-so-customer-results/.test(markup)) fail('search, new customer or results hook missing');
if (js.includes('Enter to select · ↑↓ to navigate')) fail('keyboard hint still in the results header');
if (!/\.so2-summary-card\.so2-customer-card[^{]*\{ overflow: visible !important; \}/.test(css)) fail('customer card must not clip the results list');
if (!/so-cp-compact \.so-customer-results \{[^}]*top: calc\(100% \+ 4px\)/.test(css)) fail('results list should drop down under the search line');
console.log('Customer box v1.87: one search line, no repeated heading, results float over the page.');
