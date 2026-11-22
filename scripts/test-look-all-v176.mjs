// v1.76 The design kit on every area; record pages get the same underlined tabs; Imports fits its column.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const frame = fs.readFileSync('public/back-office-frame.js', 'utf8'), kit = fs.readFileSync('public/assets/css/system/68-pool-shed-kit.css', 'utf8');
const m = frame.match(/var KIT_TABS = \{([^}]*)\};/); assert.ok(m, 'KIT_TABS present');
const on = new Set(m[1].split(',').map(x => x.split(':')[0].trim()).filter(Boolean));
for (const t of ['salesorders','quotes','dashboard','mywork','audits','crm','jobs','purchase','products','locations','warehouse','fulfilment','fleet','accounting','analytics','settings','automation']) assert.ok(on.has(t), t + ' on the kit');
for (const t of ['engineer','barcodes']) assert.ok(!on.has(t), t + ' keeps its own full-screen layout');
const scope = kit.match(/:is\(#screen-dashboard[^)]*\)/)[0];
for (const t of on) assert.ok(scope.includes('#screen-' + t), 'kit rules reach #screen-' + t);
assert.ok(frame.includes("if (kitOn && p.tab === 'quotes' && screen && screen.querySelector('.qs-studio-root')) kitOn = false;"), 'quote editor keeps its studio');
for (const b of ['.po-command-tabs','.supplier-detail-tabs','.project-360-tabs','.ph-product-tabs','.crm-profile-tabs']) assert.ok(kit.includes(b + ' > :is(button, a):is(.active, .is-active, [aria-selected="true"], [aria-current="page"])'), b + ' underlined');
assert.ok(kit.includes('.import-history { grid-template-columns: minmax(0, 1fr) !important; }'));
assert.ok(!/#[0-9a-f]{3,6}\b/i.test(kit.replace(/#screen-[a-z]+/g, '')), 'kit still uses colour tokens only');
console.log('Look v1.76: every area on the kit, record tabs underlined, Imports fits, tokens only.');
