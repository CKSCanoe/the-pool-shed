import fs from 'node:fs';import assert from 'node:assert/strict';
const runtime=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
for(const table of ['suppliers','products','customers','customer_addresses','locations','projects','purchase_orders','purchase_order_items','sales_orders','sales_order_items','goods_out_notes','goods_out_note_items','notification_events','stock_balances','location_restock_rules','stock_allocations','stock_movements']){
  assert(runtime.includes(`"${table}"`)||runtime.includes(`'${table}'`),`legacy Supabase recovery bridge must probe ${table}`);
}
assert(runtime.includes('PoolShedLegacyRecovery'),'runtime must use the normalized recovery transformer');
assert(runtime.includes('PoolShedLegacyAutoRecovery'),'runtime must invoke safe automatic recovery after canonical workspace load');
console.log('PASS v1.22 legacy remote bridge probes normalized tables and invokes safe recovery');
