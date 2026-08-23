import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const failures = [];

if (/<title>[^<]*(?:v\d|version\s+\d)/i.test(index)) failures.push('A version number is visible in the page title.');
if (/bundle-(?:system-v2|studio-v\d+)/.test(index)) failures.push('Versioned bundle assets remain linked in index.html.');
if (pkg.version !== '1.0.0') failures.push('package.json is not Version 1.');
if (vercel.outputDirectory !== 'dist') failures.push('Vercel outputDirectory must be dist.');
for (const file of ['bundle-system.js','bundle-system.css','bundle-studio.js','bundle-studio.css']) {
  if (!fs.existsSync(path.join(root,'public',file))) failures.push(`Missing ${file}.`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Release cleanup checks passed.');
