const CACHE = 'pool-shed-v1.40.0-quote-studio-command';
const CORE = ["./","./index.html","./assets/img/pb-logo.png","./assets/css/app.css?v=1.40.0","./config.js?v=1.40.0","./identity-authority.js?v=1.40.0","./audit-authority.js?v=1.40.0","./assets/js/01-legacy-01.js?v=1.40.0","./assets/js/02-legacy-02.js?v=1.40.0","./assets/js/03-pb-import-governance-v192.js?v=1.40.0","./assets/js/04-pb-product-profile-v196-fix.js?v=1.40.0","./assets/js/05-pb-v1100-inventory-product-hub.js?v=1.40.0","./business-media.js?v=1.40.0","./product-images.js?v=1.40.0","./sales-order-search.js?v=1.40.0","./catalogue-intelligence.js?v=1.40.0","./partial-fulfilment.js?v=1.40.0","./assets/js/06-pb-product-title-persistence-v115-fix.js?v=1.40.0","./bundle-engine.js?v=1.40.0","./bundle-system.js?v=1.40.0","./bundle-studio.js?v=1.40.0","./bundle-sales-intelligence.js?v=1.40.0","./pool-shed-overhaul.js?v=1.40.0","./sales-order-customer-picker.js?v=1.40.0","./professional-workspace.js?v=1.40.0","./accounting-workspace.js?v=1.40.0","./finance-command-engine.js?v=1.40.0","./finance-command-workspace.js?v=1.40.0","./analytics-command-engine.js?v=1.40.0","./analytics-command-workspace.js?v=1.40.0","./settings-permissions-engine.js?v=1.40.0","./record-router.js?v=1.40.0","./notifications-command-engine.js?v=1.40.0","./action-authority.js?v=1.40.0","./approval-authority.js?v=1.40.0","./action-approval-integrations.js?v=1.40.0","./action-source-adapters.js?v=1.40.0","./my-work-workspace.js?v=1.40.0","./notifications-command-workspace.js?v=1.40.0","./assistant-engine.js?v=1.40.0","./automation-command-engine.js?v=1.40.0","./automation-command-workspace.js?v=1.40.0","./production-readiness-engine.js?v=1.40.0","./settings-command-workspace.js?v=1.40.0","./project-engine.js?v=1.40.0","./project-documents.js?v=1.40.0","./project-billing.js?v=1.40.0","./project-workspace.js?v=1.40.0","./sales-workspace.js?v=1.40.0","./warehouse-workspace.js?v=1.40.0","./purchase-workspace.js?v=1.40.0","./supplier-command-engine.js?v=1.40.0","./supplier-command-workspace.js?v=1.40.0","./product-hub-engine.js?v=1.40.0","./product-hub-workspace.js?v=1.40.0","./inventory-control-engine.js?v=1.40.0","./inventory-workspace.js?v=1.40.0","./fulfilment-control-engine.js?v=1.40.0","./fulfilment-workspace.js?v=1.40.0","./dashboard-review-engine.js?v=1.40.0","./business-review.js?v=1.40.0","./quarterly-review.js?v=1.40.0","./quote-studio.css?v=1.40.0","./quote-studio-engine.js?v=1.40.0","./quote-studio-workspace.js?v=1.40.0","./proposal.html","./quote-customer-portal.css?v=1.40.0","./quote-customer-portal.js?v=1.40.0"];
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
