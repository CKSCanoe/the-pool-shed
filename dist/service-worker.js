const CACHE = 'verified-v1-sales-workspace-v1-projects-v1-accounting-v1-performance-v1-professional-workspace-v1-receipt-ledger-v1-pool-shed-app-v1-po-picker-modal-final-sales-table-header-fix-smart-customer-picker-professional-palette-v1-css-system-v1-precision-foundation-v1-dashboard-command-v1-commercial-dashboard-v1-dashboard-reference-v1';
const CORE = ['./assets/img/pb-logo.png', './dashboard-review-engine.js', './quarterly-review.js', './business-review.js', './sales-workspace.js', './project-billing.js', './project-engine.js', './project-documents.js', './project-workspace.js', './accounting-workspace.js', './professional-workspace.js', './', './index.html', './assets/css/app.css', './config.js', './product-images.js', './sales-order-search.js', './partial-fulfilment.js', './catalogue-intelligence.js', './pool-shed-overhaul.js', './sales-order-customer-picker.js', './bundle-system.js', './bundle-studio.js', './bundle-engine.js', './bundle-sales-intelligence.js'];
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
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then(cache => cache.put('./index.html', copy)));
          }
          return response;
        })
        .catch(() => caches.match('./index.html').then(match => match || caches.match('./')))
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
