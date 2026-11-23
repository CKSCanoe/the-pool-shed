/* Pool Shed v1.92.0 — average and landed cost on goods in (blueprint step 7).
   Each time stock is received against a purchase order, the product's average cost is updated:
     new average = (stock on hand × old average + received × landed cost) ÷ (stock on hand + received).
   Landed cost = the PO line's unit cost plus its share (by value) of any delivery, carriage, freight or duty lines on
   the same PO that are not charged to a project. The product's own cost price (the supplier price) is never changed.
   The receipt keeps the unit, landed and before/after average costs, so every change can be traced. */
(function(global){
  'use strict';
  var CHARGE = /deliver|carriage|freight|shipping|postage|courier|duty|customs|import|pallet/i;
  var DATA = function(){ return typeof global.__POOL_SHED_GET_DATA__ === 'function' ? (global.__POOL_SHED_GET_DATA__() || {}) : {}; };
  var num = function(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; };
  var r4 = function(n){ return Math.round(n * 10000) / 10000; };
  function nonStock(l){ return !!(l && (l.nonStockPurchase || l.lineType === 'custom-purchase')); }
  function isCharge(l){ return nonStock(l) && !l.projectId && !l.jobId && CHARGE.test([l.customProductName, l.description, l.purchaseCategory].filter(Boolean).join(' ')); }
  function lineUnit(l, products){ var p = products && products.get(String(l.productId)); return num(l.unitCost != null ? l.unitCost : l.cost != null ? l.cost : p && p.cost); }
  function productMap(d){ return new Map((d.products || []).map(function(p){ return [String(p.id), p]; })); }
  // Per-unit landed cost for one stock line: unit cost × (1 + charges ÷ value of the stock lines on the PO).
  function landedUnit(po, line, d){
    d = d || DATA(); var products = productMap(d), lines = (po && po.lines) || [];
    var charges = lines.filter(isCharge).reduce(function(n, l){ return n + num(l.qty) * lineUnit(l, products); }, 0);
    var value = lines.filter(function(l){ return !nonStock(l); }).reduce(function(n, l){ return n + num(l.qty) * lineUnit(l, products); }, 0);
    var unit = lineUnit(line, products);
    return { unit: unit, landed: r4(value > 0 ? unit * (1 + charges / value) : unit), charges: Math.round(charges * 100) / 100 };
  }
  function onHand(d, productId){ return (d.stock || []).filter(function(s){ return String(s.productId) === String(productId); }).reduce(function(n, s){ return n + Math.max(0, num(s.qty)); }, 0); }
  // The cost used for valuation and profit: the running average once goods have been received, else the cost price.
  function unitCost(p){ if (!p) return null; if (p.avgCost != null && Number.isFinite(Number(p.avgCost))) return Number(p.avgCost); return p.cost == null || p.cost === '' ? null : num(p.cost); }
  function apply(po, line, qty, before, d){
    var products = productMap(d), p = products.get(String(line.productId)); if (!p || nonStock(line)) return null;
    var c = landedUnit(po, line, d); if (!(c.unit > 0)) return null;
    var prev = unitCost(p); if (!(prev > 0)) prev = c.landed;
    var avg = before > 0 ? (before * prev + qty * c.landed) / (before + qty) : c.landed;
    p.avgCost = r4(avg); p.avgCostUpdatedAt = new Date().toISOString(); p.lastLandedCost = c.landed;
    return { unitCost: c.unit, landedUnitCost: c.landed, avgCostBefore: r4(prev), avgCostAfter: p.avgCost, onHandBefore: before };
  }
  if (typeof recordPurchaseReceipt === 'function') {
    var original = recordPurchaseReceipt;
    recordPurchaseReceipt = function(po, line, qty){
      var d = DATA(), before = line ? onHand(d, line.productId) : 0;
      var event = original.apply(this, arguments);
      if (event && line) { try { var c = apply(po, line, Number(qty), before, DATA()); if (c) Object.assign(event, c); } catch (_) {} }
      return event;
    };
    global.recordPurchaseReceipt = recordPurchaseReceipt;
  }
  global.PoolShedStockCost = { unitCost: unitCost, landedUnit: landedUnit, isCharge: isCharge, _apply: apply, _onHand: onHand };
})(typeof window !== 'undefined' ? window : globalThis);
