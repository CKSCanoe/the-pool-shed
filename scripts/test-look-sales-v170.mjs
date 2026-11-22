// v1.70 Sales on the new look: every Sales screen (orders list and order page, quotes list, contracts, web orders,
// returns) uses the kit; the order page is a record layout (header, progress line, cards, underline tabs, lines with
// the full width on laptop screens, compact "add" row); the quotes list sits inside the app with the menu while the
// quote editor keeps its full-screen studio; each Sales page has its own one-line description.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const kit = fs.readFileSync('public/assets/css/system/68-pool-shed-kit.css', 'utf8'), frame = fs.readFileSync('public/back-office-frame.js', 'utf8');
assert(/var KIT_TABS = \{ salesorders: 1, quotes: 1,/.test(frame), 'whole Sales area on the kit');
assert(/screen\.querySelector\('\.qs-studio-root'\)\) kitOn = false/.test(frame) && /\.ps-kit-scope:not\(:has\(> \.qs-studio-root\)\)/.test(kit), 'quote editor excluded');
assert(/body\.ps-kit:has\(#screen-quotes\.ps-kit-scope:not\(\.hidden\) > \.qs-root:not\(\.qs-studio-root\)\) \.sidebar \{ display: flex !important; \}/.test(kit), 'quotes list keeps the menu');
assert(/:is\(#screen-dashboard, [^)]*#screen-salesorders[^)]*\)\.ps-kit-scope/.test(kit), 'kit rules anchored to screen ids');
for (const [re, why] of [[/\.so3-command-actions \.so3-invoice \{ display: none/, 'duplicate Invoice button removed'], [/\.sof-rail li\.now \{ background: var\(--k-brand\)/, 'current step in brand colour, not alarm red'],
  [/@media \(min-width: 1680px\)/, 'side panel only on wide screens'], [/@media \(max-width: 1679px\)/, 'cards in a row above the tabs on laptops'],
  [/\.tabs-row \.tab-chip\.active \{ color: var\(--k-brand\)/, 'underline tabs'], [/details\.so4-tool-card > summary strong::before \{ content: "\+ "/, 'compact add row'],
  [/\.so4-commercial-check \{ display: none/, 'commercial check card hidden'], [/\.so2-lines-table th:nth-child\(4\)[^{]*\{ width: 150px !important; max-width: 170px !important; min-width: 0/, 'lines table columns fit'],
  [/button\.pill\.blue \{ background: var\(--k-brand\)/, 'view switches look like the round filters'], [/\.so-list-kpi \{ background: var\(--k-surface\)/, 'figure cards on contracts and others']]) assert(re.test(kit), why);
for (const k of ['salesorders|Sales Orders', 'salesorders|Contracts', 'salesorders|Web Orders', 'salesorders|Sales Credits', 'quotes|Quotes']) assert(frame.includes("'" + k + "': '"), 'description for ' + k);
assert(!/#[0-9a-f]{3,6}\b/i.test(kit.replace(/\/\*[\s\S]*?\*\//g, '')), 'still no hard-coded colours');
console.log('Look Sales v1.70: whole Sales area on the kit, order record layout, quotes list in the app, editor untouched.');
