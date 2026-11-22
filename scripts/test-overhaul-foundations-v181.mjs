// v1.81 Overhaul phase 1: product pages no longer stuck on Imports, My work stops saving on view, nothing under 12px,
// one coloured button per page, quieter labels, icons, and the new Home.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const read = f => fs.readFileSync(f, 'utf8');
// 1. Imports bug
const hub = read('public/product-hub-workspace.js');
assert.ok(hub.includes("if((productView==='bulk'&&sec!=='Imports')||(productView==='health'&&sec!=='Catalogue Health'))productView='list';"));
assert.ok(hub.indexOf("productView='list';}") < hub.indexOf("if(['create','bulk','prices','health'].includes(productView)) return legacyRenderProducts();"), 'mode cleared before the old screen is chosen');
// 2. My work: unchanged tasks are left alone and a check only saves when something changed
const aa = read('public/action-authority.js');
assert.ok(aa.includes("if(material()===before)return {ok:true,deduped:true,unchanged:true,action:open};"));
assert.ok(aa.includes("function save(){if(quietSave)return;"));
assert.ok(aa.includes("if(JSON.stringify(state().actions)!==before)save();"));
// 3. Text scale: nothing in the stylesheets below 12px (base size is 14px, so rem/em at least .86)
const dir = 'public/assets/css/system'; const bad = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.css'))) { const css = read(path.join(dir, f));
  for (const m of css.matchAll(/font-size:\s*([0-9.]+)(px|rem|em)\b/g)) { const v = Number(m[1]); if ((m[2] === 'px' && v < 12) || (m[2] !== 'px' && v < 0.86)) bad.push(f + ' ' + m[0]); }
  for (const m of css.matchAll(/font:\s*(?:[0-9]+\s+)?([0-9.]+)px/g)) if (Number(m[1]) < 12) bad.push(f + ' ' + m[0]); }
assert.deepEqual(bad, [], 'text below 12px: ' + bad.slice(0, 5).join(', '));
assert.ok(read(path.join(dir, '40-design-system.css')).includes('--ps-font-micro: 12px'));
// 4. Buttons and labels (new look only)
const f73 = read(path.join(dir, '73-overhaul-foundations.css'));
assert.ok(f73.includes(':is(td, li, article, [class*="-row"], [class*="-item"]) button.primary{background:var(--color-surface-default) !important'));
assert.ok(f73.includes(':is([class*="eyebrow"],[class*="kicker"]){text-transform:none !important'));
assert.ok(f73.includes('.ps-kit-scope:not(#ps-kit-none):not(:has(> .qs-studio-root)) .dashboard-final-hero'), 'old greeting band hidden with the new look only');
// 5. Icons and Home
const icons = read('public/ps-icons.js'); assert.ok(icons.includes('global.PoolShedIcon = icon'));
const frame = read('public/back-office-frame.js');
for (const s of ['function homeFigures()', "'Orders taken this month'", "'Owed to you'", "'Margin this month'", '<h3>To do</h3>', '<h3>Recent</h3>', 'data-home-new', 'data-home-recent']) assert.ok(frame.includes(s), s);
assert.ok(frame.includes("if (c > 0) { cost += q * c; costedNet += q * p; }"), 'margin only from lines with a cost');
assert.ok(frame.includes("(!uptoDay || c.slice(8, 10) <= uptoDay)"), 'compared with the same days last month');
assert.ok(frame.includes("'core stock lines to reorder': 'core stock line to reorder'"), 'singular wording');
const index = read('public/index.html'); assert.ok(index.indexOf('ps-icons.js') < index.indexOf('back-office-frame.js'));
assert.ok(read('public/jump-to.js').includes("action: item.action || ''"), 'recent items remember what kind of record they are');
console.log('Overhaul 1 v1.81: Imports fix, My work quiet, 12px floor, one coloured button, quiet labels, icons, new Home.');
