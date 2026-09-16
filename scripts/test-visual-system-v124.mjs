import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const designPath = 'public/assets/css/system/40-design-system.css';
const componentPath = 'public/assets/css/system/56-executive-premium-components.css';
const design = read(designPath);
const login = read('public/assets/css/system/55-login-command.css');
const build = read('scripts/build-css.mjs');
const html = read('public/index.html');
const sw = read('public/service-worker.js');
const legacy = read('public/assets/js/01-legacy-01.js');
const overhaul = read('public/pool-shed-overhaul.js');
const projectWorkspace = read('public/project-workspace.js');
const financeLegacyCss = read('public/finance-command.css');
const pkg = JSON.parse(read('package.json'));
const failures = [];

const requireText = (source, text, message) => {
  if (!source.includes(text)) failures.push(message);
};
const forbidText = (source, text, message) => {
  if (source.toUpperCase().includes(text.toUpperCase())) failures.push(message);
};

const [maj,min,patch]=pkg.version.split('.').map(Number);
if (maj !== 1 || min < 24 || (min === 24 && patch < 1)) failures.push(`package version must retain v1.24.1+ Executive Premium foundations, found ${pkg.version}`);

if (!html.includes('<meta name="theme-color" content="#101820">')) failures.push('browser theme colour must use the Executive Premium shell colour #101820');
for (const requiredTest of ['test-visual-system-v124.mjs','test-theme-semantic-contrast-v124.mjs','test-semantic-surface-usage-v124.mjs','test-project-details-v124.mjs']) {
  if (!pkg.scripts.validate.includes(requiredTest)) failures.push(`validate script must include ${requiredTest}`);
}
for (const oldStructuralColour of ['#D7E0E5','#F3F6F8','#5B6972','#102B3A']) {
  if (overhaul.toUpperCase().includes(oldStructuralColour.toUpperCase())) failures.push(`pool-shed-overhaul.js retains legacy inline structural colour ${oldStructuralColour}`);
}
for (const oldReportColour of ['color:#102B3A','border-bottom:1px solid #D7E0E5','small{color:#5B6972}']) {
  if (projectWorkspace.toUpperCase().includes(oldReportColour.toUpperCase())) failures.push(`project report retains legacy visual colour ${oldReportColour}`);
}
if (/#[0-9a-fA-F]{3,8}\b/.test(financeLegacyCss)) failures.push('legacy Finance Command compatibility stylesheet must resolve through semantic tokens, not fixed hex colours');

for (const token of [
  '--color-shell: #101820;',
  '--color-shell-secondary: #17232D;',
  '--color-surface-canvas: #F5F7F8;',
  '--color-surface-default: #FFFFFF;',
  '--color-surface-subtle: #EEF2F4;',
  '--color-surface-raised: #E5EAED;',
  '--color-text-primary: #18242C;',
  '--color-text-secondary: #5F6D75;',
  '--color-text-muted: #89959C;',
  '--color-border-default: #D8E0E4;',
  '--color-border-strong: #C2CCD1;',
  '--color-action-primary: #2F6B84;',
  '--color-action-primary-hover: #24566A;',
  '--color-action-soft: #E7F0F4;',
  '--color-action-ink: #173847;'
]) requireText(design, token, `missing Executive Premium token: ${token}`);

for (const darkToken of [
  '--color-shell: #0B1015;',
  '--color-shell-secondary: #121920;',
  '--color-surface-canvas: #0F1419;',
  '--color-surface-default: #161D23;',
  '--color-surface-subtle: #1D252C;',
  '--color-surface-raised: #263039;',
  '--color-text-primary: #EEF3F5;',
  '--color-text-secondary: #A9B5BB;',
  '--color-text-muted: #7F8C93;',
  '--color-border-default: #2C3841;',
  '--color-border-strong: #3A4852;',
  '--color-action-primary: #69A8C2;',
  '--color-action-primary-hover: #4E8DA7;',
  '--color-action-soft: #17313D;',
  '--color-action-ink: #DFF3FB;'
]) requireText(design, darkToken, `missing dark Executive Premium token: ${darkToken}`);

for (const interaction of [
  '--color-hover-surface:',
  '--color-selected-surface:',
  '--color-selected-edge:',
  '--color-focus-ring:'
]) requireText(design, interaction, `missing interaction token ${interaction}`);

const aliases = ['--brand:', '--accent:', '--ps-cyan:', '--pb-teal:', '--ci-cyan:', '--bs-blue:', '--b2-blue:'];
for (const alias of aliases) requireText(design, alias, `compatibility alias missing: ${alias}`);

if (!fs.existsSync(path.join(root, componentPath))) {
  failures.push('Executive Premium shared component authority file is missing');
} else {
  const component = read(componentPath);
  if (/#[0-9a-fA-F]{3,8}\b/.test(component)) failures.push('component authority must consume semantic tokens and contain no hard-coded hex colours');
  for (const required of ['--color-hover-surface','--color-selected-surface','--color-selected-edge','--color-action-primary','--color-surface-subtle']) {
    requireText(component, required, `component authority does not consume ${required}`);
  }
}

const i55 = build.indexOf('system/55-login-command.css');
const i56 = build.indexOf('system/56-executive-premium-components.css');
if (i56 < 0) failures.push('CSS build is missing system/56-executive-premium-components.css');
if (i55 >= 0 && i56 >= 0 && i56 < i55) failures.push('Executive Premium component authority must load after login command CSS');

for (const required of [
  'background:var(--color-shell)',
  'background:var(--color-surface-default)',
  'border-color:var(--color-action-primary)',
  'box-shadow:var(--focus-ring)'
]) requireText(login, required, `premium login must consume semantic colour authority: ${required}`);

for (const old of ['#071A27','#071B28','#0B3043','#78BEC9','#83C7D1','#68AEBC','#387B8B']) {
  forbidText(login, old, `premium login still contains legacy aqua/navy colour ${old}`);
}

// Feature modules must not own literal hex palette values. Dark/light presentation
// must resolve through the semantic authority rather than fixed light-theme colours.
for (const file of fs.readdirSync(path.join(root, 'public/assets/css/system')).filter((f) => f.endsWith('.css') && f !== '40-design-system.css')) {
  const source = read(`public/assets/css/system/${file}`);
  const literals = [...new Set(source.match(/#[0-9a-fA-F]{3,8}\b/g) || [])];
  if (literals.length) failures.push(`${file} contains ${literals.length} hard-coded hex colour(s): ${literals.slice(0,8).join(', ')}`);
}

// Feature modules must not own literal rgb/rgba or named white/black colours either.
// Shadows, scrims, focus rings and surface mixes must resolve through semantic tokens
// so dark mode cannot inherit light-only alpha paint.
for (const file of fs.readdirSync(path.join(root, 'public/assets/css/system')).filter((f) => f.endsWith('.css') && f !== '40-design-system.css')) {
  const source = read(`public/assets/css/system/${file}`);
  const rgbLiterals = [...new Set(source.match(/rgba?\([^)]*\)/gi) || [])];
  if (rgbLiterals.length) failures.push(`${file} contains ${rgbLiterals.length} literal rgb/rgba colour(s): ${rgbLiterals.slice(0,6).join(', ')}`);

  const namedColourRx = /(?:^|[;{])\s*(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?-color|outline-color|fill|stroke)\s*:\s*(white|black)\b/gim;
  const named = [...source.matchAll(namedColourRx)].map((m) => m[1].toLowerCase());
  if (named.length) failures.push(`${file} contains literal named colour(s): ${[...new Set(named)].join(', ')}`);

  if (/color-mix\([^)]*,\s*(?:white|black)\b/i.test(source)) failures.push(`${file} contains literal white/black inside color-mix(); use semantic surface/shell tokens`);
}

// Purple is forbidden everywhere in maintained runtime CSS.
for (const file of fs.readdirSync(path.join(root, 'public/assets/css/system')).filter((f) => f.endsWith('.css'))) {
  const source = read(`public/assets/css/system/${file}`);
  for (const purple of ['#8F6BFF','#6F4FE8','#A88CFF','#7B5AA6','#624180']) {
    if (source.toUpperCase().includes(purple)) failures.push(`${file} contains forbidden purple ${purple}`);
  }
}

// Feature modules must not retain hard-coded saturated blue/teal/purple brand/action colours.
// Those hues are allowed only as semantic token definitions in 40-design-system.css.
const cssDir = path.join(root, 'public/assets/css/system');
const hexRx = /#[0-9a-fA-F]{6}\b/g;
function hueSat(hex) {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g-b)/d) % 6;
    else if (max === g) h = (b-r)/d + 2;
    else h = (r-g)/d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d/max;
  return [h,s,max];
}
for (const file of fs.readdirSync(cssDir).filter((f) => f.endsWith('.css') && f !== '40-design-system.css')) {
  const source = read(`public/assets/css/system/${file}`);
  const seen = new Set(source.match(hexRx) || []);
  for (const hex of seen) {
    const [h,s,v] = hueSat(hex);
    if (s >= 0.28 && v >= 0.28 && h >= 165 && h <= 320) {
      failures.push(`${file} contains hard-coded saturated blue/teal/purple ${hex}; use semantic variables`);
    }
  }
}

if (!legacy.includes(`Pool Shed v${pkg.version} · Pool Bros Ltd`)) failures.push(`discreet footer/version must report v${pkg.version}`);
if (/Platform Hardening/i.test(html)) failures.push('staff runtime must not contain Platform Hardening content');
if (!login.includes('.ps-login-stage')) failures.push('premium login structure must remain present');
if (!html.includes(`app.css?v=${pkg.version}`)) failures.push(`app.css runtime version must be v${pkg.version}`);
if (!html.includes(`config.js?v=${pkg.version}`)) failures.push(`runtime JS version must be v${pkg.version}`);
if (!sw.includes(pkg.version)) failures.push(`service worker cache/runtime must reference v${pkg.version}`);
if (/\?v=1\.23\.0/.test(html)) failures.push('stale v1.23.0 runtime asset references remain in index.html');

if (failures.length) {
  console.error(failures.map((x) => `FAIL: ${x}`).join('\n'));
  process.exit(1);
}
console.log('PASS v1.24 Executive Premium Steel Blue visual contract: semantic palette, premium login, no purple, no hard-coded feature action hues, current release wiring.');
