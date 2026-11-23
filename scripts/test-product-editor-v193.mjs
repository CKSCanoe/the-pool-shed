// v1.93 product editor: one page, drafts held until Save, family name, variants grid, supplier record kept in step
// without wiping its own lead time, keep in stock with suggested levels, status, SKU checks, All fields still reachable.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';
const src = fs.readFileSync('public/product-editor.js', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');
assert(index.indexOf('product-editor.js') > index.indexOf('catalogue-list.js'), 'loads after the catalogue list');
assert(fs.readFileSync('public/service-worker.js', 'utf8').includes('./product-editor.js?v='), 'cached for offline use');
assert(/data-ph-save-product data-pe-save/.test(src), 'Save button answers Ctrl+S');
const now = Date.now(), day = 864e5, iso = t => new Date(t).toISOString().slice(0, 10);
const products = [
  { id: 'A', sku: 'T2', name: 'Tabs', parentSku: 'G', parentName: 'Chlorine Tabs', variantValue: '2kg', variantSortOrder: 1, rrp: 20, trade: 0, cost: 10, supplier: 'CPC', supplierSku: 'C2' },
  { id: 'B', sku: 'T5', name: 'Tabs', parentSku: 'G', parentName: 'Chlorine Tabs', variantValue: '5kg', variantSortOrder: 2, rrp: 50, cost: 30, supplier: 'CPC' },
  { id: 'X', sku: 'OTHER', name: 'Other' }
];
const data = { products, supplierProducts: [{ id: 'SP-1', productId: 'A', supplier: 'CPC', leadTimeDays: 5, minQty: 2, cost: 10, supplierSku: 'C2' }],
  salesOrders: [{ created: iso(now - 10 * day), lines: [{ productId: 'A', qty: 45 }] }, { created: iso(now - 200 * day), lines: [{ productId: 'A', qty: 999 }] }], purchaseOrders: [], suppliers: [{ name: 'CPC' }] };
let saved = 0;
const hub = { productById: id => products.find(p => p.id === id), isStocked: () => true, stockSummary: () => ({ available: 3, onHand: 3, allocated: 0 }),
  replenishmentSettings: p => ({ enabled: !!p.replenishmentEnabled }), supplierOffer: p => data.supplierProducts.find(o => o.productId === p.id) || null };
const ctx = { console, data, setTimeout: () => 0, clearTimeout() {}, saveAppData: () => saved++, toast() {}, render() {}, renderProducts: () => 'full record',
  selectedProductId: 'A', productView: 'profile', activeSubPage: {}, document: { getElementById: () => null, querySelector: () => null, addEventListener() {} },
  PoolShedProductImages: { groupKey: p => p.parentSku || p.id, variantImageUrl: () => '', parentImageUrl: () => '' } };
ctx.window = ctx; ctx.PoolShedProductHub = hub; ctx.__POOL_SHED_GET_DATA__ = () => data;
vm.createContext(ctx); vm.runInContext(src, ctx);
const E = ctx.PoolShedProductEditor;

let html = ctx.renderProducts();
assert(/pe-page/.test(html) && /Product name \(all 2 variants\)/.test(html), 'one page for the family');
assert(/data-pe-row="0" data-pe-col="rrp"/.test(html) && /data-pe-row="1" data-pe-col="cost"/.test(html), 'variants grid');
assert(/data-pe="A\|leadTimeDays" value="5"/.test(html), 'lead time shows the supplier record when the product has none');
assert(/50% margin/.test(html), 'margin at RRP');
assert(/From the last 90 days|Ordered when sold/.test(html) && /data-pe-all="Overview">All fields/.test(html), 'reordering card and All fields');
const sg = E.suggest(products[0]); assert(sg && sg.sold === 45 && sg.at === 6 && sg.to >= 21, 'levels suggested from 90 days only: ' + JSON.stringify(sg));

E.setDraft('A', 'parentName', 'Chlorine Tablets'); E.setDraft('A', 'cost', '12'); E.setDraft('B', 'trade', '41.5'); E.setDraft('A', 'keep', true); E.setDraft('A', 'reorderPoint', '6'); E.setDraft('A', 'targetStock', '24'); E.setDraft('A', 'status', 'draft');
assert(/7 unsaved changes/.test(E.editorHtml(products[0])), 'save bar counts the changes');
assert.equal(products[0].cost, 10, 'nothing changes before Save');
const n = E.apply();
assert.equal(n, 7); assert.equal(saved, 1, 'one save');
assert(products.slice(0, 2).every(p => p.parentName === 'Chlorine Tablets'), 'family name renamed on every variant');
assert.deepEqual([products[0].cost, products[1].trade, products[0].replenishmentEnabled, products[0].reorderPoint, products[0].reorder, products[0].targetStock, products[0].restockTo, products[0].status], [12, 41.5, true, 6, 6, 24, 24, 'Needs review']);
const offer = data.supplierProducts[0];
assert.deepEqual([offer.cost, offer.leadTimeDays, offer.minQty], [12, 5, 2], 'supplier cost kept in step; its lead time and minimum order untouched');
E.setDraft('A', 'status', 'archived'); E.apply(); assert(products[0].archived === true, 'archive');
E.setDraft('A', 'status', 'active'); E.apply(); assert(!products[0].archived && products[0].status === '', 'restore to active');
E.setDraft('A', 'sku', 'OTHER'); assert(/already used/.test(E.validate()), 'duplicate SKU caught'); E.state.draft = {};
E.state.allFields.A = true; assert.equal(ctx.renderProducts(), 'full record', 'All fields shows the full record'); delete E.state.allFields.A;
ctx.productView = 'list'; assert.equal(ctx.renderProducts(), 'full record', 'other product views untouched');
console.log('Product editor v1.93: one page, held changes, family rename, grid, supplier record safe, reordering, status, SKU checks.');
