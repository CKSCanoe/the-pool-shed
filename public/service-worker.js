const CACHE = 'pool-shed-v1.46.0-css-authority-commercial-audits';
const CORE = ["./","./index.html","./commercial-audits/index.html","./commercial-audits/embedded.css?v=1.46.0","./assets/img/pb-logo.png","./assets/css/app.css?v=1.46.0","./config.js?v=1.46.0","./identity-authority.js?v=1.46.0","./audit-authority.js?v=1.46.0","./assets/js/01-legacy-01.js?v=1.46.0","./shared-one-truth-authority.js?v=1.46.0","./assets/js/02-legacy-02.js?v=1.46.0","./assets/js/03-pb-import-governance-v192.js?v=1.46.0","./assets/js/04-pb-product-profile-v196-fix.js?v=1.46.0","./assets/js/05-pb-v1100-inventory-product-hub.js?v=1.46.0","./business-media.js?v=1.46.0","./product-images.js?v=1.46.0","./sales-order-search.js?v=1.46.0","./catalogue-intelligence.js?v=1.46.0","./partial-fulfilment.js?v=1.46.0","./assets/js/06-pb-product-title-persistence-v115-fix.js?v=1.46.0","./bundle-engine.js?v=1.46.0","./bundle-system.js?v=1.46.0","./bundle-studio.js?v=1.46.0","./bundle-sales-intelligence.js?v=1.46.0","./pool-shed-overhaul.js?v=1.46.0","./sales-order-customer-picker.js?v=1.46.0","./professional-workspace.js?v=1.46.0","./accounting-workspace.js?v=1.46.0","./finance-command-engine.js?v=1.46.0","./finance-command-workspace.js?v=1.46.0","./analytics-command-engine.js?v=1.46.0","./analytics-command-workspace.js?v=1.46.0","./settings-permissions-engine.js?v=1.46.0","./record-router.js?v=1.46.0","./notifications-command-engine.js?v=1.46.0","./action-authority.js?v=1.46.0","./approval-authority.js?v=1.46.0","./action-approval-integrations.js?v=1.46.0","./action-source-adapters.js?v=1.46.0","./my-work-workspace.js?v=1.46.0","./notifications-command-workspace.js?v=1.46.0","./automation-command-engine.js?v=1.46.0","./automation-command-workspace.js?v=1.46.0","./azzy-jarvis-host.js?v=1.46.0","./azzy-jarvis.css?v=1.46.0-startup-v1","./assets/img/azzy-jarvis-64.png","./assets/img/azzy-jarvis-192.png","./production-readiness-engine.js?v=1.46.0","./settings-command-workspace.js?v=1.46.0","./project-engine.js?v=1.46.0","./project-documents.js?v=1.46.0","./project-billing.js?v=1.46.0","./project-workspace.js?v=1.46.0","./project-design-parity.js?v=1.46.0","./project-setup-tools.js?v=1.46.0","./sales-workspace.js?v=1.46.0","./warehouse-workspace.js?v=1.46.0","./purchase-workspace.js?v=1.46.0","./supplier-command-engine.js?v=1.46.0","./supplier-command-workspace.js?v=1.46.0","./product-hub-engine.js?v=1.46.0","./product-hub-workspace.js?v=1.46.0","./inventory-control-engine.js?v=1.46.0","./inventory-workspace.js?v=1.46.0","./fulfilment-control-engine.js?v=1.46.0","./fulfilment-workspace.js?v=1.46.0","./dashboard-review-engine.js?v=1.46.0","./business-review.js?v=1.46.0","./quarterly-review.js?v=1.46.0","./quote-studio.css?v=1.46.0","./quote-studio-engine.js?v=1.46.0","./quote-studio-workspace.js?v=1.46.0","./proposal.html","./quote-customer-portal.css?v=1.46.0","./quote-customer-portal.js?v=1.46.0"];
const BOOT_CORE = [
  './',
  './index.html',
  './assets/img/pb-logo.png',
  './assets/css/app.css?v=1.46.0',
  './config.js?v=1.46.0',
  './identity-authority.js?v=1.46.0',
  './settings-permissions-engine.js?v=1.46.0',
  './azzy-jarvis-host.js?v=1.46.0',
  './azzy-jarvis.css?v=1.46.0-startup-v1',
  './assets/img/azzy-jarvis-192.png'
];
CORE.push(...[
  './commercial-audits/assets/pb-logo.png',
  './commercial-audits/src/theme.css',
  './commercial-audits/src/report-guidance.cjs',
  './commercial-audits/src/report-evidence.cjs',
  './commercial-audits/src/asset-report.cjs',
  './commercial-audits/src/brand.cjs',
  './commercial-audits/src/audit-model.cjs',
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
    const isCommercialAudit = url.pathname.endsWith('/commercial-audits/index.html');
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
