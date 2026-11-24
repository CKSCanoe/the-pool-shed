// v1.98 fill the gaps: counts that leave out one-off custom items, editing like a spreadsheet with checks,
// RRP from cost, supplier price list (fill gaps or update, supplier offers too), images matched by file name, undo.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';
const index = fs.readFileSync('public/index.html', 'utf8');
assert(index.indexOf('product-data.js') > index.indexOf('stock-import.js'), 'loads after the stock import it reuses');
assert(fs.readFileSync('public/service-worker.js', 'utf8').includes('./product-data.js?v='), 'cached for offline use');
assert(/data-pd-open>Fill gaps/.test(fs.readFileSync('public/catalogue-list.js', 'utf8')), 'catalogue has the button');
assert(fs.readFileSync('scripts/css-modules.mjs', 'utf8').includes('system/83-product-data.css'), 'styles are a maintained module');

const data = { products: [
  { id: 'P1', sku: 'AB-1', name: 'Chlorine', cost: 10, rrp: 0, preferredSupplier: 'Acme' },
  { id: 'P2', sku: 'AB-2', name: 'pH Minus', cost: 0, rrp: 9.99 },
  { id: 'P3', sku: 'AB-3', name: 'Old', archived: true },
  { id: 'P4', sku: 'AB-4', name: 'Strips', cost: 5, rrp: 12, barcode: '5012345678900', imageUrl: 'media:x' },
  { id: 'P5', sku: 'POCUSTOM-1-x', name: 'Delivery', cost: 50, hiddenFromCatalogue: true }],
  supplierProducts: [{ productId: 'P1', supplier: 'Acme', supplierSku: 'ACM-1', cost: 10 }], stock: [], movements: [] };
const ctx = { console, data, saveAppData() {}, setTimeout, clearTimeout };
ctx.window = ctx; ctx.__POOL_SHED_GET_DATA__ = () => data;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/stock-import.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('public/product-data.js', 'utf8'), ctx);
const P = ctx.PoolShedProductData, st = P.state;

const c = P.counts();
assert.deepEqual([c.total, c.rrp, c.cost, c.barcode, c.image, c.oneOff], [3, 1, 1, 2, 2, 1], 'archived and one-off custom items left out');
assert.equal(P.barcodeIssue('5012345678900'), ''); assert.match(P.barcodeIssue('5012345678901'), /check digit/); assert.match(P.barcodeIssue('12AB'), /digits/);
assert.equal(P.priceFromCost(10, 40), 16.67, 'RRP from cost at a margin, rounded up to the penny');

st.gap = 'rrp'; assert.deepEqual(P.gridRows().map(p => p.id), ['P1']);
assert.equal(P.priceVisibleFromCost(), 1); assert.equal(st.draft.P1.rrp, '16.67');
P.setDraft('P2', 'barcode', '5012345678900');
assert.equal(P.saveDraft().ok, false, 'a barcode already on another product is refused');
P.setDraft('P2', 'barcode', ''); P.setDraft('P2', 'cost', '£2.10'); P.setDraft('P2', 'rrp', '9.99');
assert.deepEqual(Object.keys(st.draft.P2), ['cost'], 'unchanged values are not changes; £ is accepted');
let s = P.saveDraft(); assert(s.ok && s.count === 2); assert.equal(data.products[0].rrp, 16.67); assert.equal(data.products[1].cost, 2.1);
assert.equal(P.undo(s.rec.id).ok, true); assert.equal(data.products[0].rrp, 0); assert.equal(data.products[1].cost, 0);

// supplier price list
st.text = 'Supplier code\tNet price\tRRP\tEAN\nACM-1\t13.50\t24.99\t4006381333931\nAB-2\t2.10\t12\t\nZZ\t1\t2\t'; st.impSupplier = 'Acme'; st.fill = 'gaps';
let plan = P.buildImport();
assert.deepEqual(plan.lines.map(l => [l.p.id, l.how, l.ch.map(x => x.f).join(',')]), [['P1', 'supplier code', 'rrp,barcode'], ['P2', 'SKU', 'cost']], 'fill gaps: only what is missing');
assert.equal(plan.unmatched.length, 1);
st.fill = 'all'; plan = P.buildImport();
assert.deepEqual(plan.lines[0].ch.map(x => x.f + ':' + x.after), ['cost:13.5', 'rrp:24.99', 'barcode:4006381333931']);
assert.equal(plan.lines[1].big, true, 'RRP 9.99 → 12 is flagged as a 20% change');
const rec = P.applyImport(plan);
assert.equal(data.products[0].cost, 13.5); assert.equal(data.supplierProducts[0].cost, 13.5, "the supplier's offer follows");
data.products[0].rrp = 30; assert.equal(P.undo(rec.id).ok, false, 'refused once a value has changed again');
data.products[0].rrp = 24.99; assert.equal(P.undo(rec.id).ok, true); assert.equal(data.products[0].cost, 10); assert.equal(data.supplierProducts[0].cost, 10);

// images by file name
const m = n => { const r = P.matchFile(n); return (r.p && r.p.id) + (r.extra ? '+' : ''); };
assert.deepEqual(['AB-1.jpg', 'ab 1-2.png', '5012345678900.webp', 'ACM-1.jpg', 'nope.jpg'].map(m), ['P1', 'P1+', 'P4', 'P1', 'null']);
assert.deepEqual(P.planFiles([{ name: 'AB-1.jpg', type: 'image/jpeg' }, { name: 'AB-1_2.jpg', type: 'image/jpeg' }, { name: 'AB-4.jpg', type: 'image/jpeg' }, { name: 'AB-2.pdf', type: 'application/pdf' }]).map(x => x.kind || x.why),
  ['main_image', 'gallery', 'gallery', 'not a JPG, PNG or WebP image'], 'first image is the main one unless the product has one; extras go to the gallery');
assert(/Fill the gaps/.test(P.page()));
console.log('v1.98 product data test passed');
