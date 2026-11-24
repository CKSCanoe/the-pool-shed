/* Pool Shed bundles (from v1.96): one engine for bundles and kits.
   A bundle is a product made of other products (its parts). It sells as one line at the customer's price list; its parts
   are reserved, picked, shipped (including when invoiced) and reordered by the normal stock processes.
   One rule for money: the bundle line carries the price and the cost (the live total of its parts at the time it was added);
   part lines carry neither, so nothing is counted twice.
   Price: set per price list (RRP, trade, wholesale), or the parts total less a percentage (worked out when the bundle is saved).
   "Can make": how many bundles the free stock of the parts allows, and which part limits it. */
(function(global){
'use strict';
var num = function(v){ var n = Number(v); return isFinite(n) ? n : 0; };
var LISTS = [['rrp', 'RRP'], ['trade', 'Trade'], ['wholesale', 'Wholesale']];
function D(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? global.__POOL_SHED_GET_DATA__() : (typeof data !== 'undefined' ? data : {}); }
function prod(id){ try { return (typeof product === 'function' ? product(id) : null) || (D().products || []).find(function(p){ return p && p.id === id; }) || null; } catch (_) { return null; } }
function hub(){ return global.PoolShedProductHub || null; }

function isBundle(p){
  if (!p) return false;
  var t = String(p.productType || p.type || p.structure || '').toLowerCase();
  return p.bundleEnabled === true || p.bundleEnabled === 'Yes' || t === 'bundle' || t === 'bundle / kit' || t === 'bundle product';
}
function parts(p){ return (Array.isArray(p && p.bundleItems) ? p.bundleItems : []).filter(function(x){ return x && x.productId && num(x.qty) > 0; }).map(function(x){ return { productId: x.productId, qty: Math.max(1, Math.floor(num(x.qty))), product: prod(x.productId) }; }); }
function partsTotal(p, list, items){ return (items || parts(p)).reduce(function(t, x){ var c = x.product || {}; return t + num(c[list] || (list === 'cost' ? 0 : c.rrp)) * x.qty; }, 0); }
function partsCost(p, items){ return Math.round(partsTotal(p, 'cost', items) * 100) / 100; }
function freeOf(c){ if (!c) return 0; try { var h = hub(); if (h && !h.isStocked(c)) return Infinity; return Math.max(0, num(h ? h.stockSummary(c.id).available : 0)); } catch (_) { return 0; } }
function canMake(p, items){
  var list = items || parts(p); if (!list.length) return { qty: 0, limit: null, stocked: false };
  var best = Infinity, limit = null;
  list.forEach(function(x){ var f = freeOf(x.product); if (f === Infinity) return; var n = Math.floor(f / x.qty); if (n < best) { best = n; limit = x; } });
  return best === Infinity ? { qty: 0, limit: null, stocked: false } : { qty: best, limit: limit, stocked: true };
}
function price(p, list){ var v = num(p && p[list]); return v > 0 ? v : num(p && p.rrp); }
// Recalculate the stored prices for "parts total less a %" bundles, and keep the parts cost on the record.
function refresh(p){
  if (!isBundle(p)) return p;
  var items = parts(p);
  p.bundleComponentCost = partsCost(p, items);
  p.bundleComponentRrp = Math.round(partsTotal(p, 'rrp', items) * 100) / 100;
  if (p.bundlePriceMode === 'discount') { var f = 1 - Math.min(90, Math.max(0, num(p.bundleDiscountPct))) / 100; LISTS.forEach(function(l){ p[l[0]] = Math.round(partsTotal(p, l[0], items) * f * 100) / 100; }); }
  p.stockTracked = false;
  return p;
}

// ---------- on orders ----------
function groupOf(order, instanceId){ var lines = (order.lines || []).filter(function(l){ return l.bundleInstanceId === instanceId; }); return { head: lines.find(function(l){ return l.bundleRole === 'head'; }) || null, parts: lines.filter(function(l){ return l.bundleRole === 'component'; }) }; }
function addToOrder(order, p, qty){
  qty = Math.max(1, Math.floor(num(qty) || 1));
  var items = parts(p); if (!items.length) return { ok: false, error: p.name + ' has no parts yet: add them on the product first.' };
  var shippedHead = function(l){ return num(l.shipped) > 0 || num(l.picked) > 0; };
  var head = (order.lines || []).find(function(l){ return l.bundleRole === 'head' && l.productId === p.id && !shippedHead(l); });
  if (head) { setQty(order, head, num(head.qty) + qty); return { ok: true, head: head, merged: true }; }
  var id = 'BND-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  head = { productId: p.id, qty: qty, allocated: 0, picked: 0, packed: 0, lineType: 'bundle', bundleRole: 'head', bundleInstanceId: id, unitCost: partsCost(p, items), description: p.name };
  order.lines.push(head);
  items.forEach(function(x){ var c = x.product || {};
    order.lines.push({ productId: x.productId, qty: x.qty * qty, allocated: 0, picked: 0, packed: 0, unitPrice: 0, unitCost: 0, description: c.name || x.productId, skuSnapshot: c.sku || '', supplierSnapshot: c.supplier || '',
      bundleRole: 'component', bundleInstanceId: id, bundleParentId: p.id, bundleParentSku: p.sku || '', bundleParentName: p.name || '',
      bundleComponentSnapshot: { productId: x.productId, sku: c.sku || '', name: c.name || '', supplier: c.supplier || '', cost: num(c.cost), rrp: num(c.rrp), qtyPerBundle: x.qty } }); });
  order.status = 'Needs Review'; order.updatedAt = new Date().toISOString();
  if (typeof addSalesOrderNotification === 'function') try { addSalesOrderNotification(order, 'Line added', (p.sku || p.name) + ' bundle added (' + items.length + ' parts)', 'Internal note'); } catch (_) {}
  return { ok: true, head: head };
}
// Bundle quantity changes and the parts follow; parts reserved beyond the new need are released.
function setQty(order, head, qty){
  head.qty = Math.max(0, Math.floor(num(qty)));
  groupOf(order, head.bundleInstanceId).parts.forEach(function(l){
    var per = num(l.bundleComponentSnapshot && l.bundleComponentSnapshot.qtyPerBundle) || 1;
    l.qty = per * head.qty;
    if (num(l.allocated) > l.qty && typeof releaseAllocatedStockForLine === 'function') releaseAllocatedStockForLine(order, l, num(l.allocated) - l.qty, 'Allocation Release');
  });
}
function partStatus(order, head){
  var g = groupOf(order, head.bundleInstanceId), ready = g.parts.filter(function(l){ return num(l.allocated) + num(l.shipped) >= num(l.qty) && num(l.qty) > 0; }).length;
  return { total: g.parts.length, ready: ready, parts: g.parts };
}
// Parts left behind when their bundle line was removed are tidied away (only if nothing has happened to them yet).
function tidyOrphans(){
  var changed = 0;
  (D().salesOrders || []).forEach(function(o){
    if (['Invoiced', 'Completed', 'Cancelled', 'Shipped'].indexOf(String(o.status)) >= 0) return;
    var heads = {}; (o.lines || []).forEach(function(l){ if (l.bundleRole === 'head') heads[l.bundleInstanceId] = 1; });
    var keep = (o.lines || []).filter(function(l){ var orphan = l.bundleRole === 'component' && !heads[l.bundleInstanceId] && !num(l.allocated) && !num(l.picked) && !num(l.shipped); if (orphan) changed++; return !orphan; });
    if (keep.length !== (o.lines || []).length) o.lines = keep;
  });
  return changed;
}

// ---------- wiring ----------
if (typeof addProductToSalesOrder === 'function') {
  var baseAdd = addProductToSalesOrder;
  addProductToSalesOrder = function(orderId){
    var search = typeof document !== 'undefined' ? document.getElementById('salesOrderProductSearch') : null, p = search ? prod(search.dataset.selectedProductId || '') : null;
    if (!isBundle(p)) return baseAdd.apply(this, arguments);
    var order = typeof salesOrder === 'function' ? salesOrder(orderId) : null; if (!order) return;
    var qtyEl = document.getElementById('salesOrderProductQty'), res = addToOrder(order, p, qtyEl ? qtyEl.value : 1);
    if (!res.ok) { if (typeof toast === 'function') toast(res.error); return; }
    try { if (global.PoolShedStockFlow) global.PoolShedStockFlow.autoAllocate(order); } catch (_) {}
    if (typeof saveAppData === 'function') saveAppData();
    if (typeof toast === 'function') toast((p.sku || p.name) + (res.merged ? ' bundle quantity increased.' : ' bundle added with its ' + parts(p).length + ' parts.'));
    if (typeof render === 'function') render();
  };
  global.addProductToSalesOrder = addProductToSalesOrder;
}
if (typeof updateSalesOrderLineNumber === 'function') {
  var baseQty = updateSalesOrderLineNumber;
  updateSalesOrderLineNumber = function(orderId, productId, field, value){
    var order = typeof salesOrder === 'function' ? salesOrder(orderId) : null, head = order && field === 'qty' ? (order.lines || []).find(function(l){ return l.productId === productId && l.bundleRole === 'head'; }) : null;
    if (!head) return baseQty.apply(this, arguments);
    setQty(order, head, value);
    try { if (global.PoolShedStockFlow) global.PoolShedStockFlow.autoAllocate(order); } catch (_) {}
    order.updatedAt = new Date().toISOString();
    if (typeof saveAppData === 'function') saveAppData();
    if (typeof toast === 'function') toast('Bundle quantity changed: the parts follow.');
    if (typeof render === 'function') render();
  };
  global.updateSalesOrderLineNumber = updateSalesOrderLineNumber;
}
// Older bundle code asks PoolShedBundles; it now gets the same answers as everything else.
if (global.PoolShedBundles) { global.PoolShedBundles.isBundle = isBundle; global.PoolShedBundles.items = function(p){ return parts(p).map(function(x){ return { productId: x.productId, qty: x.qty }; }); }; }
var tidyTimer = 0;
if (typeof render === 'function') {
  var baseRender = render;
  render = function(){ var r = baseRender.apply(this, arguments); clearTimeout(tidyTimer); tidyTimer = setTimeout(function(){ try { if (tidyOrphans() && typeof saveAppData === 'function') saveAppData(); } catch (_) {} }, 700); return r; };
  global.render = render;
}
global.PoolShedBundleEngine = { isBundle: isBundle, parts: parts, partsTotal: partsTotal, partsCost: partsCost, canMake: canMake, price: price, refresh: refresh, addToOrder: addToOrder, setQty: setQty, partStatus: partStatus, groupOf: groupOf, tidyOrphans: tidyOrphans, LISTS: LISTS };
})(typeof window !== 'undefined' ? window : globalThis);
