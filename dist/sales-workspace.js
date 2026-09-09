/* Presentation only: the existing order, stock and finance commands remain authoritative. */
(function () {
  'use strict';
  // The shared section navigation already exposes these destinations.
  salesOrdersSubMenu = function() { return ''; };
  const originalDetail = salesOrderDetail;
  salesOrderDetail = function(order) {
    const template=document.createElement('template');
    template.innerHTML=originalDetail(order).replace('sales-order-compact', 'sales-order-compact sales-workspace');
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
    let html = originalContent.apply(this, arguments);
    if (salesOrderTab === 'products') {
      // Keep the items workspace focused; the same PO controls live in Connections.
      const marker = '<div class="grid two" style="margin-top:1rem">';
      const pos = html.lastIndexOf(marker);
      if (pos >= 0) html = html.slice(0,pos);
      html = '<label class="sales-column-toggle"><input type="checkbox" data-sales-columns> Show accounting and pick / pack columns</label>' + html;
      html = html.replace('<div class="action-row" data-ps-secondary-actions=', '<details class="sales-advanced"><summary>Selected item actions · purchasing, returns & backorders</summary><div class="action-row" data-ps-secondary-actions=');
      html = html.replace('</div><table class="order-lines-table">', '</div></details><div class="sales-table-scroll"><table class="order-lines-table">');
      html = html.replace('</tbody></table>', '</tbody></table></div>');
    }
    return html;
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
