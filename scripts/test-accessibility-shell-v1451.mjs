import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('public/index.html', 'utf8');
const legacy = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8');
const workspace = fs.readFileSync('public/professional-workspace.js', 'utf8');
const design = fs.readFileSync('public/assets/css/system/40-design-system.css', 'utf8');

assert.match(index, /class="ps-skip-link" href="#mainContent"/, 'keyboard skip link is missing');
assert.match(index, /<main class="main" id="mainContent" tabindex="-1" aria-labelledby="pageTitle">/, 'main landmark must be an explicit skip target');
assert.match(index, /<nav class="nav" id="nav" aria-label="Primary">/, 'primary navigation needs an accessible name');
assert.match(index, /id="globalSearch"[^>]+role="combobox"[^>]+aria-autocomplete="list"[^>]+aria-expanded="false"[^>]+aria-controls="globalSearchResults"/, 'global search combobox semantics are incomplete');
assert.match(index, /id="globalSearchResults"[^>]+role="listbox"/, 'global search results need listbox semantics');
assert.match(index, /id="toast" role="status" aria-live="polite" aria-atomic="true"/, 'toast messages must be announced');
assert.match(index, /data-workspace-refresh="Dashboard"[^>]+aria-label="Refresh workspace"/, 'icon-only refresh control needs a stable accessible name');
assert.match(design, /\.ps-skip-link\s*\{[\s\S]*transform:[^;]+;[\s\S]*\}[\s\S]*\.ps-skip-link:focus\s*\{\s*transform:\s*translateY\(0\)/, 'skip-link reveal styling is missing');
assert.match(legacy, /document\.title = meta\.title === "The Pool Shed" \? "The Pool Shed" : meta\.title \+ " · The Pool Shed"/, 'document title must follow the active workspace without duplicating the product name');
assert.match(legacy, /role="option" aria-selected="false" id="globalSearchOption-/, 'search results need option state and stable IDs');
assert.match(legacy, /event\.key === "ArrowDown" \|\| event\.key === "ArrowUp"/, 'search results need arrow-key navigation');
assert.match(legacy, /aria-activedescendant/, 'search combobox needs active-descendant management');
assert.match(legacy, /menu\.classList\.add\("hidden"\)[\s\S]*button\.setAttribute\("aria-expanded", "false"\)[\s\S]*button\.focus\(\)/, 'Escape must close the account menu and restore focus');
assert.match(workspace, /e\.key==='Escape'\)\{document\.body\.classList\.remove\('ps-menu-open'\);document\.getElementById\('workspaceMenu'\)\?\.setAttribute\('aria-expanded','false'\);\}/, 'Escape must keep mobile-menu ARIA state synchronized');

console.log('PASS v1.45.1 shell accessibility, keyboard search and menu-state hardening');
