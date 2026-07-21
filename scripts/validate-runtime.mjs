import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(process.argv[2] || 'public');
const htmlPath = path.join(root, 'index.html');
const swPath = path.join(root, 'service-worker.js');
const configPath = path.join(root, 'config.js');

for (const file of [htmlPath, swPath, configPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing required deployment file: ${file}`);
}

const html = fs.readFileSync(htmlPath, 'utf8');
if (!html.includes('<!doctype html>') || !html.includes('The Pool Shed')) {
  throw new Error('index.html does not look like The Pool Shed app');
}

const scriptRegex = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
while ((match = scriptRegex.exec(html))) {
  count += 1;
  try {
    new vm.Script(match[1], { filename: `index-inline-${count}.js` });
  } catch (error) {
    throw new Error(`Inline JavaScript ${count} failed syntax validation: ${error.message}`);
  }
}
if (!count) throw new Error('No inline application scripts were found');

new vm.Script(fs.readFileSync(swPath, 'utf8'), { filename: 'service-worker.js' });

for (const required of ['matchesSearchProduct', 'renderProducts', 'render', 'saveAppData']) {
  if (!html.includes(required)) throw new Error(`Required application function missing: ${required}`);
}

console.log(`Runtime validation passed: ${count} inline scripts, service worker and required app functions.`);
