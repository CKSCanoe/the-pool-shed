// v1.71 custom items and deposits: a one-off custom or delivery line no longer creates a product record; it shows the
// one code CUSTOM (or SHIPPING) with its own name and price, rebuilt from the line; the start-up repair step does not
// re-create records for them; the 105 existing one-off records stay but are hidden from Stock levels. Quote deposits
// are raised as Pool Shed deposit invoices for the quote's own amount; project stages can be set as a % of the agreed value.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const legacy = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8');
// Run the real product() / createNonStockProduct / oneOffProduct functions in a sandbox.
const pick = (name, end) => { const a = legacy.indexOf(name); assert(a >= 0, name); return legacy.slice(a, legacy.indexOf(end, a) + end.length); };
const src = [
  pick('      const productIndex = { list: null, len: -1, map: null };', 'hiddenFromCatalogue: true, virtual: true };\n      }'),
  pick('      function nextNonStockLineId(prefix) {', '        return (prefix || "NS") + "-" + seed;\n      }'),
  pick('      function createNonStockProduct(lineType, description, unitPrice, unitCost, variantDescription) {', '        return productRecord;\n      }')
].join('\n');
const ctx = { Date, Math, Number, String, Map, Set, Object, Array, data: { products: [{ id: 'P1', sku: 'CHL', name: 'Chlorine' }], salesOrders: [{ id: 'SO-1', lines: [] }], goodsNotes: [], salesCredits: [], quotes: [], salesOrderSubscriptions: [] } };
vm.createContext(ctx); vm.runInContext(src, ctx);
const p = ctx.createNonStockProduct('custom', 'Site survey visit', 95, 30, '');
assert.equal(ctx.data.products.length, 1, 'no product record created'); assert.equal(p.sku, 'CUSTOM'); assert(/^CUSTOM-/.test(p.id), 'each line keeps its own private reference');
assert.equal(ctx.product(p.id).name, 'Site survey visit', 'found before the line is saved');
ctx.data.salesOrders[0].lines.push({ productId: p.id, lineType: 'custom', customProductName: 'Site survey visit', unitPrice: 95, unitCost: 30, qty: 1 });
let sp = ctx.product(p.id); assert.equal(sp.sku, 'CUSTOM'); assert.equal(sp.rrp, 95); assert.equal(sp.cost, 30); assert.equal(sp.stockTracked, false); assert.equal(sp.hiddenFromCatalogue, true);
ctx.data.salesOrders[0].lines[0].customProductName = 'Site survey and report'; assert.equal(ctx.product(p.id).name, 'Site survey and report', 'renamed line shows its new name');
const s = ctx.createNonStockProduct('shipping', 'Pallet delivery', 45, 0); ctx.data.salesOrders[0].lines.push({ productId: s.id, lineType: 'shipping', shippingMethod: 'Pallet delivery', unitPrice: 45, qty: 1 });
assert.equal(ctx.product(s.id).sku, 'SHIPPING'); assert.equal(ctx.product(s.id).name, 'Pallet delivery');
assert.equal(ctx.product('P1').name, 'Chlorine', 'real products unchanged'); assert.equal(ctx.product('NOPE'), undefined, 'unknown ids still not found');
assert.equal(ctx.data.products.length, 1, 'still no records');
// Repair step, Stock levels, deposits, project %.
assert(/if \(\/\^\(CUSTOM\|SHIP\)-\/i\.test\(String\(productId\)\)\) return;/.test(legacy), 'start-up repair skips one-off lines');
const inv = fs.readFileSync('public/inventory-workspace.js', 'utf8'); assert(/!p\.hiddenFromCatalogue&&!\/\^\(Custom\|Shipping\) charge\$\/\.test\(p\.productType\|\|''\)/.test(inv), 'old one-off records hidden from Stock levels');
const qe = fs.readFileSync('public/quote-studio-engine.js', 'utf8'), qw = fs.readFileSync('public/quote-studio-workspace.js', 'utf8');
assert(/db\.rpc\('ps_sales_invoice_create'/.test(qe) && /kind:'deposit'/.test(qe) && /source:'job',id:c\.projectId,kind:'stage'/.test(qe) && !/\/api\/finance\?action=queue/.test(qe.slice(qe.indexOf('async function queueDeposit'), qe.indexOf('touch(q);return dep}', qe.indexOf('async function queueDeposit')))), 'deposit raised on the ledger, not the old Xero queue');
assert(/dep\.status='Deposit invoiced'/.test(qe) && /dep\.status==='Deposit invoiced'\)\?button\('Record payment received'/.test(qw) && /button\('Raise '\+/.test(qw), 'deposit flow and button');
const pw = fs.readFileSync('public/project-workspace.js', 'utf8'), pb = fs.readFileSync('public/project-billing.js', 'utf8');
assert(/data-project-phase-pct=/.test(pw) && /\[data-project-phase-pct\]/.test(pb) && /p\+'% deposit'/.test(pb), 'project stage as a % of the agreed value');
console.log('Custom items v1.71: one code (CUSTOM / SHIPPING), no product records, names from the line; deposits on the ledger; project %.');
