import fs from 'node:fs';
const js=fs.readFileSync('public/bundle-sales-intelligence.js','utf8');
const html=fs.readFileSync('public/index.html','utf8');
const engine=fs.readFileSync('public/bundle-engine.js','utf8');
const required=['Allocate available stock','Transfer internal stock','Create missing-item POs','bundleInstanceId','originalSalesOrderId','Bundle component shortage','PoolShedBundleIntelligence'];
for(const token of required){if(!js.includes(token))throw new Error('Missing intelligence feature: '+token)}
if(!html.includes('bundle-sales-intelligence.js')||!html.includes('bundle-sales-intelligence.css'))throw new Error('Intelligence assets are not linked');
if(!engine.includes('bundleComponentSnapshot'))throw new Error('Component history snapshot missing');
if(!engine.includes('api.allocate(order,group)'))throw new Error('Automatic component allocation missing');
console.log('Bundle sales intelligence tests: Passed');
