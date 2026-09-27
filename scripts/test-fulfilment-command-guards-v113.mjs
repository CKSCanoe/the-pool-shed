import fs from 'node:fs';import assert from 'node:assert/strict';
const s=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
function block(name,next){const a=s.indexOf(`function ${name}`);assert(a>=0,`${name} missing`);const b=next?s.indexOf(`function ${next}`,a+1):a+2200;return s.slice(a,b>0?b:a+2200);}
for(const name of ['markGoodsNotePrinted','markGoodsNotePicked','markGoodsNotePacked'])assert(block(name).includes('note.hold'),`${name} must refuse progression while Goods Note is on hold`);
const ship=block('shipGoodsNote','runBulkGoodsOutAction');assert(ship.includes('PoolShedFulfilmentControl')&&ship.includes('atomicShip'),'legacy Ship action must delegate to Fulfilment Command atomic ship gate');
const binder=block('bindFulfilment','renderShippingModal');assert(binder.includes('note.hold'),'legacy pack/open-pack action must respect Hold');
assert(s.includes('if (note.hold) return "On Hold";'),'legacy Goods Note status must expose Hold');
const modal=block('renderShippingModal','closeShippingModal');assert(modal.includes('const packed = markGoodsNotePacked(note, true)')&&modal.includes('if (!packed)'),'shipping modal save must stop if Hold or another guard rejects packing');
console.log('PASS Fulfilment Command hold and ship-gate guards across legacy execution paths');
