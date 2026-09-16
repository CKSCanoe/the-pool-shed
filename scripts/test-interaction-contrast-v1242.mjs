import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const legacyJs = fs.readFileSync(path.join(root, 'public/assets/js/01-legacy-01.js'), 'utf8');
const coreCss = fs.readFileSync(path.join(root, 'public/assets/css/system/30-workspace-core.css'), 'utf8');
const designCss = fs.readFileSync(path.join(root, 'public/assets/css/system/40-design-system.css'), 'utf8');
const componentsCss = fs.readFileSync(path.join(root, 'public/assets/css/system/56-executive-premium-components.css'), 'utf8');

// Creation/save CTAs are primary actions, never semantic success controls.
const runtimeFiles=[];
const walk=(dir)=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(/\.(?:js|html)$/i.test(entry.name))runtimeFiles.push(full);}};
walk(path.join(root,'public'));
const semanticSuccessButtons=[];
for(const file of runtimeFiles){const src=fs.readFileSync(file,'utf8');for(const m of src.matchAll(/<button[^>]*class="[^"]*(?:success|green-action)[^"]*"[^>]*>(.*?)<\/button>/gsi))semanticSuccessButtons.push(`${path.relative(root,file)}: ${m[1].replace(/<[^>]+>/g,'').trim()}`);}
assert.equal(semanticSuccessButtons.length, 0, `Runtime still uses success/green-action for action buttons: ${semanticSuccessButtons.join(', ')}`);
assert.match(legacyJs, /class="primary" data-create-sales-order="true">New Sales Order<\/button>/, 'New Sales Order must be a primary Steel Blue CTA');
assert.match(legacyJs, /class="primary" data-create-crm-profile="true">Save customer<\/button>/, 'Save customer must be a primary Steel Blue CTA');

// Legacy submenu rules must not force page/action colours over the shell hierarchy.
assert.doesNotMatch(coreCss, /\.sidebar \.nav-subgroups button\s*\{[^}]*color\s*:\s*var\(--color-dark-muted\)\s*!important/si, 'Submenu text must not use legacy page-muted colour with !important');
assert.doesNotMatch(coreCss, /\.sidebar \.nav-subgroups button\.active\s*\{[^}]*color\s*:\s*var\(--color-action-focus\)\s*!important/si, 'Active submenu text must not use Steel Blue as foreground on the dark shell');
assert.match(designCss, /--color-shell-text-subnav\s*:\s*#[0-9A-Fa-f]{6}\s*;/, 'Design system must define a dedicated readable submenu shell text token');
assert.match(componentsCss, /body \.sidebar \.nav-subgroups button\s*\{[^}]*color\s*:\s*var\(--color-shell-text-subnav\)/si, 'Executive component authority must explicitly own submenu text');
assert.match(componentsCss, /body \.sidebar \.nav-subgroups button(?:\.active|\.on|\[aria-current="page"\])[^\{]*\{[^}]*color\s*:\s*var\(--color-shell-text\)/si, 'Active submenu must use high-contrast shell text');

// Primary interaction contract must keep readable contrast through hover.
assert.match(componentsCss, /button\.primary[^}]*background\s*:\s*var\(--color-action-primary\)[^}]*color\s*:\s*var\(--color-action-contrast\)/si, 'Primary button must use action background and action contrast text');
assert.match(componentsCss, /button\.primary[^\{]*:hover[^}]*background\s*:\s*var\(--color-action-primary-hover\)[^}]*color\s*:\s*var\(--color-action-contrast\)/si, 'Primary hover must preserve action contrast text');
assert.match(componentsCss, /button\.success,button\.green-action\)\{[^}]*background\s*:\s*var\(--color-action-primary\)[^}]*color\s*:\s*var\(--color-action-contrast\)/si, 'Legacy success button names must fall back to the primary action palette, not green');
assert.match(componentsCss, /:where\(\.success,\.is-success\):not\(\.pill\):not\(\.badge\):not\(tr\):not\(button\)/, 'Success status/callout rule must explicitly exclude buttons');

console.log('PASS v1.24.2 interaction contrast authority');
