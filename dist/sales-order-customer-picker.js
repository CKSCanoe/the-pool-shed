(function () {
  'use strict';

  var customerIndexCache = null;
  var customerIndexSignature = '';
  var activeOrderId = '';
  var selectedSuggestionIndex = -1;
  var searchTimer = null;

  function normalise(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9@.+\- ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function customerSignature() {
    if (!data || !Array.isArray(data.customers)) return '0';
    var last = data.customers[data.customers.length - 1];
    return data.customers.length + '|' + (last ? [last.id, last.code, last.email, last.name, last.companyName].join('|') : '');
  }

  function buildCustomerIndex() {
    var signature = customerSignature();
    if (customerIndexCache && customerIndexSignature === signature) return customerIndexCache;
    customerIndexSignature = signature;
    customerIndexCache = (data.customers || []).map(function (c, index) {
      var display = customerDisplayName(c);
      var tokens = [
        c.id, c.code, c.firstName, c.lastName, c.name, c.companyName,
        c.email, c.email2, c.email3, c.phone, c.mobile,
        c.postcode,
        c.addresses && c.addresses.primary && c.addresses.primary.postcode,
        c.addresses && c.addresses.delivery && c.addresses.delivery.postcode
      ].filter(Boolean);
      return {
        customer: c,
        index: index,
        display: display,
        exact: tokens.map(normalise),
        haystack: normalise(tokens.join(' '))
      };
    });
    return customerIndexCache;
  }

  function searchCustomers(query) {
    var q = normalise(query);
    var index = buildCustomerIndex();
    if (!q) {
      return index.slice().sort(function (a, b) {
        var aOrders = data.salesOrders.filter(function (o) { return o.customerId === a.customer.id; }).length;
        var bOrders = data.salesOrders.filter(function (o) { return o.customerId === b.customer.id; }).length;
        return bOrders - aOrders || a.index - b.index;
      }).slice(0, 7);
    }
    var words = q.split(' ').filter(Boolean);
    return index.map(function (entry) {
      var score = 0;
      if (entry.exact.indexOf(q) >= 0) score += 1000;
      if (normalise(entry.customer.code) === q) score += 1500;
      if (normalise(entry.customer.email) === q) score += 1400;
      if (normalise(entry.display) === q) score += 1300;
      if (entry.haystack.indexOf(q) === 0) score += 700;
      if (entry.haystack.indexOf(q) >= 0) score += 400;
      words.forEach(function (word) {
        if (entry.haystack.indexOf(word) >= 0) score += 70;
        if (entry.exact.some(function (token) { return token.indexOf(word) === 0; })) score += 45;
      });
      return { entry: entry, score: score };
    }).filter(function (row) { return row.score > 0; })
      .sort(function (a, b) { return b.score - a.score || a.entry.index - b.entry.index; })
      .slice(0, 8)
      .map(function (row) { return row.entry; });
  }

  function customerAddressLine(c) {
    var a = c && c.addresses && (c.addresses.primary || c.addresses.delivery);
    return a ? [a.line1, a.city, a.postcode].filter(Boolean).join(', ') : '';
  }

  function renderSuggestions(input, forceOpen) {
    var picker = input.closest('.so-customer-picker');
    if (!picker) return;
    var results = picker.querySelector('[data-so-customer-results]');
    if (!results) return;
    var matches = searchCustomers(input.value);
    selectedSuggestionIndex = matches.length ? 0 : -1;
    if (!matches.length) {
      results.innerHTML = '<div class="so-customer-empty"><div><strong>No CRM customer found</strong><span>Check the spelling or create a new customer without leaving this sales order.</span></div><button type="button" data-so-new-customer="' + escapeHtml(input.dataset.soCustomerSearch) + '">+ Add customer</button></div>';
      results.classList.add('open');
      return;
    }
    results.innerHTML = '<div class="so-customer-results-head"><span>' + matches.length + ' customer' + (matches.length === 1 ? '' : 's') + '</span><small>Enter to select · ↑↓ to navigate</small></div>' + matches.map(function (entry, index) {
      var c = entry.customer;
      var address = customerAddressLine(c);
      var meta = [c.companyName && c.companyName !== customerDisplayName(c) ? c.companyName : '', c.email, c.phone || c.mobile].filter(Boolean).join(' · ');
      return '<button type="button" class="so-customer-result' + (index === selectedSuggestionIndex ? ' active' : '') + '" data-so-customer-result="' + escapeHtml(c.id) + '" data-result-index="' + index + '">' +
        '<span class="so-customer-result-avatar">' + escapeHtml(((c.firstName || c.name || c.companyName || 'C').charAt(0) + (c.lastName || '').charAt(0)).toUpperCase()) + '</span>' +
        '<span class="so-customer-result-main"><strong>' + escapeHtml(customerDisplayName(c)) + '</strong><small>' + escapeHtml(meta || 'CRM customer') + '</small>' + (address ? '<small class="address">' + escapeHtml(address) + '</small>' : '') + '</span>' +
        '<span class="so-customer-result-code">' + escapeHtml(c.code || c.id) + '</span>' +
      '</button>';
    }).join('') + '<button type="button" class="so-customer-create-row" data-so-new-customer="' + escapeHtml(input.dataset.soCustomerSearch) + '"><span>＋</span><div><strong>Create a new customer</strong><small>Add contact and address details here and link them to CRM automatically.</small></div></button>';
    if (forceOpen !== false) results.classList.add('open');
  }

  function updateActiveResult(results) {
    var rows = Array.prototype.slice.call(results.querySelectorAll('.so-customer-result'));
    rows.forEach(function (row, index) { row.classList.toggle('active', index === selectedSuggestionIndex); });
    if (rows[selectedSuggestionIndex]) rows[selectedSuggestionIndex].scrollIntoView({ block: 'nearest' });
  }

  function attachCustomer(orderId, customerId) {
    var c = customer(customerId);
    if (!c) return toast('Customer record could not be found.');
    applyCustomerToSalesOrder(orderId, c.id);
  }

  function ensureDrawer() {
    var drawer = document.getElementById('soCustomerCreateDrawer');
    if (drawer) return drawer;
    drawer = document.createElement('div');
    drawer.id = 'soCustomerCreateDrawer';
    drawer.className = 'so-customer-drawer-shell';
    drawer.innerHTML = '<div class="so-customer-drawer-backdrop" data-so-customer-drawer-close="true"></div><aside class="so-customer-drawer" role="dialog" aria-modal="true" aria-labelledby="soCustomerDrawerTitle"><header><div><span>POOL SHED CRM</span><h2 id="soCustomerDrawerTitle">Add customer</h2><p>Create the CRM profile and attach it to this sales order in one step.</p></div><button type="button" class="so-drawer-close" data-so-customer-drawer-close="true" aria-label="Close">×</button></header><form data-so-customer-create-form><div class="so-drawer-scroll"><section><div class="so-drawer-section-title"><span>01</span><div><strong>Contact</strong><small>Only the essentials are required. You can add more detail later in CRM.</small></div></div><div class="so-customer-form-grid two"><label>First name<input name="firstName" autocomplete="given-name"></label><label>Last name<input name="lastName" autocomplete="family-name"></label></div><label>Company / account name<input name="companyName" autocomplete="organization"></label><div class="so-customer-form-grid two"><label>Email<input name="email" type="email" autocomplete="email"></label><label>Phone / mobile<input name="phone" autocomplete="tel"></label></div><div class="so-customer-duplicate" data-so-customer-duplicate hidden></div></section><section><div class="so-drawer-section-title"><span>02</span><div><strong>Account</strong><small>Used for pricing, VAT and CRM reporting.</small></div></div><div class="so-customer-form-grid two"><label>Customer type<select name="customerType"><option>Retail</option><option>Trade</option><option>Wholesale</option><option>Commercial</option></select></label><label>Price list<select name="priceList"><option value="rrp">RRP</option><option value="trade">Trade</option><option value="wholesale">Wholesale</option></select></label></div></section><section><div class="so-drawer-section-title"><span>03</span><div><strong>Primary & delivery address</strong><small>This is copied to the sales order when the customer is attached.</small></div></div><label>Address line 1<input name="line1" autocomplete="address-line1"></label><label>Address line 2<input name="line2" autocomplete="address-line2"></label><div class="so-customer-form-grid two"><label>Town / city<input name="city" autocomplete="address-level2"></label><label>Postcode<input name="postcode" autocomplete="postal-code"></label></div><label>Country<input name="country" value="United Kingdom" autocomplete="country-name"></label></section></div><footer><button type="button" class="secondary" data-so-customer-drawer-close="true">Cancel</button><button type="submit" class="so-create-link-button">Create & attach customer</button></footer></form></aside>';
    document.body.appendChild(drawer);
    drawer.querySelectorAll('[data-so-customer-drawer-close]').forEach(function (button) {
      button.addEventListener('click', closeDrawer);
    });
    var form = drawer.querySelector('[data-so-customer-create-form]');
    form.addEventListener('input', function () { updateDuplicateWarning(form); });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      createAndAttachCustomer(form);
    });
    return drawer;
  }

  function openDrawer(orderId, seedText) {
    activeOrderId = orderId;
    var drawer = ensureDrawer();
    var form = drawer.querySelector('[data-so-customer-create-form]');
    form.reset();
    form.elements.country.value = 'United Kingdom';
    form.elements.customerType.value = 'Retail';
    form.elements.priceList.value = 'rrp';
    var text = String(seedText || '').trim();
    if (text) {
      if (text.indexOf('@') > 0) form.elements.email.value = text;
      else {
        var parts = text.split(/\s+/);
        form.elements.firstName.value = parts.shift() || '';
        form.elements.lastName.value = parts.join(' ');
      }
    }
    updateDuplicateWarning(form);
    drawer.classList.add('open');
    document.body.classList.add('so-customer-drawer-open');
    setTimeout(function () {
      var firstEmpty = Array.prototype.find.call(form.querySelectorAll('input'), function (input) { return !input.value; });
      if (firstEmpty) firstEmpty.focus();
    }, 50);
  }

  function closeDrawer() {
    var drawer = document.getElementById('soCustomerCreateDrawer');
    if (drawer) drawer.classList.remove('open');
    document.body.classList.remove('so-customer-drawer-open');
    activeOrderId = '';
  }

  function findDuplicate(form) {
    var email = normalise(form.elements.email.value);
    var phone = normalise(form.elements.phone.value).replace(/\s/g, '');
    if (!email && !phone) return null;
    return (data.customers || []).find(function (c) {
      var cEmail = normalise(c.email);
      var cPhone = normalise(c.phone || c.mobile).replace(/\s/g, '');
      return (email && cEmail === email) || (phone && cPhone && cPhone === phone);
    }) || null;
  }

  function updateDuplicateWarning(form) {
    var box = form.querySelector('[data-so-customer-duplicate]');
    var duplicate = findDuplicate(form);
    if (!duplicate) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    box.innerHTML = '<div><strong>Possible existing CRM customer</strong><span>' + escapeHtml(customerDisplayName(duplicate)) + ' · ' + escapeHtml(duplicate.email || duplicate.phone || duplicate.code || '') + '</span></div><button type="button" data-so-use-duplicate="' + escapeHtml(duplicate.id) + '">Use existing</button>';
    var useButton = box.querySelector('[data-so-use-duplicate]');
    if (useButton) useButton.addEventListener('click', function () {
      var orderId = activeOrderId;
      closeDrawer();
      attachCustomer(orderId, duplicate.id);
    });
  }

  function createAndAttachCustomer(form) {
    var firstName = form.elements.firstName.value.trim();
    var lastName = form.elements.lastName.value.trim();
    var companyName = form.elements.companyName.value.trim();
    var email = form.elements.email.value.trim();
    var phone = form.elements.phone.value.trim();
    if (!firstName && !lastName && !companyName) return toast('Add a customer or company name.');
    if (!email && !phone) return toast('Add an email address or phone number so the CRM profile can be matched later.');
    var duplicate = findDuplicate(form);
    if (duplicate) return toast('This email or phone number already belongs to ' + customerDisplayName(duplicate) + '. Use the existing CRM customer instead.');
    var type = form.elements.customerType.value || 'Retail';
    var priceList = form.elements.priceList.value || (type === 'Trade' ? 'trade' : type === 'Wholesale' ? 'wholesale' : 'rrp');
    var id = nextCustomerId();
    var code = nextCustomerCode();
    var customerName = companyName || [firstName, lastName].filter(Boolean).join(' ') || email || phone;
    var address = {
      line1: form.elements.line1.value.trim(),
      line2: form.elements.line2.value.trim(),
      city: form.elements.city.value.trim(),
      postcode: form.elements.postcode.value.trim(),
      country: form.elements.country.value.trim() || 'United Kingdom',
      phone: phone
    };
    var newCustomer = {
      id: id,
      code: code,
      name: customerName,
      firstName: firstName,
      lastName: lastName,
      companyName: companyName || customerName,
      email: email,
      email2: '',
      email3: '',
      phone: phone,
      mobile: phone,
      customerType: type,
      priceList: priceList,
      status: 'Active',
      discount: 0,
      creditLimit: type === 'Trade' ? 2500 : 0,
      creditDays: type === 'Trade' ? 30 : 0,
      creditTermType: 'Net',
      currency: 'GBP',
      nominalCode: '4000',
      taxCode: 'T20',
      owner: 'Office',
      leadSource: 'Sales Order',
      website: '',
      memo: '',
      newsletter: 'No',
      brightpearlContactId: '',
      shopifyCustomerId: '',
      xeroContactId: '',
      addresses: {
        primary: Object.assign({}, address),
        billing: Object.assign({}, address),
        delivery: Object.assign({}, address)
      },
      tags: [type, String(priceList).toUpperCase()],
      customFields: { poolType: '', preferredEngineer: '', servicePlan: '', lastWaterTest: '' },
      matrix: { brightpearl: 'Missing', shopify: 'Not linked', xero: 'Missing', quotient: 'Not linked' }
    };
    data.customers.push(newCustomer);
    customerIndexCache = null;
    ensureCustomerProfileFields();
    saveAppData();
    var orderId = activeOrderId;
    closeDrawer();
    applyCustomerToSalesOrder(orderId, newCustomer.id);
    toast(customerName + ' created in CRM and attached to ' + orderId + '.');
  }

  function enhanceExistingPicker(root) {
    (root || document).querySelectorAll('.so-customer-picker [data-so-customer-search]').forEach(function (input) {
      if (input.dataset.customerPickerBound === 'true') return;
      input.dataset.customerPickerBound = 'true';
      input.addEventListener('focus', function () { renderSuggestions(input, true); });
      input.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () { renderSuggestions(input, true); }, 45);
      });
      input.addEventListener('keydown', function (event) {
        var results = input.closest('.so-customer-picker').querySelector('[data-so-customer-results]');
        var rows = Array.prototype.slice.call(results.querySelectorAll('.so-customer-result'));
        if (event.key === 'ArrowDown' && rows.length) {
          event.preventDefault(); selectedSuggestionIndex = Math.min(rows.length - 1, selectedSuggestionIndex + 1); updateActiveResult(results);
        } else if (event.key === 'ArrowUp' && rows.length) {
          event.preventDefault(); selectedSuggestionIndex = Math.max(0, selectedSuggestionIndex - 1); updateActiveResult(results);
        } else if (event.key === 'Enter' && rows.length && selectedSuggestionIndex >= 0) {
          event.preventDefault(); rows[selectedSuggestionIndex].click();
        } else if (event.key === 'Escape') {
          results.classList.remove('open');
        }
      });
    });
  }

  document.addEventListener('click', function (event) {
    var result = event.target.closest('[data-so-customer-result]');
    if (result) {
      var picker = result.closest('.so-customer-picker');
      var input = picker && picker.querySelector('[data-so-customer-search]');
      if (input) input.value = result.querySelector('.so-customer-result-main strong').textContent;
      var orderId = picker ? picker.dataset.orderId : '';
      var results = picker && picker.querySelector('[data-so-customer-results]');
      if (results) results.classList.remove('open');
      attachCustomer(orderId, result.dataset.soCustomerResult);
      return;
    }
    var create = event.target.closest('[data-so-new-customer]');
    if (create) {
      var pickerForCreate = create.closest('.so-customer-picker');
      var search = pickerForCreate && pickerForCreate.querySelector('[data-so-customer-search]');
      openDrawer(create.dataset.soNewCustomer, search ? search.value : '');
      return;
    }
    if (!event.target.closest('.so-customer-picker')) {
      document.querySelectorAll('[data-so-customer-results].open').forEach(function (menu) { menu.classList.remove('open'); });
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && document.body.classList.contains('so-customer-drawer-open')) closeDrawer();
  });

  if (typeof customerProfileCard === 'function') {
    var originalCustomerProfileCard = customerProfileCard;
    customerProfileCard = function (order, c, activePriceList, costSummary, activeTab) {
      var markup = originalCustomerProfileCard(order, c, activePriceList, costSummary, activeTab);
      var oldPicker = /<div class="smart-customer-select">[\s\S]*?<\/div><datalist id="salesOrderCustomerOptions">[\s\S]*?<\/datalist>/;
      var linkedName = escapeHtml(customerDisplayName(c));
      var linkedMeta = escapeHtml([c.email, c.phone || c.mobile, c.code].filter(Boolean).join(' · '));
      var replacement = '<div class="so-customer-picker" data-order-id="' + escapeHtml(order.id) + '">' +
        '<div class="so-customer-picker-head"><div><span>Customer</span><strong>Find or create a CRM customer</strong></div><span class="so-customer-linked-chip">✓ ' + escapeHtml(c.code || c.id) + '</span></div>' +
        '<div class="so-customer-search-row"><div class="so-customer-search-field"><span class="so-customer-search-icon">⌕</span><input type="search" autocomplete="off" data-so-customer-search="' + escapeHtml(order.id) + '" placeholder="Search name, company, email, phone or customer code"><kbd>⌘K</kbd></div><button type="button" class="so-new-customer-button" data-so-new-customer="' + escapeHtml(order.id) + '">+ New customer</button></div>' +
        '<div class="so-customer-current"><span class="so-current-avatar">' + escapeHtml(((c.firstName || c.name || 'C').charAt(0) + (c.lastName || '').charAt(0)).toUpperCase()) + '</span><div><span>Currently linked</span><strong>' + linkedName + '</strong><small>' + linkedMeta + '</small></div></div>' +
        '<div class="so-customer-results" data-so-customer-results></div>' +
      '</div>';
      if (oldPicker.test(markup)) markup = markup.replace(oldPicker, replacement);
      return markup;
    };
  }

  if (typeof bindSales === 'function') {
    var originalBindSales = bindSales;
    bindSales = function () {
      var result = originalBindSales.apply(this, arguments);
      enhanceExistingPicker(document);
      return result;
    };
  }

  setTimeout(function () { enhanceExistingPicker(document); }, 0);

  window.PoolShedCustomerPicker = {
    search: searchCustomers,
    openCreate: openDrawer,
    closeCreate: closeDrawer,
    rebuildIndex: function () { customerIndexCache = null; return buildCustomerIndex(); }
  };
})();
