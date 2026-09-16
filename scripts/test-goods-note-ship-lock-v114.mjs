import fs from 'node:fs';import assert from 'node:assert/strict';
const engine=fs.readFileSync('public/fulfilment-control-engine.js','utf8');
const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
assert(engine.includes('shipmentLocked'),'engine must persist shipment lock');
assert(engine.includes("code:'SHIPPED'"),'ship gate must reject already shipped note');
assert(legacy.includes('Shipping is final and cannot be reversed. Use a sales credit or return.'),'legacy UI must explicitly block unship');
assert(!legacy.match(/data-unship|>Unship<|Undo Ship/i),'no Unship control may exist');
console.log('PASS v1.14 shipped Goods Notes are irreversible and return-led');
