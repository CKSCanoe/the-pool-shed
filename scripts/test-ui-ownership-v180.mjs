import fs from 'node:fs';
import path from 'node:path';
import { CSS_MODULES } from './css-modules.mjs';

const root = process.cwd();
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const html = read('public', 'index.html');
const sw = read('public', 'service-worker.js');
const overhaul = read('public', 'pool-shed-overhaul.js');
const legacyCss = read('public', 'assets', 'css', 'system', '10-legacy-compat.css');
const designCss = read('public', 'assets', 'css', 'system', '40-design-system.css');
const cssTest = read('scripts', 'test-css-architecture.mjs');
const legacyRuntime = read('public', 'assets', 'js', '01-legacy-01.js');
const failures = [];
const pkg = JSON.parse(read('package.json'));
const release = pkg.version;

function fail(message) { failures.push(message); }

const cssHref = html.match(/<link[^>]+href=["'](\.\/assets\/css\/app\.css[^"']*)["']/i)?.[1];
if (cssHref !== `./assets/css/app.css?v=${release}`) {
  fail(`app.css must be release-versioned to ${release}; got ${cssHref || 'missing'}`);
}

const localScripts = [...html.matchAll(/<script[^>]+src=["'](\.\/[^"']+\.js(?:\?[^"']*)?)["'][^>]*>/gi)].map(m => m[1]);
if (!localScripts.length) fail('No local runtime scripts found in index.html');
for (const src of localScripts) {
  if (!src.endsWith(`?v=${release}`)) fail(`Local runtime asset is not release-coherent: ${src}`);
}

if (!localScripts.includes(`./warehouse-workspace.js?v=${release}`)) fail('Warehouse authority script is not loaded as a release-coherent runtime asset');

if (!legacyRuntime.includes(`navigator.serviceWorker.register("./service-worker.js?v=${release}", { updateViaCache:"none" })`)) {
  fail('Service-worker registration must be release-versioned and bypass HTTP cache');
}

if (!sw.includes(`const CACHE = 'pool-shed-v${release}-`)) {
  fail(`Service worker cache namespace is not release-coherent with ${release}`);
}
if (!sw.includes("CORE.map(url => new Request(url, { cache: 'reload' }))")) {
  fail('Service-worker install must revalidate core assets instead of trusting stale HTTP cache entries');
}
if (!sw.includes('isVersionedRuntimeAsset') || !sw.includes("fetch(request, { cache: 'no-store' })")) {
  fail('Versioned runtime CSS/JS must use network-first delivery with cache fallback');
}
const coreMatch = sw.match(/const CORE = (\[[^;]+\]);/s);
if (!coreMatch) {
  fail('Could not read service-worker CORE list');
} else {
  const core = JSON.parse(coreMatch[1]);
  const required = [cssHref, ...localScripts].filter(Boolean);
  for (const asset of required) {
    if (!core.includes(asset)) fail(`Service-worker CORE does not match index runtime URL: ${asset}`);
  }
}

const toolbarBody = overhaul.match(/function decorateSalesToolbar\(\)\{([\s\S]*?)\n  \}/)?.[1] || '';
if (!/sales-command-page/.test(toolbarBody) || !/return;/.test(toolbarBody)) {
  fail('Legacy sales toolbar decorator must explicitly bypass .sales-command-page');
}
const bundleBody = overhaul.match(/function decorateBundleRows\(\)\{([\s\S]*?)\n  \}/)?.[1] || '';
if (!/sales-command-page/.test(bundleBody) || !/return;/.test(bundleBody)) {
  fail('Legacy bundle-row decorator must explicitly bypass .sales-command-page');
}
const composerBody = overhaul.match(/function setupComposer\(\)\{([\s\S]*?)\n  \}/)?.[1] || '';
if (!/sales-command-page/.test(composerBody) || !/return;/.test(composerBody)) {
  fail('Legacy line composer decorator must explicitly bypass .sales-command-page');
}

if (/button:hover\s*,\s*\.button:hover\s*,\s*\[role=["']?button["']?\]:hover\s*\{/.test(legacyCss)) {
  fail('Legacy compatibility CSS still owns an unscoped global button hover rule');
}
const buttonHover = designCss.match(/button:hover\s*\{([\s\S]*?)\}/)?.[1] || '';
for (const required of ['transform: none', 'filter: none', 'box-shadow: none']) {
  if (!buttonHover.includes(required)) fail(`Authoritative design-system button:hover is missing ${required}`);
}

if (!cssTest.includes('CSS_MODULES')) {
  fail('CSS architecture test must consume the canonical CSS module manifest');
}
for (const module of [
  'system/49-supplier-command.css',
  'system/50-finance-command.css',
  'system/51-analytics-command.css',
  'system/52-automation-command.css',
  'system/53-settings-command.css',
  'system/54-production-readiness.css',
  'system/55-login-command.css',
  'system/56-executive-premium-components.css',
  'system/57-notifications-command.css',
  'system/58-foundation-authority.css',
  'system/59-my-work-action-authority.css',
  'system/59-quote-studio.css',
  'system/60-responsive-layout.css',
  'system/61-project-design-parity.css',
  'system/62-record-controls.css',
  'system/63-workspace-compatibility.css',
]) {
  if (!CSS_MODULES.includes(module)) fail(`Canonical CSS manifest does not cover late module ${module}`);
}

if (failures.length) {
  console.error(`UI ownership v${release} regression failed:\n- ` + failures.join('\n- '));
  process.exit(1);
}
console.log(`UI ownership v${release} checks passed: coherent assets, modern Sales Order fence, authoritative hover ownership, full CSS module coverage.`);
