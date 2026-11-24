// v1.96: the separate bundle "intelligence" layer was never shown (its panel was switched off) and duplicated the stock,
// transfer and purchasing rules. It is retired; bundles.js is the one bundle engine and its parts go through the normal
// allocation, fulfilment, ship-with-invoice and To order processes.
import fs from 'node:fs';
const html = fs.readFileSync('public/index.html', 'utf8');
if (fs.existsSync('public/bundle-sales-intelligence.js') || html.includes('bundle-sales-intelligence.js')) throw new Error('Retired bundle intelligence layer is still linked');
const engine = fs.readFileSync('public/bundles.js', 'utf8');
for (const token of ['bundleInstanceId', 'bundleComponentSnapshot', 'function canMake', 'function setQty', 'PoolShedBundleEngine']) if (!engine.includes(token)) throw new Error('Bundle engine missing ' + token);
if (!fs.readFileSync('public/po-receive.js', 'utf8').includes("'Part of ' + (l.bundleParentName")) throw new Error('Short bundle parts must show in To order');
console.log('Bundle sales intelligence tests: Passed (retired in v1.96; one bundle engine)');
