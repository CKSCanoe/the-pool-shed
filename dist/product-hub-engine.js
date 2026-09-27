(function (global) {
  'use strict';

  function store() {
    if (typeof global.__POOL_SHED_GET_DATA__ === 'function') return global.__POOL_SHED_GET_DATA__() || {};
    if (global.data) return global.data;
    return {};
  }
  function number(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }
  function text(value) { return String(value == null ? '' : value).trim(); }
  function lower(value) { return text(value).toLowerCase(); }
  function productById(id) { return (store().products || []).find(function (p) { return p && p.id === id && !p.deleted; }) || null; }
  function isBundle(product) {
    if (!product) return false;
    const type = lower(product.productType || product.type);
    return product.bundleEnabled === true || product.bundleEnabled === 'Yes' || type === 'bundle' || type === 'bundle / kit' || (Array.isArray(product.bundleItems) && product.bundleItems.length > 0);
  }
  function isStocked(product) {
    if (!product || product.deleted) return false;
    if (isBundle(product)) return false;
    const type = lower(product.productType || product.type);
    if (product.stockTracked === false || product.stockTracked === 'false') return false;
    return !['service','service / non-stock','non-stock','shipping charge','custom charge'].includes(type);
  }
  function aliases(product) {
    const raw = product && (product.aliases || product.alias || product.oldCodes || product.oldSku || product.legacySku);
    if (Array.isArray(raw)) return raw.map(text).filter(Boolean);
    return text(raw).split(/[,;|\n]/).map(text).filter(Boolean);
  }
  function identityValues(product) {
    return [
      product && product.sku, product && product.name, product && product.parentName, product && product.parentSku,
      product && product.supplierSku, product && product.barcode, product && product.ean, product && product.upc,
      product && product.mpn, product && product.manufacturerPartNumber, product && product.brand, product && product.category,
      product && product.variantName, product && product.variantValue, product && product.variantLabel,
      product && product.productGroup, product && product.groupName, product && product.description
    ].concat(aliases(product)).map(text).filter(Boolean);
  }
  function search(query, options) {
    const opts = options || {};
    const raw = text(query);
    const q = lower(raw);
    const terms = q.split(/\s+/).filter(Boolean);
    const rows = (store().products || []).filter(function (p) {
      if (!p || p.deleted) return false;
      if (!opts.includeHidden && p.hiddenFromCatalogue) return false;
      if (opts.excludeBundles && isBundle(p)) return false;
      return true;
    }).map(function (product, index) {
      const values = identityValues(product);
      const lowers = values.map(lower);
      const exact = [product.sku, product.supplierSku, product.barcode, product.ean, product.upc, product.mpn, product.manufacturerPartNumber].concat(aliases(product)).map(lower);
      const haystack = lowers.join(' ');
      if (terms.length && !terms.every(function (term) { return haystack.includes(term); })) return null;
      let score = Math.max(0, 1000 - index);
      if (q && exact.includes(q)) score += 20000;
      else if (q && lower(product.name) === q) score += 15000;
      else if (q && lowers.some(function (v) { return v.startsWith(q); })) score += 8000;
      if (q && lower(product.sku).startsWith(q)) score += 5000;
      if (q && lower(product.supplierSku).startsWith(q)) score += 4500;
      return { product: product, score: score };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score || text(a.product.name).localeCompare(text(b.product.name)); });
    return rows.slice(0, opts.limit || 100).map(function (row) { return row.product; });
  }
  function stockSummary(productId) {
    if (typeof global.productStockSummary === 'function') {
      const s = global.productStockSummary(productId) || {};
      return { onHand:number(s.onHand), allocated:number(s.allocated), available:number(s.available, Math.max(0,number(s.onHand)-number(s.allocated))) };
    }
    const rows = (store().stock || []).filter(function (row) { return row && row.productId === productId; });
    const onHand = rows.reduce(function (n, row) { return n + number(row.qty); }, 0);
    const allocated = rows.reduce(function (n, row) { return n + number(row.allocated); }, 0);
    return { onHand:onHand, allocated:allocated, available:Math.max(0,onHand-allocated) };
  }
  function supplierOffer(product) {
    if (!product) return null;
    const d = store();
    const preferred = text(product.preferredSupplier || product.supplier);
    const offers = (d.supplierProducts || []).filter(function (o) { return o && o.productId === product.id && o.available !== false; });
    const offer = offers.find(function (o) { return text(o.supplier) === preferred; }) || offers[0] || null;
    return offer || {
      productId:product.id, supplier:preferred || 'Supplier to confirm', supplierSku:product.supplierSku || product.sku || '',
      cost:number(product.cost), leadTimeDays:number(product.leadTimeDays, 0), minQty:number(product.minimumOrderQuantity || product.moq, 1),
      packQty:number(product.orderMultiple || product.packQty, 1), available:true
    };
  }
  function confirmedInbound(productId) {
    const confirmed = new Set(['supplier confirmed','part received','received - partial','in transit','dispatched']);
    return (store().purchaseOrders || []).reduce(function (total, po) {
      if (!po || ['cancelled','received','closed'].includes(lower(po.status))) return total;
      if (!confirmed.has(lower(po.status)) && !po.supplierConfirmedAt && !po.confirmedDate) return total;
      return total + (po.lines || []).filter(function (line) { return line && line.productId === productId; }).reduce(function (sum, line) {
        return sum + Math.max(0, number(line.confirmedQty != null ? line.confirmedQty : line.qty) - number(line.received));
      }, 0);
    }, 0);
  }
  function salesDemand(productId) {
    const closed = new Set(['shipped','invoiced','cancelled','completed','complete']);
    return (store().salesOrders || []).reduce(function (total, order) {
      if (!order || closed.has(lower(order.status))) return total;
      return total + (order.lines || []).filter(function (line) { return line && line.productId === productId && line.bundleRole !== 'head'; }).reduce(function (sum, line) {
        const qty = number(line.qty);
        const covered = Math.max(number(line.allocated), number(line.shipped), number(line.delivered), number(line.cancelledQty));
        return sum + Math.max(0, qty - covered);
      }, 0);
    }, 0);
  }
  function uncoveredDemand(productId) { return salesDemand(productId); }
  function masterRule(productId) {
    const d = store();
    const locations = d.locations || [];
    const masterIds = new Set(locations.filter(function (l) { return l && (l.isMaster || lower(l.type) === 'warehouse' || lower(l.type) === 'main warehouse'); }).map(function (l) { return l.id; }));
    const rules = (d.restockRules || []).filter(function (r) { return r && r.productId === productId; });
    return rules.find(function (r) { return masterIds.has(r.locationId); }) || rules[0] || null;
  }
  function replenishmentSettings(product) {
    const offer = supplierOffer(product) || {};
    const rule = masterRule(product.id) || {};
    const reorderPoint = number(product.reorderPoint != null ? product.reorderPoint : (product.reorder != null ? product.reorder : rule.min));
    const targetStock = number(product.targetStock != null ? product.targetStock : (product.restockTo != null ? product.restockTo : (rule.restockTo != null ? rule.restockTo : rule.max)));
    const moq = Math.max(1, number(product.minimumOrderQuantity != null ? product.minimumOrderQuantity : (product.moq != null ? product.moq : offer.minQty), 1));
    const orderMultiple = Math.max(1, number(product.orderMultiple != null ? product.orderMultiple : (product.packQty != null ? product.packQty : offer.packQty), 1));
    const enabled = product.replenishmentEnabled == null ? (isStocked(product) && (reorderPoint > 0 || targetStock > 0)) : !!product.replenishmentEnabled;
    return {
      enabled:enabled, reorderPoint:reorderPoint, targetStock:Math.max(targetStock,reorderPoint), safetyStock:number(product.safetyStock),
      moq:moq, orderMultiple:orderMultiple, leadTimeDays:number(product.leadTimeDays != null ? product.leadTimeDays : offer.leadTimeDays),
      supplier:text(product.preferredSupplier || offer.supplier || product.supplier || 'Supplier to confirm'), supplierSku:text(offer.supplierSku || product.supplierSku || product.sku), unitCost:number(offer.cost != null ? offer.cost : product.cost)
    };
  }
  function roundOrderQuantity(raw, moq, multiple) {
    if (!(raw > 0)) return 0;
    const minimum = Math.max(raw, Math.max(1,number(moq,1)));
    const step = Math.max(1,number(multiple,1));
    return Math.ceil(minimum / step) * step;
  }
  function replenishmentRow(productOrId) {
    const product = typeof productOrId === 'string' ? productById(productOrId) : productOrId;
    if (!product) return null;
    const s = stockSummary(product.id), settings = replenishmentSettings(product), inbound = confirmedInbound(product.id), demand = uncoveredDemand(product.id);
    const projectedAvailable = s.available + inbound - demand;
    const rawNeed = settings.enabled && projectedAvailable <= settings.reorderPoint ? Math.max(0, settings.targetStock - projectedAvailable) : 0;
    const suggestedQty = roundOrderQuantity(rawNeed, settings.moq, settings.orderMultiple);
    const reasons = [];
    if (!settings.enabled) reasons.push('Replenishment disabled');
    else if (suggestedQty) reasons.push('Projected stock ' + projectedAvailable + ' is at/below reorder point ' + settings.reorderPoint);
    else reasons.push('Projected stock ' + projectedAvailable + ' is above reorder point ' + settings.reorderPoint);
    if (inbound) reasons.push(inbound + ' confirmed inbound');
    if (demand) reasons.push(demand + ' uncovered demand');
    if (suggestedQty && settings.moq > 1) reasons.push('MOQ ' + settings.moq);
    if (suggestedQty && settings.orderMultiple > 1) reasons.push('order multiple ' + settings.orderMultiple);
    return {
      product:product, productId:product.id, supplier:settings.supplier, supplierSku:settings.supplierSku,
      onHand:s.onHand, allocated:s.allocated, available:s.available, inbound:inbound, demand:demand, projectedAvailable:projectedAvailable,
      reorderPoint:settings.reorderPoint, targetStock:settings.targetStock, safetyStock:settings.safetyStock, moq:settings.moq, orderMultiple:settings.orderMultiple,
      leadTimeDays:settings.leadTimeDays, unitCost:settings.unitCost, suggestedQty:suggestedQty, suggestedCost:suggestedQty*settings.unitCost,
      needsOrder:suggestedQty>0, reason:reasons.join(' · '), enabled:settings.enabled
    };
  }
  function replenishmentRows(options) {
    const opts=options||{};
    let rows=(store().products||[]).filter(function(p){return isStocked(p)&&!p.deleted;}).map(replenishmentRow).filter(Boolean);
    if(opts.needsOrder) rows=rows.filter(function(r){return r.needsOrder;});
    if(opts.supplier) rows=rows.filter(function(r){return r.supplier===opts.supplier;});
    if(opts.category) rows=rows.filter(function(r){return r.product.category===opts.category;});
    return rows.sort(function(a,b){return (b.needsOrder-a.needsOrder)||(b.suggestedCost-a.suggestedCost)||text(a.product.name).localeCompare(text(b.product.name));});
  }
  function groupReplenishmentBySupplier(rows) {
    const map = new Map();
    (rows || replenishmentRows({needsOrder:true})).forEach(function (row) {
      if (!map.has(row.supplier)) map.set(row.supplier,{supplier:row.supplier,rows:[],suggestedCost:0,suggestedUnits:0});
      const group=map.get(row.supplier);group.rows.push(row);group.suggestedCost+=row.suggestedCost;group.suggestedUnits+=row.suggestedQty;
    });
    return Array.from(map.values()).sort(function(a,b){return b.suggestedCost-a.suggestedCost||a.supplier.localeCompare(b.supplier);});
  }
  function nextPoId() {
    if (typeof global.nextPurchaseOrderId === 'function') return global.nextPurchaseOrderId();
    const ids=(store().purchaseOrders||[]).map(function(po){const m=String(po.id||'').match(/(\d+)/g);return m?Number(m[m.length-1]):0;});
    return 'PO-' + String(Math.max(0,...ids)+1).padStart(4,'0');
  }
  function createDraftPurchaseOrders(selections) {
    const d=store();if(!Array.isArray(d.purchaseOrders))d.purchaseOrders=[];
    const bySupplier=new Map();
    (selections||[]).forEach(function(sel){const p=productById(sel.productId);if(!p)return;const row=replenishmentRow(p);const qty=Math.max(0,number(sel.qty != null ? sel.qty : row.suggestedQty));if(!qty)return;const supplier=text(sel.supplier||row.supplier||p.supplier||'Supplier to confirm');if(!bySupplier.has(supplier))bySupplier.set(supplier,[]);bySupplier.get(supplier).push({product:p,row:row,qty:qty});});
    const touched=[];
    bySupplier.forEach(function(lines,supplier){
      let po=d.purchaseOrders.find(function(candidate){return candidate&&candidate.supplier===supplier&&lower(candidate.status)==='draft - review'&&candidate.source==='Product Hub replenishment';});
      if(!po){po={id:nextPoId(),supplier:supplier,status:'Draft - Review',source:'Product Hub replenishment',reviewStatus:'Needs review',supplierEmailStatus:'Blocked until reviewed',created:new Date().toISOString().slice(0,10),due:'',lines:[]};d.purchaseOrders.push(po);}
      lines.forEach(function(entry){const existing=(po.lines||[]).find(function(line){return line.productId===entry.product.id&&!line.salesOrderId&&!line.projectId;});if(existing)existing.qty=number(existing.qty)+entry.qty;else po.lines.push({productId:entry.product.id,qty:entry.qty,received:0,supplierSku:entry.row.supplierSku||entry.product.supplierSku||'',unitCost:entry.row.unitCost,orderedDate:new Date().toISOString().slice(0,10),dueDate:'',leadTimeDays:entry.row.leadTimeDays,chaseStatus:'Waiting',supplierNotes:'Suggested by Product Hub replenishment · '+entry.row.reason,replenishment:true});});
      touched.push(po);
    });
    if(touched.length&&typeof global.saveAppData==='function')global.saveAppData();
    return touched;
  }
  function bundleMetrics(bundle) {
    const items=Array.isArray(bundle&&bundle.bundleItems)?bundle.bundleItems.filter(function(item){return item&&item.productId&&number(item.qty)>0;}):[];
    const errors=[];let componentCost=0,buildable=Infinity;
    if(!items.length)errors.push('Bundle must contain at least one existing SKU.');
    items.forEach(function(item){const component=productById(item.productId);if(!component){errors.push('Component '+item.productId+' does not exist.');return;}if(isBundle(component)){errors.push('Nested bundles are not supported: '+component.sku+'.');return;}const qty=Math.max(1,number(item.qty,1)),s=stockSummary(component.id);componentCost+=number(component.cost)*qty;buildable=Math.min(buildable,Math.floor(s.available/qty));});
    if(buildable===Infinity)buildable=0;
    const sell=number(bundle&&bundle.rrp),profit=sell-componentCost,margin=sell>0?profit/sell*100:0;
    return {valid:errors.length===0,errors:errors,buildable:Math.max(0,buildable),componentCost:componentCost,sellPrice:sell,profit:profit,margin:margin,items:items};
  }
  function createBundle(values) {
    const d=store(),sku=text(values&&values.sku),name=text(values&&values.name),components=Array.isArray(values&&values.components)?values.components:[];
    if(!sku||!name)throw new Error('Bundle SKU and name are required.');
    if((d.products||[]).some(function(p){return !p.deleted&&lower(p.sku)===lower(sku);}))throw new Error('SKU already exists.');
    const candidate={id:'BND-'+Date.now().toString(36).toUpperCase(),sku:sku,name:name,productType:'Bundle / Kit',bundleEnabled:true,stockTracked:false,rrp:number(values.rrp),cost:0,bundleItems:components.map(function(c){return {productId:c.productId,qty:Math.max(1,number(c.qty,1)),role:text(c.role)};})};
    const metrics=bundleMetrics(candidate);if(!metrics.valid)throw new Error(metrics.errors.join(' '));candidate.cost=metrics.componentCost;(d.products||(d.products=[])).push(candidate);if(typeof global.saveAppData==='function')global.saveAppData();return candidate;
  }
  function createProductGroup(values) {
    const d=store(),name=text(values&&values.name),parentSku=text(values&&values.parentSku),ids=Array.isArray(values&&values.productIds)?values.productIds:[];
    if(!name||!parentSku||!ids.length)throw new Error('Group name, group code and at least one existing SKU are required.');
    const products=ids.map(productById).filter(Boolean);if(products.length!==ids.length)throw new Error('Every group member must be an existing SKU.');
    products.forEach(function(p,index){p.parentName=name;p.parentSku=parentSku;p.productGroup=name;p.isVariant=products.length>1;p.variantSortOrder=index+1;});if(typeof global.saveAppData==='function')global.saveAppData();return {name:name,parentSku:parentSku,products:products};
  }
  function productHealth(product) {
    if(!product)return {tone:'bad',label:'Missing',issues:['Product missing']};
    const issues=[];const row=isStocked(product)?replenishmentRow(product):null;
    if(isStocked(product)&&!text(product.supplierSku))issues.push('Supplier SKU missing');
    if(isStocked(product)&&!text(product.barcode)&&!text(product.mpn))issues.push('Barcode / MPN missing');
    if(isStocked(product)&&row&&row.needsOrder)issues.push('Replenishment required');
    const margin=number(product.rrp)>0?(number(product.rrp)-number(product.cost))/number(product.rrp)*100:null;if(margin!==null&&margin<25)issues.push('Low margin');
    if(isBundle(product)){const m=bundleMetrics(product);if(!m.valid)issues.push('Bundle component issue');else if(m.buildable<=0)issues.push('Bundle not currently buildable');}
    return {tone:issues.length?'warn':'good',label:issues.length?'Needs attention':'Healthy',issues:issues,margin:margin};
  }

  global.PoolShedProductHub={
    version:'1.11.0', search:search, productById:productById, isBundle:isBundle, isStocked:isStocked, stockSummary:stockSummary,
    supplierOffer:supplierOffer, confirmedInbound:confirmedInbound, uncoveredDemand:uncoveredDemand, replenishmentSettings:replenishmentSettings,
    replenishmentRow:replenishmentRow, replenishmentRows:replenishmentRows, groupReplenishmentBySupplier:groupReplenishmentBySupplier,
    roundOrderQuantity:roundOrderQuantity, createDraftPurchaseOrders:createDraftPurchaseOrders,
    bundleMetrics:bundleMetrics, createBundle:createBundle, createProductGroup:createProductGroup, productHealth:productHealth, aliases:aliases
  };
})(globalThis);
