import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = fs.readFileSync('pnpm-lock.yaml', 'utf8');

function esc(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function importerEntry(name) {
  const key = name.startsWith('@') ? `'${name}'` : name;
  const re = new RegExp(`^\\s{6}${esc(key)}:\\n\\s{8}specifier:\\s*([^\\n]+)\\n\\s{8}version:\\s*([^\\n]+)`, 'm');
  const match = lock.match(re);
  return match ? { specifier: match[1].trim().replace(/^['"]|['"]$/g, ''), version: match[2].trim().replace(/^['"]|['"]$/g, '') } : null;
}

for (const [name, specifier] of Object.entries(pkg.dependencies || {})) {
  const entry = importerEntry(name);
  assert.ok(entry, `pnpm-lock root importer is missing dependency ${name}`);
  assert.equal(entry.specifier, specifier, `pnpm-lock specifier mismatch for dependency ${name}`);
}

for (const [name, specifier] of Object.entries(pkg.devDependencies || {})) {
  const entry = importerEntry(name);
  assert.ok(entry, `pnpm-lock root importer is missing devDependency ${name}`);
  assert.equal(entry.specifier, specifier, `pnpm-lock specifier mismatch for devDependency ${name}`);
  const packageKey = name.startsWith('@') ? `'${name}@${entry.version}'` : `${name}@${entry.version}`;
  assert.match(lock, new RegExp(`^\\s{2}${esc(packageKey)}:`, 'm'), `pnpm-lock package entry is missing ${name}@${entry.version}`);
}

assert.match(lock, /playwright-core@1\.55\.0:[\s\S]*?sha512-GvZs4vU3U5ro2nZpeiwyb0zuFaqb9sUiAJuyrWpcGouD8y9\/HLgGbNRjIph7zU9D3hnPaisMl9zG9CgFi\/biIg==/, 'Playwright Core 1.55.0 lock integrity is missing');

console.log('PASS package.json and pnpm-lock.yaml are synchronised for frozen CI installs');
