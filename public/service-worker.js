const CACHE = 'pool-shed-v1.32.1-elite-quote-builder';
const CORE = ["./","./index.html","./assets/img/pb-logo.png","./assets/css/app.css?v=1.32.1","./config.js?v=1.32.1","./identity-authority.js?v=1.32.1","./audit-authority.js?v=1.32.1","./assets/js/01-legacy-01.js?v=1.32.1","./assets/js/02-legacy-02.js?v=1.32.1","./assets/js/03-pb-import-governance-v192.js?v=1.32.1","./assets/js/04-pb-product-profile-v196-fix.js?v=1.32.1","./assets/js/05-pb-v1100-inventory-product-hub.js?v=1.32.1","./product-images.js?v=1.32.1","./sales-order-search.js?v=1.32.1","./catalogue-intelligence.js?v=1.32.1","./partial-fulfilment.js?v=1.32.1","./assets/js/06-pb-product-title-persistence-v115-fix.js?v=1.32.1","./bundle-engine.js?v=1.32.1","./bundle-system.js?v=1.32.1","./bundle-studio.js?v=1.32.1","./bundle-sales-intelligence.js?v=1.32.1","./pool-shed-overhaul.js?v=1.32.1","./sales-order-customer-picker.js?v=1.32.1","./professional-workspace.js?v=1.32.1","./accounting-workspace.js?v=1.32.1","./finance-command-engine.js?v=1.32.1","./finance-command-workspace.js?v=1.32.1","./analytics-command-engine.js?v=1.32.1","./analytics-command-workspace.js?v=1.32.1","./settings-permissions-engine.js?v=1.32.1","./record-router.js?v=1.32.1","./notifications-command-engine.js?v=1.32.1","./action-authority.js?v=1.32.1","./approval-authority.js?v=1.32.1","./action-approval-integrations.js?v=1.32.1","./action-source-adapters.js?v=1.32.1","./my-work-workspace.js?v=1.32.1","./notifications-command-workspace.js?v=1.32.1","./assistant-engine.js?v=1.32.1","./automation-command-engine.js?v=1.32.1","./automation-command-workspace.js?v=1.32.1","./production-readiness-engine.js?v=1.32.1","./settings-command-workspace.js?v=1.32.1","./project-engine.js?v=1.32.1","./project-documents.js?v=1.32.1","./project-billing.js?v=1.32.1","./project-workspace.js?v=1.32.1","./sales-workspace.js?v=1.32.1","./warehouse-workspace.js?v=1.32.1","./purchase-workspace.js?v=1.32.1","./supplier-command-engine.js?v=1.32.1","./supplier-command-workspace.js?v=1.32.1","./product-hub-engine.js?v=1.32.1","./product-hub-workspace.js?v=1.32.1","./inventory-control-engine.js?v=1.32.1","./inventory-workspace.js?v=1.32.1","./fulfilment-control-engine.js?v=1.32.1","./fulfilment-workspace.js?v=1.32.1","./dashboard-review-engine.js?v=1.32.1","./business-review.js?v=1.32.1","./quarterly-review.js?v=1.32.1","./quote-studio.css?v=1.32.1","./quote-studio-engine.js?v=1.32.1","./quote-studio-workspace.js?v=1.32.1","./proposal.html","./quote-customer-portal.css?v=1.32.1","./quote-customer-portal.js?v=1.32.1"];
const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(async cache => {
        await cache.addAll(CORE);
        try { await cache.add(SUPABASE_CDN); } catch (_) {}
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const request = event.request;
  const url = new URL(request.url);
  // Financial and authenticated responses must never enter the offline cache.
  if (url.pathname.startsWith('/api/') || request.headers.has('Authorization')) return;
  const isNavigation = request.mode === 'navigate' || request.destination === 'document';

  if (isNavigation) {
    const isCustomerProposal = url.pathname.endsWith('/proposal.html') || url.pathname.endsWith('/proposal');
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then(cache => cache.put(isCustomerProposal ? request : './index.html', copy)));
          }
          return response;
        })
        .catch(() => isCustomerProposal
          ? caches.match(request).then(match => match || Response.error())
          : caches.match('./index.html').then(match => match || caches.match('./')))
    );
    return;
  }

  if (url.origin === location.origin || url.href.startsWith(SUPABASE_CDN)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
        }
        return response;
      }))
    );
  }
});
