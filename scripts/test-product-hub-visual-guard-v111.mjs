import fs from 'node:fs';import assert from 'node:assert/strict';
assert(fs.existsSync('public/assets/css/system/46-product-hub-command.css'),'Product Hub CSS authority must exist');
const css=fs.readFileSync('public/assets/css/system/46-product-hub-command.css','utf8');
for(const token of ['.product-hub-v111','.ph-catalogue-table','.ph-stock-stack','.ph-quick-drawer','.ph-replenishment','.ph-product-360','.ph-bundle-studio','overflow-x:auto','@media']) assert(css.includes(token),`Product Hub visual authority missing ${token}`);
assert(!/(^|})\s*(button|input|select|textarea|table|th|td)\s*\{/m.test(css),'Product Hub CSS must not leak shared base selectors');
for(const bad of ['font-size:9px','font-size: 9px']) assert(!css.includes(bad),'Product Hub must not introduce unreadable 9px text');
console.log('PASS Product Hub scoped visual authority and responsive guards');
