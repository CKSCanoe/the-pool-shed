// v1.97 stock count import: paste or CSV, columns recognised, matched by SKU / barcode / supplier code / name,
// preview first, never below reserved, set or add, movements recorded, undo only when nothing has moved since.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';
const src = fs.readFileSync('public/stock-import.js', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');
assert(index.indexOf('stock-import.js') > index.indexOf('catalogue-list.js'), 'loads after the catalogue list it wraps');
assert(fs.readFileSync('public/service-worker.js', 'utf8').includes('./stock-import.js?v='), 'cached for offline use');
assert(/data-si-open>Import stock counts/.test(fs.readFileSync('public/catalogue-list.js', 'utf8')), 'catalogue has the button');
assert(fs.readFileSync('scripts/css-modules.mjs', 'utf8').includes('system/82-stock-import.css'), 'styles are a maintained module');

const moves = [];
const products = [{ id: 'P1', sku: 'AB-1', name: 'Chlorine', barcode: '5012345' }, { id: 'P2', sku: 'AB-2', name: 'pH Minus', supplierSku: 'SUP9' }, { id: 'P3', sku: 'SVC', name: 'Labour' }, { id: 'P4', sku: 'CD-4', name: 'Test Strips' }];
const data = { products, supplierProducts: [{ productId: 'P4', supplierSku: 'ACME-77' }], stock: [{ productId: 'P1', locationId: 'L-WH-A1', qty: 5, allocated: 3 }, { productId: 'P2', locationId: 'L-WH-A1', qty: 0, allocated: 0 }],
  locations: [{ id: 'L-WH-A1', name: 'Main Warehouse A1' }, { id: 'L-WH-B2', name: 'Overflow B2' }, { id: 'L-QUARANTINE', name: 'Quarantine' }], movements: [] };
const ctx = { console, data, addMovement: (...a) => moves.push(a), saveAppData() {}, PoolShedProductHub: { isStocked: p => p.id !== 'P3' } };
ctx.window = ctx; ctx.__POOL_SHED_GET_DATA__ = () => data;
vm.createContext(ctx); vm.runInContext(src, ctx);
const S = ctx.PoolShedStockImport;

// pasted from a sheet: header recognised, quotes stripped, all four ways of matching, location column, duplicates added together
S.state.text = 'Product code\tBarcode\tCount\tBin\nab-1\t\t1\t\n\t5012345\t2\tOverflow B2\nSUP9\t\t"12"\t\nACME 77\t\t4\t\nSVC\t\t4\t\nZZZ\t\t3\t\nAB-2\t\tx\t\nCD-4\t\t1\tQuarantine';
let p = S.buildPlan();
const got = Object.fromEntries(p.lines.map(l => [l.p.id + '@' + l.loc, [l.before, l.after, l.how, l.floored]]));
assert.deepEqual(got['P1@L-WH-A1'], [5, 3, 'SKU', true], 'counted 1 but 3 reserved: stays at 3 and is flagged');
assert.deepEqual(got['P1@L-WH-B2'], [0, 2, 'barcode', false], 'barcode match and location column');
assert.deepEqual(got['P2@L-WH-A1'], [0, 12, 'supplier code', false], 'supplier code on the product, quoted number');
assert.deepEqual(got['P4@L-WH-A1'], [0, 5, 'supplier code', false], 'supplier price-list code; held locations fall back, duplicates add up');
assert.equal(p.unmatched.length, 1, 'unknown code listed'); assert.equal(p.skipped.length, 1, 'non-stock product skipped'); assert.equal(p.bad.length, 1, 'bad quantity listed');

// CSV with no header, then "add" mode
S.state.text = 'AB-2,"1,200"\nAB-1,9'; S.state.mode = 'add'; p = S.buildPlan();
assert.deepEqual(p.lines.map(l => [l.p.id, l.after]).sort(), [['P1', 14], ['P2', 1200]], 'no header: code then count; add mode adds');
S.state.mode = 'set'; p = S.buildPlan();
assert.equal(S.buildPlan().header, false);
const rec = S.apply(p);
assert.equal(data.stock.find(r => r.productId === 'P1').qty, 9); assert.equal(data.stock.find(r => r.productId === 'P2').qty, 1200);
assert.equal(moves.length, 2, 'one movement per change'); assert(moves.every(m => m[5] === rec.id), 'movements carry the import reference');
assert.equal(data.stockImports.length, 1);

// undo refused once stock has moved, allowed otherwise; never twice
data.stock.find(r => r.productId === 'P1').qty = 8;
assert.equal(S.undo(rec.id).ok, false, 'refused after stock moved');
data.stock.find(r => r.productId === 'P1').qty = 9;
assert.equal(S.undo(rec.id).ok, true);
assert.deepEqual(data.stock.map(r => r.qty).slice(0, 2), [5, 0], 'put back'); assert.equal(moves.length, 4, 'undo is recorded, history kept');
assert.equal(S.undo(rec.id).ok, false, 'not twice');
assert(/Nothing changes until you confirm/.test(S.page()), 'page explains the safety');
console.log('v1.97 stock import test passed');
