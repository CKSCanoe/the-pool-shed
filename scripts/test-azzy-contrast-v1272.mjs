import fs from 'node:fs';
import assert from 'node:assert/strict';

const design = fs.readFileSync('public/assets/css/system/40-design-system.css','utf8');
const css = fs.readFileSync('public/assets/css/system/52-automation-command.css','utf8');
const js = fs.readFileSync('public/automation-command-workspace.js','utf8');

function token(name, dark=false) {
  const region = dark
    ? (design.match(/html\[data-theme="dark"\][\s\S]*?\/\* Core surfaces/) || [])[0]
    : (design.match(/:root \{[\s\S]*?html\[data-theme="dark"\]/) || [])[0];
  assert.ok(region, `could not resolve ${dark ? 'dark' : 'light'} token region`);
  const m = region.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`));
  assert.ok(m, `missing token ${name} in ${dark ? 'dark' : 'light'} theme`);
  return m[1];
}

function srgb(c){c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
function luminance(hex){const h=hex.slice(1);const r=srgb(parseInt(h.slice(0,2),16)),g=srgb(parseInt(h.slice(2,4),16)),b=srgb(parseInt(h.slice(4,6),16));return .2126*r+.7152*g+.0722*b;}
function contrast(a,b){const x=luminance(a),y=luminance(b);const hi=Math.max(x,y),lo=Math.min(x,y);return (hi+.05)/(lo+.05);}
function assertContrast(fg,bg,label,min=4.5){const ratio=contrast(fg,bg);assert.ok(ratio>=min,`${label} contrast ${ratio.toFixed(2)} is below ${min}:1`);return ratio;}

assert.match(css,/v1\.27\.2 Azzy floating assistant contrast authority/);
assert.match(css,/\.az-quick button\{[^}]*background:var\(--color-action-soft\);[^}]*color:var\(--color-action-ink\)/);
assert.match(css,/\.azzy-panel header button\{[^}]*color:var\(--color-text-secondary\)/);
assert.match(css,/\.azzy-modes button\.on\{[^}]*background:var\(--color-action-soft\);[^}]*color:var\(--color-action-ink\)/);
assert.match(css,/\.azzy-input input\{[^}]*color:var\(--color-text-primary\)/);
assert.match(css,/\.azzy-input input::placeholder\{color:var\(--color-text-muted\)\}/);
assert.match(css,/\.azzy-input button\{[^}]*background:var\(--color-action-primary\);[^}]*color:var\(--color-action-contrast\)/);
assert.match(css,/\.az-answer>p,\.az-answer ol,\.az-answer li\{color:var\(--color-text-primary\)\}/);
assert.match(css,/\.az-sources button\{[^}]*background:var\(--color-action-soft\);[^}]*color:var\(--color-action-ink\)/);
assert.match(css,/\.az-answer-actions button\{[^}]*background:var\(--color-action-soft\);[^}]*color:var\(--color-action-ink\)/);
assert.match(css,/\.azzy-float i\{color:var\(--color-action-contrast\)\}/);

// The new authority must occur after the old inherited floating rules so it wins the cascade.
assert.ok(css.lastIndexOf('v1.27.2 Azzy floating assistant contrast authority') > css.indexOf('.azzy-panel header button{border:0;background:transparent;color:var(--color-action-contrast)'), 'Azzy contrast authority must load after the legacy floating rules');

// Floating controls are mounted under body, so explicitly verify their markup remains accessible and non-submit where appropriate.
assert.match(js,/aria-label="Close '\+esc\(p\.name\)\+' assistant"/);
assert.match(js,/<button type="button" data-az-action="quick-question"/);
assert.match(js, /<button type="button" class="'\+\(assistantMode===m\?'on':''\)\+'" data-az-action="assistant-mode"/, 'assistant mode controls must be explicit non-submit buttons');

const ratios = [];
for (const dark of [false,true]) {
  const theme = dark ? 'dark' : 'light';
  ratios.push([`${theme} quick action`, assertContrast(token('--color-action-ink',dark), token('--color-action-soft',dark), `${theme} quick action`)]);
  ratios.push([`${theme} primary copy`, assertContrast(token('--color-text-primary',dark), token('--color-surface-default',dark), `${theme} primary copy`)]);
  ratios.push([`${theme} secondary copy`, assertContrast(token('--color-text-secondary',dark), token('--color-surface-default',dark), `${theme} secondary copy`)]);
  ratios.push([`${theme} header secondary`, assertContrast(token('--color-text-secondary',dark), token('--color-surface-subtle',dark), `${theme} header secondary`)]);
}

console.log('PASS v1.27.2 Azzy floating assistant semantic colours and WCAG text contrast', ratios.map(([n,r])=>`${n}=${r.toFixed(2)}:1`).join(', '));
