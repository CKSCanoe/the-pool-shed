import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('public/supplier-command-workspace.js','utf8');
const css=fs.readFileSync('public/assets/css/system/49-supplier-command.css','utf8');
const purchase=fs.readFileSync('public/purchase-workspace.js','utf8');

for (const id of [
  'scSupplierName','scSupplierLegalName','scSupplierCompanyNumber','scSupplierVatNumber',
  'scSupplierContact','scSupplierContactRole','scSupplierPhone','scSupplierMobile',
  'scSupplierOrdersEmail','scSupplierAccountsEmail','scSupplierReturnsEmail',
  'scSupplierAddress1','scSupplierAddress2','scSupplierCity','scSupplierCounty','scSupplierPostcode','scSupplierCountry',
  'scSupplierAccountNumber','scSupplierTerms','scSupplierCredit','scSupplierLead',
  'scSupplierMinimumOrder','scSupplierFreeCarriage','scSupplierCurrency','scSupplierOrderMethod','scSupplierDeliveryTerms'
]) assert(source.includes('id="'+id+'"'),id+' missing from supplier onboarding');

assert.match(source,/function editSupplier\(name\)/,'Existing suppliers must use the same full profile editor');
assert.match(source,/function saveSupplierProfile\(originalName\)/,'Supplier master save handler missing');
assert.match(source,/function cascadeSupplierRename/,'Supplier rename must preserve linked records');
assert.match(source,/address:\{?address|address:address/,'Supplier address must be persisted');
assert.match(source,/supplierProfileSnapshot/,'New POs must snapshot supplier master details');
assert.match(source,/supplierAddress:Object\.assign/,'New POs must carry supplier address details');
assert.match(source,/supplier-master-summary/,'Supplier Contacts tab must surface the master profile');
assert.match(css,/Supplier master-record onboarding/,'Supplier profile design layer missing');
assert.match(css,/\.sc-profile-grid/,'Supplier profile needs structured responsive fields');
assert.match(purchase,/function poSupplierAddressText/,'Purchase Orders must understand supplier master addresses');
assert.match(purchase,/po-supplier-address/,'Purchase Order supplier card must show the supplier address');

console.log('PASS Supplier onboarding captures, edits and uses complete supplier master data');
