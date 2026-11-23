// v1.82 Overhaul phase 2: lists. Product Groups searched and paged; Catalogue Health and Imports no longer build the
// whole product list; Health 100 rows at a time and wired up; My work compact rows; avatars; old task noise tidied.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = f => fs.readFileSync(f, 'utf8');
const hub = read('public/product-hub-workspace.js');
assert.ok(hub.includes("const per=24,pages=Math.max(1,Math.ceil(found.length/per))") && hub.includes('data-ph-group-search') && hub.includes('data-ph-group-page'));
assert.ok(!hub.includes('<span>PRODUCT GROUP</span>'), 'no capital label on each group');
const l1 = read('public/assets/js/01-legacy-01.js'), l2 = read('public/assets/js/02-legacy-02.js');
assert.ok(l1.includes('const listRows = function(){ return filteredProducts.map(') && l1.includes('if (content === null) content = listContent();'), 'base product list only when shown');
assert.ok(l2.includes('const listContent=function(){') && l2.includes('if (content === null) content = listContent();'), 'grouped product list only when shown');
assert.ok(l2.includes("if (productView === 'health' && typeof bindCatalogueHealth === 'function') bindCatalogueHealth();"), 'Health search, filter and Save wired');
assert.ok(l1.includes("(rowIndex >= 100 ? ' hidden' : '')") && l1.includes('let healthLimit = 100;') && l1.includes('Show the next 100'));
const mw = read('public/my-work-workspace.js');
assert.ok(mw.includes('class="mw-row') && mw.includes('data-action-complete="') && mw.includes('>Mark done</button>') && mw.includes('<details class="mw-more">'));
for (const a of ['data-action-claim', 'data-action-start', 'data-action-wait', 'data-action-snooze', 'data-action-open']) assert.ok(mw.includes(a), a + ' kept');
const aa = read('public/action-authority.js');
assert.ok(aa.includes("if(!s.historyTidied){") && aa.includes("a.history=a.history.filter((h,i)=>!(h&&h.event==='refreshed')||i===last);"), 'one-off tidy keeps every real event and the latest refresh');
// The tidy itself
const hist = [{ event: 'created' }, { event: 'refreshed', at: 1 }, { event: 'claimed' }, { event: 'refreshed', at: 2 }, { event: 'refreshed', at: 3 }];
let last = -1; hist.forEach((h, i) => { if (h.event === 'refreshed') last = i; });
const kept = hist.filter((h, i) => !(h.event === 'refreshed') || i === last);
assert.equal(JSON.stringify(kept.map(h => h.event + (h.at || ''))), JSON.stringify(['created', 'claimed', 'refreshed3']));
const icons = read('public/ps-icons.js'); assert.ok(icons.includes('global.PoolShedAvatar = avatar'));
assert.ok(read('public/purchase-workspace.js').includes("globalThis.PoolShedAvatar?globalThis.PoolShedAvatar(po.supplier||'?')"));
assert.ok(l1.includes("window.PoolShedAvatar ? window.PoolShedAvatar(customerDisplayName(c))"));
console.log('Overhaul 2 v1.82: groups paged, Health and Imports fast and wired, My work compact, avatars, task history tidied.');
