// v1.88: star favourites in the sales order product search, and Quick add under the search instead of in the order header.
import fs from 'node:fs';
const ws = fs.readFileSync('public/sales-workspace.js', 'utf8');
const flow = fs.readFileSync('public/sales-order-flow.js', 'utf8');
const css = fs.readFileSync('public/assets/css/system/76-overhaul-flows.css', 'utf8');
const fail = m => { console.error('FAIL favourites v1.88: ' + m); process.exit(1); };
for (const k of ['function so4IsFav(', 'function so4FavProducts(', 'function so4StockProducts(', 'function so4QuickChips(']) if (!ws.includes(k)) fail('missing ' + k);
if (!/data-so-fav="/.test(ws) || !/aria-pressed="' \+ fav/.test(ws)) fail('star button missing from results');
if (!/p\.salesFavourite\) delete p\.salesFavourite; else p\.salesFavourite = true;[\s\S]{0,80}saveAppData\(\)/.test(ws)) fail('star must toggle the shared product flag and save');
if (!/data-so4-quick="/.test(ws)) fail('Quick add row missing under the search');
if (ws.includes('<span>Try:</span>')) fail('old hidden "Try:" row should be replaced');
if (/quickAdd\(order, f\)|class="sof-quick"/.test(flow)) fail('Quick add should no longer sit in the order header');
if (!/oftenSold: oftenSold/.test(flow)) fail('often-sold list should be shared with the search panel');
if (!/so4-search-wrap > \.so4-stock-results \{ position: absolute !important/.test(css)) fail('results list should hang under the search box');

// ranking: exact SKU first, then favourites, then the rest; empty search shows favourites only
const start = ws.indexOf('  function so4IsFav('), end = ws.indexOf('  function so4QuickChips(');
const products = [
  { id: 'a', name: 'Alpha chlorine', sku: 'A1' }, { id: 'b', name: 'Beta chlorine', sku: 'B1', salesFavourite: true },
  { id: 'c', name: 'Gamma chlorine', sku: 'C1' }, { id: 'd', name: 'Delta tabs', sku: 'D1', salesFavourite: true }];
const fn = new Function('data', 'window', 'salesOrderCatalogueProducts', ws.slice(start, end) + '; return so4StockProducts;');
const scores = { A1: 10000 };
const win = { PoolShedSalesSearch: { rankProducts: (list, q) => list.filter(p => p.name.toLowerCase().includes(q) || p.sku === q).map((p, i) => ({ product: p, score: scores[q] && p.sku === q ? 10000 : 100 - i })).sort((x, y) => y.score - x.score) } };
const search = fn({ products }, win, () => products);
const ids = q => search(q).map(p => p.id).join(',');
if (ids('chlorine') !== 'b,a,c') fail('favourite should come first: got ' + ids('chlorine'));
if (ids('A1') !== 'a') fail('exact SKU should stay first: got ' + ids('A1'));
if (ids('') !== 'b,d') fail('empty search should list favourites: got ' + ids(''));
console.log('Favourites v1.88: starred products first, exact SKU still wins, Quick add under the search.');
