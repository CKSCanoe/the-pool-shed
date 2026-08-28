/* Pool Shed v1.11.4 parent and variant product images */
(function () {
  'use strict';

  const VERSION = '1.11.4';

  function text(value) { return String(value == null ? '' : value); }
  function escapeHtmlSafe(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(text(value));
    return text(value).replace(/[&<>"']/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
    });
  }
  function allProducts() {
    try { return Array.isArray(data.products) ? data.products : []; } catch (_) { return []; }
  }
  function parentRecords() {
    try {
      const list = data.productParents || data.product_parents;
      return Array.isArray(list) ? list : [];
    } catch (_) { return []; }
  }
  function groupKey(productRecord) {
    if (!productRecord) return '';
    return text(productRecord.parentSku || productRecord.parent_sku || productRecord.sisterKey || productRecord.sku || productRecord.id);
  }
  function groupMembers(productRecord) {
    const key = groupKey(productRecord);
    if (!key) return productRecord ? [productRecord] : [];
    return allProducts().filter(function (candidate) {
      return candidate && !candidate.deleted && groupKey(candidate) === key;
    });
  }
  function isGrouped(productRecord) {
    return Boolean(productRecord && (productRecord.parentSku || productRecord.parent_sku || groupMembers(productRecord).length > 1));
  }
  function parentRecord(productRecord) {
    if (!productRecord) return null;
    const parentId = productRecord.parentProductId || productRecord.parent_product_id;
    const parentSku = productRecord.parentSku || productRecord.parent_sku;
    return parentRecords().find(function (parent) {
      return (parentId && (parent.id === parentId || parent.parentProductId === parentId)) ||
        (parentSku && text(parent.parentSku || parent.parent_sku).toLowerCase() === text(parentSku).toLowerCase());
    }) || null;
  }
  function validImageUrl(value) {
    const raw = text(value).trim();
    if (!raw) return '';
    try {
      const parsed = new URL(raw, window.location && window.location.href ? window.location.href : 'https://the-pool-shed.vercel.app/');
      if (!['http:', 'https:', 'data:', 'blob:'].includes(parsed.protocol)) return '';
      if (parsed.protocol === 'data:' && !/^data:image\//i.test(raw)) return '';
      return raw;
    } catch (_) { return ''; }
  }
  function explicitParentImageUrl(productRecord) {
    if (!productRecord) return '';
    const parent = parentRecord(productRecord) || {};
    const parentValue = parent.defaultImageUrl || parent.default_image_url || parent.imageUrl || parent.image_url;
    if (validImageUrl(parentValue)) return validImageUrl(parentValue);
    const member = groupMembers(productRecord).find(function (item) {
      return validImageUrl(item.parentImageUrl || item.parent_image_url || item.defaultImageUrl || item.default_image_url);
    });
    return member ? validImageUrl(member.parentImageUrl || member.parent_image_url || member.defaultImageUrl || member.default_image_url) : '';
  }
  function parentImageUrl(productRecord) {
    const explicit = explicitParentImageUrl(productRecord);
    if (explicit) return explicit;
    const members = groupMembers(productRecord);
    const defaultVariant = members.find(function (item) {
      return item.isDefaultVariant === true || item.defaultVariant === true || text(item.defaultVariant).toLowerCase() === 'true';
    });
    const candidates = defaultVariant ? [defaultVariant].concat(members.filter(function (item) { return item !== defaultVariant; })) : members;
    for (const item of candidates) {
      const url = validImageUrl(item.variantImageUrl || item.variant_image_url || item.imageUrl || item.image_url);
      if (url) return url;
    }
    return '';
  }
  function variantImageUrl(productRecord) {
    if (!productRecord) return '';
    return validImageUrl(productRecord.variantImageUrl || productRecord.variant_image_url || productRecord.imageUrl || productRecord.image_url) || parentImageUrl(productRecord);
  }
  function imageAlt(productRecord, mode, override) {
    if (override) return text(override);
    if (!productRecord) return 'Pool Bros product';
    if (mode === 'parent') return text(productRecord.parentName || productRecord.parent_name || productRecord.name || 'Pool Bros product');
    return text(productRecord.imageAlt || productRecord.image_alt || productRecord.name || productRecord.parentName || 'Pool Bros product');
  }
  function markup(productRecord, options) {
    options = options || {};
    const mode = options.mode === 'parent' ? 'parent' : 'variant';
    const url = mode === 'parent' ? parentImageUrl(productRecord) : variantImageUrl(productRecord);
    const className = text(options.className || '').trim();
    const size = text(options.size || 'md').trim();
    const classes = ['pb-product-image', 'pb-product-image-' + size, className, url ? 'has-image' : 'is-fallback'].filter(Boolean).join(' ');
    const alt = imageAlt(productRecord, mode, options.alt);
    return '<span class="' + escapeHtmlSafe(classes) + '" data-product-image-shell="true" data-image-mode="' + mode + '">' +
      (url ? '<img data-product-image="true" src="' + escapeHtmlSafe(url) + '" alt="' + escapeHtmlSafe(alt) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') +
      '<span class="pb-product-image-fallback" aria-hidden="' + (url ? 'true' : 'false') + '">PB</span></span>';
  }
  function setParentImage(productRecord, value) {
    if (!productRecord) return;
    const clean = text(value).trim();
    const members = groupMembers(productRecord);
    (members.length ? members : [productRecord]).forEach(function (item) { item.parentImageUrl = clean; });
    const parent = parentRecord(productRecord);
    if (parent) parent.defaultImageUrl = clean;
  }
  function refreshPreview(field, mode) {
    const productId = field && (field.dataset.parentImageUrl || (field.dataset.productField || '').split('|')[0]);
    if (!productId) return;
    let productRecord = null;
    try { productRecord = typeof product === 'function' ? product(productId) : allProducts().find(function (item) { return item.id === productId; }); } catch (_) {}
    if (!productRecord) return;
    const escapedId = window.CSS && typeof window.CSS.escape === 'function' ? window.CSS.escape(productId) : text(productId).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    document.querySelectorAll('[data-product-image-preview="' + escapedId + '"][data-image-preview-mode="' + mode + '"]').forEach(function (preview) {
      preview.innerHTML = markup(productRecord, { mode: mode, className: 'product-profile-image-preview', size: 'xl' });
    });
  }

  document.addEventListener('error', function (event) {
    const image = event.target;
    if (!image || !image.matches || !image.matches('img[data-product-image="true"]')) return;
    const shell = image.closest('[data-product-image-shell="true"]');
    if (!shell) return;
    image.hidden = true;
    shell.classList.remove('has-image');
    shell.classList.add('is-fallback');
    const fallback = shell.querySelector('.pb-product-image-fallback');
    if (fallback) fallback.setAttribute('aria-hidden', 'false');
  }, true);

  document.addEventListener('input', function (event) {
    const field = event.target;
    if (!field || !field.matches) return;
    if (field.matches('[data-parent-image-url]')) {
      const id = field.dataset.parentImageUrl;
      let productRecord = null;
      try { productRecord = typeof product === 'function' ? product(id) : allProducts().find(function (item) { return item.id === id; }); } catch (_) {}
      setParentImage(productRecord, field.value);
      refreshPreview(field, 'parent');
      return;
    }
    if (field.matches('[data-product-field$="|imageUrl"], [data-product-field$="|variantImageUrl"]')) {
      window.setTimeout(function () { refreshPreview(field, 'variant'); }, 0);
    }
  });

  document.addEventListener('change', function (event) {
    const field = event.target;
    if (!field || !field.matches || !field.matches('[data-parent-image-url]')) return;
    const id = field.dataset.parentImageUrl;
    let productRecord = null;
    try { productRecord = typeof product === 'function' ? product(id) : allProducts().find(function (item) { return item.id === id; }); } catch (_) {}
    setParentImage(productRecord, field.value);
    if (typeof saveAppData === 'function') saveAppData();
  });

  window.PoolShedProductImages = {
    version: VERSION,
    groupKey: groupKey,
    groupMembers: groupMembers,
    isGrouped: isGrouped,
    explicitParentImageUrl: explicitParentImageUrl,
    parentImageUrl: parentImageUrl,
    variantImageUrl: variantImageUrl,
    validImageUrl: validImageUrl,
    markup: markup,
    setParentImage: setParentImage
  };
})();
