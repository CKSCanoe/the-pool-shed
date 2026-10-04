import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';

const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const engineSource=fs.readFileSync('public/product-hub-engine.js','utf8');
const workspace=fs.readFileSync('public/product-hub-workspace.js','utf8');
const purchase=fs.readFileSync('public/purchase-workspace.js','utf8');
const build=fs.readFileSync('scripts/build.sh','utf8');

for(const token of ['customPurchaseRefs','orderLineOnly: true','hiddenFromCatalogue: true','stockTracked: false','productId.indexOf("POCUSTOM-") === 0'])
  assert(legacy.includes(token),'Legacy normalization missing custom PO isolation rule: '+token);
assert.match(legacy,/purchaseOrders\.forEach[\s\S]*!customPurchaseRefs\.has\(String\(line\.productId\)\)/,'Custom PO pseudo IDs must be excluded from orphan-product recovery');
assert.match(legacy,/source\.stock = source\.stock\.filter[\s\S]*customPurchaseRefs/,'Custom PO pseudo IDs must be stripped from stock records');

assert.match(purchase,/lineType:'custom-purchase'/,'PO custom lines must remain explicit custom-purchase lines');
assert.match(purchase,/nonStockPurchase:true/,'PO custom lines must remain non-stock');
assert.match(purchase,/salesOrderId:''/,'PO-only custom line must not require a Sales Order');

const context={globalThis:{},console};
context.globalThis.__POOL_SHED_GET_DATA__=()=>({products:[
  {id:'POCUSTOM-1',sku:'POCUSTOM-1',name:'Recovered product',orderLineOnly:true,hiddenFromCatalogue:true,stockTracked:false,productType:'Custom purchase / non-stock'},
  {id:'P-1',sku:'P-1',name:'Real product',stockTracked:true}
],stock:[],purchaseOrders:[],salesOrders:[],supplierProducts:[],locations:[],restockRules:[]});
vm.createContext(context);
vm.runInContext(engineSource,context);
const hub=context.globalThis.PoolShedProductHub;
assert.equal(hub.isOrderLineOnly(context.globalThis.__POOL_SHED_GET_DATA__().products[0]),true);
assert.equal(hub.isStocked(context.globalThis.__POOL_SHED_GET_DATA__().products[0]),false);
assert.equal(hub.search('POCUSTOM').length,0,'Order-line-only pseudo products must never appear in Product Hub search');
assert.equal(hub.search('Real product').length,1,'Real products must remain searchable');
assert(workspace.includes('hub.isOrderLineOnly'),'Product Hub catalogue must defensively exclude order-line-only records');
assert(build.includes('test-custom-po-catalogue-isolation-v153.mjs'),'Custom PO isolation test must run in production build');
console.log('PASS custom PO lines remain auditable order data without becoming catalogue, stock or replenishment products');
