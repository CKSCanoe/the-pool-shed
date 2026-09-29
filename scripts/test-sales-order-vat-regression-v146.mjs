import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const start=source.indexOf('      function vatRateForLine(line) {');
const end=source.indexOf('\n      function vatAmount(',start);
assert(start>=0&&end>start,'vatRateForLine implementation is missing');
const context={};
vm.createContext(context);
vm.runInContext(source.slice(start,end),context);
const rate=context.vatRateForLine;
assert.equal(typeof rate,'function','vatRateForLine must be executable');
for(const [taxCode,expected] of [
  ['20% VAT',0.2],['20%',0.2],['T20',0.2],['0%',0],['T0',0],['Zero rated',0],['Not rated',0]
]) assert.equal(rate({taxCode}),expected,taxCode+' VAT mapping is wrong');
assert.equal(rate({}),0.2,'default VAT must remain 20%');
console.log('PASS Sales Order VAT parser keeps 20% and zero-rated codes distinct');
