/* Pool Shed v1.10.5 sales order catalogue picker */
(function () {
  'use strict';

  const SEARCH_VERSION = '1.10.5';
  let activeInput = null;
  let activeBox = null;
  let activeIndex = -1;
  let lastMatches = [];
  let observer = null;

  function text(value) {
    return String(value == null ? '' : value);
  }

  function normalise(value) {
    return text(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[“”″]/g, ' inch ')
      .replace(/[’']/g, '')
      .replace(/\bkilograms?\b|\bkgs?\b/g, ' kg ')
      .replace(/\bgrams?\b|\bgrms?\b/g, ' g ')
      .replace(/\blitres?\b|\bliters?\b|\bltrs?\b/g, ' l ')
      .replace(/\bmillilitres?\b|\bmilliliters?\b|\bmls?\b/g, ' ml ')
      .replace(/\bmillimetres?\b|\bmillimeters?\b/g, ' mm ')
      .replace(/\bcentimetres?\b|\bcentimeters?\b/g, ' cm ')
      .replace(/\bmetres?\b|\bmeters?\b/g, ' m ')
      .replace(/\bthree[ -]?phase\b/g, ' 3 phase ')
      .replace(/\bsingle[ -]?phase\b/g, ' 1 phase ')
      .replace(/\bmultifunctional\b/g, ' multifunction multi function ')
      .replace(/\btabs?\b/g, ' tablet tablets ')
      .replace(/\bvalves?\b/g, ' valve valves ')
      .replace(/\bunions?\b/g, ' union unions ')
      .replace(/([0-9])([a-z])/g, '$1 $2')
      .replace(/([a-z])([0-9])/g, '$1 $2')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compact(value) {
    return normalise(value).replace(/\s+/g, '');
  }

  function levenshtein(a, b) {
    a = text(a);
    b = text(b);
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const previous = Array.from({ length: b.length + 1 }, function (_, index) { return index; });
    const current = new Array(b.length + 1);
    for (let i = 1; i <= a.length; i += 1) {
      current[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      }
      for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
    }
    return previous[b.length];
  }

  function permittedDistance(token) {
    if (token.length <= 3) return 0;
    if (token.length <= 7) return 1;
    return 2;
  }

  function tokenMatchScore(queryToken, candidateTokens) {
    let best = -Infinity;
    candidateTokens.forEach(function (candidate) {
      if (!candidate) return;
      if (candidate === queryToken) best = Math.max(best, 120);
      else if (candidate.startsWith(queryToken) || queryToken.startsWith(candidate)) best = Math.max(best, 92);
      else if (candidate.includes(queryToken) || queryToken.includes(candidate)) best = Math.max(best, 72);
      else {
        const distance = levenshtein(queryToken, candidate);
        const allowed = Math.min(permittedDistance(queryToken), permittedDistance(candidate));
        if (allowed && distance <= allowed) best = Math.max(best, 58 - distance * 9);
      }
    });
    return best;
  }

  function parentRecord(productRecord) {
    if (!productRecord) return null;
    const parents = (typeof data !== 'undefined' && (data.productParents || data.product_parents)) || [];
    const parentId = productRecord.parentProductId || productRecord.parent_product_id;
    const parentSku = productRecord.parentSku || productRecord.parent_sku;
    return parents.find(function (parent) {
      return (parentId && (parent.id === parentId || parent.parentProductId === parentId)) ||
        (parentSku && normalise(parent.parentSku || parent.parent_sku) === normalise(parentSku));
    }) || null;
  }

  function productFields(productRecord) {
    const parent = parentRecord(productRecord) || {};
    return [
      productRecord.parentName, productRecord.parent_name, parent.name,
      productRecord.parentSku, productRecord.parent_sku, parent.parentSku, parent.parent_sku,
      productRecord.variantName, productRecord.variant_name,
      productRecord.variantValue, productRecord.variant_value,
      productRecord.variantLabel, productRecord.variant_label, productRecord.variant,
      productRecord.name, productRecord.sku, productRecord.code,
      productRecord.itemCode, productRecord.item_code,
      productRecord.barcode, productRecord.upc, productRecord.ean, productRecord.mpn,
      productRecord.brand, productRecord.collection,
      productRecord.category, productRecord.reportingCategory, productRecord.reporting_category,
      productRecord.reportingSubcategory, productRecord.reporting_subcategory,
      productRecord.vendor, productRecord.supplier, productRecord.supplierName, productRecord.supplier_name,
      productRecord.supplierSku, productRecord.supplier_sku,
      productRecord.description, productRecord.mainDescription, productRecord.main_description,
      productRecord.packSize, productRecord.pack_size, productRecord.unit
    ].filter(Boolean);
  }

  function searchDocument(productRecord) {
    return normalise(productFields(productRecord).join(' '));
  }

  function exactIdentifiers(productRecord) {
    return [
      productRecord.sku, productRecord.code, productRecord.itemCode, productRecord.item_code,
      productRecord.barcode, productRecord.upc, productRecord.ean,
      productRecord.supplierSku, productRecord.supplier_sku,
      productRecord.parentSku, productRecord.parent_sku
    ].filter(Boolean).map(compact);
  }

  function scoreProduct(productRecord, query) {
    const clean = normalise(query);
    if (!clean) return 1;
    const compactQuery = compact(query);
    const identifiers = exactIdentifiers(productRecord);
    if (identifiers.includes(compactQuery)) return 10000;
    if (identifiers.some(function (value) { return value.startsWith(compactQuery); })) return 9200;

    const documentText = searchDocument(productRecord);
    if (!documentText) return -Infinity;
    const candidateTokens = documentText.split(' ').filter(Boolean);
    const queryTokens = clean.split(' ').filter(Boolean);
    let total = 0;
    for (const queryToken of queryTokens) {
      const tokenScore = tokenMatchScore(queryToken, candidateTokens);
      if (!Number.isFinite(tokenScore)) return -Infinity;
      total += tokenScore;
    }

    const nameText = normalise([
      productRecord.parentName, productRecord.parent_name,
      productRecord.name, productRecord.variantValue, productRecord.variantLabel
    ].filter(Boolean).join(' '));
    if (nameText === clean) total += 950;
    else if (nameText.startsWith(clean)) total += 500;
    else if (nameText.includes(clean)) total += 260;

    if (documentText.includes(clean)) total += 180;
    total += Math.max(0, 45 - Math.abs(candidateTokens.length - queryTokens.length));
    return total;
  }

  function catalogueProducts() {
    const source = (typeof data !== 'undefined' && Array.isArray(data.products)) ? data.products : [];
    const seenIds = new Set();
    const seenSkus = new Set();
    return source.filter(function (productRecord) {
      if (!productRecord || productRecord.hiddenFromCatalogue || productRecord.deleted) return false;
      const archived = productRecord.archived === true || productRecord.active === false ||
        normalise(productRecord.status) === 'archived' || normalise(productRecord.active) === 'no';
      if (archived) return false;
      const idKey = text(productRecord.id || '').trim();
      const skuKey = compact(productRecord.sku || productRecord.code || productRecord.itemCode || '');
      if (idKey && seenIds.has(idKey)) return false;
      if (skuKey && seenSkus.has(skuKey)) return false;
      if (idKey) seenIds.add(idKey);
      if (skuKey) seenSkus.add(skuKey);
      return Boolean(idKey || skuKey || productRecord.name);
    });
  }

  function productMatches(query) {
    const clean = normalise(query);
    const products = catalogueProducts();
    if (!clean) {
      return products.slice().sort(function (a, b) {
        const aStock = stockInfo(a).available;
        const bStock = stockInfo(b).available;
        return bStock - aStock || text(a.name).localeCompare(text(b.name));
      }).slice(0, 14);
    }
    return products.map(function (productRecord) {
      return { product: productRecord, score: scoreProduct(productRecord, query) };
    }).filter(function (row) {
      return Number.isFinite(row.score) && row.score > 0;
    }).sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      const aStock = stockInfo(a.product).available;
      const bStock = stockInfo(b.product).available;
      return bStock - aStock || text(a.product.name).localeCompare(text(b.product.name));
    }).slice(0, 30).map(function (row) { return row.product; });
  }

  function stockInfo(productRecord) {
    let rows = [];
    if (typeof masterStockRowsForProduct === 'function') rows = masterStockRowsForProduct(productRecord.id) || [];
    else if (typeof stockRowsForProduct === 'function') rows = stockRowsForProduct(productRecord.id) || [];
    else if (typeof data !== 'undefined') rows = (data.stock || []).filter(function (row) { return row.productId === productRecord.id; });
    const onHand = rows.reduce(function (sum, row) {
      return sum + Number(row.qty ?? row.quantity ?? row.qty_on_hand ?? 0);
    }, 0);
    const allocated = rows.reduce(function (sum, row) {
      return sum + Number(row.allocated ?? row.allocatedQty ?? row.qty_allocated ?? 0);
    }, 0);
    const available = Math.max(0, onHand - allocated);
    const minimum = Number(productRecord.min ?? productRecord.minimum ?? productRecord.reorder ?? productRecord.reorderPoint ?? productRecord.reorder_level ?? 0);
    const statusClass = available <= 0 ? 'bad' : (minimum > 0 && available <= minimum ? 'warn' : 'good');
    const statusLabel = available <= 0 ? 'Out of stock' : (minimum > 0 && available <= minimum ? 'Low stock' : 'In stock');
    let locationLabel = 'Main Warehouse';
    if (rows.length && typeof locationById === 'function') {
      const best = rows.slice().sort(function (a, b) {
        return Number(b.qty ?? b.quantity ?? 0) - Number(a.qty ?? a.quantity ?? 0);
      })[0];
      const locationRecord = locationById(best.locationId || best.location_id || best.location);
      if (locationRecord && locationRecord.name) locationLabel = locationRecord.name;
    }
    return { onHand: onHand, allocated: allocated, available: available, minimum: minimum, statusClass: statusClass, statusLabel: statusLabel, locationLabel: locationLabel };
  }

  function variantLabel(productRecord) {
    return productRecord.variantValue || productRecord.variant_value || productRecord.variantLabel || productRecord.variant_label || productRecord.variant || productRecord.packSize || productRecord.pack_size || '';
  }

  function parentName(productRecord) {
    const parent = parentRecord(productRecord);
    return productRecord.parentName || productRecord.parent_name || (parent && parent.name) || '';
  }

  function sellPrice(productRecord, priceList) {
    return Number(
      productRecord[priceList] ??
      productRecord.rrp ?? productRecord.rrpPrice ?? productRecord.rrp_price ??
      productRecord.trade ?? productRecord.tradePrice ?? productRecord.trade_price ??
      productRecord.special ?? productRecord.specialPrice ?? productRecord.special_price ?? 0
    );
  }

  function escape(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(text(value));
    return text(value).replace(/[&<>"']/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
    });
  }

  function formatMoney(value) {
    if (typeof money === 'function') return money(Number(value || 0));
    return '£' + Number(value || 0).toFixed(2);
  }

  function selectedSummaryHtml(productRecord, order) {
    const stock = stockInfo(productRecord);
    const priceList = typeof orderPriceList === 'function' ? orderPriceList(order) : 'rrp';
    const price = sellPrice(productRecord, priceList);
    const parent = parentName(productRecord);
    const variant = variantLabel(productRecord);
    return '<div class="identity"><strong>' + escape(parent || productRecord.name || 'Selected product') + '</strong>' +
      '<span>' + escape([variant, productRecord.sku || productRecord.code, productRecord.brand, productRecord.supplier].filter(Boolean).join(' · ')) + '</span></div>' +
      '<div class="metric"><span>Available</span><strong>' + stock.available + '</strong><small>' + stock.onHand + ' physical, ' + stock.allocated + ' allocated</small></div>' +
      '<div class="metric"><span>Location</span><strong>' + escape(stock.locationLabel) + '</strong><small>' + escape(stock.statusLabel) + '</small></div>' +
      '<div class="metric"><span>' + escape(text(priceList || 'RRP').toUpperCase()) + ' price</span><strong>' + formatMoney(price) + '</strong><small>Net unit price</small></div>' +
      '<button type="button" class="secondary" data-so-clear-selection="true">Change</button>';
  }

  function addRowHtml(order) {
    const connected = typeof navigator === 'undefined' || navigator.onLine;
    const count = catalogueProducts().length;
    return '<section class="so-catalogue-picker" aria-label="Add a stock item">' +
      '<div class="so-catalogue-picker-head"><div><span class="eyebrow">Connected product catalogue</span><h3>Add a stock-controlled item</h3><p>Search every active parent product and variant. Exact SKUs and barcodes are prioritised, with typo and mixed-word support for names and sizes.</p></div>' +
      '<span class="so-search-connectivity ' + (connected ? '' : 'offline') + '"><i></i>' + (connected ? 'Live and offline-ready' : 'Offline catalogue active') + ' · ' + count + ' items</span></div>' +
      '<div class="so-catalogue-picker-grid">' +
        '<label class="so-catalogue-search-field"><span>Find product or exact variant</span><div class="so-catalogue-search-shell"><input id="salesOrderProductSearch" data-order-id="' + escape(order.id) + '" autocomplete="off" spellcheck="true" aria-autocomplete="list" aria-controls="salesOrderProductResults" aria-expanded="false" placeholder="Product, size, Pool Bros SKU, supplier SKU or barcode"><button type="button" class="so-search-clear" data-so-clear-search="true">Clear</button></div></label>' +
        '<label class="so-catalogue-qty-field"><span>Quantity</span><input id="salesOrderProductQty" type="number" min="1" step="1" value="1" inputmode="numeric" aria-label="Quantity"></label>' +
        '<button type="button" id="salesOrderAddStockButton" class="so-add-stock-button" data-add-line-order="' + escape(order.id) + '" disabled>Add selected item</button>' +
      '</div>' +
      '<div class="so-search-hints"><span>Quick examples:</span><button type="button" data-so-search-example="chlorine tablets 5 kg">chlorine tablets 5 kg</button><button type="button" data-so-search-example="clorine 5kg tabs">clorine 5kg tabs</button><button type="button" data-so-search-example="1.5 inch union">1.5 inch union</button><button type="button" data-so-show-recent="true">Show recent products</button></div>' +
      '<div id="salesOrderSelectedProduct" class="so-selected-product" hidden></div>' +
      '<div id="salesOrderProductResults" class="po-product-results so-product-results so-search-popover" role="listbox" hidden></div>' +
    '</section>';
  }

  function resultHtml(productRecord, order, index) {
    const stock = stockInfo(productRecord);
    const priceList = typeof orderPriceList === 'function' ? orderPriceList(order) : 'rrp';
    const price = sellPrice(productRecord, priceList);
    const parent = parentName(productRecord);
    const variant = variantLabel(productRecord);
    const displayName = parent || productRecord.name || 'Unnamed product';
    const detail = [
      productRecord.sku || productRecord.code || 'No SKU',
      productRecord.supplierSku || productRecord.supplier_sku ? 'Supplier SKU ' + (productRecord.supplierSku || productRecord.supplier_sku) : '',
      productRecord.brand,
      productRecord.category,
      productRecord.barcode ? 'Barcode ' + productRecord.barcode : ''
    ].filter(Boolean).join(' · ');
    return '<button type="button" role="option" aria-selected="false" tabindex="-1" class="so-product-result ' + stock.statusClass + '" data-so-select-product-v1105="' + escape(order.id) + '|' + escape(productRecord.id) + '" data-search-index="' + index + '">' +
      '<div class="so-search-result-main"><strong>' + escape(displayName) + '</strong>' + (variant ? '<span class="variant">' + escape(variant) + '</span>' : '') + '<small>' + escape(detail) + '</small></div>' +
      '<div class="so-search-result-stock"><span class="pill ' + stock.statusClass + '">' + stock.statusLabel + '</span><small>' + stock.available + ' available · ' + stock.onHand + ' physical · ' + stock.locationLabel + '</small></div>' +
      '<div class="so-search-result-price"><span>' + escape(text(priceList || 'RRP').toUpperCase()) + ' net</span><strong>' + formatMoney(price) + '</strong></div>' +
    '</button>';
  }

  function portalBox(box, input) {
    document.querySelectorAll('.so-search-popover[data-portal="true"]').forEach(function (existing) {
      if (existing !== box) existing.remove();
    });
    if (box.parentElement !== document.body) document.body.appendChild(box);
    box.dataset.portal = 'true';
    activeBox = box;
    activeInput = input;
    positionBox();
    input.setAttribute('aria-expanded', 'true');
    if (observer) observer.disconnect();
    observer = new MutationObserver(function () {
      if (!activeInput || !activeInput.isConnected) closeResults(true);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function positionBox() {
    if (!activeBox || activeBox.hidden || !activeInput || !activeInput.isConnected) return;
    const rect = activeInput.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(Math.max(rect.width + 320, 720), window.innerWidth - margin * 2);
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
    activeBox.style.width = width + 'px';
    activeBox.style.left = left + 'px';
    activeBox.style.visibility = 'hidden';
    const height = Math.min(activeBox.scrollHeight || 420, Math.max(220, window.innerHeight - margin * 2));
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openAbove = spaceBelow < Math.min(320, height) && spaceAbove > spaceBelow;
    activeBox.style.top = (openAbove ? Math.max(margin, rect.top - Math.min(height, spaceAbove) - 8) : rect.bottom + 8) + 'px';
    activeBox.style.maxHeight = Math.max(180, openAbove ? spaceAbove - 8 : spaceBelow) + 'px';
    activeBox.style.visibility = 'visible';
  }

  function closeResults(remove) {
    if (remove === undefined) remove = true;
    if (activeInput && activeInput.isConnected) activeInput.setAttribute('aria-expanded', 'false');
    if (activeBox) {
      activeBox.hidden = true;
      if (remove) activeBox.remove();
    }
    if (observer) observer.disconnect();
    observer = null;
    activeBox = null;
    activeInput = null;
    activeIndex = -1;
    lastMatches = [];
  }

  function setActiveResult(index) {
    if (!activeBox) return;
    const buttons = Array.from(activeBox.querySelectorAll('[data-so-select-product-v1105]'));
    if (!buttons.length) return;
    activeIndex = Math.max(0, Math.min(index, buttons.length - 1));
    buttons.forEach(function (button, buttonIndex) {
      const active = buttonIndex === activeIndex;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
    buttons[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  function selectProduct(input, productRecord) {
    if (!input || !productRecord) return;
    const order = typeof salesOrder === 'function' ? salesOrder(input.dataset.orderId) : null;
    input.value = [parentName(productRecord) || productRecord.name, variantLabel(productRecord), productRecord.sku || productRecord.code].filter(Boolean).join(' · ');
    input.dataset.selectedProductId = productRecord.id;
    input.classList.add('has-selection');
    const summary = document.getElementById('salesOrderSelectedProduct');
    if (summary && order) {
      summary.innerHTML = selectedSummaryHtml(productRecord, order);
      summary.hidden = false;
    }
    const addButton = document.getElementById('salesOrderAddStockButton');
    if (addButton) addButton.disabled = false;
    closeResults(true);
    input.focus({ preventScroll: true });
  }

  function clearSelection(clearText) {
    const input = document.getElementById('salesOrderProductSearch');
    if (!input) return;
    input.dataset.selectedProductId = '';
    input.classList.remove('has-selection');
    if (clearText) input.value = '';
    const summary = document.getElementById('salesOrderSelectedProduct');
    if (summary) { summary.hidden = true; summary.innerHTML = ''; }
    const addButton = document.getElementById('salesOrderAddStockButton');
    if (addButton) addButton.disabled = true;
    closeResults(true);
    input.focus({ preventScroll: true });
    if (!clearText) renderResults(input, input.value);
  }

  function ensureResultsBox(input) {
    if (activeBox && activeInput === input && activeBox.isConnected) return activeBox;
    document.querySelectorAll('#salesOrderProductResults').forEach(function (candidate) {
      if (candidate.dataset.portal === 'true') candidate.remove();
    });
    const picker = input.closest('.so-catalogue-picker');
    let box = picker ? picker.querySelector('#salesOrderProductResults') : null;
    if (!box && picker) {
      box = document.createElement('div');
      box.id = 'salesOrderProductResults';
      box.className = 'po-product-results so-product-results so-search-popover';
      box.setAttribute('role', 'listbox');
      box.hidden = true;
      picker.appendChild(box);
    }
    return box;
  }

  function renderResults(input, query) {
    if (!input || !input.isConnected) return;
    const box = ensureResultsBox(input);
    const order = typeof salesOrder === 'function' ? salesOrder(input.dataset.orderId) : null;
    if (!box || !order) return;
    const matches = productMatches(query);
    lastMatches = matches;
    activeIndex = -1;
    const clean = normalise(query);
    box.innerHTML = '<div class="po-product-results-head"><div><strong>' + (clean ? 'Best catalogue matches' : 'Recent catalogue products') + '</strong><span>Select the exact stock-controlled variant before adding</span></div><span>' + matches.length + ' result' + (matches.length === 1 ? '' : 's') + '</span></div>' +
      (matches.length ? matches.map(function (productRecord, index) { return resultHtml(productRecord, order, index); }).join('') :
        '<div class="so-search-empty"><strong>No product matched that search</strong><p>Try fewer words, a size such as 5 kg, a Pool Bros SKU, supplier SKU or barcode. Typing errors are supported, but the selected variant must still be confirmed.</p><div class="so-search-diagnostics">Active catalogue checked: ' + catalogueProducts().length + ' products and variants · Search engine v' + SEARCH_VERSION + '</div></div>');
    box.hidden = false;
    portalBox(box, input);
    setActiveResult(0);
  }

  function exactProductFromValue(value) {
    const queryCompact = compact(value);
    if (!queryCompact) return null;
    return catalogueProducts().find(function (productRecord) {
      return exactIdentifiers(productRecord).includes(queryCompact);
    }) || null;
  }

  function refreshConnectivity() {
    document.querySelectorAll('.so-search-connectivity').forEach(function (badge) {
      const connected = navigator.onLine;
      badge.classList.toggle('offline', !connected);
      badge.innerHTML = '<i></i>' + (connected ? 'Live and offline-ready' : 'Offline catalogue active') + ' · ' + catalogueProducts().length + ' items';
    });
  }

  if (typeof salesOrderCatalogueProducts === 'function') {
    salesOrderCatalogueProducts = catalogueProducts;
  }
  if (typeof salesOrderProductSearchText === 'function') {
    salesOrderProductSearchText = searchDocument;
  }
  if (typeof salesOrderProductMatches === 'function') {
    salesOrderProductMatches = productMatches;
  }
  if (typeof salesOrderProductStockInfo === 'function') {
    salesOrderProductStockInfo = stockInfo;
  }
  if (typeof productFromSearch === 'function') {
    productFromSearch = function (value) {
      return exactProductFromValue(value) || productMatches(value)[0] || null;
    };
  }
  if (typeof renderSalesOrderProductResults === 'function') {
    renderSalesOrderProductResults = function (orderId, query) {
      const input = document.getElementById('salesOrderProductSearch');
      if (!input || input.dataset.orderId !== orderId) return;
      renderResults(input, query);
    };
  }
  if (typeof salesOrderAddRow === 'function') {
    const previousAddRow = salesOrderAddRow;
    salesOrderAddRow = function (order) {
      const previous = previousAddRow(order);
      const marker = '<section class="so-line-composer">';
      const markerIndex = previous.indexOf(marker);
      const additionalLines = markerIndex >= 0 ? previous.slice(markerIndex) : '';
      return addRowHtml(order) + additionalLines;
    };
  }

  document.addEventListener('input', function (event) {
    const input = event.target.closest && event.target.closest('#salesOrderProductSearch');
    if (!input) return;
    event.stopImmediatePropagation();
    input.dataset.selectedProductId = '';
    input.classList.remove('has-selection');
    const summary = document.getElementById('salesOrderSelectedProduct');
    if (summary) { summary.hidden = true; summary.innerHTML = ''; }
    const addButton = document.getElementById('salesOrderAddStockButton');
    if (addButton) addButton.disabled = true;
    renderResults(input, input.value);
  }, true);

  document.addEventListener('focus', function (event) {
    const input = event.target.closest && event.target.closest('#salesOrderProductSearch');
    if (!input) return;
    event.stopImmediatePropagation();
    renderResults(input, input.value);
  }, true);

  document.addEventListener('keydown', function (event) {
    const input = event.target.closest && event.target.closest('#salesOrderProductSearch');
    if (!input) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    if (event.key === 'Escape') { closeResults(true); return; }
    if (event.key === 'ArrowDown') { setActiveResult(activeIndex + 1); return; }
    if (event.key === 'ArrowUp') { setActiveResult(activeIndex <= 0 ? lastMatches.length - 1 : activeIndex - 1); return; }
    if (event.key === 'Enter') {
      if (input.dataset.selectedProductId) {
        if (typeof addProductToSalesOrder === 'function') addProductToSalesOrder(input.dataset.orderId);
        return;
      }
      const productRecord = lastMatches[Math.max(0, activeIndex)] || exactProductFromValue(input.value);
      if (productRecord) selectProduct(input, productRecord);
      else if (typeof toast === 'function') toast('No matching catalogue product was found.');
    }
  }, true);

  document.addEventListener('click', function (event) {
    const result = event.target.closest && event.target.closest('[data-so-select-product-v1105]');
    if (result) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const parts = result.dataset.soSelectProductV1105.split('|');
      const productRecord = typeof product === 'function' ? product(parts[1]) : catalogueProducts().find(function (item) { return item.id === parts[1]; });
      const input = document.getElementById('salesOrderProductSearch') || activeInput;
      selectProduct(input, productRecord);
      return;
    }
    const clear = event.target.closest && event.target.closest('[data-so-clear-search]');
    if (clear) { event.preventDefault(); clearSelection(true); return; }
    const change = event.target.closest && event.target.closest('[data-so-clear-selection]');
    if (change) { event.preventDefault(); clearSelection(true); return; }
    const example = event.target.closest && event.target.closest('[data-so-search-example]');
    if (example) {
      event.preventDefault();
      const input = document.getElementById('salesOrderProductSearch');
      if (input) { clearSelection(true); input.value = example.dataset.soSearchExample; renderResults(input, input.value); }
      return;
    }
    const recent = event.target.closest && event.target.closest('[data-so-show-recent]');
    if (recent) {
      event.preventDefault();
      const input = document.getElementById('salesOrderProductSearch');
      if (input) { clearSelection(true); renderResults(input, ''); }
      return;
    }
    if (activeBox && !activeBox.contains(event.target) && (!activeInput || !activeInput.contains(event.target))) closeResults(true);
  }, true);

  window.addEventListener('resize', positionBox, { passive: true });
  window.addEventListener('scroll', positionBox, { passive: true, capture: true });
  window.addEventListener('online', refreshConnectivity);
  window.addEventListener('offline', refreshConnectivity);

  window.PoolShedSalesSearch = {
    version: SEARCH_VERSION,
    normalise: normalise,
    scoreProduct: scoreProduct,
    productMatchesQuery: function (productRecord, query) { return Number.isFinite(scoreProduct(productRecord, query)) && scoreProduct(productRecord, query) > 0; },
    rankProducts: function (products, query) {
      return products.map(function (productRecord) { return { product: productRecord, score: scoreProduct(productRecord, query) }; })
        .filter(function (row) { return Number.isFinite(row.score) && row.score > 0; })
        .sort(function (a, b) { return b.score - a.score; });
    }
  };

  setTimeout(function () {
    refreshConnectivity();
    if (typeof activeTab !== 'undefined' && activeTab === 'salesorders' && typeof salesOrderView !== 'undefined' && salesOrderView === 'detail' && typeof render === 'function') render();
  }, 0);
})();
