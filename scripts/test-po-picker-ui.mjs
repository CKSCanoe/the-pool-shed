import fs from 'node:fs';
const js = fs.readFileSync('public/catalogue-intelligence.js','utf8');
const css = fs.readFileSync('public/catalogue-intelligence.css','utf8');
const checks = [
  ['modal search rendered', js.includes('id="ciPoModalSearch"')],
  ['modal close rendered', js.includes('data-ci-po-modal-close="true"')],
  ['confirm button rendered', js.includes('Add selected products to PO')],
  ['confirm handler wired', js.includes("commitPoBasket(basketConfirm.dataset.ciBasketConfirm)")],
  ['PO lines commit', js.includes('targetPo.lines.push')],
  ['fixed viewport modal', css.includes('definitive full-screen Purchase Order product selector') && css.includes('inset: 12px !important')],
  ['sticky visible action area', css.includes('.ci-search-popover-po .ci-po-actionbar') && css.includes('flex:0 0 auto !important')],
  ['selected basket visible on tablet', css.includes('display:flex !important; max-height:34vh')],
  ['modal input wired', js.includes("event.target.closest('#ciPoModalSearch')")],
  ['service cache updated', fs.readFileSync('public/service-worker.js','utf8').includes('po-picker-modal-final')]
];
for (const [name, ok] of checks) {
  if (!ok) { console.error('FAIL', name); process.exit(1); }
  console.log('PASS', name);
}
console.log('PO modal picker UI checks passed.');
