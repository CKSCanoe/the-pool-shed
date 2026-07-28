/* Pool Shed v1.11.4 product image catalogue */
(function () {
  'use strict';

  const VERSION = '1.11.8';
  const RECENT_KEY = 'poolshed:v1113:catalogueRecentSearches';
  let hubPopover = null;
  let hubInput = null;
  let hubMatches = [];
  let hubActiveIndex = -1;
  let poPopover = null;
  let poInput = null;
  let poMatches = [];
  let poActiveIndex = -1;
  let enhanceTimer = null;
  let searchBackdrop = null;
  let poBasket = [];

  function str(value) { return String(value == null ? '' : value); }
  function esc(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(str(value));
    return str(value).replace(/[&<>"']/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
    });
  }
  function cash(value) {
    if (typeof money === 'function') return money(Number(value || 0));
    return '£' + Number(value || 0).toFixed(2);
  }
  function normalise(value) {
    if (window.PoolShedSalesSearch && typeof window.PoolShedSalesSearch.normalise === 'function') {
      return window.PoolShedSalesSearch.normalise(value);
    }
    return str(value).toLowerCase().replace(/([0-9])([a-z])/g, '$1 $2').replace(/([a-z])([0-9])/g, '$1 $2').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function compact(value) { return normalise(value).replace(/\s+/g, ''); }
  function activeProducts() {
    const source = (typeof data !== 'undefined' && Array.isArray(data.products)) ? data.products : [];
    const ids = new Set();
    const skus = new Set();
    return source.filter(function (productRecord) {
      if (!productRecord || productRecord.deleted || productRecord.hiddenFromCatalogue) return false;
      if (productRecord.active === false || productRecord.archived === true || normalise(productRecord.status) === 'archived') return false;
      const id = str(productRecord.id).trim();
      const sku = compact(productRecord.sku || productRecord.code || productRecord.itemCode || '');
      if (id && ids.has(id)) return false;
      if (sku && skus.has(sku)) return false;
      if (id) ids.add(id);
      if (sku) skus.add(sku);
      return Boolean(id || sku || productRecord.name);
    });
  }
  function rankProducts(query, limit) {
    const products = activeProducts();
    if (!normalise(query)) {
      return products.slice().sort(function (a, b) {
        const sa = stockInfo(a).available;
        const sb = stockInfo(b).available;
        return sb - sa || str(a.name).localeCompare(str(b.name));
      }).slice(0, limit || 14).map(function (productRecord) { return { product: productRecord, score: 1, exact: false }; });
    }
    if (window.PoolShedSalesSearch && typeof window.PoolShedSalesSearch.rankProducts === 'function') {
      return window.PoolShedSalesSearch.rankProducts(products, query).slice(0, limit || 24).map(function (row) {
        const exact = exactIdentifiers(row.product).includes(compact(query));
        return { product: row.product, score: row.score, exact: exact };
      });
    }
    const q = normalise(query);
    return products.map(function (productRecord) {
      const doc = normalise(productSearchText(productRecord));
      return { product: productRecord, score: doc.includes(q) ? 100 : -1, exact: exactIdentifiers(productRecord).includes(compact(query)) };
    }).filter(function (row) { return row.score > 0; }).slice(0, limit || 24);
  }
  function exactIdentifiers(productRecord) {
    return [productRecord.sku, productRecord.code, productRecord.itemCode, productRecord.item_code, productRecord.barcode, productRecord.upc, productRecord.ean, productRecord.supplierSku, productRecord.supplier_sku, productRecord.parentSku, productRecord.parent_sku].filter(Boolean).map(compact);
  }
  function parentRecord(productRecord) {
    const parents = (typeof data !== 'undefined' && (data.productParents || data.product_parents)) || [];
    const parentId = productRecord.parentProductId || productRecord.parent_product_id;
    const parentSku = productRecord.parentSku || productRecord.parent_sku;
    return parents.find(function (parent) {
      return (parentId && parent.id === parentId) || (parentSku && compact(parent.parentSku || parent.parent_sku) === compact(parentSku));
    }) || null;
  }
  function parentName(productRecord) {
    const parent = parentRecord(productRecord);
    return productRecord.parentName || productRecord.parent_name || (parent && parent.name) || '';
  }
  function variantName(productRecord) {
    return productRecord.variantValue || productRecord.variant_value || productRecord.variantLabel || productRecord.variant_label || productRecord.variant || productRecord.packSize || productRecord.pack_size || '';
  }
  function productSearchText(productRecord) {
    const parent = parentRecord(productRecord) || {};
    return [
      parentName(productRecord), productRecord.parentSku, productRecord.parent_sku, parent.parentSku, parent.parent_sku,
      productRecord.name, variantName(productRecord), productRecord.sku, productRecord.code, productRecord.itemCode,
      productRecord.supplierSku, productRecord.supplier_sku, productRecord.barcode, productRecord.upc, productRecord.ean,
      productRecord.brand, productRecord.category, productRecord.reportingCategory, productRecord.reportingSubcategory,
      productRecord.supplier, productRecord.supplierName, productRecord.description, productRecord.mainDescription,
      productRecord.packSize, productRecord.pack_size, productRecord.unit
    ].filter(Boolean).join(' ');
  }
  function stockRows(productRecord) {
    if (typeof masterStockRowsForProduct === 'function') return masterStockRowsForProduct(productRecord.id) || [];
    if (typeof stockRowsForProduct === 'function') return stockRowsForProduct(productRecord.id) || [];
    return (typeof data !== 'undefined' && Array.isArray(data.stock)) ? data.stock.filter(function (row) { return row.productId === productRecord.id; }) : [];
  }
  function stockInfo(productRecord) {
    const rows = stockRows(productRecord);
    const physical = rows.reduce(function (sum, row) { return sum + Number(row.qty ?? row.quantity ?? row.qty_on_hand ?? 0); }, 0);
    const allocated = rows.reduce(function (sum, row) { return sum + Number(row.allocated ?? row.allocatedQty ?? row.qty_allocated ?? 0); }, 0);
    let location = 'Main Warehouse';
    if (rows.length && typeof locationById === 'function') {
      const best = rows.slice().sort(function (a, b) { return Number(b.qty ?? b.quantity ?? 0) - Number(a.qty ?? a.quantity ?? 0); })[0];
      const locationRecord = locationById(best.locationId || best.location_id || best.location);
      if (locationRecord && locationRecord.name) location = locationRecord.name;
    }
    return { physical: physical, allocated: allocated, available: Math.max(0, physical - allocated), location: location };
  }
  function productPrice(productRecord, field) {
    return Number(productRecord[field] ?? productRecord.cost ?? productRecord.costPrice ?? productRecord.cost_price ?? 0);
  }
  function options(values, selected, label) {
    const unique = Array.from(new Set(values.filter(Boolean).map(str))).sort(function (a, b) { return a.localeCompare(b); });
    return '<option value="">' + esc(label) + '</option>' + unique.map(function (value) {
      return '<option value="' + esc(value) + '"' + (value === selected ? ' selected' : '') + '>' + esc(value) + '</option>';
    }).join('');
  }
  function mappedOptions(rows, selected) {
    return rows.map(function (row) { return '<option value="' + esc(row[0]) + '"' + (row[0] === selected ? ' selected' : '') + '>' + esc(row[1]) + '</option>'; }).join('');
  }
  function recentSearches() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter(Boolean).slice(0, 5); } catch (_) { return []; }
  }
  function saveRecent(query) {
    const value = str(query).trim();
    if (!value) return;
    try {
      const next = [value].concat(recentSearches().filter(function (row) { return normalise(row) !== normalise(value); })).slice(0, 5);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch (_) {}
  }
  function connectedBadge() {
    const online = typeof navigator === 'undefined' || navigator.onLine;
    return '<span class="ci-live-badge' + (online ? '' : ' offline') + '"><i></i>' + (online ? 'Catalogue ready online' : 'Offline catalogue ready') + ' · ' + activeProducts().length + ' variants</span>';
  }
  function filterChips(state) {
    const rows = [
      ['query', 'Search', state.query], ['category', 'Category', state.category], ['supplier', 'Supplier', state.supplier],
      ['stock', 'Stock', ({ in: 'In stock', low: 'Low stock', out: 'Out of stock', allocated: 'Allocated' })[state.stock]],
      ['kind', 'Structure', ({ grouped: 'Grouped', standalone: 'Standalone' })[state.kind]]
    ].filter(function (row) { return row[2]; });
    if (!rows.length) return '<div class="ci-active-filters"><span>No filters applied · Press / to focus search</span></div>';
    return '<div class="ci-active-filters"><span>Active:</span>' + rows.map(function (row) {
      return '<button type="button" class="ci-filter-chip" data-ci-clear-filter="' + row[0] + '">' + esc(row[1]) + ': <strong>' + esc(row[2]) + '</strong> ×</button>';
    }).join('') + '</div>';
  }

  function hubCommandHtml(resultText) {
    const state = window.poolShedProductHubState || { query: '', category: '', supplier: '', stock: '', kind: '', sort: 'name' };
    const products = activeProducts();
    const categories = products.map(function (p) { return p.category; });
    const suppliers = products.map(function (p) { return p.supplier || p.supplierName; });
    const recent = recentSearches();
    return '<section class="ci-command-centre" aria-label="Catalogue intelligence search">' +
      '<div class="ci-command-head"><div><span class="ci-eyebrow">Pool Bros catalogue intelligence · v' + VERSION + '</span><h3>Find the exact product in seconds</h3><p>Search names, sizes, variants, Pool Bros SKUs, supplier codes and barcodes with typo tolerance, intelligent ranking and offline catalogue support.</p></div>' + connectedBadge() + '</div>' +
      '<div class="ci-search-grid"><label class="ci-search-field"><span>Search the full catalogue</span><div class="ci-search-shell"><span class="ci-search-icon">⌕</span><input id="ciHubSearch" autocomplete="off" spellcheck="true" aria-autocomplete="list" aria-expanded="false" placeholder="Try clorine 5kg tabs, 1.5 inch union, SKU or barcode" value="' + esc(state.query || '') + '"><button type="button" class="ci-search-clear" data-ci-hub-clear="true">Clear</button></div></label><button type="button" class="ci-search-submit" data-ci-hub-submit="true">Search catalogue</button></div>' +
      '<div class="ci-shortcuts"><span>Quick search:</span><button type="button" data-ci-query="chlorine tablets 5 kg">chlorine tablets 5 kg</button><button type="button" data-ci-query="1.5 inch union">1.5 inch union</button><button type="button" data-ci-query="3 phase pump">3 phase pump</button>' + recent.map(function (row) { return '<button type="button" data-ci-query="' + esc(row) + '">' + esc(row) + '</button>'; }).join('') + '</div>' +
      filterChips(state) +
      '<div class="ci-filter-deck"><label>Category<select data-ci-hub-filter="category">' + options(categories, state.category || '', 'All categories') + '</select></label><label>Supplier<select data-ci-hub-filter="supplier">' + options(suppliers, state.supplier || '', 'All suppliers') + '</select></label><label>Stock status<select data-ci-hub-filter="stock">' + mappedOptions([['', 'All stock statuses'], ['in', 'In stock'], ['low', 'Low stock'], ['out', 'Out of stock'], ['allocated', 'Allocated stock']], state.stock || '') + '</select></label><label>Product structure<select data-ci-hub-filter="kind">' + mappedOptions([['', 'All products'], ['grouped', 'Grouped products'], ['standalone', 'Standalone products']], state.kind || '') + '</select></label><label>Sort results<select data-ci-hub-filter="sort">' + mappedOptions([['name', 'Name A–Z'], ['stock', 'Available stock'], ['rrp', 'Lowest RRP'], ['variants', 'Most variants']], state.sort || 'name') + '</select></label></div>' +
      '<div class="ci-command-footer"><div class="ci-result-summary"><strong>' + esc(resultText || 'Catalogue ready') + '</strong><span>Enter searches · ↑↓ chooses a suggestion · Esc closes</span></div><div class="ci-command-actions"><button type="button" data-ci-hub-action="standalone">Add standalone product</button><button type="button" data-ci-hub-action="grouped">Add grouped product</button><button type="button" class="secondary" data-ci-hub-action="import">Import catalogue</button><button type="button" class="secondary" data-ci-reset-all="true">Reset filters</button></div></div>' +
    '</section>';
  }

  function enhanceProductHub() {
    const screen = document.getElementById('screen-products');
    if (!screen || !screen.isConnected) return;
    screen.querySelectorAll('.inventory-sync-banner').forEach(function (banner) { banner.remove(); });
    const oldCommand = screen.querySelector('.product-hub-command');
    if (!oldCommand || screen.querySelector('.ci-command-centre')) return;
    const oldActions = screen.querySelector('.product-hub-actions');
    const resultText = oldActions && oldActions.querySelector('.result-count') ? oldActions.querySelector('.result-count').textContent.trim() : (screen.querySelectorAll('.catalogue-row').length + ' product groups');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = hubCommandHtml(resultText);
    oldCommand.replaceWith(wrapper.firstElementChild);
    if (oldActions) oldActions.remove();
    const eyebrow = screen.querySelector('.group-toolbar .eyebrow');
    if (eyebrow) eyebrow.textContent = 'VERSION ' + VERSION;
  }

  function hubSuggestionHtml(row, index) {
    const p = row.product;
    const stock = stockInfo(p);
    const parent = parentName(p) || p.name || 'Unnamed product';
    const variant = variantName(p);
    const detail = [p.sku || p.code || 'No SKU', p.supplierSku ? 'Supplier SKU ' + p.supplierSku : '', p.brand, p.category, p.supplier, p.barcode ? 'Barcode ' + p.barcode : ''].filter(Boolean).join(' · ');
    const image = window.PoolShedProductImages ? window.PoolShedProductImages.markup(p, { mode: 'variant', className: 'ci-result-thumb', size: 'md', alt: parent }) : '<span class="pb-product-image pb-product-image-md is-fallback ci-result-thumb"><span class="pb-product-image-fallback">PB</span></span>';
    return '<button type="button" role="option" aria-selected="false" tabindex="-1" class="ci-result-row' + (row.exact ? ' exact' : '') + '" data-ci-hub-result="' + esc(p.id) + '" data-ci-index="' + index + '">' + image + '<div class="ci-result-main"><strong>' + esc(parent) + '</strong>' + (variant ? '<span class="variant">' + esc(variant) + '</span>' : '') + '<small>' + esc(detail) + '</small></div><div class="ci-result-metric"><span>Availability</span><strong>' + stock.available + ' available</strong><small>' + stock.physical + ' physical · ' + stock.allocated + ' allocated</small></div><div class="ci-result-metric"><span>Pricing</span><strong>' + cash(Number(p.rrp || p.rrpPrice || 0)) + ' RRP</strong><small>' + cash(productPrice(p, 'cost')) + ' cost · ' + esc(stock.location) + '</small></div><span class="ci-result-action">↵</span></button>';
  }
  function ensureSearchBackdrop() { return null; }
  function setActiveSearchSource(input) {
    document.querySelectorAll('.ci-search-source-active').forEach(function (node) { node.classList.remove('ci-search-source-active'); });
    if (!input || !input.isConnected) return;
    const shell = input.closest('.ci-search-shell');
    if (shell) shell.classList.add('ci-search-source-active');
  }
  function showSearchLayer(input) { setActiveSearchSource(input); }
  function tidySearchLayer() {
    document.querySelectorAll('.ci-search-source-active').forEach(function (node) { node.classList.remove('ci-search-source-active'); });
    document.body.classList.remove('ci-search-layer-open');
  }
  function ensurePopover(type) {
    const existing = type === 'hub' ? hubPopover : poPopover;
    if (existing && existing.isConnected) return existing;
    const box = document.createElement('div');
    box.className = 'ci-search-popover ci-search-popover-' + type;
    box.hidden = true;
    box.setAttribute('role', 'listbox');
    box.setAttribute('aria-label', type === 'hub' ? 'Catalogue search results' : 'Purchase order supplier offers');
    document.body.appendChild(box);
    if (type === 'hub') hubPopover = box; else poPopover = box;
    return box;
  }
  function positionPopover(box, input) {
    if (!box || box.hidden || !input || !input.isConnected) return;
    const host = input.closest('.ci-command-centre, .ci-po-catalogue-picker') || input.parentElement;
    if (box.parentElement !== host) host.appendChild(box);
    const shell = input.closest('.ci-search-shell') || input;
    const hostRect = host.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    box.style.position = 'absolute';
    box.style.left = Math.max(12, shellRect.left - hostRect.left) + 'px';
    box.style.top = Math.max(0, shellRect.bottom - hostRect.top + 8) + 'px';
    box.style.width = Math.min(Math.max(shellRect.width, 680), hostRect.width - 24) + 'px';
    box.style.height = 'auto';
    box.style.maxHeight = input.id === 'poProductSearch' ? '620px' : '520px';
    box.style.visibility = 'visible';
  }
  function showHubSuggestions(input) {
    if (!input || !input.isConnected) return;
    const box = ensurePopover('hub');
    hubInput = input;
    hubMatches = rankProducts(input.value, 8);
    hubActiveIndex = hubMatches.length ? 0 : -1;
    box.innerHTML = '<div class="ci-popover-head"><div><strong>' + (normalise(input.value) ? 'Best catalogue matches' : 'Available catalogue products') + '</strong><span>Showing the top ' + hubMatches.length + ' result' + (hubMatches.length === 1 ? '' : 's') + ' · exact codes are prioritised</span></div><span class="ci-key-hint">↑↓ Navigate · Enter open · Esc close</span></div><div class="ci-popover-results">' + (hubMatches.length ? hubMatches.map(hubSuggestionHtml).join('') : '<div class="ci-search-empty"><strong>No catalogue result found</strong><p>Try fewer words, a size such as 5 kg, a Pool Bros SKU, supplier SKU or barcode. Common spelling errors and mixed word order are supported.</p></div>') + '</div><div class="ci-popover-footer"><span>Press Enter to open the highlighted variant.</span><button type="button" data-ci-show-all="true">Search the full catalogue</button></div>';
    box.hidden = false;
    showSearchLayer(input);
    input.setAttribute('aria-expanded', 'true');
    positionPopover(box, input);
    setHubActive(0);
  }
  function setHubActive(index) {
    if (!hubPopover) return;
    const rows = Array.from(hubPopover.querySelectorAll('[data-ci-hub-result]'));
    if (!rows.length) return;
    hubActiveIndex = Math.max(0, Math.min(index, rows.length - 1));
    rows.forEach(function (row, rowIndex) {
      const active = rowIndex === hubActiveIndex;
      row.classList.toggle('is-active', active);
      row.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    rows[hubActiveIndex].scrollIntoView({ block: 'nearest' });
  }
  function closeHubPopover() {
    if (hubPopover) { hubPopover.hidden = true; hubPopover.remove(); }
    if (hubInput && hubInput.isConnected) hubInput.setAttribute('aria-expanded', 'false');
    hubPopover = null; hubInput = null; hubMatches = []; hubActiveIndex = -1;
    tidySearchLayer();
  }
  function applyHubQuery(query, productRecord) {
    const state = window.poolShedProductHubState || (window.poolShedProductHubState = { query: '', category: '', supplier: '', stock: '', kind: '', sort: 'name', compare: [] });
    const value = productRecord ? (productRecord.sku || productRecord.name || query) : str(query).trim();
    state.query = value;
    if (productRecord && window.poolShedExpandedProductGroups && typeof window.poolShedExpandedProductGroups.add === 'function') {
      window.poolShedExpandedProductGroups.add(str(productRecord.parentSku || productRecord.parent_sku || productRecord.sisterKey || productRecord.sku || productRecord.id));
    }
    saveRecent(query || value);
    closeHubPopover();
    if (typeof renderProducts === 'function') renderProducts(); else if (typeof render === 'function') render();
  }

  function supplierProfileSafe(name) {
    if (typeof supplierProfile === 'function') return supplierProfile(name) || { name: name || 'Unknown supplier' };
    return { name: name || 'Unknown supplier', preferred: false, leadTimeDays: 0, creditLimit: 0 };
  }
  function supplierRowsForProduct(productRecord) {
    const rows = (typeof data !== 'undefined' && Array.isArray(data.supplierProducts)) ? data.supplierProducts.filter(function (row) { return row.productId === productRecord.id && row.available !== false; }) : [];
    if (rows.length) return rows;
    return [{ productId: productRecord.id, supplier: productRecord.supplier || productRecord.supplierName || 'Supplier to confirm', supplierSku: productRecord.supplierSku || productRecord.sku, cost: productPrice(productRecord, 'cost'), leadTimeDays: 0, minQty: 1, packQty: 1, available: true }];
  }
  function creditPosition(supplier) {
    if (typeof supplierCreditPosition === 'function') return supplierCreditPosition(supplier);
    return { available: Math.max(0, Number(supplier.creditLimit || 0) - Number(supplier.creditUsed || 0)) };
  }
  function purchaseOffers(po, query) {
    const ranked = rankProducts(query, 18);
    const rows = [];
    ranked.forEach(function (rankedRow) {
      const p = rankedRow.product;
      const offers = supplierRowsForProduct(p);
      const minCost = Math.min.apply(Math, offers.map(function (offer) { return Number(offer.cost ?? productPrice(p, 'cost')); }));
      offers.forEach(function (offer) {
        const supplier = supplierProfileSafe(offer.supplier || p.supplier);
        const cost = Number(offer.cost ?? productPrice(p, 'cost'));
        const rrp = Number(p.rrp || p.rrpPrice || p.rrp_price || 0);
        const margin = rrp > 0 ? ((rrp - cost) / rrp) * 100 : 0;
        const lead = Number(offer.leadTimeDays || supplier.leadTimeDays || 0);
        const current = Boolean(po && po.supplier && po.supplier !== 'Supplier to confirm' && po.supplier === supplier.name);
        const bestValue = cost === minCost;
        const preference = (current ? 500 : 0) + (supplier.preferred ? 120 : 0) + (bestValue ? 60 : 0) - lead;
        rows.push({ product: p, offer: offer, supplier: supplier, cost: cost, rrp: rrp, margin: margin, leadTime: lead, current: current, bestValue: bestValue, relevance: rankedRow.score, exact: rankedRow.exact, preference: preference });
      });
    });
    rows.sort(function (a, b) {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance;
      if (b.preference !== a.preference) return b.preference - a.preference;
      if (a.cost !== b.cost) return a.cost - b.cost;
      return a.leadTime - b.leadTime;
    });
    return rows.slice(0, 28);
  }
  function selectedOfferHtml(row) {
    const p = row.product;
    const credit = creditPosition(row.supplier);
    const image = window.PoolShedProductImages ? window.PoolShedProductImages.markup(p, { mode: 'variant', className: 'ci-selected-thumb', size: 'md', alt: parentName(p) || p.name }) : '';
    return image + '<div class="identity"><strong>' + esc(parentName(p) || p.name) + '</strong><span>' + esc([variantName(p), p.sku, row.offer.supplierSku || p.supplierSku].filter(Boolean).join(' · ')) + '</span></div><div class="metric"><span>Supplier</span><strong>' + esc(row.supplier.name) + '</strong></div><div class="metric"><span>Unit cost</span><strong>' + cash(row.cost) + '</strong></div><div class="metric"><span>Lead time</span><strong>' + row.leadTime + ' days</strong></div><button type="button" class="secondary" data-ci-po-change="true">Change</button>';
  }
  function poResultHtml(row, index) {
    const p = row.product;
    const credit = creditPosition(row.supplier);
    const parent = parentName(p) || p.name || 'Unnamed product';
    const variant = variantName(p);
    const badges = (row.current ? '<span class="pill blue">Current PO supplier</span>' : '<span class="pill warn">Separate supplier PO</span>') + (row.bestValue ? '<span class="pill good">Best value</span>' : '') + (row.supplier.preferred ? '<span class="pill good">Preferred</span>' : '') + (row.exact ? '<span class="pill dark">Exact code</span>' : '');
    const image = window.PoolShedProductImages ? window.PoolShedProductImages.markup(p, { mode: 'variant', className: 'ci-result-thumb', size: 'md', alt: parent }) : '<span class="pb-product-image pb-product-image-md is-fallback ci-result-thumb"><span class="pb-product-image-fallback">PB</span></span>';
    return '<button type="button" role="option" aria-selected="false" tabindex="-1" class="ci-result-row ci-offer-row' + (row.bestValue ? ' best-value' : '') + '" data-ci-po-result="' + esc(p.id) + '" data-ci-po-supplier="' + esc(row.supplier.name) + '" data-ci-index="' + index + '">' + image + '<div class="ci-result-main"><strong>' + esc(parent) + '</strong>' + (variant ? '<span class="variant">' + esc(variant) + '</span>' : '') + '<small>' + esc([p.sku, row.offer.supplierSku ? 'Supplier SKU ' + row.offer.supplierSku : '', p.brand, p.category].filter(Boolean).join(' · ')) + '</small></div><div class="ci-result-metric"><span>Supplier</span><strong>' + esc(row.supplier.name) + '</strong><small>' + row.leadTime + ' day lead · ' + cash(credit.available) + ' credit free</small></div><div class="ci-result-metric"><span>Cost</span><strong>' + cash(row.cost) + '</strong><small>' + Math.round(row.margin) + '% margin at RRP</small></div><div class="ci-offer-badges">' + badges + '</div><span class="ci-result-action">↵</span></button>';
  }
  function basketKey(row) { return str(row.product.id) + '::' + str(row.supplier.name); }
  function basketTotalQty() { return poBasket.reduce(function (sum, row) { return sum + Number(row.qty || 0); }, 0); }
  function addOfferToBasket(row, qty) {
    if (!row) return;
    const key = basketKey(row);
    const existing = poBasket.find(function (item) { return item.key === key; });
    if (existing) existing.qty += Math.max(1, Number(qty || 1));
    else poBasket.push({ key: key, product: row.product, offer: row.offer, supplier: row.supplier, cost: row.cost, leadTime: row.leadTime, qty: Math.max(1, Number(qty || 1)) });
  }
  function basketHtml() {
    if (!poBasket.length) return '<div class="ci-basket-empty"><strong>No products selected yet</strong><span>Choose products from the results. Your list stays here while you continue searching.</span></div>';
    return '<div class="ci-basket-list">' + poBasket.map(function (item) {
      return '<div class="ci-basket-item" data-ci-basket-key="' + esc(item.key) + '"><div><strong>' + esc(parentName(item.product) || item.product.name) + '</strong><span>' + esc([variantName(item.product), item.product.sku, item.supplier.name].filter(Boolean).join(' · ')) + '</span></div><label>Qty<input type="number" min="1" step="1" value="' + Number(item.qty || 1) + '" data-ci-basket-qty="' + esc(item.key) + '"></label><strong>' + cash(Number(item.cost || 0) * Number(item.qty || 1)) + '</strong><button type="button" aria-label="Remove product" title="Remove" data-ci-basket-remove="' + esc(item.key) + '">×</button></div>';
    }).join('') + '</div>';
  }
  function commitPoBasket(poId) {
    const po = typeof purchaseOrderById === 'function' ? purchaseOrderById(poId) : null;
    if (!po || !poBasket.length) return;
    const bySupplier = {};
    poBasket.forEach(function (item) { (bySupplier[item.supplier.name] ||= []).push(item); });
    const suppliers = Object.keys(bySupplier);
    suppliers.forEach(function (supplierName, groupIndex) {
      let targetPo = po;
      if (po.supplier && po.supplier !== 'Supplier to confirm' && po.supplier !== supplierName) {
        const id = typeof nextPurchaseOrderId === 'function' ? nextPurchaseOrderId() : ('PO-' + Date.now() + '-' + groupIndex);
        targetPo = { id:id, supplier:supplierName, status:'Draft - Review', due:po.due, source:'Bulk supplier selection', reviewStatus:'Needs review', supplierEmailStatus:'Blocked until reviewed', originalSalesOrderId:po.originalSalesOrderId || '', customerId:po.customerId || '', customerName:po.customerName || '', customerShipTo:po.customerShipTo || '', lines:[] };
        data.purchaseOrders.push(targetPo);
      } else if (!po.supplier || po.supplier === 'Supplier to confirm') {
        po.supplier = supplierName;
      }
      bySupplier[supplierName].forEach(function (item) {
        const existing = (targetPo.lines || []).find(function (line) { return line.productId === item.product.id && !line.salesOrderId; });
        if (existing) existing.qty = Number(existing.qty || 0) + Number(item.qty || 1);
        else targetPo.lines.push({ productId:item.product.id, qty:Number(item.qty || 1), received:0, supplierSku:item.offer.supplierSku || item.product.supplierSku || '', unitCost:Number(item.cost || 0), orderedDate:typeof todayIso === 'function' ? todayIso() : new Date().toISOString().slice(0,10), dueDate:targetPo.due, leadTimeDays:Number(item.leadTime || 0), chaseStatus:'Waiting', nextChaseDate:typeof todayIso === 'function' ? todayIso() : new Date().toISOString().slice(0,10), supplierNotes:'Added through purchasing catalogue bulk selector.' });
      });
    });
    const count = poBasket.length;
    poBasket = [];
    if (typeof saveAppData === 'function') saveAppData();
    if (typeof toast === 'function') toast(count + ' product' + (count === 1 ? '' : 's') + ' added to purchase order workflow.');
    closePoPopover();
    if (typeof render === 'function') render();
  }
  function poPickerHtml(po) {
    const supplier = supplierProfileSafe(po.supplier);
    const credit = creditPosition(supplier);
    return '<section class="ci-po-catalogue-picker" aria-label="Purchase order catalogue intelligence"><div class="ci-po-picker-head"><div><span class="ci-eyebrow">Purchasing catalogue intelligence · v' + VERSION + '</span><h3>Find the exact product and best supplier offer</h3><p>Search parent products, variants, Pool Bros SKUs, supplier SKUs and barcodes. The current PO supplier is prioritised while lower-cost and preferred alternatives remain visible.</p></div>' + connectedBadge() + '</div><div class="ci-po-picker-grid"><label class="ci-search-field"><span>Search supplier catalogue</span><div class="ci-search-shell"><span class="ci-search-icon">⌕</span><input id="poProductSearch" data-po-id="' + esc(po.id) + '" autocomplete="off" spellcheck="true" aria-autocomplete="list" aria-expanded="false" placeholder="Product, size, SKU, supplier SKU or barcode"><button type="button" class="ci-search-clear" data-ci-po-clear="true">Clear</button></div></label><label class="ci-po-qty"><span>Quantity</span><input id="poProductQty" type="number" min="1" step="1" value="1" inputmode="numeric"></label><button type="button" class="ci-po-add" data-ci-po-add="' + esc(po.id) + '" disabled>Confirm selected list</button></div><div class="ci-shortcuts"><span>Quick search:</span><button type="button" data-ci-po-query="chlorine 5 kg">chlorine 5 kg</button><button type="button" data-ci-po-query="1.5 inch union">1.5 inch union</button><button type="button" data-ci-po-query="supplier SKU">supplier SKU</button><button type="button" data-ci-po-recent="true">Show catalogue</button></div><div class="ci-po-intelligence-strip"><div><span>Current supplier</span><strong>' + esc(po.supplier || 'To confirm') + '</strong></div><div><span>Supplier lead time</span><strong>' + Number(supplier.leadTimeDays || 0) + ' days</strong></div><div><span>Credit available</span><strong>' + cash(credit.available) + '</strong></div><div><span>Catalogue coverage</span><strong>' + activeProducts().length + ' active variants</strong></div></div><div id="ciPoSelectedOffer" class="ci-selected-offer" hidden></div></section>';
  }
  function enhancePurchaseOrderPicker() {
    const input = document.getElementById('poProductSearch');
    if (!input || !input.isConnected || input.closest('.ci-po-catalogue-picker')) return;
    const poId = input.dataset.poId;
    const po = typeof purchaseOrderById === 'function' ? purchaseOrderById(poId) : null;
    const host = input.closest('.po-add-items');
    if (!host || !po) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = poPickerHtml(po);
    host.replaceWith(wrapper.firstElementChild);
  }
  function showPoSuggestions(input) {
    if (!input || !input.isConnected) return;
    const po = typeof purchaseOrderById === 'function' ? purchaseOrderById(input.dataset.poId) : null;
    if (!po) return;
    const box = ensurePopover('po');
    poInput = input;
    poMatches = purchaseOffers(po, input.value).slice(0, 10);
    poActiveIndex = poMatches.length ? 0 : -1;
    box.innerHTML = '<div class="ci-mega-head"><div><strong>' + (normalise(input.value) ? 'Best supplier offers' : 'Available supplier catalogue') + '</strong><span>' + poMatches.length + ' ranked offers · current supplier and best value prioritised</span></div><span class="ci-key-hint">↑↓ navigate · Enter add · Esc close</span></div><div class="ci-mega-body"><section class="ci-mega-results"><div class="ci-mega-section-title"><strong>Search results</strong><span>Keep typing while this menu stays open</span></div><div class="ci-popover-results">' + (poMatches.length ? poMatches.map(poResultHtml).join('') : '<div class="ci-search-empty"><strong>No supplier catalogue offer matched</strong><p>Try the Pool Bros SKU, supplier SKU, barcode, size or fewer product words.</p></div>') + '</div></section><aside class="ci-po-basket"><div class="ci-mega-section-title"><strong>Selected products</strong><span>' + poBasket.length + ' lines · ' + basketTotalQty() + ' total units</span></div>' + basketHtml() + '<div class="ci-basket-footer"><button type="button" class="secondary" data-ci-basket-clear="true"' + (poBasket.length ? '' : ' disabled') + '>Clear list</button><button type="button" data-ci-basket-confirm="' + esc(po.id) + '"' + (poBasket.length ? '' : ' disabled') + '>Add list to PO</button></div></aside></div>';
    box.hidden = false;
    showSearchLayer(input);
    input.setAttribute('aria-expanded', 'true');
    positionPopover(box, input);
    setPoActive(0);
  }
  function setPoActive(index) {
    if (!poPopover) return;
    const rows = Array.from(poPopover.querySelectorAll('[data-ci-po-result]'));
    if (!rows.length) return;
    poActiveIndex = Math.max(0, Math.min(index, rows.length - 1));
    rows.forEach(function (row, rowIndex) {
      const active = rowIndex === poActiveIndex;
      row.classList.toggle('is-active', active);
      row.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    rows[poActiveIndex].scrollIntoView({ block: 'nearest' });
  }
  function closePoPopover() {
    if (poPopover) { poPopover.hidden = true; poPopover.remove(); }
    if (poInput && poInput.isConnected) poInput.setAttribute('aria-expanded', 'false');
    poPopover = null; poInput = null; poMatches = []; poActiveIndex = -1;
    tidySearchLayer();
  }
  function clearPoSelection(clearText) {
    const input = document.getElementById('poProductSearch');
    if (!input) return;
    input.dataset.selectedProductId = '';
    input.dataset.selectedSupplier = '';
    if (clearText) input.value = '';
    const selected = document.getElementById('ciPoSelectedOffer');
    if (selected) { selected.hidden = true; selected.innerHTML = ''; }
    const add = document.querySelector('[data-ci-po-add]');
    if (add) add.disabled = true;
    closePoPopover();
    input.focus({ preventScroll: true });
  }
  function selectPoOffer(input, row) {
    if (!input || !row) return;
    const qtyInput = document.getElementById('poProductQty');
    addOfferToBasket(row, qtyInput ? qtyInput.value : 1);
    if (qtyInput) qtyInput.value = '1';
    showPoSuggestions(input);
    input.focus({ preventScroll: true });
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(function () {
      enhanceProductHub();
      enhancePurchaseOrderPicker();
    }, 0);
  }

  if (typeof renderProducts === 'function') {
    const previousRenderProducts = renderProducts;
    renderProducts = function () {
      const result = previousRenderProducts.apply(this, arguments);
      scheduleEnhance();
      return result;
    };
  }
  if (typeof render === 'function') {
    const previousRender = render;
    render = function () {
      const result = previousRender.apply(this, arguments);
      scheduleEnhance();
      return result;
    };
  }

  document.addEventListener('input', function (event) {
    const hub = event.target.closest && event.target.closest('#ciHubSearch');
    if (hub) {
      event.stopImmediatePropagation();
      clearTimeout(hub._ciTimer);
      hub._ciTimer = setTimeout(function () { showHubSuggestions(hub); }, 90);
      return;
    }
    const po = event.target.closest && event.target.closest('#poProductSearch');
    if (po && po.closest('.ci-po-catalogue-picker')) {
      event.stopImmediatePropagation();
      clearTimeout(po._ciTimer);
      po._ciTimer = setTimeout(function () { showPoSuggestions(po); }, 90);
    }
  }, true);

  document.addEventListener('focusin', function (event) {
    const hub = event.target.closest && event.target.closest('#ciHubSearch');
    if (hub) { showHubSuggestions(hub); return; }
    const po = event.target.closest && event.target.closest('#poProductSearch');
    if (po && po.closest('.ci-po-catalogue-picker')) showPoSuggestions(po);
  }, true);

  document.addEventListener('keydown', function (event) {
    const hub = event.target.closest && event.target.closest('#ciHubSearch');
    if (hub) {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); }
      if (event.key === 'Escape') return closeHubPopover();
      if (event.key === 'ArrowDown') return setHubActive(hubActiveIndex + 1);
      if (event.key === 'ArrowUp') return setHubActive(hubActiveIndex <= 0 ? hubMatches.length - 1 : hubActiveIndex - 1);
      if (event.key === 'Enter') {
        const chosen = hubMatches[hubActiveIndex];
        if (event.altKey && chosen) applyHubQuery(hub.value, chosen.product);
        else applyHubQuery(hub.value, null);
      }
      return;
    }
    const po = event.target.closest && event.target.closest('#poProductSearch');
    if (po && po.closest('.ci-po-catalogue-picker')) {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); }
      if (event.key === 'Escape') return closePoPopover();
      if (event.key === 'ArrowDown') return setPoActive(poActiveIndex + 1);
      if (event.key === 'ArrowUp') return setPoActive(poActiveIndex <= 0 ? poMatches.length - 1 : poActiveIndex - 1);
      if (event.key === 'Enter') {
        const chosen = poMatches[Math.max(0, poActiveIndex)];
        if (chosen) selectPoOffer(po, chosen);
        else showPoSuggestions(po);
      }
    }
  }, true);

  document.addEventListener('keydown', function (event) {
    if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const active = document.activeElement;
      if (active && /input|textarea|select/i.test(active.tagName)) return;
      const target = document.getElementById('ciHubSearch') || document.getElementById('poProductSearch');
      if (target) { event.preventDefault(); target.focus(); }
    }
  });

  document.addEventListener('change', function (event) {
    const basketQty = event.target.closest && event.target.closest('[data-ci-basket-qty]');
    if (basketQty) { const item = poBasket.find(function (row) { return row.key === basketQty.dataset.ciBasketQty; }); if (item) item.qty = Math.max(1, Number(basketQty.value || 1)); const input = document.getElementById('poProductSearch') || poInput; if (input) showPoSuggestions(input); return; }
    const filter = event.target.closest && event.target.closest('[data-ci-hub-filter]');
    if (!filter) return;
    const state = window.poolShedProductHubState || (window.poolShedProductHubState = {});
    state[filter.dataset.ciHubFilter] = filter.value;
    if (typeof renderProducts === 'function') renderProducts();
  }, true);

  document.addEventListener('click', function (event) {
    const showAll = event.target.closest && event.target.closest('[data-ci-show-all]');
    if (showAll) {
      if (hubInput && hubInput.isConnected) applyHubQuery(hubInput.value, null);
      return;
    }
    const hubResult = event.target.closest && event.target.closest('[data-ci-hub-result]');
    if (hubResult) {
      event.preventDefault(); event.stopImmediatePropagation();
      const p = typeof product === 'function' ? product(hubResult.dataset.ciHubResult) : activeProducts().find(function (row) { return row.id === hubResult.dataset.ciHubResult; });
      if (p) applyHubQuery(p.sku || p.name, p);
      return;
    }
    if (event.target.closest && event.target.closest('[data-ci-hub-submit]')) {
      const input = document.getElementById('ciHubSearch');
      if (input) applyHubQuery(input.value, null);
      return;
    }
    if (event.target.closest && event.target.closest('[data-ci-hub-clear]')) {
      const input = document.getElementById('ciHubSearch');
      if (input) { input.value = ''; applyHubQuery('', null); }
      return;
    }
    const quick = event.target.closest && event.target.closest('[data-ci-query]');
    if (quick) {
      const input = document.getElementById('ciHubSearch');
      if (input) { input.value = quick.dataset.ciQuery; applyHubQuery(input.value, null); }
      return;
    }
    const clearFilter = event.target.closest && event.target.closest('[data-ci-clear-filter]');
    if (clearFilter) {
      const state = window.poolShedProductHubState || {};
      state[clearFilter.dataset.ciClearFilter] = '';
      if (typeof renderProducts === 'function') renderProducts();
      return;
    }
    if (event.target.closest && event.target.closest('[data-ci-reset-all]')) {
      const state = window.poolShedProductHubState || {};
      Object.assign(state, { query: '', category: '', supplier: '', stock: '', kind: '', sort: 'name' });
      closeHubPopover();
      if (typeof renderProducts === 'function') renderProducts();
      return;
    }
    const action = event.target.closest && event.target.closest('[data-ci-hub-action]');
    if (action) {
      if (action.dataset.ciHubAction === 'standalone') productView = 'create';
      if (action.dataset.ciHubAction === 'grouped') { productView = 'bulk'; if (typeof activeSubPage !== 'undefined') activeSubPage.products = 'Import Catalogue'; }
      if (action.dataset.ciHubAction === 'import') productView = 'bulk';
      if (typeof render === 'function') render();
      return;
    }
    const basketRemove = event.target.closest && event.target.closest('[data-ci-basket-remove]');
    if (basketRemove) {
      poBasket = poBasket.filter(function (item) { return item.key !== basketRemove.dataset.ciBasketRemove; });
      const input = document.getElementById('poProductSearch') || poInput;
      if (input) showPoSuggestions(input);
      return;
    }
    const basketClear = event.target.closest && event.target.closest('[data-ci-basket-clear]');
    if (basketClear) { poBasket = []; const input = document.getElementById('poProductSearch') || poInput; if (input) showPoSuggestions(input); return; }
    const basketConfirm = event.target.closest && event.target.closest('[data-ci-basket-confirm]');
    if (basketConfirm) { commitPoBasket(basketConfirm.dataset.ciBasketConfirm); return; }
    const poResult = event.target.closest && event.target.closest('[data-ci-po-result]');
    if (poResult) {
      event.preventDefault(); event.stopImmediatePropagation();
      const row = poMatches.find(function (candidate) { return candidate.product.id === poResult.dataset.ciPoResult && candidate.supplier.name === poResult.dataset.ciPoSupplier; });
      const input = document.getElementById('poProductSearch') || poInput;
      if (row) selectPoOffer(input, row);
      return;
    }
    if (event.target.closest && event.target.closest('[data-ci-po-clear]')) { clearPoSelection(true); return; }
    if (event.target.closest && event.target.closest('[data-ci-po-change]')) { clearPoSelection(true); return; }
    const poQuery = event.target.closest && event.target.closest('[data-ci-po-query]');
    if (poQuery) {
      const input = document.getElementById('poProductSearch');
      if (input) { clearPoSelection(true); input.value = poQuery.dataset.ciPoQuery; showPoSuggestions(input); }
      return;
    }
    if (event.target.closest && event.target.closest('[data-ci-po-recent]')) {
      const input = document.getElementById('poProductSearch');
      if (input) { clearPoSelection(true); showPoSuggestions(input); }
      return;
    }
    const poAdd = event.target.closest && event.target.closest('[data-ci-po-add]');
    if (poAdd) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!poBasket.length) return;
      commitPoBasket(poAdd.dataset.ciPoAdd);
      return;
    }
    if (hubPopover && !hubPopover.contains(event.target) && (!hubInput || event.target !== hubInput)) closeHubPopover();
    if (poPopover && !poPopover.contains(event.target) && (!poInput || event.target !== poInput)) closePoPopover();
  }, true);

  window.addEventListener('resize', function () {
    if (hubPopover && hubInput) positionPopover(hubPopover, hubInput, 420);
    if (poPopover && poInput) positionPopover(poPopover, poInput, 520);
  }, { passive: true });

  window.addEventListener('online', scheduleEnhance);
  window.addEventListener('offline', scheduleEnhance);

  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.PoolShedCatalogueIntelligence = {
    version: VERSION,
    normalise: normalise,
    rankProducts: rankProducts,
    purchaseOffers: purchaseOffers,
    activeProducts: activeProducts,
    applyHubQuery: applyHubQuery
  };

  setTimeout(function () {
    scheduleEnhance();
    if (typeof activeTab !== 'undefined' && (activeTab === 'products' || activeTab === 'purchase') && typeof render === 'function') render();
  }, 0);
})();
