import fs from 'node:fs';
import assert from 'node:assert/strict';

const legacy=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
const normalizer=fs.readFileSync('server/azzy/integration/pool-shed-normalizer.js','utf8');
const planner=fs.readFileSync('server/azzy/src/core/planner.js','utf8');
const registry=fs.readFileSync('server/azzy/src/tools/registry.js','utf8');

assert.match(legacy,/salesOrderSubscriptions:\s*\[\]/,'subscription collection missing from Pool Shed state');
assert.match(legacy,/salesorders:\s*\["Sales Orders", "Subscriptions"/,'Subscriptions missing from Sales Orders navigation');
assert.match(legacy,/function salesOrderSubscriptionsPage\(/,'subscription workspace missing');
assert.match(legacy,/function createSalesOrderSubscriptionFromOrder\(/,'subscription template creation missing');
assert.match(legacy,/function generateSubscriptionSalesOrder\(/,'manual recurring-order generation missing');
assert.match(legacy,/data-subscription-generate/,'subscription generate control missing');
assert.match(legacy,/source:"Subscription"/,'generated Sales Order must retain Subscription source');
assert.match(legacy,/status:"New Order"/,'generated subscription order must enter the normal New Order workflow');
assert.match(legacy,/Nothing will be allocated, purchased or invoiced automatically/,'subscription generation safety confirmation missing');
assert.match(legacy,/autoCreate:false/,'subscriptions must not silently auto-create business orders');
assert.match(legacy,/approvalRequired:true/,'subscriptions must retain explicit review authority');
assert.doesNotMatch(legacy,/setInterval\([^\n]*generateSubscriptionSalesOrder/,'subscription Sales Orders must not be timer-generated silently');

assert.match(normalizer,/normaliseSalesOrderSubscriptions/,'Azzy normalizer does not read recurring Sales Orders');
assert.match(normalizer,/stockMovements:normaliseStockMovements/,'Azzy normalizer does not read stock movements');
assert.match(registry,/get_stock_movement_insights/,'Azzy stock movement intelligence tool missing');
assert.match(registry,/get_order_trends/,'Azzy order trend tool missing');
assert.match(registry,/get_product_recommendations/,'Azzy product recommendation tool missing');
assert.match(registry,/get_subscription_review/,'Azzy subscription review tool missing');
assert.match(registry,/find_customers/,'Azzy fuzzy customer resolver missing');
assert.match(planner,/subscription_review/,'Azzy subscription planner route missing');
assert.match(planner,/stock_movement/,'Azzy stock movement planner route missing');
assert.match(planner,/order_trends/,'Azzy order trend planner route missing');

new Function(legacy);
console.log('PASS recurring Sales Orders, customer matching, stock movement and trend intelligence safety wiring');
