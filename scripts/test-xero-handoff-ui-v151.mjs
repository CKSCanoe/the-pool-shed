// v1.51: the opening-balances import reads Xero's Aged Payables export correctly and never guesses a supplier.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const ctx = { console, Intl, Date, Math, Number, String, JSON, Promise, encodeURIComponent,
  document: { addEventListener() {}, querySelector() { return null; } },
  __POOL_SHED_GET_DATA__: () => ({ suppliers: [{ name: 'Arrow Plant Hire', accountType: 'Credit', terms: 'Net 30' }, { name: 'Travis Perkins', accountType: 'Pro Forma' }] }) };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/purchases-ledger-workspace.js', 'utf8'), ctx);
const ui = ctx.PoolShedPurchasesUI;
const csv = 'Contact,Invoice Number,Invoice Date,Due Date,Amount Outstanding\r\n' +
  '"Arrow Plant Hire",APH-1001,01/10/2026,31/10/2026,"£1,250.50"\r\n' +
  'Travis Perkins,TP-77,15 Oct 2026,15/10/2026,300\r\n' +
  'Unknown Supplier Ltd,U-1,01/11/2026,01/12/2026,99.99\r\n' +
  'Arrow Plant Hire,APH-PAID,01/09/2026,01/10/2026,0\r\n';
const r = JSON.parse(JSON.stringify(ui._readOpening(csv)));
assert.deepEqual(r.rows, [
  { supplier_key: 'name:Arrow Plant Hire', supplier_invoice_no: 'APH-1001', invoice_date: '2026-10-01', due_date: '2026-10-31', outstanding_gross: 1250.5 },
  { supplier_key: 'name:Travis Perkins', supplier_invoice_no: 'TP-77', invoice_date: '2026-10-15', due_date: '2026-10-15', outstanding_gross: 300 }
], 'UK dates, £ and thousands separators, quoted names; paid (0) lines skipped');
assert.deepEqual(r.unknown, ['Unknown Supplier Ltd'], 'unmatched suppliers are listed, never guessed');
console.log('Xero hand-off v1.51: opening-balance import reads Aged Payables correctly and never guesses a supplier.');
