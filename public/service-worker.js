const CACHE = 'pool-shed-v1.7.0-asset-freshness';
const CORE = ["./", "./index.html", "./assets/img/pb-logo.png", "./dashboard-review-engine.js", "./quarterly-review.js", "./business-review.js", "./sales-workspace.js?v=1.7.0", "./project-billing.js", "./project-engine.js", "./project-documents.js", "./project-workspace.js", "./accounting-workspace.js", "./professional-workspace.js", "./assets/css/app.css?v=1.7.0", "./config.js", "./product-images.js", "./sales-order-search.js", "./partial-fulfilment.js", "./catalogue-intelligence.js", "./pool-shed-overhaul.js", "./sales-order-customer-picker.js", "./bundle-system.js", "./bundle-studio.js", "./bundle-engine.js", "./bundle-sales-intelligence.js", "./assets/js/01-legacy-01.js", "./assets/js/02-legacy-02.js", "./assets/js/03-pb-import-governance-v192.js", "./assets/js/04-pb-product-profile-v196-fix.js", "./assets/js/05-pb-v1100-inventory-product-hub.js", "./assets/js/06-pb-product-title-persistence-v115-fix.js"];
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
