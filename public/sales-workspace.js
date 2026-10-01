/* Sales Order Command presentation layer.
   Business engines in the legacy runtime remain authoritative. */
(function () {
  'use strict';

  salesOrdersSubMenu = function() { return ''; };

  const originalDetail = salesOrderDetail;
  const originalContent = salesOrderTabContent;
  const originalCustomer = customerProfileCard;
  const originalTabs = salesOrderTabs;
  const originalTotalsBox = salesOrderTotalsBox;
  const originalAddRow = salesOrderAddRow;

  function so2Money(value) {
    return money(Number(value || 0));
  }

  function so2CustomerCard(order, c) {
    if (!c) return originalCustomer.apply(this, arguments);
    const finance = customerFinancialSummary(c.id);
    const company = c.companyName || c.name || 'Customer';
    const contact = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.contactName || c.name || company;
    const initials = ((c.firstName || company || 'C').charAt(0) + (c.lastName || company.split(' ')[1] || '').charAt(0)).toUpperCase();
    const balance = Number(finance && finance.balance || 0);
    const creditLimit = Number(c.creditLimit || 0);
    const onHold = String(c.status || 'Active').toLowerCase() !== 'active' || (creditLimit > 0 && balance > creditLimit);
    const terms = Number(c.creditDays || 0) > 0 ? ((c.creditTermType || 'Net') + ' ' + Number(c.creditDays) + ' days') : 'Standard terms';
    const priceList = String(c.priceList || orderPriceList(order) || 'RRP').toUpperCase();
    const identityMeta = [contact !== company ? contact : '', c.code || c.id, priceList, terms].filter(Boolean).join(' · ');
    const contactMeta = [c.email || '', c.phone || c.mobile || ''].filter(Boolean).join(' · ') || 'Contact details not recorded';

    return '<section class="so2-summary-card so2-customer-card">' +
      '<div class="so2-card-body">' +
        '<div class="so2-kicker">Customer</div>' +
        '<div class="so2-customer-title"><span class="so2-avatar">' + escapeHtml(initials) + '</span><div class="so2-customer-title-copy"><h3>' + escapeHtml(company) + '</h3><p>' + escapeHtml(identityMeta) + '</p><small class="so2-customer-contact">' + escapeHtml(contactMeta) + '</small></div>' +
          '<span class="pill ' + (onHold ? 'warn' : 'good') + '">' + (onHold ? 'Needs attention' : 'CRM linked') + '</span></div>' +
        '<div class="smart-customer-select so2-customer-search"><label><span class="sr-only">Select customer</span><input list="salesOrderCustomerOptions" data-customer-smart-input="' + order.id + '" value="' + escapeHtml(customerSmartValue(c)) + '" placeholder="Change customer — search name, email, postcode or customer code"></label><button class="secondary" data-apply-order-customer="' + order.id + '">Change</button><button type="button" class="secondary" data-sales-edit-customer="' + escapeHtml(c.id) + '">Open CRM</button></div>' + customerSmartOptions(order.customerId) +
      '</div>' +
    '</section>';
  }

  customerProfileCard = so2CustomerCard;

  salesOrderTabs = function() {
    const tabs = [
      ['products','Items & Pricing'],
      ['fulfilment','Fulfilment'],
      ['addresses','Addresses'],
      ['cost','Cost & Margin'],
      ['connections','Purchasing & Credits'],
      ['notes','Activity & Payments'],
      ['custom','More']
    ];
    return '<div class="so2-tabs-shell"><div class="tabs-row so2-tabs">' + tabs.map(function(tab) {
      return '<button class="tab-chip ' + (salesOrderTab === tab[0] ? 'active' : '') + '" data-so-tab="' + tab[0] + '">' + tab[1] + '</button>';
    }).join('') + '</div></div>';
  };

  salesOrderTotalsBox = function(order) {
    const totals = salesOrderTotals(order);
    const balance = Math.max(0, totals.gross - totals.paid);
    return '<div class="so2-totals-body">' +
      '<div class="order-total-row"><span>Net</span><strong>' + so2Money(totals.net) + '</strong></div>' +
      '<div class="order-total-row"><span>VAT</span><strong>' + so2Money(totals.vat) + '</strong></div>' +
      '<div class="order-total-row grand"><span>Total inc VAT</span><strong>' + so2Money(totals.gross) + '</strong></div>' +
      '<div class="order-total-row"><span>Paid</span><strong>' + so2Money(totals.paid) + '</strong></div>' +
      '<div class="order-total-row"><span>Balance due</span><strong>' + so2Money(balance) + '</strong></div>' +
      '<div class="so2-payment-actions"><button class="primary-action" data-open-payment="' + order.id + '">Take / Record Payment</button><button class="secondary" data-so-tab="notes">View payment history</button></div>' +
      '<p class="so2-totals-note">Payments update the financial record only. Stock state is controlled by allocation and fulfilment.</p>' +
    '</div>';
  };

  salesOrderAddRow = function(order) {
    return '<div class="so4-finder-shell">' +
      '<div class="so4-finder-copy"><div><span class="so2-kicker">Connected product catalogue</span><strong>Add a stock-controlled item</strong><small>Start typing and useful products appear immediately. Search family, exact variant, SKU, barcode, size or common trade wording.</small></div>' +
        '<span class="so4-catalogue-ready">● Catalogue ready · ' + (data.products || []).filter(function(p){return p && p.active !== false && !p.deleted && !p.archived && !p.hiddenFromCatalogue;}).length + ' items</span></div>' +
      '<div class="so4-finder-controls">' +
        '<div class="so4-search-field"><label for="salesOrderProductSearch">Find product, variant, SKU, barcode or keyword</label><div class="so4-search-wrap"><span aria-hidden="true">⌕</span><input id="salesOrderProductSearch" data-order-id="' + escapeHtml(order.id) + '" autocomplete="off" placeholder="Try product name, SKU, barcode, size or keyword"><button type="button" class="secondary so4-clear-search" data-so-clear-search>Clear</button><div id="salesOrderProductResults" class="po-product-results so-product-results" hidden></div></div></div>' +
        '<label class="so4-qty-field"><span>Quantity</span><input id="salesOrderProductQty" type="number" min="1" value="1"></label>' +
        '<button type="button" class="primary-action so4-add-selected" data-add-line-order="' + escapeHtml(order.id) + '">Add selected item</button>' +
        '<button type="button" class="secondary so4-add-multiple" data-open-so-batch="' + escapeHtml(order.id) + '">Add multiple items</button>' +
      '</div>' +
      '<div class="so-smart-search-hints"><span>Try:</span><button type="button" data-so-inline-search-fill="chlorine">chlorine</button><button type="button" data-so-inline-search-fill="shock">shock</button><button type="button" data-so-inline-search-fill="hypo">hypo</button><button type="button" data-so-inline-search-fill="20 litre">20 litre</button><button type="button" data-so-inline-search-fill="pH minus">pH minus</button><small>Typos, word order and common trade terms are supported.</small></div>' +
    '</div>' +
    salesOrderBatchPicker(order) +
    '<div class="so4-secondary-tools">' +
      '<details class="so4-tool-card"><summary><span><small>Non-stock & custom</small><strong>Add a custom sales line</strong><em>Labour, call-out, discounts and other non-stock charges.</em></span><b>Open</b></summary>' +
        '<div class="so4-tool-body so-line-form" data-line-composer-panel="custom"><label class="so-line-description"><span>Product / service name</span><input id="customLineProductName" placeholder="Example: One-piece pool shell" required></label><label class="so-line-description"><span>Variant / specification</span><input id="customLineVariant" placeholder="Example: Light Grey · 10m × 3.7m × 1.5m"></label><label><span>Quantity</span><input id="customLineQty" type="number" min="1" step="1" value="1"></label><label><span>Unit price net</span><input id="customLinePrice" type="number" min="0" step="0.01" value="0.00"></label><label><span>Unit cost</span><input id="customLineCost" type="number" min="0" step="0.01" value="0.00"></label><label><span>Tax</span><select id="customLineTax">' + optionList(["20% VAT","Zero rated","Not rated"],"20% VAT") + '</select></label><label><span>Sales account</span><select id="customLineAccount">' + optionList(["4010 Service Upsell","4030 Labour Income","4050 Call-out Charges","4060 Miscellaneous Sales"],"4010 Service Upsell") + '</select></label><label class="so-line-note"><span>Internal note (optional)</span><textarea id="customLineNote" placeholder="Reason, engineer detail or approval note"></textarea></label><button type="button" class="primary-action" data-add-custom-line="' + escapeHtml(order.id) + '">Add custom line</button></div>' +
      '</details>' +
      '<details class="so4-tool-card"><summary><span><small>Delivery & billing</small><strong>Add a shipping charge</strong><em>Delivery charge, method and customer-facing description.</em></span><b>Open</b></summary>' +
        '<div class="so4-tool-body so-line-form" data-line-composer-panel="shipping"><label class="so-line-description"><span>Shipping method</span><select id="shippingLineMethod"><option>Standard delivery</option><option>Express delivery</option><option>Pallet delivery</option><option>Chemical delivery surcharge</option><option>Free delivery</option><option>Collection</option><option>Custom shipping</option></select></label><label class="so-line-description"><span>Customer description</span><input id="shippingLineDescription" value="Standard delivery" placeholder="Shown on the sales order and invoice"></label><label><span>Charge net</span><input id="shippingLinePrice" type="number" min="0" step="0.01" value="12.50"></label><label><span>Tax</span><select id="shippingLineTax">' + optionList(["20% VAT","Zero rated","Not rated"],"20% VAT") + '</select></label><button type="button" class="primary-action" data-add-shipping-line="' + escapeHtml(order.id) + '">Add shipping</button></div>' +
      '</details>' +
      '<section class="so4-tool-card so4-commercial-check"><div><small>Commercial check</small><strong>Ready to progress?</strong><em>Save the order independently of allocation and fulfilment. Adding an item never allocates stock automatically.</em></div><span>✓ Stock and finance remain separate</span></section>' +
    '</div>';
  };

  function so2FamilyKey(p) {
    return String((p && (p.parentSku || p.parent_sku || p.parentName || p.parent_name || p.familyName || p.family_name)) || (p && p.name) || '').trim().toLowerCase();
  }

  function so2VariantProducts(p) {
    if (!p) return [];
    const key = so2FamilyKey(p);
    return (data.products || []).filter(function(candidate) {
      return candidate && candidate.active !== false && !candidate.deleted && !candidate.archived && !candidate.hiddenFromCatalogue && so2FamilyKey(candidate) === key;
    });
  }

  function so2CustomProductName(line,p) {
    if (line && line.lineType === 'shipping') return 'Delivery charge';
    return String((line && line.customProductName) || (p && p.name) || (line && line.description) || 'Custom line').trim();
  }

  function so2CustomVariant(line,p) {
    if (line && line.lineType === 'shipping') return String(line.description || line.shippingMethod || 'Shipping charge').trim();
    const explicit = String((line && (line.customVariant || line.variantDescription || line.variant)) || '').trim();
    if (explicit) return explicit;
    if (line && line.customProductName && line.description && String(line.description).trim() !== String(line.customProductName).trim()) return String(line.description).trim();
    return 'Custom / non-stock';
  }

  function so2VariantSelect(order, line, p, locked) {
    const variants = so2VariantProducts(p);
    const currentMeta = salesOrderVariantMeta(p) || p.name || p.sku || 'Exact SKU';
    if (isNonStockSalesLine(line)) {
      return '<div class="so2-variant-static"><strong>' + escapeHtml(so2CustomVariant(line,p)) + '</strong><small>' + escapeHtml(p.sku || p.id || '') + '</small></div>';
    }
    if (variants.length < 2) {
      return '<div class="so2-variant-static"><strong>' + escapeHtml(currentMeta) + '</strong><small>' + escapeHtml(p.sku || p.id || '') + '</small></div>';
    }
    return '<label class="so2-variant-control"><span>Exact variant / SKU</span><select data-so2-variant="' + escapeHtml(order.id) + '|' + escapeHtml(line.productId) + '"' + (locked ? ' disabled title="Variant cannot change after allocation or fulfilment starts."' : '') + '>' +
      variants.map(function(v) {
        const meta = salesOrderVariantMeta(v) || v.name || v.sku || 'Variant';
        return '<option value="' + escapeHtml(v.id) + '"' + (v.id === line.productId ? ' selected' : '') + '>' + escapeHtml(meta + ' · ' + (v.sku || v.id)) + '</option>';
      }).join('') + '</select><small>' + escapeHtml(p.sku || p.id || '') + (locked ? ' · locked by stock activity' : '') + '</small></label>';
  }


  function so5ProductThumb(p) {
    if (!p || !p.id || String(p.id).indexOf('CUSTOM-')===0) return '<span class="so5-line-thumb"><span aria-hidden="true">PB</span></span>';
    let url='';
    try {
      if (window.PoolShedProductImages) {
        url=window.PoolShedProductImages.variantImageUrl(p) || window.PoolShedProductImages.parentImageUrl(p) || '';
      }
    } catch (_) {}
    if (!url) url=p.variantImageUrl || p.variant_image_url || p.imageUrl || p.image_url || '';
    return '<span class="so5-line-thumb">' + (url ? '<img src="' + escapeHtml(url) + '" alt="" loading="lazy" decoding="async">' : '<span aria-hidden="true">PB</span>') + '</span>';
  }

  function so2LineRows(order) {
    return order.lines.map(function(line) {
      const p = product(line.productId) || { id:line.productId, sku:'CUSTOM', name:line.description || 'Custom sales line', category:'Non-stock' };
      const nonStock = isNonStockSalesLine(line);
      const coverage = salesLineCoverage(line, order.id);
      const health = salesLineHealth(line, order.id);
      const stockInfo = nonStock ? null : salesOrderProductStockInfo(p);
      const unitNet = salesOrderLinePrice(order, line);
      const vatRate = vatRateForLine(line);
      const lineGross = (unitNet * Number(line.qty || 0)) * (1 + vatRate);
      const family = nonStock ? so2CustomProductName(line,p) : salesOrderProductFamily(p);
      const locked = Number(line.allocated||0) > 0 || Number(line.picked||0) > 0 || Number(line.packed||0) > 0 || Number(line.shipped||0) > 0 ||
        goodsNotesForOrder(order.id).some(function(note){ return note.lines.some(function(nl){ return nl.productId === line.productId; }); });
      const deleteCheck = so2SalesLineDeleteAssessment(order,line);
      const removable = deleteCheck.allowed;
      const menuId = 'so2-menu-' + String(order.id + '-' + line.productId).replace(/[^a-z0-9_-]/gi,'-');
      return '<tr class="so2-line-row ' + health.className + '">' +
        '<td class="so2-check"><input type="checkbox" data-sales-line-select="' + order.id + '|' + line.productId + '" aria-label="Select ' + escapeHtml(p.sku || p.name) + '"></td>' +
        '<td class="so2-product-cell"><div class="so5-line-product">' + so5ProductThumb(p) + '<div class="so5-line-product-copy"><strong>' + escapeHtml(family) + '</strong><small>' + escapeHtml(nonStock ? (line.lineType === 'shipping' ? 'Non-stock delivery charge' : 'Custom / non-stock') : (p.name || p.brand || p.category || 'Catalogue product')) + '</small>' + (!nonStock ? '<button type="button" class="link-button" data-open-product="' + escapeHtml(p.id) + '">View product</button>' : '') + '</div></div></td>' +
        '<td class="so2-variant-cell">' + so2VariantSelect(order,line,p,locked) + '</td>' +
        '<td class="so2-stock-cell">' + (nonStock ? '<span class="muted">Not stock controlled</span>' : '<strong class="' + (coverage.free > 0 ? 'so2-stock-good' : 'so2-stock-warn') + '">' + coverage.free + ' free</strong><small>' + escapeHtml(stockInfo ? stockInfo.location : allocationSourceLabel(order.id)) + ' · ' + (stockInfo ? stockInfo.onHand : 0) + ' physical' + (coverage.onPo ? ' · ' + coverage.onPo + ' on PO' : '') + '</small>') + '</td>' +
        '<td><input class="qty-input so2-qty" data-line-field="' + order.id + '|' + line.productId + '|qty" type="number" min="0" value="' + Number(line.qty||0) + '"></td>' +
        '<td class="so2-allocated"><strong>' + (nonStock ? '—' : Number(line.allocated||0) + ' / ' + Number(line.qty||0)) + '</strong><small>' + (nonStock ? 'Not required' : (Number(line.allocated||0) ? 'Allocated' : 'Not allocated')) + '</small></td>' +
        '<td class="right so2-money"><strong>' + so2Money(unitNet) + '</strong><small>net unit</small></td>' +
        '<td class="so2-vat">' + Math.round(vatRate*100) + '%</td>' +
        '<td class="right so2-money so5-line-total"><strong>' + so2Money(lineGross) + '</strong><small>inc VAT</small></td>' +
        '<td class="so2-actions-cell"><button type="button" class="secondary so2-menu-button" data-so2-line-menu="' + menuId + '" aria-haspopup="menu" aria-expanded="false">•••</button>' +
          '<div id="' + menuId + '" class="so2-line-menu" data-so2-menu role="menu" hidden>' +
            (!nonStock ? '<button type="button" role="menuitem" data-allocate-line="' + order.id + '|' + line.productId + '">Allocate</button><button type="button" role="menuitem" data-unallocate-line="' + order.id + '|' + line.productId + '">Unallocate</button><button type="button" role="menuitem" data-open-product="' + escapeHtml(p.id) + '">View product</button><button type="button" role="menuitem" data-so-tab="fulfilment">Fulfilment details</button><div class="so2-menu-separator"></div>' : '') +
            '<button type="button" role="menuitem" class="danger" data-remove-sales-line="' + order.id + '|' + line.productId + '"' + (removable ? ' title="' + escapeHtml(deleteCheck.reason) + '"' : ' aria-disabled="true" title="' + escapeHtml(deleteCheck.reason) + '"') + '>Remove line</button>' +
          '</div></td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="10"><div class="so2-empty-lines"><strong>No order lines yet</strong><span>Search the connected catalogue below to add the first exact SKU.</span></div></td></tr>';
  }

  function so2SalesLineDeleteAssessment(order,line) {
    if (!order || !line) return { allowed:false, reason:'Sales Order line unavailable.', linkedPoLines:[], linkedGoodsNotes:[] };
    const nonStock = isNonStockSalesLine(line);
    const linkedPoLines = [];
    (data.purchaseOrders||[]).forEach(function(po){
      (po.lines||[]).forEach(function(poLine,index){
        if (String(poLine.salesOrderId||'')===String(order.id) && String(poLine.productId||'')===String(line.productId||'')) linkedPoLines.push({po:po,line:poLine,index:index});
      });
    });
    const linkedGoodsNotes=(data.goodsNotes||[]).filter(function(note){
      return String(note.salesOrderId||'')===String(order.id) && (note.lines||[]).some(function(noteLine){
        return String(noteLine.productId||'')===String(line.productId||'');
      });
    });
    const receivedPo = linkedPoLines.some(function(row){
      if (Number(row.line.received||row.line.receivedQty||0)>0) return true;
      return (data.receiptEvents||[]).some(function(event){
        if (String(event.poId||'')!==String(row.po.id||'')) return false;
        if (String(event.productId||'')===String(line.productId||'')) return Number(event.qty||event.received||1)>0;
        return (event.lines||[]).some(function(receiptLine){return String(receiptLine.productId||'')===String(line.productId||'') && Number(receiptLine.qty||receiptLine.received||0)>0;});
      });
    });
    const goodsOutMoved = !nonStock && (
      Number(line.shipped||0)>0 ||
      linkedGoodsNotes.some(function(note){
        if(note.shipped||note.stockDeducted||note.shipmentLocked)return true;
        return (note.lines||[]).some(function(noteLine){
          return String(noteLine.productId||'')===String(line.productId||'') && Number(noteLine.shipped||0)>0;
        });
      }) ||
      (data.movements||[]).some(function(move){
        if(String(move.productId||'')!==String(line.productId||''))return false;
        if(String(move.type||'').toLowerCase()!=='goods out')return false;
        return String(move.ref||'')===String(order.id) || linkedGoodsNotes.some(function(note){return String(move.ref||'')===String(note.id||'');});
      })
    );
    const invoiceRef=String(order.xeroRef||'').trim();
    const invoiced=!!(
      order.invoiceSource || order.invoiceDate || order.invoiceId || order.xeroInvoiceId || order.xeroInvoiceNumber ||
      (invoiceRef && invoiceRef.toLowerCase()!=='draft') ||
      ['Invoiced','Completed'].includes(String(order.status||'')) ||
      (order.tags||[]).some(function(tag){return String(tag||'').toLowerCase()==='invoiced';})
    );
    if (receivedPo) return {allowed:false,reason:'This product has already been received from a supplier, so stock has physically moved. Use Supplier Returns & Credits before correcting the Sales Order.',linkedPoLines:linkedPoLines,linkedGoodsNotes:linkedGoodsNotes};
    if (goodsOutMoved) return {allowed:false,reason:'This product has already been shipped or deducted from stock. Use a Sales Credit / return so the stock movement stays auditable.',linkedPoLines:linkedPoLines,linkedGoodsNotes:linkedGoodsNotes};
    if (invoiced) return {allowed:false,reason:'This Sales Order has already been invoiced. Use a Sales Credit / corrective document rather than deleting the line.',linkedPoLines:linkedPoLines,linkedGoodsNotes:linkedGoodsNotes};
    const workflow=[];
    if(Number(line.allocated||0)>0)workflow.push('allocated stock');
    if(linkedGoodsNotes.length)workflow.push('open fulfilment');
    if(linkedPoLines.length)workflow.push('unreceived PO demand');
    return {
      allowed:true,
      reason:nonStock?'This line can be removed and retained in correction history.':workflow.length?'This line can be removed. '+workflow.join(', ')+' will be unwound automatically.':'This line can be safely removed.',
      linkedPoLines:linkedPoLines,
      linkedGoodsNotes:linkedGoodsNotes
    };
  }

  function so2RemoveLinkedPoDemand(rows,order,line,reason) {
    const touched = new Set(),at=new Date().toISOString(),user=(typeof currentUser==='function'&&currentUser()&&(currentUser().name||currentUser().email))||'Sales';
    rows.forEach(function(row){
      const po=row.po;if(!po||touched.has(po.id))return;touched.add(po.id);
      const removed=[];
      po.lines=(po.lines||[]).filter(function(poLine){
        const match=String(poLine.salesOrderId||'')===String(order.id) && String(poLine.productId||'')===String(line.productId||'');
        if(match)removed.push(JSON.parse(JSON.stringify(poLine)));
        return !match;
      });
      if(!removed.length)return;
      po.lineCorrections=Array.isArray(po.lineCorrections)?po.lineCorrections:[];
      removed.forEach(function(snapshot){
        po.lineCorrections.push({id:'POLINE-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),type:'Demand removed with Sales Order line',at:at,user:user,reason:reason,line:snapshot,sku:(product(snapshot.productId)||{}).sku||snapshot.productId,name:(product(snapshot.productId)||{}).name||''});
      });
      const supplierCommitted=!!(po.supplierEmailSentAt||po.supplierConfirmedAt||String(po.status||'').toLowerCase().includes('confirmed'));
      if(supplierCommitted){
        po.reviewStatus='Needs review';po.supplierEmailStatus='Changes pending';
        if(!['Cancelled','Received'].includes(po.status))po.status='Draft - Review';
      }
      data.auditLog=Array.isArray(data.auditLog)?data.auditLog:[];
      data.auditLog.push({id:'AUD-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),date:at,user:user,action:'Purchase order demand removed from Sales Order correction',product:po.id,previousValue:removed,newValue:'Removed before receipt',reason:reason});
    });
    return Array.from(touched);
  }

  function so2RemoveOpenFulfilmentDemand(order,line,reason) {
    const touched=[],removedNotes=[],at=new Date().toISOString(),user=(typeof currentUser==='function'&&currentUser()&&(currentUser().name||currentUser().email))||'Sales';
    const notes=Array.isArray(data.goodsNotes)?data.goodsNotes:[];
    notes.forEach(function(note){
      if(String(note.salesOrderId||'')!==String(order.id))return;
      const removed=(note.lines||[]).filter(function(noteLine){return String(noteLine.productId||'')===String(line.productId||'');});
      if(!removed.length)return;
      if(note.shipped||note.stockDeducted||note.shipmentLocked||removed.some(function(noteLine){return Number(noteLine.shipped||0)>0;}))return;
      note.lineCorrections=Array.isArray(note.lineCorrections)?note.lineCorrections:[];
      removed.forEach(function(snapshot){
        note.lineCorrections.push({id:'GNLINE-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),type:'Fulfilment line removed with Sales Order correction',at:at,user:user,reason:reason,line:JSON.parse(JSON.stringify(snapshot))});
      });
      note.lines=(note.lines||[]).filter(function(noteLine){return String(noteLine.productId||'')!==String(line.productId||'');});
      if(note.lines.length){
        note.picked=note.lines.every(function(noteLine){return Number(noteLine.picked||0)>=Number(noteLine.qty||0);});
        note.packed=note.lines.every(function(noteLine){return Number(noteLine.packed||0)>=Number(noteLine.qty||0);});
        touched.push(note.id);
      }else{
        removedNotes.push(note.id);
      }
      data.auditLog=Array.isArray(data.auditLog)?data.auditLog:[];
      data.auditLog.push({id:'AUD-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),date:at,user:user,action:'Open fulfilment demand removed from Sales Order correction',product:note.id,previousValue:removed,newValue:note.lines.length?'Line removed':'Goods note removed',reason:reason});
    });
    if(removedNotes.length)data.goodsNotes=notes.filter(function(note){return !removedNotes.includes(note.id);});
    return {touched:touched,removed:removedNotes};
  }

  function so2ApplySalesOrderLineRemoval(order,line,assessment,reason) {
    const p=product(line.productId)||{},label=line.description||line.customProductName||p.name||line.productId;
    const snapshot=JSON.parse(JSON.stringify(line)),at=new Date().toISOString(),user=(typeof currentUser==='function'&&currentUser()&&(currentUser().name||currentUser().email))||'Sales';
    const fulfilment=so2RemoveOpenFulfilmentDemand(order,line,reason);
    if(!isNonStockSalesLine(line)&&Number(line.allocated||0)>0)releaseAllocatedStockForLine(order,line,Number(line.allocated||0),'Sales order line undo');
    const poIds=so2RemoveLinkedPoDemand(assessment.linkedPoLines,order,line,reason);
    const index=order.lines.indexOf(line);if(index>=0)order.lines.splice(index,1);
    order.lineCorrections=Array.isArray(order.lineCorrections)?order.lineCorrections:[];
    order.lineCorrections.push({id:'SOLINE-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),type:'Sales Order line undone before invoice / stock movement',at:at,user:user,reason:reason,line:snapshot,linkedPurchaseOrders:poIds,fulfilmentNotesRemoved:fulfilment.removed,fulfilmentNotesUpdated:fulfilment.touched});
    data.auditLog=Array.isArray(data.auditLog)?data.auditLog:[];
    data.auditLog.push({id:'AUD-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),date:at,user:user,action:'Sales order line undone',product:order.id,previousValue:snapshot,newValue:'Removed before invoice / physical stock movement',reason:reason});
    addSalesOrderNotification(order,'Sales order item undone',label+' removed. Reason: '+reason+(poIds.length?' Linked PO demand removed from '+poIds.join(', ')+'.':'')+((fulfilment.removed.length||fulfilment.touched.length)?' Open fulfilment was reset.':''),'Internal note');
    return label;
  }

  function so2FinishSalesOrderLineRemoval(order,labels) {
    if(typeof syncSalesOrderStatusFromGoodsNotes==='function')syncSalesOrderStatusFromGoodsNotes(order);
    order.status=order.lines.length?(order.status==='New Order'?'New Order':'Needs Review'):'Needs Review';
    order.updatedAt=new Date().toISOString();
    if(typeof saveAppData==='function')saveAppData();
    if(typeof toast==='function')toast((labels.length===1?labels[0]:labels.length+' lines')+' removed from '+order.id+'. Linked pre-shipment activity was unwound and project value/profit will recalculate automatically.');
    if(typeof render==='function')render();
  }

  function so2RemoveSalesOrderLine(order,line,assessment) {
    const p=product(line.productId)||{},label=line.description||line.customProductName||p.name||line.productId,reason=String(prompt('Reason for removing “'+label+'” from '+order.id+' (required)')||'').trim();
    if(!reason){ if(typeof toast==='function')toast('A removal reason is required.'); return; }
    let warning='Undo “'+label+'” from '+order.id+'?';
    if(!isNonStockSalesLine(line)&&Number(line.allocated||0)>0)warning+=' Allocated stock will be released.';
    if((assessment.linkedGoodsNotes||[]).length)warning+=' Open pick/pack activity will be removed.';
    if(assessment.linkedPoLines.length)warning+=' '+assessment.linkedPoLines.length+' unreceived linked PO line'+(assessment.linkedPoLines.length===1?'':'s')+' will also be removed and retained in PO history.';
    warning+=' The original entry and the reason for undoing it will remain in the audit history.';
    if(!confirm(warning))return;
    const removed=so2ApplySalesOrderLineRemoval(order,line,assessment,reason);
    so2FinishSalesOrderLineRemoval(order,[removed]);
  }

  function so2SelectedSalesOrderLines(orderId) {
    const order=(data.salesOrders||[]).find(function(row){return String(row.id)===String(orderId);});
    if(!order)return [];
    return Array.from(document.querySelectorAll('[data-sales-line-select^="'+String(orderId)+'|"]:checked')).map(function(input){
      const productId=String(input.dataset.salesLineSelect||'').split('|')[1];
      return order.lines.find(function(line){return String(line.productId)===productId;});
    }).filter(Boolean);
  }

  function so2UpdateSelectedLineToolbar(orderId) {
    const selected=so2SelectedSalesOrderLines(orderId),button=document.querySelector('[data-delete-selected-sales-lines="'+String(orderId)+'"]'),count=document.querySelector('[data-selected-sales-line-count="'+String(orderId)+'"]');
    if(count)count.textContent=selected.length?selected.length+' selected':'';
    if(button){
      button.disabled=!selected.length;
      button.textContent=selected.length?'Delete selected ('+selected.length+')':'Delete selected';
      button.setAttribute('aria-disabled',selected.length?'false':'true');
    }
    document.querySelectorAll('[data-sales-line-select^="'+String(orderId)+'|"]').forEach(function(input){
      const row=input.closest('tr');if(row)row.classList.toggle('so2-line-selected',!!input.checked);
    });
  }

  function so2RemoveSelectedSalesOrderLines(orderId) {
    const order=(data.salesOrders||[]).find(function(row){return String(row.id)===String(orderId);}),selected=so2SelectedSalesOrderLines(orderId);
    if(!order||!selected.length){if(typeof toast==='function')toast('Tick one or more order lines first.');return;}
    const checks=selected.map(function(line){return {line:line,assessment:so2SalesLineDeleteAssessment(order,line)};});
    const blocked=checks.filter(function(row){return !row.assessment.allowed;});
    if(blocked.length){
      const p=product(blocked[0].line.productId)||{},label=blocked[0].line.description||blocked[0].line.customProductName||p.name||blocked[0].line.productId;
      if(typeof toast==='function')toast('Cannot delete selected lines: '+label+'. '+blocked[0].assessment.reason);
      return;
    }
    const reason=String(prompt('Reason for deleting '+selected.length+' selected line'+(selected.length===1?'':'s')+' from '+order.id+' (required)')||'').trim();
    if(!reason){if(typeof toast==='function')toast('A removal reason is required.');return;}
    const allocationCount=selected.filter(function(line){return !isNonStockSalesLine(line)&&Number(line.allocated||0)>0;}).length;
    const fulfilmentCount=checks.filter(function(row){return (row.assessment.linkedGoodsNotes||[]).length>0;}).length;
    const poCount=checks.reduce(function(total,row){return total+row.assessment.linkedPoLines.length;},0);
    let warning='Delete '+selected.length+' selected line'+(selected.length===1?'':'s')+' from '+order.id+'?';
    if(allocationCount)warning+=' Allocated stock will be released.';
    if(fulfilmentCount)warning+=' Open pick/pack activity will be reset.';
    if(poCount)warning+=' '+poCount+' unreceived linked PO line'+(poCount===1?'':'s')+' will be removed.';
    warning+=' The original entries and your reason will remain in the audit history.';
    if(!confirm(warning))return;
    const labels=checks.map(function(row){return so2ApplySalesOrderLineRemoval(order,row.line,row.assessment,reason);});
    so2FinishSalesOrderLineRemoval(order,labels);
  }

  function so2ProductsContent(order) {
    const stockLines = order.lines.filter(function(line){ return !isNonStockSalesLine(line); });
    const unitCount = order.lines.reduce(function(sum,line){ return sum + Number(line.qty||0); },0);
    const allocatedCount = stockLines.reduce(function(sum,line){ return sum + Number(line.allocated||0); },0);
    const shortageCount = stockLines.filter(function(line){ return salesLineCoverage(line,order.id).toRaise > 0; }).length;
    return '<section class="so2-items-workspace">' +
      '<div class="so2-lines-toolbar"><div><span class="so2-kicker">Order lines</span><strong>' + order.lines.length + ' lines · ' + unitCount + ' units</strong><small>' + allocatedCount + ' allocated' + (shortageCount ? ' · ' + shortageCount + ' stock issue' + (shortageCount===1?'':'s') : '') + '</small></div>' +
        '<div class="so2-toolbar-actions"><span class="so2-selected-count" data-selected-sales-line-count="' + order.id + '"></span><button type="button" class="danger-button so2-delete-selected" data-delete-selected-sales-lines="' + order.id + '" disabled aria-disabled="true">Delete selected</button><button class="secondary" data-allocate-order="' + order.id + '">Allocate all</button><button class="secondary" data-selected-line-action="purchaseOrder" data-order-id="' + order.id + '">Raise PO</button><button class="secondary" data-selected-line-action="backOrder" data-order-id="' + order.id + '">Back order</button></div></div>' +
      '<div class="sales-table-scroll so2-table-scroll"><table class="order-lines-table so2-lines-table"><thead><tr><th></th><th>Product</th><th class="so2-variant-head">Variant</th><th>Stock</th><th>Qty</th><th>Allocated</th><th class="right">Unit net</th><th>VAT</th><th class="right">Line total</th><th>Actions</th></tr></thead><tbody>' + so2LineRows(order) + '</tbody></table></div>' +
      '<div class="so2-entry-grid"><section class="so2-catalogue-card" aria-label="Add products"><div class="so2-catalogue-body">' + salesOrderAddRow(order) + '</div></section>' +
        '<aside class="so2-totals-card"><div class="so2-section-head"><div><span class="so2-kicker">Order value</span><strong>Live totals</strong><small>Net, VAT, payments and balance.</small></div></div>' + salesOrderTotalsBox(order) + '</aside></div>' +
    '</section>';
  }

  function so2SupplierFundingForOrder(order) {
    const engine=window.PoolShedSupplierCommand;
    if(!engine||typeof engine.fundingControl!=='function')return [];
    const linkedPos=(data.purchaseOrders||[]).filter(function(po){return (po.lines||[]).some(function(line){return String(line.salesOrderId||po.originalSalesOrderId||'')===String(order.id);});});
    return linkedPos.map(function(po){const funding=engine.fundingControl(po.supplier,{today:new Date().toISOString().slice(0,10)}),row=(funding.rows||[]).find(function(item){return String(item.poId)===String(po.id);});return {po:po,funding:funding,row:row};});
  }

  function so2SupplierFundingPanel(order) {
    const rows=so2SupplierFundingForOrder(order);
    if(!rows.length)return '<section class="so-funding-panel"><div class="so-funding-head"><div><span>SUPPLIER FUNDING</span><strong>No supplier commitments linked yet</strong><small>When a Purchase Order line links to this Sales Order, its supplier funding and customer cash cover will appear here.</small></div></div></section>';
    const html=rows.map(function(item){const r=item.row||{},f=item.funding||{},short=Number(r.customerShortfall||0),tone=short>0?'warn':'good';return '<article class="so-funding-row '+tone+'"><div><button type="button" class="link-button" data-so-open-po-funding="'+escapeHtml(item.po.id)+'"><strong>'+escapeHtml(item.po.id)+'</strong></button><small>'+escapeHtml(item.po.supplier||'Supplier')+' · '+escapeHtml(f.accountType||'Supplier account')+'</small></div><div><span>Supplier due / commitment</span><strong>'+money(Number(r.amountDue||r.linkedRequirement||0))+'</strong><small>'+escapeHtml(r.dueDate||item.po.due||'Date not set')+'</small></div><div><span>Customer cash cover</span><strong>'+money(Number(r.customerCover||0))+'</strong><small>'+Number(r.coverPercent||0)+'% of linked demand</small></div><div><span>Status</span><strong class="'+(short>0?'bad-text':'good-text')+'">'+(short>0?money(short)+' short':'Funded')+'</strong><small>'+(short>0?'Customer payment needs attention':'Receipt allocation available')+'</small></div><div><button type="button" class="secondary" data-so-open-supplier-funding="'+escapeHtml(item.po.supplier||'')+'">Open supplier</button></div></article>';}).join('');
    const totalCover=rows.reduce(function(n,item){return n+Number(item.row&&item.row.customerCover||0);},0),totalShort=rows.reduce(function(n,item){return n+Number(item.row&&item.row.customerShortfall||0);},0),paid=(order.payments||[]).reduce(function(n,p){return n+Number(p.amount||0);},0);
    return '<section class="so-funding-panel"><div class="so-funding-head"><div><span>SUPPLIER FUNDING</span><strong>Customer cash covering linked Purchase Orders</strong><small>Actual payments received on this Sales Order are allocated once across linked supplier commitments.</small></div><div class="so-funding-summary"><span>Customer paid <b>'+money(paid)+'</b></span><span>Allocated cover <b>'+money(totalCover)+'</b></span><span class="'+(totalShort>0?'bad-text':'good-text')+'">Shortfall <b>'+money(totalShort)+'</b></span></div></div><div class="so-funding-list">'+html+'</div></section>';
  }

  salesOrderTabContent = function(order, lines, poRows, addressCards, costRows, costSummary) {
    if (salesOrderTab === 'products') return so2ProductsContent(order);
    if (salesOrderTab === 'fulfilment') {
      const progress = salesOrderProgress(order);
      return '<section class="so2-secondary-panel"><div class="so2-section-head"><div><span class="so2-kicker">Fulfilment</span><strong>Print · Pick · Pack · Ship</strong><small>Operational progress and Goods Notes for this order.</small></div><button class="primary-action" data-selected-line-action="advancedFulfil" data-order-id="' + order.id + '">Open fulfilment</button></div><div class="so2-fulfilment-summary"><div><span>Required</span><strong>' + progress.required + '</strong></div><div><span>Picked</span><strong>' + progress.picked + '</strong></div><div><span>Packed</span><strong>' + progress.packed + '</strong></div><div><span>Shipped</span><strong>' + (progress.shipped || 0) + '</strong></div></div>' + salesOrderGoodsNotesDirectory(order) + '</section>';
    }
    if (salesOrderTab === 'connections') {
      const credits = (data.salesCredits || []).filter(function(c){ return c.originalSalesOrderId===order.id; });
      return so2SupplierFundingPanel(order) + '<div class="so2-secondary-grid">' +
        panel('Linked purchasing','Receive against the purchase order in Warehouse Goods In. Stock is received once, then allocated to this order.','<div class="sales-table-scroll"><table><thead><tr><th>Purchase order</th><th>Status</th><th>Due</th><th>Items</th><th>Actions</th></tr></thead><tbody>'+poRows+'</tbody></table></div>') +
        panel('Credit notes & returns','Credits retain their link to this sales order.',credits.length ? credits.map(function(c){return '<p><button class="secondary" data-open-sales-credit="'+escapeHtml(c.id)+'">'+escapeHtml(c.id)+'</button> <span>'+escapeHtml(c.status)+'</span></p>';}).join('') : '<p class="muted">No credit notes linked to this order.</p>') +
      '</div>';
    }
    return originalContent.apply(this, arguments);
  };

  salesOrderDetail = function(order) {
    /* v1.6.3: authoritative Sales Order Command shell. Business/data engines
       stay in the legacy runtime; this replaces only the outer presentation. */
    const c = customer(order.customerId);
    const progress = salesOrderProgress(order);
    const required = Number(progress.required || 0);
    const allocated = (order.lines || []).filter(function(line){ return !isNonStockSalesLine(line); })
      .reduce(function(sum,line){ return sum + Number(line.allocated || 0); },0);
    const packed = Number(progress.packed || 0);
    const shipped = Number(progress.shipped || 0);

    /* v1.7.1: the primary Items & Pricing surface is rendered directly from the
       approved Sales Order Command presentation. It no longer round-trips
       through the legacy record shell, which allowed old wrappers/styles to
       leak back into the page. Non-primary tabs still reuse their existing
       business payload until those modules are intentionally redesigned. */
    let activeBody = '';
    if (salesOrderTab === 'products') {
      activeBody = so2ProductsContent(order);
    } else if (salesOrderTab === 'fulfilment') {
      activeBody = salesOrderTabContent(order, '', '', '', '', '');
    } else {
      const legacyTemplate = document.createElement('template');
      legacyTemplate.innerHTML = originalDetail(order);
      const legacyBodies = legacyTemplate.content.querySelectorAll('.record-card-body');
      activeBody = legacyBodies.length ? legacyBodies[legacyBodies.length - 1].innerHTML : '';
    }

    const channelOptions = optionList(
      ["Project Order","Trade Counter","Service Upsell","WooCommerce","Wholesale and trade","Phone Order"],
      order.channel
    );
    const customerPo = order.customerPo || order.customerPO || order.customerPoRef || order.reference || '';
    const fulfilmentCopy = required
      ? (allocated >= required ? 'Stock allocated and ready for fulfilment.' : (allocated ? 'Partially allocated — review remaining demand.' : 'Stock has not been allocated yet.'))
      : 'Add an order line to begin stock allocation.';

    return '<div class="record-card sales-workspace sales-command-page so2-page so3-page">' +
      '<header class="so3-command-header">' +
        '<button type="button" class="so3-back" data-back-so-list>← Sales Orders</button>' +
        '<div class="so3-order-identity">' +
          '<div class="so3-order-title"><strong>' + escapeHtml(order.id) + '</strong>' + salesOrderStatusPicker(order) + '</div>' +
          '<div class="so3-order-meta">Created ' + escapeHtml(order.created || '—') + ' · Due ' + escapeHtml(order.due || '—') + ' · ' + escapeHtml(order.channel || order.source || 'Sales order') + '</div>' +
        '</div>' +
        '<div class="so3-command-actions">' +
          '<button type="button" class="secondary" data-email-print-order="' + escapeHtml(order.id) + '">Email / Print</button>' +
          '<button type="button" class="secondary" data-allocate-order="' + escapeHtml(order.id) + '">Allocate All</button>' +
          '<button type="button" class="secondary" data-fulfil-order="' + escapeHtml(order.id) + '">Fulfil</button>' +
          '<button type="button" class="secondary so3-invoice" data-open-invoice-confirm="' + escapeHtml(order.id) + '">Invoice</button>' +
          '<button type="button" class="primary-action so3-save so-action-save" data-save-order="' + escapeHtml(order.id) + '">Save Order</button>' +
        '</div>' +
      '</header>' +
      '<div class="so3-command-accent" aria-hidden="true"></div>' +

      '<div class="so3-workspace">' +
        '<section class="so3-summary-grid">' +
          so2CustomerCard(order,c) +
          '<section class="so2-summary-card so3-order-details"><div class="so3-card-body">' +
            '<span class="so2-kicker">Order details</span><h3>Dates & channel</h3>' +
            '<div class="so3-detail-grid">' +
              '<label><span>Date created</span><input data-order-field="' + escapeHtml(order.id) + '" data-field="created" type="date" value="' + escapeHtml(order.created || '') + '"></label>' +
              '<label><span>Due date</span><input data-order-field="' + escapeHtml(order.id) + '" data-field="due" type="date" value="' + escapeHtml(order.due || '') + '"></label>' +
              '<label><span>Channel</span><select data-order-field="' + escapeHtml(order.id) + '" data-field="channel">' + channelOptions + '</select></label>' +
              '<label><span>Customer PO</span><input data-order-field="' + escapeHtml(order.id) + '" data-field="customerPo" value="' + escapeHtml(customerPo) + '" placeholder="Optional"></label>' +
            '</div>' +
          '</div></section>' +
          '<section class="so2-summary-card so3-fulfilment"><div class="so3-card-body">' +
            '<span class="so2-kicker">Stock & fulfilment</span>' +
            '<div class="so3-fulfilment-title"><h3>' + (required ? (allocated >= required ? 'Ready to progress' : 'Allocation required') : 'Ready for order lines') + '</h3><button type="button" class="link-button" data-so-tab="fulfilment">Open fulfilment</button></div>' +
            '<p>' + escapeHtml(fulfilmentCopy) + '</p>' +
            '<div class="so3-stage-grid">' +
              '<div><span>Ordered</span><strong>' + required + '</strong></div>' +
              '<div><span>Allocated</span><strong>' + allocated + '</strong></div>' +
              '<div><span>Packed</span><strong>' + packed + '</strong></div>' +
              '<div><span>Shipped</span><strong>' + shipped + '</strong></div>' +
            '</div>' +
            '<label class="so3-source"><span>Allocation source</span><select data-order-field="' + escapeHtml(order.id) + '" data-field="carrier">' + locationOptionsSelected(order.carrier) + '</select></label>' +
          '</div></section>' +
        '</section>' +

        '<section class="so3-order-workspace">' +
          salesOrderTabs() +
          '<div class="so3-tab-content">' + activeBody + '</div>' +
        '</section>' +
      '</div>' +
    '</div>';
  };

  function closeLineMenus(except) {
    document.querySelectorAll('.so2-line-menu.so2-menu-open').forEach(function(menu) {
      if (menu === except) return;
      menu.classList.remove('so2-menu-open');
      menu.hidden = true;
      const owner = document.querySelector('[data-so2-line-menu="' + menu.id + '"]');
      if (owner) owner.setAttribute('aria-expanded','false');
    });
  }

  function positionLineMenu(button, menu) {
    if (menu.parentElement !== document.body) document.body.appendChild(menu);
    menu.hidden = false;
    menu.classList.add('so2-menu-open');
    const r = button.getBoundingClientRect();
    const mr = menu.getBoundingClientRect();
    const pad = 8;
    const left = Math.min(window.innerWidth - mr.width - pad, Math.max(pad, r.right - mr.width));
    let top = r.bottom + 5;
    if (top + mr.height > window.innerHeight - pad) top = Math.max(pad, r.top - mr.height - 5);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    button.setAttribute('aria-expanded','true');
  }

  document.addEventListener('change',function(event){
    const checkbox=event.target.closest('[data-sales-line-select]');
    if(!checkbox)return;
    const orderId=String(checkbox.dataset.salesLineSelect||'').split('|')[0];
    so2UpdateSelectedLineToolbar(orderId);
  },true);

  document.addEventListener('click',function(event){
    const button=event.target.closest('[data-delete-selected-sales-lines]');
    if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(button.disabled)return;
    so2RemoveSelectedSalesOrderLines(button.dataset.deleteSelectedSalesLines);
  },true);

  document.addEventListener('click', function(event) {
    const button=event.target.closest('[data-remove-sales-line]');
    if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    const parts=String(button.dataset.removeSalesLine||'').split('|'),order=salesOrder(parts[0]),line=order&&(order.lines||[]).find(function(item){return String(item.productId)===String(parts[1]);});
    if(!order||!line){if(typeof toast==='function')toast('Sales Order line not found.');return;}
    const assessment=so2SalesLineDeleteAssessment(order,line);
    if(!assessment.allowed){if(typeof toast==='function')toast(assessment.reason);return;}
    so2RemoveSalesOrderLine(order,line,assessment);
  },true);

  document.addEventListener('click', function(event) {
    const menuButton = event.target.closest('[data-so2-line-menu]');
    if (menuButton) {
      event.preventDefault();
      event.stopPropagation();
      const menu = document.getElementById(menuButton.dataset.so2LineMenu);
      if (!menu) return;
      const open = menu.classList.contains('so2-menu-open');
      closeLineMenus();
      if (!open) positionLineMenu(menuButton,menu);
      return;
    }
    if (!event.target.closest('.so2-line-menu')) closeLineMenus();

    const clearFinder = event.target.closest('[data-so-clear-search]');
    if (clearFinder) {
      const input = document.getElementById('salesOrderProductSearch');
      const results = document.getElementById('salesOrderProductResults');
      if (input) {
        input.value = '';
        input.dataset.selectedProductId = '';
        input.dataset.finderMode = '';
        input.classList.remove('has-selection');
        input.focus();
        input.dispatchEvent(new Event('input', { bubbles:true }));
      }
      if (results) results.hidden = true;
      return;
    }

    const editCustomer = event.target.closest('[data-sales-edit-customer]');
    if (editCustomer) {
      selectedCrmCustomerId = editCustomer.dataset.salesEditCustomer;
      active = 'crm';
      activeSubPage.crm = 'All Customers';
      render();
    }
  });

  document.addEventListener('change', function(event) {
    const select = event.target.closest('[data-so2-variant]');
    if (!select) return;
    const parts = select.dataset.so2Variant.split('|');
    const order = salesOrder(parts[0]);
    if (!order) return;
    const line = order.lines.find(function(item){ return item.productId === parts[1]; });
    if (!line) return;
    const targetId = select.value;
    if (targetId === line.productId) return;
    const target = product(targetId);
    if (!target) { toast('Variant could not be found.'); render(); return; }
    const locked = Number(line.allocated||0)>0 || Number(line.picked||0)>0 || Number(line.packed||0)>0 || Number(line.shipped||0)>0 ||
      goodsNotesForOrder(order.id).some(function(note){ return note.lines.some(function(nl){ return nl.productId === line.productId; }); });
    if (locked) { toast('Release allocation and fulfilment activity before changing variant.'); render(); return; }
    if (order.lines.some(function(item){ return item !== line && item.productId === targetId; })) {
      toast('That exact variant is already on this order. Adjust its quantity instead.');
      render();
      return;
    }
    const oldProduct = product(line.productId);
    line.productId = targetId;
    line.specialPrice = false;
    delete line.unitSell;
    delete line.price;
    addSalesOrderNotification(order,'Variant changed',(oldProduct ? oldProduct.sku : parts[1]) + ' changed to ' + (target.sku || target.id),'Internal note');
    order.status = 'Needs Review';
    order.updatedAt = new Date().toISOString();
    saveAppData();
    toast('Variant changed to ' + (target.sku || target.name) + '. Review price and allocation.');
    render();
  });

  document.addEventListener('click',function(event){
    const poButton=event.target.closest('[data-so-open-po-funding]');
    if(poButton){event.preventDefault();selectedPurchaseOrderId=poButton.dataset.soOpenPoFunding;purchaseOrderView='detail';if(typeof purchaseCommandTab!=='undefined')purchaseCommandTab='connections';activeSubPage.purchase='Purchase Orders';active='purchase';render();return;}
    const supplierButton=event.target.closest('[data-so-open-supplier-funding]');
    if(supplierButton){event.preventDefault();if(typeof globalThis.openSupplierCommand==='function'){globalThis.openSupplierCommand(supplierButton.dataset.soOpenSupplierFunding,'Overview');return;}selectedSupplierName=supplierButton.dataset.soOpenSupplierFunding;purchaseOrderView='supplier-profile';activeSubPage.purchase='Suppliers';active='purchase';render();return;}
  },true);

  /* Customer Orders was a duplicate list over data.salesOrders. Keep old links safe,
     but make Sales Orders the single customer-order authority. */
  const soUnifiedSidebarGroups=typeof sidebarSubGroups==='function'?sidebarSubGroups:null;
  if(soUnifiedSidebarGroups){
    sidebarSubGroups=function(tabId){const list=soUnifiedSidebarGroups(tabId).slice();return tabId==='salesorders'?list.filter(function(label){return label!=='Customer Orders';}):list;};
  }
  const soUnifiedOpenSidebar=typeof openSidebarSubGroup==='function'?openSidebarSubGroup:null;
  if(soUnifiedOpenSidebar){
    openSidebarSubGroup=function(tabId,subgroup){if(tabId==='salesorders'&&subgroup==='Customer Orders')subgroup='Sales Orders';return soUnifiedOpenSidebar(tabId,subgroup);};
  }
  const soUnifiedRenderSales=typeof renderSalesOrders==='function'?renderSalesOrders:null;
  if(soUnifiedRenderSales){
    renderSalesOrders=function(){if(activeSubPage&&activeSubPage.salesorders==='Customer Orders')activeSubPage.salesorders='Sales Orders';if(typeof salesOrderView!=='undefined'&&salesOrderView==='customerOrders')salesOrderView='list';return soUnifiedRenderSales();};
  }
  document.addEventListener('click',function(event){
    const legacy=event.target.closest('[data-sales-subview="customerOrders"],[data-sidebar-subgroup="salesorders|Customer Orders"]');
    if(!legacy)return;
    event.preventDefault();event.stopImmediatePropagation();
    active='salesorders';activeSubPage.salesorders='Sales Orders';salesOrderView='list';render();
  },true);

  window.addEventListener('resize', function(){ closeLineMenus(); });
  window.addEventListener('scroll', function(){ closeLineMenus(); }, true);
})();
