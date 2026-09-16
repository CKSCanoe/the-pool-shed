import fs from 'node:fs';import assert from 'node:assert/strict';
const inv=fs.readFileSync('public/inventory-workspace.js','utf8');const product=fs.readFileSync('public/product-hub-workspace.js','utf8');
assert(!product.includes('Open Product 360'),'Product quick view must say Product Details');
assert(!product.includes('PRODUCT 360'),'Product detail kicker must say Product Details');
for(const token of ["active='products'","active='jobs'","active='warehouse'","active='purchase'",'Replenishment']) assert(inv.includes(token),`Inventory must connect to destination: ${token}`);
console.log('PASS Inventory cross-module navigation and Product Details terminology');
