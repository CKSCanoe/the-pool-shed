import fs from 'node:fs';
import assert from 'node:assert/strict';

const legacyCss=fs.readFileSync('public/assets/css/system/10-legacy-compat.css','utf8');
const projectCss=fs.readFileSync('public/assets/css/system/45-project-360-command.css','utf8');

const cssModules=fs.readdirSync('public/assets/css/system').filter(x=>x.endsWith('.css')).map(x=>fs.readFileSync('public/assets/css/system/'+x,'utf8')).join('\n');
assert(!/thead th[^{}]*\{[^}]*background\s*:\s*var\(--color-action-focus\)/is.test(cssModules),
  'no Pool Shed table header may use the bright focus aqua as its fill');

const aquaHeaderRules=[];
for(const match of cssModules.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
  const selector=match[1].trim(),body=match[2];
  if(/(^|[\s>+~,.#:[\]])th([\s>+~,.#:[\]]|$)/i.test(selector)&&/background(?:-color)?\s*:\s*var\(--color-action-focus\)/i.test(body)) aquaHeaderRules.push(selector);
}
assert.deepEqual(aquaHeaderRules,[],`no table header selector may use bright aqua fill: ${aquaHeaderRules.join(', ')}`);

assert(!/thead th\s*\{[^}]*background\s*:\s*var\(--color-action-focus\)\s*!important/i.test(legacyCss),
  'legacy compatibility CSS must not force every table header to aqua');
assert(!/tbody tr:hover td\s*\{[^}]*background\s*:\s*var\(--color-action-focus\)\s*!important/i.test(legacyCss),
  'legacy compatibility CSS must not force every table hover cell to aqua');
assert(/\.project-360-home[^{}]*th[^{]*\{[^}]*background\s*:\s*#f6f9fa[^}]*color\s*:\s*#[0-9a-f]{6}/is.test(projectCss),
  'Project 360 table headers must retain an explicit neutral readable treatment');
assert(/\.project-360-home[^{}]*tbody tr:hover td[^{]*\{[^}]*background\s*:\s*#f8fbfc/is.test(projectCss),
  'Project 360 row hover must remain neutral and readable');

console.log('PASS v1.22 readability guard blocks global aqua table overrides');
