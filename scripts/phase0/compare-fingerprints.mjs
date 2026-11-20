#!/usr/bin/env node
// Compares two fingerprints. Exit 0 = identical data, 1 = differences (listed).
// Usage: node scripts/phase0/compare-fingerprints.mjs <before.json> <after.json>
import fs from "node:fs";

const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error("Usage: node scripts/phase0/compare-fingerprints.mjs <before.json> <after.json>"); process.exit(2); }
const before = JSON.parse(fs.readFileSync(a, "utf8"));
const after = JSON.parse(fs.readFileSync(b, "utf8"));
const problems = [];

for (const [k, v] of Object.entries(before.money)) {
  if (after.money[k] !== v) problems.push(`money.${k}: ${v} -> ${after.money[k]}`);
}
for (const key of new Set([...Object.keys(before.sections), ...Object.keys(after.sections)])) {
  const x = before.sections[key], y = after.sections[key];
  if (!x) { problems.push(`section added: ${key}`); continue; }
  if (!y) { problems.push(`section MISSING: ${key}`); continue; }
  if (x.count !== y.count) problems.push(`${key}: count ${x.count} -> ${y.count}`);
  if (x.idsSha256 !== y.idsSha256) problems.push(`${key}: record ids differ`);
  else if (x.sha256 !== y.sha256) problems.push(`${key}: same records, contents differ`);
}

if (!problems.length && before.totalSha256 === after.totalSha256) {
  console.log(`PASS · identical (${before.totalSha256.slice(0, 16)}…)`);
  process.exit(0);
}
console.log(`DIFFERENT · ${problems.length} difference(s)`);
problems.forEach((p) => console.log("  - " + p));
process.exit(1);
