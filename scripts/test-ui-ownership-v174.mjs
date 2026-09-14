import fs from 'node:fs';
import path from 'node:path';

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
const release = '1.7.4';

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

if (!legacyRuntime.includes(`navigator.serviceWorker.register("./service-worker.js?v=${release}", { updateViaCache:"none" })`)) {
  fail('Service-worker registration must be release-versioned and bypass HTTP cache');
}

if (!sw.includes(`const CACHE = 'pool-shed-v${release}-ui-ownership';`)) {
  fail('Service worker cache namespace is not the 1.7.4 UI ownership namespace');
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

for (const module of ['system/34-customer-workspace.css','system/41-sales-order-command.css','system/42-sales-order-parity.css','system/43-sales-order-finder-polish.css']) {
  if (!cssTest.includes(`"${module}"`)) fail(`CSS architecture test does not cover late module ${module}`);
}

if (failures.length) {
  console.error('UI ownership v1.7.4 regression failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log(`UI ownership v${release} checks passed: coherent assets, modern Sales Order fence, authoritative hover ownership, full CSS module coverage.`);
