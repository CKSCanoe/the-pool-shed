const CACHE = 'pool-shed-v1.47.2-quiet-shared-autosave';
const CORE = ["./","./index.html","./commercial-audits/index.html","./commercial-audits/embedded.css?v=1.47.2","./assets/img/pb-logo.png","./assets/css/app.css?v=1.47.2","./config.js?v=1.47.2","./identity-authority.js?v=1.47.2","./audit-authority.js?v=1.47.2","./assets/js/01-legacy-01.js?v=1.47.2","./shared-one-truth-authority.js?v=1.47.2","./assets/js/02-legacy-02.js?v=1.47.2","./assets/js/03-pb-import-governance-v192.js?v=1.47.2","./assets/js/04-pb-product-profile-v196-fix.js?v=1.47.2","./assets/js/05-pb-v1100-inventory-product-hub.js?v=1.47.2","./business-media.js?v=1.47.2","./product-images.js?v=1.47.2","./sales-order-search.js?v=1.47.2","./catalogue-intelligence.js?v=1.47.2","./partial-fulfilment.js?v=1.47.2","./assets/js/06-pb-product-title-persistence-v115-fix.js?v=1.47.2","./bundle-engine.js?v=1.47.2","./bundle-system.js?v=1.47.2","./bundle-studio.js?v=1.47.2","./bundle-sales-intelligence.js?v=1.47.2","./pool-shed-overhaul.js?v=1.47.2","./sales-order-customer-picker.js?v=1.47.2","./professional-workspace.js?v=1.47.2","./accounting-workspace.js?v=1.47.2","./finance-command-engine.js?v=1.47.2","./finance-command-workspace.js?v=1.47.2","./analytics-command-engine.js?v=1.47.2","./analytics-command-workspace.js?v=1.47.2","./settings-permissions-engine.js?v=1.47.2","./record-router.js?v=1.47.2","./notifications-command-engine.js?v=1.47.2","./action-authority.js?v=1.47.2","./approval-authority.js?v=1.47.2","./action-approval-integrations.js?v=1.47.2","./action-source-adapters.js?v=1.47.2","./my-work-workspace.js?v=1.47.2","./notifications-command-workspace.js?v=1.47.2","./automation-command-engine.js?v=1.47.2","./automation-command-workspace.js?v=1.47.2","./azzy-jarvis-host.js?v=1.47.2","./azzy-jarvis.css?v=1.47.2-startup-v1","./assets/img/azzy-jarvis-64.png","./assets/img/azzy-jarvis-192.png","./production-readiness-engine.js?v=1.47.2","./settings-command-workspace.js?v=1.47.2","./project-engine.js?v=1.47.2","./project-documents.js?v=1.47.2","./project-billing.js?v=1.47.2","./project-workspace.js?v=1.47.2","./project-design-parity.js?v=1.47.2","./project-setup-tools.js?v=1.47.2","./sales-workspace.js?v=1.47.2","./warehouse-workspace.js?v=1.47.2","./purchase-workspace.js?v=1.47.2","./supplier-command-engine.js?v=1.47.2","./supplier-command-workspace.js?v=1.47.2","./product-hub-engine.js?v=1.47.2","./product-hub-workspace.js?v=1.47.2","./inventory-control-engine.js?v=1.47.2","./inventory-workspace.js?v=1.47.2","./fulfilment-control-engine.js?v=1.47.2","./fulfilment-workspace.js?v=1.47.2","./dashboard-review-engine.js?v=1.47.2","./business-review.js?v=1.47.2","./quarterly-review.js?v=1.47.2","./quote-studio.css?v=1.47.2","./quote-studio-engine.js?v=1.47.2","./quote-studio-workspace.js?v=1.47.2","./proposal.html","./quote-customer-portal.css?v=1.47.2","./quote-customer-portal.js?v=1.47.2"];
const BOOT_CORE = [
  './',
  './index.html',
  './assets/img/pb-logo.png',
  './assets/css/app.css?v=1.47.2',
  './config.js?v=1.47.2',
  './identity-authority.js?v=1.47.2',
  './settings-permissions-engine.js?v=1.47.2',
  './azzy-jarvis-host.js?v=1.47.2',
  './azzy-jarvis.css?v=1.47.2-startup-v1',
  './assets/img/azzy-jarvis-192.png'
];
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
