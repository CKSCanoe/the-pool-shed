import fs from 'node:fs';import assert from 'node:assert/strict';
const file='public/assets/css/system/59-my-work-action-authority.css';assert.ok(fs.existsSync(file),'My Work CSS missing');const css=fs.readFileSync(file,'utf8');
assert.ok(css.includes('.my-work-command'));assert.ok(css.includes('.my-work-summary'));assert.ok(css.includes('.my-work-action-card'));assert.ok(css.includes('.my-work-approval-card'));assert.ok(css.includes('@media'));assert.ok(css.includes('prefers-reduced-motion'));
assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css),'My Work CSS must use semantic tokens, not literal hex colours');assert.ok(!/\brgba?\s*\(/.test(css),'My Work CSS must use semantic tokens, not literal rgb colours');
for(const token of ['--color-action-primary','--color-surface-default','--color-text-primary','--color-border-default','--color-status-success','--color-status-attention','--color-status-danger'])assert.ok(css.includes(token),`missing ${token}`);
console.log('PASS v1.27 My Work Executive Premium semantic-token visual contract');
