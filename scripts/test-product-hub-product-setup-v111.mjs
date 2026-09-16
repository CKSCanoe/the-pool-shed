import fs from 'node:fs';import assert from 'node:assert/strict';
const js=fs.readFileSync('public/assets/js/01-legacy-01.js','utf8');
for(const token of ['name="replenishmentEnabled"','name="supplierMoq"','name="supplierPackQty"','name="supplierLeadTime"']) assert(js.includes(token),`Product setup missing ${token}`);
for(const token of ['minimumOrderQuantity: Number(values.supplierMoq || 1)','orderMultiple: Number(values.supplierPackQty || 1)','leadTimeDays: Number(values.supplierLeadTime || 0)','preferredSupplier: (values.supplier || "").trim()','replenishmentEnabled: values.replenishmentEnabled !== "false"','restockTo: Number(values.restockTo || 0)']) assert(js.includes(token),`New product persistence missing ${token}`);
assert(js.includes('minQty: Number(values.supplierMoq || 1)')&&js.includes('packQty: Number(values.supplierPackQty || 1)'),'Supplier offer must inherit product MOQ and pack multiple');
console.log('PASS Product setup captures replenishment rules and supplier buying constraints');
