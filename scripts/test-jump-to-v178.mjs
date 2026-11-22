// v1.78 Jump to anything: Ctrl/Command+K box over pages, records (with quotes) and "new" actions.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const src = fs.readFileSync('public/jump-to.js', 'utf8');
const box = { value: 'kept' }, store = {};
const ctx = { console, setTimeout, clearTimeout, JSON, Object, Array, String, Number, document: { addEventListener(){}, getElementById: id => id === 'globalSearch' ? box : null, querySelectorAll: () => [] },
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
  PoolShedFrame: { MENU: [{ label: 'Accounts', pages: [['accounting', 'Customer Invoices', 'Invoices']] }, { label: 'Settings', pages: [['settings', 'Users', 'Users']] }], create(){}, openPage(){} },
  __POOL_SHED_CAN_ACCESS__: tab => tab !== 'settings',
  product: id => id === 'P-OLD' ? { id, hiddenFromCatalogue: true } : { id },
  globalSearchResults: () => { const q = box.value; return [
    { type: 'Sales Order', id: 'SO-2063', title: 'SO-2063 - Matthew White', snippet: 'Open', action: 'salesOrder' },
    { type: 'Sales Order', id: 'SO-2061', title: 'SO-2061 - Matthew White', snippet: 'Invoiced', action: 'salesOrder' },
    { type: 'Product', id: 'P-OLD', title: 'Old one-off', snippet: '', action: 'product' },
    { type: 'Customer', id: 'C-1', title: 'Matthew White', snippet: '', action: 'customer', q }].filter(r => q.length >= 2); },
  PoolShedQuoteStudio: { listQuotes: () => [{ id: 'Q-2026-0002', projectName: 'Pool package', customerId: 'C-1', status: 'Draft' }], customer: () => ({ name: 'Matthew White' }) } };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
const J = ctx.PoolShedJump;
let r = J.build('matthew white');
const types = r.filter(x => x.group === 'Records').map(x => x.type);
assert.equal(types[0], 'Customer', 'people first'); assert.equal(types[1], 'Quote', 'quotes are searched');
assert.ok(!r.some(x => x.id === 'P-OLD'), 'one-off products hidden from the catalogue are not offered');
assert.equal(box.value, 'kept', 'the top search box is left as it was');
r = J.build('SO-2061'); assert.equal(r[0].id, 'SO-2061', 'an exact reference goes to the top');
r = J.build('invoices'); assert.ok(r.some(x => x.kind === 'page' && x.title === 'Invoices'), 'pages are found');
r = J.build('users'); assert.ok(!r.some(x => x.kind === 'page' && x.tab === 'settings'), 'pages the role cannot open are not offered');
r = J.build('new quote'); assert.ok(r.some(x => x.kind === 'new' && x.id === 'quote'));
J.remember({ kind: 'record', action: 'salesOrder', id: 'SO-2063', title: 'SO-2063 - Matthew White', type: 'Sales order' });
J.remember({ kind: 'new', id: 'quote', title: 'New quote' });
r = J.build(''); assert.equal(r[0].group, 'Recent'); assert.equal(r[0].id, 'SO-2063'); assert.ok(!r.some(x => x.group === 'Recent' && x.kind === 'new'), 'actions are not kept as recent');
for (let i = 0; i < 12; i++) J.remember({ kind: 'record', action: 'customer', id: 'C-' + i, title: 'x', type: 'Customer' });
assert.equal(JSON.parse(store['poolshed:jump-recent']).length, 8, 'at most 8 recent');
// Wiring
assert.ok(src.includes("(e.ctrlKey || e.metaKey) && !e.altKey && String(e.key).toLowerCase() === 'k'") && src.includes('e.stopImmediatePropagation()'), 'Ctrl/Command+K, ahead of the old shortcut');
const frame = fs.readFileSync('public/back-office-frame.js', 'utf8'), index = fs.readFileSync('public/index.html', 'utf8'), qw = fs.readFileSync('public/quote-studio-workspace.js', 'utf8');
assert.ok(frame.includes('data-jump-open'));
assert.ok(index.indexOf('jump-to.js') > index.indexOf('back-office-frame.js'));
assert.ok(qw.includes('openQuote:function(id){if(engine.getQuote(id))setQuote(id)}'));
console.log('Jump to v1.78: pages, records with quotes, new actions, role-aware, exact reference first, recent items.');
