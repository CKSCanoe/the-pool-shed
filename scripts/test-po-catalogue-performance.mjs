import fs from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

const source = fs.readFileSync(new URL('../public/catalogue-intelligence.js', import.meta.url), 'utf8');
const products = [];
const supplierProducts = [];
for (let i = 0; i < 6000; i += 1) {
  const id = `P-${i}`;
  const sku = i === 4321 ? 'PB-CPC-SODIUM-HYPO-20L' : `PB-TEST-${String(i).padStart(5, '0')}`;
  products.push({ id, sku, name: i === 4321 ? '14/15% Sodium Hypochlorite - 20ltr' : `Catalogue Product ${i}`, supplier: i % 2 ? 'Certikin' : 'Lighthouse Pools', supplierSku: `SUP-${i}`, category: i % 3 ? 'Pipe & Fittings' : 'Chemicals', cost: i + 0.25, rrp: i + 1.5, active: true });
  supplierProducts.push({ productId: id, supplier: i % 2 ? 'Certikin' : 'Lighthouse Pools', supplierSku: `SUP-${i}`, cost: i + 0.25, available: true, leadTimeDays: 5 });
}
const listeners = {};
const document = {
  addEventListener(type, fn) { listeners[type] = fn; },
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  body: { appendChild() {}, classList: { add() {}, remove() {} } },
  documentElement: { style: { setProperty() {}, removeProperty() {} } },
  createElement() { return { style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, appendChild() {}, remove() {}, querySelectorAll() { return []; } }; }
};
const windowObj = { addEventListener() {}, PoolShedSalesSearch: null };
const context = {
  window: windowObj,
  document,
  navigator: { onLine: true },
  localStorage: { getItem() { return null; }, setItem() {} },
  setTimeout(fn) { return 0; },
  clearTimeout() {},
  requestAnimationFrame(fn) { fn(); },
  cancelAnimationFrame() {},
  console,
  performance,
  MutationObserver: class { observe() {} disconnect() {} },
  data: { products, supplierProducts, productParents: [], stock: [], suppliers: [] },
  supplierProfile(name) { return { name, preferred: name === 'Certikin', leadTimeDays: 5, creditLimit: 10000, creditUsed: 0 }; },
  supplierCreditPosition(s) { return { available: s.creditLimit - s.creditUsed }; },
  escapeHtml(v) { return String(v); },
  money(v) { return `£${Number(v).toFixed(2)}`; }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'catalogue-intelligence.js' });
const api = context.window.PoolShedCataloguePerformance;
if (!api) throw new Error('Performance API not exposed');
const t0 = performance.now();
const exact = api.search('PB-CPC-SODIUM-HYPO-20L', 10);
const t1 = performance.now();
const offers = api.purchaseSearch({ supplier: 'Certikin' }, 'sodium hypo 20l', 10);
const t2 = performance.now();
for (let i = 0; i < 25; i += 1) api.purchaseSearch({ supplier: 'Certikin' }, `product ${1000 + i}`, 10);
const t3 = performance.now();
if (!exact.length || exact[0].product.sku !== 'PB-CPC-SODIUM-HYPO-20L') throw new Error('Exact SKU ranking failed');
if (!offers.length || offers[0].product.sku !== 'PB-CPC-SODIUM-HYPO-20L') throw new Error('PO search ranking failed');
if ((t1 - t0) > 350) throw new Error(`Initial index/search too slow: ${(t1 - t0).toFixed(1)}ms`);
if ((t3 - t2) > 500) throw new Error(`Repeated PO searches too slow: ${(t3 - t2).toFixed(1)}ms`);
console.log(`PO catalogue performance passed: initial ${(t1-t0).toFixed(1)}ms, offers ${(t2-t1).toFixed(1)}ms, 25 repeated ${(t3-t2).toFixed(1)}ms`);
