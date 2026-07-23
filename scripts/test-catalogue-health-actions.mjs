import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
function extract(name, nextName) {
  const start = html.indexOf(`      function ${name}`);
  if (start < 0) throw new Error(`Missing ${name}`);
  const end = nextName ? html.indexOf(`      function ${nextName}`, start + 1) : -1;
  if (end < 0) throw new Error(`Missing boundary after ${name}`);
  return html.slice(start, end);
}
const source = [
  extract('parseCsvDocument(text)', 'importProductsCsv'),
  extract('catalogueHealthFieldLabel(field)', 'catalogueHealthInput'),
  extract('validateCatalogueHealthImport(text)', 'importCatalogueHealthCorrections')
].join('\n');
const products = [
  { id: 'P-1', sku: 'SKU-ONE', name: 'Product One', cost: 0, rrp: 0, deleted: false },
  { id: 'P-2', sku: 'SKU-TWO', name: 'Product Two', cost: 2, rrp: 5, deleted: false }
];
const context = vm.createContext({ data: { products }, console });
new vm.Script(source).runInContext(context);

const parsed = context.parseCsvDocument('\ufeff"sku","description","rrp"\r\n"SKU-ONE","Line one\nLine two","12.50"\r\n');
if (parsed.rows.length !== 1 || parsed.rows[0].description !== 'Line one\nLine two') throw new Error('Quoted multiline CSV parsing failed');

const valid = context.validateCatalogueHealthImport('sku,rrp,issueFields\nSKU-ONE,12.50,rrp\n');
if (valid.errors.length || valid.updates.length !== 1 || valid.updates[0].changes.rrp !== 12.5) throw new Error('Valid correction was not accepted');

const unknown = context.validateCatalogueHealthImport('sku,rrp,issueFields\nNEW-SKU,12.50,rrp\n');
if (!unknown.errors.some((value) => value.includes('does not exist'))) throw new Error('Unknown SKU was not blocked');

const invalidPrice = context.validateCatalogueHealthImport('sku,rrp,issueFields\nSKU-ONE,0,rrp\n');
if (!invalidPrice.errors.some((value) => value.includes('greater than zero'))) throw new Error('Invalid price was not blocked');

for (const marker of [
  'type="button" class="secondary" data-health-export="true"',
  'type="button" data-health-import="true"',
  'event.preventDefault(); event.stopPropagation(); exportCatalogueHealthIssues();',
  'event.preventDefault(); event.stopPropagation(); importCatalogueHealthCorrections();'
]) {
  if (!html.includes(marker)) throw new Error(`Missing working action marker: ${marker}`);
}
console.log('Catalogue Health export/import action tests passed.');
