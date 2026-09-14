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

  function so2Money(value) {
    return money(Number(value || 0));
  }

  function so2CustomerCard(order, c) {
    if (!c) return originalCustomer.apply(this, arguments);
    const finance = customerFinancialSummary(c.id);
    const company = c.companyName || c.name || 'Customer';
    const contact = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || company;
    const initials = ((c.firstName || company || 'C').charAt(0) + (c.lastName || company.split(' ')[1] || '').charAt(0)).toUpperCase();
    const balance = Number(finance && finance.balance || 0);
    const creditLimit = Number(c.creditLimit || 0);
    const headroom = creditLimit > 0 ? Math.max(0, creditLimit - Math.max(0, balance)) : 0;
    const onHold = String(c.status || 'Active').toLowerCase() !== 'active' || (creditLimit > 0 && balance > creditLimit);
    const terms = (c.creditTermType || 'Net') + ' ' + Number(c.creditDays || 0);
    const delivery = addressText(c, 'delivery') || addressText(c, 'primary') || 'No default delivery address';
    const priceList = String(c.priceList || orderPriceList(order) || 'RRP').toUpperCase();

    return '<section class="so2-summary-card so2-customer-card">' +
      '<div class="so2-card-body">' +
        '<div class="so2-kicker">Customer</div>' +
        '<div class="so2-customer-title"><span class="so2-avatar">' + escapeHtml(initials) + '</span><div><h3>' + escapeHtml(company) + '</h3><p>' + escapeHtml(c.code || c.id) + ' · ' + escapeHtml(c.customerType || 'Customer') + '</p></div>' +
          '<span class="pill ' + (onHold ? 'warn' : 'good') + '">' + (onHold ? 'Needs attention' : 'Healthy') + '</span></div>' +
        '<div class="smart-customer-select so2-customer-search"><label><span class="sr-only">Select customer</span><input list="salesOrderCustomerOptions" data-customer-smart-input="' + order.id + '" value="' + escapeHtml(customerSmartValue(c)) + '" placeholder="Search name, company, email, phone or code"></label><button class="secondary" data-apply-order-customer="' + order.id + '">Change</button><button type="button" class="secondary" data-sales-edit-customer="' + escapeHtml(c.id) + '">Open CRM</button></div>' + customerSmartOptions(order.customerId) +
      '</div>' +
      '<div class="so2-customer-facts">' +
        '<div><span>Primary contact</span><strong>' + escapeHtml(contact) + '</strong><small>' + escapeHtml(c.email || 'No email') + ' · ' + escapeHtml(c.phone || c.mobile || 'No phone') + '</small></div>' +
        '<div><span>Account owner</span><strong>' + escapeHtml(c.owner || 'Office') + '</strong><small>' + escapeHtml(c.status || 'Active') + ' account</small></div>' +
        '<div><span>Delivery default</span><strong>' + escapeHtml(delivery) + '</strong><small>' + (c.vatNumber ? 'VAT ' + escapeHtml(c.vatNumber) : 'VAT details not recorded') + '</small></div>' +
        '<div><span>Commercial terms</span><strong>' + escapeHtml(priceList) + ' · ' + escapeHtml(terms) + '</strong><small>' + (creditLimit > 0 ? 'Credit limit ' + so2Money(creditLimit) : 'No credit limit set') + '</small></div>' +
      '</div>' +
      '<div class="so2-customer-commercial">' +
        '<div><span>Outstanding</span><strong>' + so2Money(balance) + '</strong></div>' +
        '<div><span>Credit headroom</span><strong>' + (creditLimit > 0 ? so2Money(headroom) : '—') + '</strong></div>' +
        '<div class="so2-account-state ' + (onHold ? 'warn' : 'good') + '"><span>' + (onHold ? 'Review account before progressing' : 'Account in good standing') + '</span></div>' +
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

  function so2VariantSelect(order, line, p, locked) {
    const variants = so2VariantProducts(p);
    const currentMeta = salesOrderVariantMeta(p) || p.name || p.sku || 'Exact SKU';
    if (isNonStockSalesLine(line) || variants.length < 2) {
      return '<div class="so2-variant-static"><strong>' + escapeHtml(currentMeta) + '</strong><small>' + escapeHtml(p.sku || p.id || '') + '</small></div>';
    }
    return '<label class="so2-variant-control"><span>Exact variant / SKU</span><select data-so2-variant="' + escapeHtml(order.id) + '|' + escapeHtml(line.productId) + '"' + (locked ? ' disabled title="Variant cannot change after allocation or fulfilment starts."' : '') + '>' +
      variants.map(function(v) {
        const meta = salesOrderVariantMeta(v) || v.name || v.sku || 'Variant';
        return '<option value="' + escapeHtml(v.id) + '"' + (v.id === line.productId ? ' selected' : '') + '>' + escapeHtml(meta + ' · ' + (v.sku || v.id)) + '</option>';
      }).join('') + '</select><small>' + escapeHtml(p.sku || p.id || '') + (locked ? ' · locked by stock activity' : '') + '</small></label>';
  }

  function so2LineRows(order) {
    return order.lines.map(function(line) {
      const p = product(line.productId) || { id:line.productId, sku:'CUSTOM', name:line.description || 'Custom sales line', category:'Non-stock' };
      const nonStock = isNonStockSalesLine(line);
      const coverage = salesLineCoverage(line, order.id);
      const health = salesLineHealth(line, order.id);
      const unitNet = salesOrderLinePrice(order, line);
      const vatRate = vatRateForLine(line);
      const lineGross = (unitNet * Number(line.qty || 0)) * (1 + vatRate);
      const family = nonStock ? (line.lineType === 'shipping' ? 'Delivery charge' : 'Custom sales line') : salesOrderProductFamily(p);
      const locked = Number(line.allocated||0) > 0 || Number(line.picked||0) > 0 || Number(line.packed||0) > 0 || Number(line.shipped||0) > 0 ||
        goodsNotesForOrder(order.id).some(function(note){ return note.lines.some(function(nl){ return nl.productId === line.productId; }); });
      const removable = canRemoveSalesOrderLine(line);
      const menuId = 'so2-menu-' + String(order.id + '-' + line.productId).replace(/[^a-z0-9_-]/gi,'-');
      return '<tr class="so2-line-row ' + health.className + '">' +
        '<td class="so2-check"><input type="checkbox" data-sales-line-select="' + order.id + '|' + line.productId + '" aria-label="Select ' + escapeHtml(p.sku || p.name) + '"></td>' +
        '<td class="so2-product-cell"><strong>' + escapeHtml(family) + '</strong><small>' + escapeHtml(nonStock ? (line.description || p.name) : (p.brand || p.category || 'Catalogue product')) + '</small>' + (!nonStock ? '<button type="button" class="link-button" data-open-product="' + escapeHtml(p.id) + '">View product</button>' : '') + '</td>' +
        '<td class="so2-variant-cell">' + so2VariantSelect(order,line,p,locked) + '</td>' +
        '<td class="so2-stock-cell">' + (nonStock ? '<span class="muted">Not stock controlled</span>' : '<strong class="' + (coverage.free > 0 ? 'so2-stock-good' : 'so2-stock-warn') + '">' + coverage.free + ' free</strong><small>' + escapeHtml(allocationSourceLabel(order.id)) + (coverage.onPo ? ' · ' + coverage.onPo + ' on PO' : '') + '</small>') + '</td>' +
        '<td><input class="qty-input so2-qty" data-line-field="' + order.id + '|' + line.productId + '|qty" type="number" min="0" value="' + Number(line.qty||0) + '"></td>' +
        '<td class="so2-allocated"><strong>' + (nonStock ? '—' : Number(line.allocated||0) + ' / ' + Number(line.qty||0)) + '</strong><small>' + (nonStock ? 'Not required' : (Number(line.allocated||0) ? 'Allocated' : 'Not allocated')) + '</small></td>' +
        '<td class="right so2-money"><strong>' + so2Money(unitNet) + '</strong><small>net</small></td>' +
        '<td class="so2-vat">' + Math.round(vatRate*100) + '%</td>' +
        '<td class="right so2-money"><strong>' + so2Money(lineGross) + '</strong><small>inc VAT</small></td>' +
        '<td class="so2-actions-cell"><button type="button" class="secondary so2-menu-button" data-so2-line-menu="' + menuId + '" aria-haspopup="menu" aria-expanded="false">•••</button>' +
          '<div id="' + menuId + '" class="so2-line-menu" data-so2-menu role="menu" hidden>' +
            (!nonStock ? '<button type="button" role="menuitem" data-allocate-line="' + order.id + '|' + line.productId + '">Allocate</button><button type="button" role="menuitem" data-unallocate-line="' + order.id + '|' + line.productId + '">Unallocate</button><button type="button" role="menuitem" data-open-product="' + escapeHtml(p.id) + '">View product</button><button type="button" role="menuitem" data-so-tab="fulfilment">Fulfilment details</button><div class="so2-menu-separator"></div>' : '') +
            '<button type="button" role="menuitem" class="danger" data-remove-sales-line="' + order.id + '|' + line.productId + '"' + (removable ? '' : ' aria-disabled="true" title="' + escapeHtml(salesOrderLineRemovalReason(line)) + '"') + '>Remove line</button>' +
          '</div></td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="10"><div class="so2-empty-lines"><strong>No order lines yet</strong><span>Search the connected catalogue below to add the first exact SKU.</span></div></td></tr>';
  }

  function so2ProductsContent(order) {
    const stockLines = order.lines.filter(function(line){ return !isNonStockSalesLine(line); });
    const unitCount = order.lines.reduce(function(sum,line){ return sum + Number(line.qty||0); },0);
    const allocatedCount = stockLines.reduce(function(sum,line){ return sum + Number(line.allocated||0); },0);
    const shortageCount = stockLines.filter(function(line){ return salesLineCoverage(line,order.id).toRaise > 0; }).length;
    return '<section class="so2-items-workspace">' +
      '<div class="so2-lines-toolbar"><div><span class="so2-kicker">Order lines</span><strong>' + order.lines.length + ' lines · ' + unitCount + ' units</strong><small>' + allocatedCount + ' allocated' + (shortageCount ? ' · ' + shortageCount + ' stock issue' + (shortageCount===1?'':'s') : '') + '</small></div>' +
        '<div class="so2-toolbar-actions"><button class="secondary" data-allocate-order="' + order.id + '">Allocate all</button><button class="secondary" data-selected-line-action="purchaseOrder" data-order-id="' + order.id + '">Raise PO</button><button class="secondary" data-selected-line-action="backOrder" data-order-id="' + order.id + '">Back order</button></div></div>' +
      '<div class="sales-table-scroll so2-table-scroll"><table class="order-lines-table so2-lines-table"><thead><tr><th></th><th>Product</th><th class="so2-variant-head">Variant</th><th>Stock</th><th>Qty</th><th>Allocated</th><th class="right">Unit net</th><th>VAT</th><th class="right">Line total</th><th>Actions</th></tr></thead><tbody>' + so2LineRows(order) + '</tbody></table></div>' +
      '<div class="so2-entry-grid"><section class="so2-catalogue-card"><div class="so2-section-head"><div><span class="so2-kicker">Connected product catalogue</span><strong>Add stock-controlled items</strong><small>Search by family, exact variant, SKU, barcode or description.</small></div></div><div class="so2-catalogue-body">' + salesOrderAddRow(order) + '</div></section>' +
        '<aside class="so2-totals-card"><div class="so2-section-head"><div><span class="so2-kicker">Order value</span><strong>Live totals</strong><small>Net, VAT, payments and balance.</small></div></div>' + salesOrderTotalsBox(order) + '</aside></div>' +
    '</section>';
  }

  salesOrderTabContent = function(order, lines, poRows, addressCards, costRows, costSummary) {
    if (salesOrderTab === 'products') return so2ProductsContent(order);
    if (salesOrderTab === 'fulfilment') {
      const progress = salesOrderProgress(order);
      return '<section class="so2-secondary-panel"><div class="so2-section-head"><div><span class="so2-kicker">Fulfilment</span><strong>Print · Pick · Pack · Ship</strong><small>Operational progress and Goods Notes for this order.</small></div><button class="primary-action" data-selected-line-action="advancedFulfil" data-order-id="' + order.id + '">Open fulfilment</button></div><div class="so2-fulfilment-summary"><div><span>Required</span><strong>' + progress.required + '</strong></div><div><span>Picked</span><strong>' + progress.picked + '</strong></div><div><span>Packed</span><strong>' + progress.packed + '</strong></div><div><span>Shipped</span><strong>' + (progress.shipped || 0) + '</strong></div></div>' + salesOrderGoodsNotesDirectory(order) + '</section>';
    }
    if (salesOrderTab === 'connections') {
      const credits = (data.salesCredits || []).filter(function(c){ return c.originalSalesOrderId===order.id; });
      return '<div class="so2-secondary-grid">' +
        panel('Linked purchasing','Receive against the purchase order in Warehouse Goods In. Stock is received once, then allocated to this order.','<div class="sales-table-scroll"><table><thead><tr><th>Purchase order</th><th>Status</th><th>Due</th><th>Items</th><th>Actions</th></tr></thead><tbody>'+poRows+'</tbody></table></div>') +
        panel('Credit notes & returns','Credits retain their link to this sales order.',credits.length ? credits.map(function(c){return '<p><button class="secondary" data-open-sales-credit="'+escapeHtml(c.id)+'">'+escapeHtml(c.id)+'</button> <span>'+escapeHtml(c.status)+'</span></p>';}).join('') : '<p class="muted">No credit notes linked to this order.</p>') +
      '</div>';
    }
    return originalContent.apply(this, arguments);
  };

  salesOrderDetail = function(order) {
    const template = document.createElement('template');
    template.innerHTML = originalDetail(order).replace('sales-order-compact', 'sales-order-compact sales-workspace sales-command-page so2-page');
    const root = template.content.querySelector('.so2-page');
    if (!root) return template.innerHTML;

    const recordTop = root.querySelector('.record-top');
    if (recordTop) {
      recordTop.classList.add('so2-command-header');
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'so2-back';
      back.dataset.backSoList = '';
      back.textContent = '← Sales Orders';
      recordTop.insertBefore(back, recordTop.firstChild);
      const id = recordTop.querySelector('.record-id');
      if (id) {
        id.classList.add('so2-command-identity');
        const meta = document.createElement('span');
        meta.className = 'so2-command-meta';
        meta.textContent = 'Created ' + (order.created || '—') + ' · Due ' + (order.due || '—') + ' · ' + (order.channel || order.source || 'Sales order');
        id.appendChild(meta);
      }
      const save = recordTop.querySelector('[data-save-order]');
      if (save) save.textContent = 'Save Order';
      const print = recordTop.querySelector('[data-email-print-order]');
      if (print) print.textContent = 'Email / Print';
      const fulfil = recordTop.querySelector('[data-fulfil-order]');
      if (fulfil) fulfil.textContent = 'Fulfil';
    }

    const shell = root.querySelector('.record-shell');
    if (shell) shell.classList.add('so2-summary-grid');
    const details = root.querySelector('.so-order-details-card');
    if (details) details.classList.add('so2-summary-card','so2-order-details');
    const fulfilment = root.querySelector('.so-fulfilment-card');
    if (fulfilment) fulfilment.classList.add('so2-summary-card','so2-fulfilment-card');

    if(!order.lines.some(function(line){ return !isNonStockSalesLine(line); })) {
      root.querySelectorAll('[data-allocate-order],[data-fulfil-order],[data-create-another-shipment]').forEach(function(el){ el.disabled = false; });
    }
    return template.innerHTML;
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

  window.addEventListener('resize', function(){ closeLineMenus(); });
  window.addEventListener('scroll', function(){ closeLineMenus(); }, true);
})();
