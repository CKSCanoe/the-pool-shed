import fs from 'node:fs';import assert from 'node:assert/strict';const css=fs.readFileSync('public/finance-command.css','utf8');
assert(css.includes('#102b3a')||css.includes('#102B3A'),'Finance Command must retain Pool Shed navy authority');
assert(css.includes('#007a8c')||css.includes('#007A8C'),'Finance Command must retain restrained Pool Shed teal accent');
assert(!/linear-gradient|radial-gradient/i.test(css),'Finance Command must not introduce generic SaaS gradients');
assert(!/font-size\s*:\s*[0-9](?:px)?\s*[;}]/i.test(css),'Finance Command must not introduce unreadably small text');
console.log('PASS Finance Command visual authority guard');
