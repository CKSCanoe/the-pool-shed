// v1.74.0 Pool spec configurator: choice photos, highlights, cost and margin, catalogue search, groups from templates,
// and accepted choices reaching the sales order, project and purchasing with one product code for typed-in choices.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = f => fs.readFileSync(f, 'utf8');
const ed = read('public/quote-brochure-editor.js'), eng = read('public/quote-studio-engine.js'), srv = read('server/quote.js'), css = read('public/assets/css/system/69-quote-brochure-editor.css');

// Editor: every choice field the owner asked for.
assert.ok(ed.includes("const OPTION_KEYS=['title','description','subtitle','unitPrice','qty','selected','recommended','badge','image','costSnapshot','supplierSnapshot','benefits'];"));
for (const label of ["'Photo'", "'Description'", "'Highlights (one per line, up to 6)'", "'Cost each (only you see this)'", "'Order from supplier'", "'From the catalogue'"]) assert.ok(ed.includes(label), label);
assert.ok(ed.includes('function marginText(o)') && ed.includes("return m<20?'bad':m<30?'warn':'good'"), 'margin shown and coloured');
assert.ok(ed.includes('function catalogueResults(term)') && ed.includes('if(out.length>=8)break'), 'catalogue search stops at 8');
assert.ok(ed.includes("p.virtual||p.hiddenFromCatalogue||/^(CUSTOM|SHIP)-/i.test(String(p.id))"), 'one-off records never offered');
assert.ok(ed.includes('engine.addProductOption(qt.id,g.id,d.beCatAdd)'));
assert.ok(ed.includes('engine.copyGroup(qt.id,d.beTpl,d.beTplGroup)') && ed.includes('engine.saveTemplate(qt.id,'));
assert.ok(ed.includes("Starting total '+cash(t.gross)+' inc. VAT"));
assert.ok(/\.be-two\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/.test(css), 'settings fit narrow panels');

// Engine: copying a group gives fresh ids and brings its pictures.
assert.ok(/function copyGroup\(id,templateId,sectionId\)\{[^\n]*g\.id=uid\('SEC'\);\(g\.options\|\|\[\]\)\.forEach\(o=>o\.id=uid\('OPT'\)\)/.test(eng));
assert.ok(eng.includes('q.mediaLibrary.push(clone(m))'));

// Typed-in choices get the one CUSTOM code (named after the choice); catalogue and bundle choices are unchanged.
const src = eng.match(/function optionOperationalLines\(section,o\)\{[^\n]*\}/)[0];
const uid = p => p + '-' + Math.random().toString(36).slice(2, 8), money = v => Math.round(Number(v || 0) * 100) / 100;
const optionOperationalLines = new Function('uid', 'money', src + '; return optionOperationalLines;')(uid, money);
const sec = { id: 'SEC-1' };
const typed = optionOperationalLines(sec, { id: 'OPT-9', kind: 'custom', productId: '', title: 'Excavation and muck away', qty: 1, unitPrice: 2400, costSnapshot: 1500 });
assert.equal(typed[0].productId, 'CUSTOM-OPT-9'); assert.equal(typed[0].customProductName, 'Excavation and muck away'); assert.equal(typed[0].unitCost, 1500);
const cat = optionOperationalLines(sec, { id: 'OPT-2', kind: 'product', productId: 'P-1', title: 'Heat pump', qty: 1, unitPrice: 3995 });
assert.equal(cat[0].productId, 'P-1'); assert.equal(cat[0].customProductName, undefined);

// Conversion (in the app and on the server when the customer accepts online): typed-in choices with no supplier make
// no purchase order and no material line; with a supplier they do. The custom name is kept on the sales order line.
for (const [name, s] of [['app', eng], ['server', srv]]) {
  assert.ok(s.includes("customProductName:l.customProductName||undefined"), name + ' keeps the custom name');
  assert.ok(s.includes("/^CUSTOM-/i.test(line.productId)&&!line.supplierSnapshot)"), name + ' skips un-bought one-offs');
}
assert.ok(srv.includes("if(!line.productId||line.bundleRole==='head')continue;if(/^CUSTOM-/i.test(line.productId)&&!line.supplierSnapshot)continue;"));
console.log('Quote spec configurator v1.73: choice photos, cost and margin, catalogue search, template groups, CUSTOM code into orders.');
