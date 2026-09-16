import fs from 'node:fs';import assert from 'node:assert/strict';
const js=fs.readFileSync('public/fulfilment-workspace.js','utf8');
for(const phrase of ['Print Pick Run','Print Parcel Goods Notes','Pack & Dispatch','Create Return / Credit','Parcel Goods Note','No Unship']) assert(js.includes(phrase),`missing workspace control/copy: ${phrase}`);
for(const action of ['print-pick-run','print-parcel-notes','dispatch','create-return']) assert(js.includes(`case '${action}'`),`missing handler ${action}`);
assert(js.includes('createPickRun('),'workspace must use fulfilment engine Pick Run');
assert(js.includes('createReturnCredit('),'workspace must use controlled return handoff');
console.log('PASS v1.14 Goods Note workspace print, dispatch and return controls');
