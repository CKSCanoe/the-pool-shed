const CACHE = 'pool-shed-v1.47.5-quiet-shared-autosave';
const CORE = ["./","./index.html","./commercial-audits/index.html","./commercial-audits/embedded.css?v=1.47.5","./assets/img/pb-logo.png","./assets/css/app.css?v=1.47.5","./config.js?v=1.47.5","./identity-authority.js?v=1.47.5","./audit-authority.js?v=1.47.5","./assets/js/01-legacy-01.js?v=1.47.5","./shared-one-truth-authority.js?v=1.47.5","./assets/js/02-legacy-02.js?v=1.47.5","./assets/js/03-pb-import-governance-v192.js?v=1.47.5","./assets/js/04-pb-product-profile-v196-fix.js?v=1.47.5","./assets/js/05-pb-v1100-inventory-product-hub.js?v=1.47.5","./business-media.js?v=1.47.5","./product-images.js?v=1.47.5","./sales-order-search.js?v=1.47.5","./catalogue-intelligence.js?v=1.47.5","./partial-fulfilment.js?v=1.47.5","./assets/js/06-pb-product-title-persistence-v115-fix.js?v=1.47.5","./bundle-engine.js?v=1.47.5","./bundle-system.js?v=1.47.5","./bundle-studio.js?v=1.47.5","./bundle-sales-intelligence.js?v=1.47.5","./pool-shed-overhaul.js?v=1.47.5","./sales-order-customer-picker.js?v=1.47.5","./professional-workspace.js?v=1.47.5","./accounting-workspace.js?v=1.47.5","./finance-command-engine.js?v=1.47.5","./finance-command-workspace.js?v=1.47.5","./analytics-command-engine.js?v=1.47.5","./analytics-command-workspace.js?v=1.47.5","./settings-permissions-engine.js?v=1.47.5","./record-router.js?v=1.47.5","./notifications-command-engine.js?v=1.47.5","./action-authority.js?v=1.47.5","./approval-authority.js?v=1.47.5","./action-approval-integrations.js?v=1.47.5","./action-source-adapters.js?v=1.47.5","./my-work-workspace.js?v=1.47.5","./notifications-command-workspace.js?v=1.47.5","./automation-command-engine.js?v=1.47.5","./automation-command-workspace.js?v=1.47.5","./azzy-jarvis-host.js?v=1.47.5","./azzy-jarvis.css?v=1.47.5-startup-v1","./assets/img/azzy-jarvis-64.png","./assets/img/azzy-jarvis-192.png","./production-readiness-engine.js?v=1.47.5","./settings-command-workspace.js?v=1.47.5","./project-engine.js?v=1.47.5","./project-documents.js?v=1.47.5","./project-billing.js?v=1.47.5","./project-workspace.js?v=1.47.5","./project-design-parity.js?v=1.47.5","./project-setup-tools.js?v=1.47.5","./sales-workspace.js?v=1.47.5","./warehouse-workspace.js?v=1.47.5","./purchase-workspace.js?v=1.47.5","./supplier-command-engine.js?v=1.47.5","./supplier-command-workspace.js?v=1.47.5","./product-hub-engine.js?v=1.47.5","./product-hub-workspace.js?v=1.47.5","./inventory-control-engine.js?v=1.47.5","./inventory-workspace.js?v=1.47.5","./fulfilment-control-engine.js?v=1.47.5","./fulfilment-workspace.js?v=1.47.5","./dashboard-review-engine.js?v=1.47.5","./business-review.js?v=1.47.5","./quarterly-review.js?v=1.47.5","./quote-studio.css?v=1.47.5","./quote-studio-engine.js?v=1.47.5","./quote-studio-workspace.js?v=1.47.5","./proposal.html","./quote-customer-portal.css?v=1.47.5","./quote-customer-portal.js?v=1.47.5"];
const BOOT_CORE = [
  './',
  './index.html',
  './assets/img/pb-logo.png',
  './assets/css/app.css?v=1.47.5',
  './config.js?v=1.47.5',
  './identity-authority.js?v=1.47.5',
  './settings-permissions-engine.js?v=1.47.5',
  './azzy-jarvis-host.js?v=1.47.5',
  './azzy-jarvis.css?v=1.47.5-startup-v1',
  './assets/img/azzy-jarvis-192.png'
];
CORE.push('./audit-offline-media.js?v=1.47.5');
CORE.push(...[
  './commercial-audits/assets/pb-logo.png',
  './commercial-audits/src/theme.css',
  './commercial-audits/src/report-guidance.js',
  './commercial-audits/src/report-evidence.js',
  './commercial-audits/src/asset-report.js',
  './commercial-audits/src/brand.js',
  './commercial-audits/src/audit-model.js',
  './commercial-audits/vendor/react.production.min.js',
  './commercial-audits/vendor/react-dom.production.min.js',
  './commercial-audits/vendor/babel.min.js',
  './commercial-audits/vendor/tailwindcss.js',
  './commercial-audits/vendor/jspdf.umd.min.js',
  './commercial-audits/vendor/jspdf.plugin.autotable.min.js'
]);
const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

self.addEventListener('install', event => {
  // Cold start stays intentionally small. The old installer fetched the whole
  // application while the page was fetching the same files, doubling network
  // contention on a first visit. Runtime assets are warmed after the app opens.
  event.waitUntil(
    caches.open(CACHE)
      .then(async cache => {
        await cache.addAll(BOOT_CORE.map(url => new Request(url, { cache: 'reload' })));
        try { await cache.add(SUPABASE_CDN); } catch (_) {}
      })
      .then(() => self.skipWaiting())
  );
});

let runtimeWarmPromise = null;
async function warmRuntimeCache() {
  if (runtimeWarmPromise) return runtimeWarmPromise;
  runtimeWarmPromise = (async () => {
    const cache = await caches.open(CACHE);
    const remaining = CORE.filter(url => !BOOT_CORE.includes(url));
    const concurrency = 3;
    let cursor = 0;
    async function worker() {
      while (cursor < remaining.length) {
        const url = remaining[cursor++];
        try {
          const request = new Request(url, { cache: 'reload' });
          const existing = await cache.match(request);
          if (existing) continue;
          const response = await fetch(request);
          if (response && response.ok) await cache.put(request, response.clone());
        } catch (_) {}
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    return true;
  })().finally(() => { runtimeWarmPromise = null; });
  return runtimeWarmPromise;
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'POOL_SHED_PREPARE_OFFLINE') {
    event.waitUntil((async () => {
      const missing = [];
      try {
        await warmRuntimeCache();
        const cache = await caches.open(CACHE);
        for (const url of CORE) if (!await cache.match(url)) missing.push(url);
        if (!await cache.match(SUPABASE_CDN)) missing.push('sign-in library');
      } catch (error) { missing.push(error.message || 'Offline cache failed'); }
      event.ports[0]?.postMessage({ ok: missing.length === 0, missing });
    })());
    return;
  }
  if (!event.data || event.data.type !== 'POOL_SHED_WARM_RUNTIME') return;
  event.waitUntil(warmRuntimeCache());
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
  const isVersionedRuntimeAsset = url.origin === location.origin &&
    url.searchParams.has('v') &&
    (request.destination === 'style' || request.destination === 'script' || /\.(?:css|js)$/.test(url.pathname));

  if (isNavigation) {
    const isCustomerProposal = url.pathname.endsWith('/proposal.html') || url.pathname.endsWith('/proposal');
    const isCommercialAudit = /^\/commercial-audits(?:\/|\/index\.html)?$/.test(url.pathname);
    if (!isCustomerProposal) {
      // The signed-in shell and survey must open from the prepared cache even
      // when a browser refuses to start a navigation request while offline.
      // Vercel redirects clean .html URLs. A redirected cached Response cannot
      // be returned for a service-worker navigation, so clear its redirect flag.
      event.respondWith((async () => {
        const key = isCommercialAudit ? './commercial-audits/index.html' : './index.html';
        const cached = await caches.match(key);
        if (cached) return cached.redirected
          ? new Response(await cached.blob(), { status:cached.status, statusText:cached.statusText, headers:cached.headers })
          : cached;
        try {
          const response = await fetch(request);
          if (response.ok) event.waitUntil(caches.open(CACHE).then(cache => cache.put(key, response.clone())));
          return response;
        } catch (_) { return Response.error(); }
      })());
      return;
    }
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then(cache => cache.put(isCustomerProposal ? request : (isCommercialAudit ? './commercial-audits/index.html' : './index.html'), copy)));
          }
          return response;
        })
        .catch(() => isCustomerProposal
          ? caches.match(request).then(match => match || Response.error())
          : isCommercialAudit
            ? caches.match('./commercial-audits/index.html').then(match => match || Response.error())
            : caches.match('./index.html').then(match => match || caches.match('./')))
    );
    return;
  }

  // Versioned runtime CSS/JS is network-first. This prevents an installed client
  // from pinning an older stylesheet when a deployment changes an asset without
  // changing the public release query string. Cached copies remain the offline fallback.
  if (isVersionedRuntimeAsset) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
          }
          return response;
        })
        .catch(() => caches.match(request).then(match => match || Response.error()))
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
