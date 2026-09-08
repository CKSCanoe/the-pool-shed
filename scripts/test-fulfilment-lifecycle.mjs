import fs from 'node:fs';
const js = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8');
const css = fs.readFileSync('public/assets/css/01-legacy-01.css', 'utf8');
const checks = [
  ['partial stage calculation', js.includes('function fulfilmentStageClass')],
  ['delivery uses shipped quantities', js.includes('shipState = fulfilmentStageClass(state.shipped, state.required')],
  ['shipment releases allocation', js.includes('releaseAllocatedStock(line.productId, line.qty, order.id)')],
  ['invoice completion reconciles allocation', js.includes('function completeSalesOrderAfterInvoice')],
  ['completed orders retain audit history', js.includes('order.completedAt = new Date().toISOString()')],
  ['amber partial icon styling', css.includes('.process-icon.partial')]
];
const failed = checks.filter(([, ok]) => !ok);
checks.forEach(([name, ok]) => console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`));
if (failed.length) process.exit(1);
