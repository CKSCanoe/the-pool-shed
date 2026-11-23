// v1.92 catalogue list: families with variants, tabs, search and filters, kept-in-stock mark, needs ordering, create POs, export.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';
const src = fs.readFileSync('public/catalogue-list.js', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');
assert(index.indexOf('catalogue-list.js') > index.indexOf('product-hub-workspace.js'), 'loads after the product hub');
assert(fs.readFileSync('public/service-worker.js', 'utf8').includes('./catalogue-list.js?v='), 'cached for offline use');
assert(fs.readFileSync('scripts/css-modules.mjs', 'utf8').includes('78-catalogue.css'), 'styles built');

const products = [
  { id: 'A1', name: 'Tabs 1kg', sku: 'TAB1', parentSku: 'GRP-1', parentName: 'Chlorine Tablets', variantValue: '1kg', variantSortOrder: 1, rrp: 15, cost: 9, supplier: 'Certikin', category: 'Chemicals', brand: 'X', replenishmentEnabled: true, reorderPoint: 4, targetStock: 12 },
  { id: 'A2', name: 'Tabs 5kg', sku: 'TAB5', parentSku: 'GRP-1', parentName: 'Chlorine Tablets', variantValue: '5kg', variantSortOrder: 2, rrp: 48, cost: 28, supplier: 'Certikin', category: 'Chemicals', brand: 'X' },
  { id: 'B1', name: 'Pump 1.5hp', sku: 'PMP', rrp: 1249, cost: 812, supplier: 'Pentair', category: 'Pumps', brand: 'Y', status: 'Needs review' },
  { id: 'C1', name: 'Old hose', sku: 'HOSE', rrp: 0, cost: 0, supplier: 'Pentair', category: 'Hoses', archived: true },
  { id: 'D1', name: 'Service', sku: 'SVC', productType: 'Service', rrp: 50, cost: 0, category: 'Labour' }
];
const stock = { A1: 2, A2: 7, B1: 0, C1: 0 };
const created = [];
const hub = {
  isStocked: p => p.productType !== 'Service', isOrderLineOnly: () => false, productById: id => products.find(p => p.id === id),
  stockSummary: id => ({ available: stock[id] || 0, onHand: stock[id] || 0, allocated: 0 }),
  replenishmentSettings: p => ({ enabled: !!p.replenishmentEnabled, reorderPoint: p.reorderPoint || 0, targetStock: p.targetStock || 0 }),
  replenishmentRow: p => { const a = stock[p.id] || 0, need = p.replenishmentEnabled && a <= p.reorderPoint; return { product: p, productId: p.id, supplier: p.supplier, supplierSku: p.sku, available: a, inbound: 0, demand: 0, projectedAvailable: a, reorderPoint: p.reorderPoint, targetStock: p.targetStock, suggestedQty: need ? p.targetStock - a : 0, unitCost: p.cost, needsOrder: need, reason: 'test' }; },
  replenishmentRows(o){ return products.filter(p => p.replenishmentEnabled).map(this.replenishmentRow).filter(r => !o || !o.needsOrder || r.needsOrder); },
  groupReplenishmentBySupplier: rows => { const m = {}; rows.forEach(r => { (m[r.supplier] = m[r.supplier] || { supplier: r.supplier, rows: [] }).rows.push(r); }); return Object.values(m); },
  createDraftPurchaseOrders: sel => { created.push(...sel); return [{ id: 'PO-9', lines: sel }]; }
};
let toasts = [];
const ctx = { console, setTimeout: f => 0, clearTimeout() {}, Set, data: { products, suppliers: [] }, toast: m => toasts.push(m), money: v => '£' + Number(v).toFixed(2), renderProducts: () => 'old', render() {}, saveAppData() {},
  selectedSubPage: () => 'Catalogue', productView: 'list', active: 'products', activeSubPage: {}, selectedPurchaseOrderId: '', purchaseOrderView: 'list', document: { getElementById: () => null, addEventListener() {}, querySelector: () => null } };
ctx.window = ctx; ctx.PoolShedProductHub = hub; ctx.__POOL_SHED_GET_DATA__ = () => ctx.data;
vm.createContext(ctx); vm.runInContext(src, ctx);
const C = ctx.PoolShedCatalogueList, st = C.state;

const fams = C.families();
assert.equal(fams.length, 4, 'two variants make one family; four products in all');
const tabs = f => fams.filter(x => C.inTab(x, f)).map(x => x.name).sort().join(',');
assert.equal(tabs('all'), 'Chlorine Tablets,Pump 1.5hp,Service', 'archived products leave the other tabs');
assert.equal(tabs('archived'), 'Old hose');
assert.equal(tabs('draft'), 'Pump 1.5hp', '"Needs review" counts as draft');
assert.equal(tabs('kept'), 'Chlorine Tablets'); assert.equal(tabs('needs'), 'Chlorine Tablets', 'kept variant at 2 ≤ 4 needs ordering');
const tab = fams.find(f => f.name === 'Chlorine Tablets');
assert.deepEqual([tab.items.length, tab.min, tab.max, tab.available, tab.kept, tab.needs], [2, 15, 48, 9, true, 1], 'family totals');

let html = ctx.renderProducts();
assert(/cl-page/.test(html) && /Chlorine Tablets<span class="cl-keep"/.test(html), 'list drawn with the ◆ mark');
assert(/2 variants · GRP-1/.test(html) && /Needs ordering/.test(html), 'family row and Needs ordering tag');
st.q = 'pump'; html = C.listPage(); assert(/Pump 1\.5hp/.test(html) && !/Chlorine Tablets<span/.test(html), 'search narrows the list'); st.q = '';
st.supplier = 'Pentair'; html = C.listPage(); assert(!/Chlorine Tablets<span/.test(html), 'supplier filter'); st.supplier = '';
st.open[tab.key] = true; html = C.listPage(); assert(/1kg <small>TAB1<\/small>/.test(html) && /2 ≤ 4 · order 10/.test(html), 'variants fold out with why and how many to order');
st.tab = 'needs'; html = C.listPage(); assert(/Certikin/.test(html) && /data-cl-create-po="Certikin"/.test(html) && /value="10"/.test(html), 'ordering view grouped by supplier with the suggested quantity');
st.qty.A1 = 6; C.createPOs('Certikin');
assert.deepEqual(created.map(x => x.productId + ':' + x.qty), ['A1:6'], 'Create PO uses the edited quantity');
assert.equal(ctx.purchaseOrderView, 'detail', 'the new purchase order opens, ready to approve and email');
assert(/Approve it, then Send to supplier/.test(toasts.join(' ')), 'tells you the next step');
ctx.selectedSubPage = () => 'Product Groups'; assert.equal(ctx.renderProducts(), 'old', 'other product pages untouched');
assert(/data-cl-bulk="prices"/.test(src) && /Change by %/.test(src) && /p\.replenishmentEnabled = v\.on === 'yes'/.test(src) && /p\.archived = true/.test(src), 'bulk changes: prices, keep in stock, archive');
assert(/pool-shed-reorder-report-/.test(src) && /pool-shed-catalogue-/.test(src), 'catalogue and reorder report exports');
console.log('Catalogue list v1.92: families, tabs, search and filters, ◆ kept in stock, needs ordering, create POs, bulk changes, exports.');
