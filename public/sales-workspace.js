/* Presentation only: the existing order, stock and finance commands remain authoritative. */
(function () {
  'use strict';
  // The shared section navigation already exposes these destinations.
  salesOrdersSubMenu = function() { return ''; };
  const originalDetail = salesOrderDetail;
  salesOrderDetail = function(order) {
    const template=document.createElement('template');
    template.innerHTML=originalDetail(order).replace('sales-order-compact', 'sales-order-compact sales-workspace sales-command-page');
    if(!order.lines.some(line=>!isNonStockSalesLine(line))) {
      template.content.querySelectorAll('.so-fulfilment-card,[data-allocate-order],[data-fulfil-order],[data-create-another-shipment]').forEach(el=>el.remove());
    }
    return template.innerHTML;
  };
  const originalCustomer = customerProfileCard;
  customerProfileCard = function(order, c) {
    const contact='<div class="sales-core-contact"><strong>'+escapeHtml(customerDisplayName(c))+'</strong><p>'+escapeHtml(c.phone||c.mobile||'No phone recorded')+' · '+escapeHtml(c.email||'No email recorded')+'</p><p>'+escapeHtml(addressText(c,'primary')||'No primary address recorded')+'</p></div>';
    return originalCustomer.apply(this, arguments).replace('<div class="customer-toolbar">',contact+'<div class="customer-toolbar">').replace('<div class="customer-toolbar">',
      '<button type="button" class="secondary" data-sales-edit-customer="'+escapeHtml(c.id)+'">Edit customer profile</button><div class="customer-toolbar">');
  };
  const originalContent = salesOrderTabContent;
  salesOrderTabContent = function(order, lines, poRows) {
    if (salesOrderTab === 'connections') {
      const credits = (data.salesCredits || []).filter(c=>c.originalSalesOrderId===order.id);
      return panel('Linked purchasing', 'Receive against the purchase order in Warehouse Goods In. Stock is received once, then allocated to this order.',
        '<div class="sales-table-scroll"><table><thead><tr><th>Purchase order</th><th>Status</th><th>Due</th><th>Items</th><th>Actions</th></tr></thead><tbody>'+poRows+'</tbody></table></div>')+
        panel('Credit notes & returns', 'Credits retain their link to this sales order. Use the selected-item actions to create a return.', credits.length ? credits.map(c=>'<p><button class="secondary" data-open-sales-credit="'+escapeHtml(c.id)+'">'+escapeHtml(c.id)+'</button> <span>'+escapeHtml(c.status)+'</span></p>').join('') : '<p class="muted">No credit notes linked to this order.</p>');
    }

    if (salesOrderTab === 'products') {
      const stockLines = order.lines.filter(line=>!isNonStockSalesLine(line));
      const unitCount = order.lines.reduce((sum,line)=>sum+Number(line.qty||0),0);
      const allocatedCount = stockLines.reduce((sum,line)=>sum+Number(line.allocated||0),0);
      const shortageCount = stockLines.filter(line=>salesLineCoverage(line,order.id).toRaise>0).length;

      return '<section class="so-command-items">' +
        '<div class="so-command-toolbar">' +
          '<div class="so-command-toolbar-actions">' +
            '<button class="secondary" data-selected-line-action="advancedFulfil" data-order-id="'+order.id+'">Print · Pick · Pack · Ship</button>' +
            '<button class="secondary" data-allocate-order="'+order.id+'">Allocate all</button>' +
            '<button class="secondary" data-selected-line-action="purchaseOrder" data-order-id="'+order.id+'">Raise PO</button>' +
            '<button class="secondary" data-selected-line-action="backOrder" data-order-id="'+order.id+'">Back order</button>' +
            '<details class="so-more-actions"><summary>More</summary><div>' +
              '<button class="ghost" data-selected-line-action="salesCredit" data-order-id="'+order.id+'">Clone to Sales Credit</button>' +
              '<button class="ghost" data-selected-line-action="salesOrder" data-order-id="'+order.id+'">Clone to Sales Order</button>' +
              '<button class="ghost" data-selected-line-action="taxCode" data-order-id="'+order.id+'">Assign tax code</button>' +
            '</div></details>' +
          '</div>' +
          '<div class="so-command-line-summary"><strong>'+order.lines.length+' lines · '+unitCount+' units</strong><span>'+allocatedCount+' allocated'+(shortageCount?' · '+shortageCount+' stock issue'+(shortageCount===1?'':'s'):'')+'</span></div>' +
        '</div>' +
        '<div class="sales-table-scroll so-command-table-wrap"><table class="order-lines-table so-command-table"><thead><tr>' +
          '<th class="so-check-col"><span class="sr-only">Select</span></th><th>Stock</th><th>Item</th><th>Details</th><th>Qty</th><th>Allocated</th><th class="right">Unit net</th><th class="right">Line total</th><th>Actions</th>' +
        '</tr></thead><tbody>'+lines+'</tbody></table></div>' +
        '<div class="so-entry-and-totals"><div class="so-entry-stack">' +
          salesOrderAddRow(order) +
        '</div><aside class="so-command-totals"><div class="so-command-totals-head"><span>ORDER VALUE</span><strong>Live totals</strong><small>Updates as lines and VAT change.</small></div>'+salesOrderTotalsBox(order)+'</aside></div>' +
      '</section>';
    }

    return originalContent.apply(this, arguments);
  };
  document.addEventListener('change', function(event) {
    if(event.target.matches('[data-sales-columns]')) event.target.closest('.sales-workspace').classList.toggle('sales-all-columns', event.target.checked);
  });
  document.addEventListener('click', function(event) {
    const button = event.target.closest('[data-sales-edit-customer]');
    if (!button) return;
    selectedCrmCustomerId = button.dataset.salesEditCustomer;
    active = 'crm';
    activeSubPage.crm = 'All Customers';
    render();
  });
})();
