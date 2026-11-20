#!/usr/bin/env node
// Re-checks a backup folder on disk: every file still matches the hash recorded when it was taken.
// Usage: node scripts/phase0/verify-backup.mjs backups/<folder>
import fs from "node:fs";
import path from "node:path";
import { ROOT, sha256 } from "./lib.mjs";

const dir = process.argv[2] ? path.resolve(ROOT, process.argv[2]) : null;
if (!dir || !fs.existsSync(dir)) { console.error("Usage: node scripts/phase0/verify-backup.mjs backups/<folder>"); process.exit(2); }
let ok = 0, bad = 0;
const check = (rel, expected) => {
  const file = path.join(dir, rel);
  if (!fs.existsSync(file)) { bad += 1; console.log(`  MISSING ${rel}`); return; }
  if (sha256(fs.readFileSync(file)) !== expected) { bad += 1; console.log(`  CHANGED ${rel}`); return; }
  ok += 1;
};
const dbManifest = path.join(dir, "manifest.json");
if (fs.existsSync(dbManifest)) {
  const m = JSON.parse(fs.readFileSync(dbManifest, "utf8"));
  for (const [rel, info] of Object.entries(m.files)) check(rel, info.sha256);
  const failedTables = Object.entries(m.tables).filter(([, v]) => v && v.error).map(([k]) => k);
  if (failedTables.length) { bad += failedTables.length; console.log(`  Tables that failed to export: ${failedTables.join(", ")}`); }
}
const stManifest = path.join(dir, "storage-manifest.json");
if (fs.existsSync(stManifest)) {
  const m = JSON.parse(fs.readFileSync(stManifest, "utf8"));
  for (const [bucket, rec] of Object.entries(m.buckets)) {
    for (const [name, info] of Object.entries(rec.files)) check(path.join("storage", bucket, name), info.sha256);
    if (rec.failed.length) { bad += rec.failed.length; console.log(`  ${rec.failed.length} file(s) in ${bucket} were never downloaded`); }
  }
}
console.log(bad ? `FAIL · ${ok} good, ${bad} problem(s)` : `PASS · all ${ok} files intact`);
process.exit(bad ? 1 : 0);
