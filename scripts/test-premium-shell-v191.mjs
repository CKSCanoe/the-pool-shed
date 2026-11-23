// v1.91 premium shell: gradient menu bar from tokens, logo on a glass tile (no white square), icons on menu areas, frosted top bar.
import fs from 'node:fs';
import assert from 'node:assert';
const css = fs.readFileSync('public/assets/css/system/77-premium-shell.css', 'utf8');
const tokens = fs.readFileSync('public/assets/css/system/00-color-tokens.css', 'utf8');
const mods = fs.readFileSync('scripts/css-modules.mjs', 'utf8');
const frame = fs.readFileSync('public/back-office-frame.js', 'utf8');
const app = fs.readFileSync('public/assets/css/app.css', 'utf8');
assert(mods.indexOf('77-premium-shell.css') > mods.indexOf('76-overhaul-flows.css') && mods.indexOf('77-premium-shell.css') < mods.indexOf('68-pool-shed-kit.css'), 'shell module loads before the page kit');
for (const t of ['--shell-grad-top', '--shell-grad-mid', '--shell-grad-end', '--brand-grad-start', '--brand-grad-end', '--canvas-glass']) assert(tokens.includes(t + ':'), 'token ' + t);
assert(/sidebar \{ background: linear-gradient\(165deg, var\(--shell-grad-top\)/.test(css), 'menu bar gradient');
assert(/brand-mark img \{[^}]*background: transparent !important/.test(css), 'logo has no white square behind it');
assert(/nav-new-btn \{[^}]*linear-gradient\(135deg, var\(--brand-grad-start\), var\(--brand-grad-end\)\)/.test(css), '+ New carries the brand gradient');
assert(/\.topbar[^{]*\{ position: sticky !important;[^}]*backdrop-filter/.test(css), 'frosted, sticky top bar');
assert(/dashboard-mode \.main \.topbar/.test(css), 'Home uses the same top bar');
assert(/AREA_ICON = \{ home: 'home', sales: 'receipt'/.test(frame) && /areaIcon\(m\.id\) \+ '<span>'/.test(frame), 'each menu area has an icon');
assert(app.includes('--shell-grad-top') && app.includes('77-premium-shell') === false || app.includes('shell-grad'), 'built into app.css');
assert(fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8').includes('if (button.id === "themeToggle") return;'), 'dark-mode switch no longer shows "not available"');
console.log('Premium shell v1.91: gradient menu, glass logo tile, menu icons, frosted top bar.');
