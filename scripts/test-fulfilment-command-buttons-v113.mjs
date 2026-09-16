import fs from 'node:fs';
import assert from 'node:assert/strict';

const js = fs.readFileSync('public/fulfilment-workspace.js','utf8');
const renderedActions = new Set([...js.matchAll(/data-ff-action=["'](?:\"|')?([^"']+)/g)].map(m => m[1]).filter(v => !v.includes('+') && !v.includes('{')));
// Dynamic row actions returned by the engine must also be handled explicitly.
for (const action of ['open','pick','pack','ship','dispatch','notify','hold','release','open-order','split','back','print-queue','batch-pick','new-shipment']) renderedActions.add(action);
for (const action of renderedActions) {
  assert(js.includes(`case '${action}'`) || js.includes(`case "${action}"`), `Fulfilment button/action '${action}' has no command handler`);
}
assert(js.includes("case 'dispatch'"), 'Update dispatch must open the pack/dispatch editor instead of being a dead button');
assert(js.includes("data-ff-section") && js.includes("section.dataset.ffSection"), 'Every Fulfilment section button must be delegated');
assert(js.includes("data-ff-filter") && js.includes("filter.dataset.ffFilter"), 'Every Fulfilment filter button must be delegated');
console.log(`PASS Fulfilment Command button coverage (${renderedActions.size} command actions plus delegated sections/filters)`);
