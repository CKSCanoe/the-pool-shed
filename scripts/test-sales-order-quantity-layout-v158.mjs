import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const workspace=fs.readFileSync('public/sales-workspace.js','utf8');
const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const css=fs.readFileSync('public/assets/css/system/43-sales-order-finder-polish.css','utf8');

assert.match(workspace,/<th>Qty<\/th><th>Allocated<\/th>/,'Sales Order must expose Qty and Allocated columns');
assert.match(workspace,/class="so2-qty-cell"/,'Sales Order quantity needs a dedicated professional cell');
assert.match(workspace,/class="qty-input so2-qty"/,'Sales Order quantity input missing');
assert.match(workspace,/const lineNet = unitNet \* Number\(line\.qty \|\| 0\)/,'line net must be quantity-aware');
assert.match(workspace,/so2Money\(lineGross\)/,'line gross total must be shown');
assert.match(workspace,/so2Money\(lineNet\).*net/,'line total must also show net value');

for (const column of [5,6,9,10]) {
  assert(
    css.includes('.so2-lines-table :is(th,td):nth-child(' + column + ')') &&
    css.includes('display:table-cell!important'),
    'Sales Order column ' + column + ' must not be hidden by the legacy compact-column rule'
  );
}
assert.match(css,/min-width:1260px!important/,'professional line layout should scroll rather than squash');
assert.match(css,/\.so2-qty\{[\s\S]*font-weight:900!important/,'quantity must be visually prominent');

const start=legacy.indexOf('      function updateSalesOrderLineNumber(');
const end=legacy.indexOf('      function updateSalesOrderLineText(',start);
assert(start>0&&end>start,'Sales Order number editor not found');
const source=legacy.slice(start,end);

const order={id:'SO-1',updatedAt:'',lines:[{productId:'P1',qty:2,allocated:0,picked:0,packed:0}]};
let saves=0,notifications=0,renders=0,toasts=0;
const context={
  salesOrder:id=>id==='SO-1'?order:null,
  isNonStockSalesLine:()=>false,
  releaseAllocatedStockForLine:()=>0,
  syncSalesOrderStatusFromGoodsNotes:()=>{},
  addSalesOrderNotification:()=>{notifications+=1;},
  product:()=>({sku:'SKU-1'}),
  saveAppData:()=>{saves+=1;return true;},
  toast:()=>{toasts+=1;},
  render:()=>{renders+=1;},
  bestSourceRow:()=>null,
  available:()=>0,
  addMovement:()=>{},
  Date,
  console
};
vm.createContext(context);
vm.runInContext(source,context);
context.updateSalesOrderLineNumber('SO-1','P1','qty',5);
assert.equal(order.lines[0].qty,5,'quantity edit should update line');
assert.equal(saves,1,'quantity edit must persist immediately');
assert.equal(notifications,1,'quantity edit must be auditable');
assert.equal(renders,1,'quantity edit should refresh totals and units');
assert(toasts>=1,'quantity edit should confirm to user');

console.log('PASS Sales Order quantities are visible, spacious, persistent, auditable and quantity-aware');