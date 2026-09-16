import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const design = read('public/assets/css/system/40-design-system.css');
const legacyCss = read('public/assets/css/system/10-legacy-compat.css');
const login = read('public/assets/css/system/55-login-command.css');
const html = read('public/index.html');
const sw = read('public/service-worker.js');
const legacy = read('public/assets/js/01-legacy-01.js');
const pkg = JSON.parse(read('package.json'));
const failures = [];

const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message); };
const forbid = (source, rx, message) => { if (rx.test(source)) failures.push(message); };

const [major, minor, patch] = pkg.version.split('.').map(Number);
if (![major, minor, patch].every(Number.isFinite) || major < 1 || (major === 1 && minor < 23)) {
  failures.push(`v1.23 visual foundations require release 1.23.0 or newer, found ${pkg.version}`);
}
for (const token of [
  '--color-surface-subtle:',
  '--color-surface-default:',
  '--color-text-primary:',
  '--color-text-secondary:',
  '--color-action-primary:',
  '--color-action-soft:',
  '--color-hover-surface:',
  '--color-selected-surface:'
]) requireText(design, token, `missing retained v1.23 semantic visual authority: ${token}`);

requireText(design, 'background: var(--color-surface-subtle);', 'shared design system must use neutral subtle surfaces');
requireText(design, 'background: color-mix(in srgb, var(--color-action-primary) 4%, var(--color-surface-default));', 'table hover must use a very soft primary tint');

forbid(legacyCss, /thead\s+th\s*\{[^}]*background\s*:\s*var\(--color-action-focus\)\s*!important/i, 'legacy CSS must not force aqua table headers');
forbid(legacyCss, /tbody\s+tr:hover\s+td\s*\{[^}]*background\s*:\s*var\(--color-action-focus\)\s*!important/i, 'legacy CSS must not force aqua hovered rows');
forbid(legacyCss, /tbody\s+tr:hover\s*\{[^}]*background[^}]*color-action-focus/i, 'legacy CSS must not retain saturated generic row hover');
forbid(legacyCss, /button\.secondary\s*\{[^}]*background\s*:\s*var\(--color-action-focus\)/i, 'legacy CSS must not paint secondary buttons with the focus accent');
forbid(legacyCss, /#screen-warehouse\s+thead\s+th\s*\{[^}]*background\s*:\s*var\(--color-action-focus\)/i, 'warehouse headers must not use aqua structural fill');
forbid(legacyCss, /#screen-warehouse\s+tbody\s+tr:hover\s*\{[^}]*background\s*:\s*var\(--color-action-focus\)/i, 'warehouse hover must not use aqua structural fill');

if (!legacy.includes(`Pool Shed v${pkg.version} · Pool Bros Ltd`)) failures.push(`login/footer must expose current release ${pkg.version} at the bottom`);
if (/Platform Hardening/i.test(html)) failures.push('staff runtime must not contain Platform Hardening content');
if (!login.includes('.ps-login-stage')) failures.push('approved premium login stylesheet must remain present');

if (!html.includes(`app.css?v=${pkg.version}`)) failures.push(`app.css runtime version must be ${pkg.version}`);
if (!html.includes(`config.js?v=${pkg.version}`)) failures.push(`runtime JS version must be ${pkg.version}`);
if (!sw.includes(pkg.version)) failures.push(`service worker cache/runtime must reference ${pkg.version}`);
if (/\?v=1\.22\.0/.test(html)) failures.push('stale v1.22.0 runtime asset references remain in index.html');

if (failures.length) {
  console.error(failures.map((x) => `FAIL: ${x}`).join('\n'));
  process.exit(1);
}
console.log(`PASS v1.23+ visual foundations retained on ${pkg.version}: neutral tables, premium login and coherent release wiring.`);
