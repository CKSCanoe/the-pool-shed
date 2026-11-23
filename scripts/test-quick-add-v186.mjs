// v1.86 Adding a customer or supplier from inside a sales order or purchase order.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = f => fs.readFileSync(f, 'utf8');
const sw = read('public/sales-workspace.js'), pick = read('public/sales-order-customer-picker.js'), pw = read('public/purchase-workspace.js');
// Sales order: the current customer card uses the search-as-you-type picker (it had silently stopped appearing)
assert.ok(sw.includes("(window.PoolShedCustomerPicker&&window.PoolShedCustomerPicker.markup?window.PoolShedCustomerPicker.markup(order,c):"));
assert.ok(pick.includes('function pickerMarkup(order, c) {') && pick.includes('markup: pickerMarkup,'));
assert.ok(pick.includes("new MutationObserver(function () { clearTimeout(pickerTimer);") && pick.includes(":not([data-customer-picker-bound])"), 'picker wired whenever it appears');
assert.ok(pick.includes('data-so-new-customer=') && pick.includes('function findDuplicate(form)') && pick.includes('applyCustomerToSalesOrder(orderId, newCustomer.id)'), 'add customer, duplicate check, attach');
assert.ok(pick.includes("want = t === 'Trade' ? 'trade' : t === 'Wholesale' ? 'wholesale' : 'rrp'") && pick.includes("form.dataset.priceListChosen = '1'"), 'price list follows the customer type');
// Purchase order: + New supplier in the supplier dropdown
assert.ok(pw.includes("'<option value=\"__new_supplier__\">+ New supplier…</option>'"));
assert.ok(pw.includes("if(select.value==='__new_supplier__'){poQuickAddSupplier(select.dataset.poSupplierChange);return;}"));
assert.ok(pw.includes("async function poQuickAddSupplier(poId){") && pw.includes("changePurchaseOrderSupplier(poId,name);"));
// Duplicate check runs before anything is created (name, email or account number)
const m = pw.match(/validate:function\(x\)\{([\s\S]*?)return '';\}\}\);/); assert.ok(m, 'validate present');
const validate = new Function('x', 'list', 'norm', m[1] + "return '';");
const norm = v => String(v || '').trim().toLowerCase(), list = [{ name: 'Certikin', ordersEmail: 'orders@certikin.example', accountNumber: 'A1' }];
assert.ok(validate({ name: 'certikin' }, list, norm).includes('already a supplier'));
assert.ok(validate({ name: 'New Co', ordersEmail: 'ORDERS@certikin.example' }, list, norm).includes('already a supplier'));
assert.ok(validate({ name: 'New Co', accountNumber: 'a1' }, list, norm).includes('already a supplier'));
assert.ok(validate({ name: 'New Co', ordersEmail: 'not-an-email' }, list, norm).includes('does not look right'));
assert.equal(validate({ name: 'New Co', ordersEmail: 'orders@newco.example' }, list, norm), '');
console.log('Quick add v1.86: customer picker with + Add customer on sales orders; + New supplier on purchase orders; duplicates caught.');
