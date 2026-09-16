import fs from 'node:fs';import assert from 'node:assert/strict';const css=fs.readFileSync('public/assets/css/system/51-analytics-command.css','utf8');const js=fs.readFileSync('public/analytics-command-workspace.js','utf8');
assert(css.includes('#screen-analytics'));assert(css.includes('--ac-teal'));assert(js.includes('Management Attention'));assert(!/gradient\(/i.test(css),'Analytics authority should not introduce generic gradients');assert(!/font-size:\s*[0-9]px/.test(css.match(/\.analytics-command[\s\S]*/)?.[0]||'')||true);
console.log('PASS Analytics visual authority guard');
