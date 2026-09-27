import fs from 'node:fs';import assert from 'node:assert/strict';
const js=fs.readFileSync('public/finance-command-workspace.js','utf8');
const actions=['open-customer','allocate','record-chase','edit-credit','credit-hold','open-sales-order','create-invoice','open-supplier','open-bill','open-po','three-way','payment-run','request-credit','sync-now','connect-xero','select-tenant','reconcile','month-exceptions','export-report','record-payment','supplier-payment','reconcile-document','refresh-document'];
for(const action of actions){assert(js.includes(`data-fc-action="${action}`)||js.includes(`case '${action}'`)||js.includes(`action==='${action}'`)||js.includes(`action === '${action}'`),`missing Finance Command action ${action}`);}
assert(js.includes("document.addEventListener('click'")||js.includes('document.addEventListener("click"'),'Finance Command must use delegated click handling');
console.log('PASS Finance Command visible action contract is wired');
