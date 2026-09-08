import fs from 'node:fs';
const index = fs.readFileSync('public/index.html','utf8');
const js = fs.readFileSync('public/sales-order-customer-picker.js','utf8');
const css = fs.readFileSync('public/sales-order-customer-picker.css','utf8');
const sw = fs.readFileSync('public/service-worker.js','utf8');
const checks = [
  ['picker JS loaded', index.includes('sales-order-customer-picker.js')],
  ['picker CSS loaded', index.includes('sales-order-customer-picker.css')],
  ['live customer search', js.includes('function searchCustomers(query)') && js.includes('data-so-customer-search')],
  ['create and attach', js.includes('function createAndAttachCustomer(form)') && js.includes('applyCustomerToSalesOrder(orderId, newCustomer.id)')],
  ['CRM record created', js.includes('data.customers.push(newCustomer)')],
  ['duplicate check', js.includes('function findDuplicate(form)') && js.includes('Use existing')],
  ['keyboard navigation', js.includes("event.key === 'ArrowDown'") && js.includes("event.key === 'Enter'")],
  ['drawer stays on SO', css.includes('.so-customer-drawer-shell') && css.includes('position: fixed')],
  ['offline cache updated', sw.includes('sales-order-customer-picker.js') && sw.includes('pool-shed-app-v1-po-picker-modal-final-sales-table-header-fix-smart-customer-picker')],
  ['old datalist replaced at runtime', js.includes('smart-customer-select') && js.includes('salesOrderCustomerOptions')]
];
let failed = false;
for (const [name, ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed=true; }
if (failed) process.exit(1);
