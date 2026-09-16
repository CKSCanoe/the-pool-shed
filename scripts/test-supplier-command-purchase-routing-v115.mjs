import fs from 'node:fs';import assert from 'node:assert/strict';
const purchase=fs.readFileSync('public/purchase-workspace.js','utf8');
const supplier=fs.readFileSync('public/supplier-command-workspace.js','utf8');
assert(purchase.includes('globalThis.openPurchaseOrderTab'),'Purchasing must expose a controlled route to an exact PO tab');
assert(purchase.includes("purchaseCommandTab=tab||'items'")||purchase.includes("purchaseCommandTab = tab || 'items'"),'Purchase tab route must set the requested command tab');
assert(supplier.includes("openPurchaseOrderTab(poid,'costs')")||supplier.includes('openPurchaseOrderTab(poid,\'costs\')'),'Open Bill must route directly to PO Cost & Invoice tab');
console.log('PASS Supplier Command routes bills into the linked PO Cost & Invoice tab');
