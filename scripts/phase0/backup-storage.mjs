#!/usr/bin/env node
// READ-ONLY download of every file in every Supabase Storage bucket, with a SHA-256 manifest.
// Usage: node scripts/phase0/backup-storage.mjs [--target staging] [--into backups/<existing-folder>]
import fs from "node:fs";
import path from "node:path";
import { ROOT, loadEnv, supabase, writeJson, stamp, human, sha256 } from "./lib.mjs";

loadEnv();
const args = process.argv.slice(2);
const target = args.includes("--target") ? args[args.indexOf("--target") + 1] : "production";
const into = args.includes("--into") ? path.resolve(ROOT, args[args.indexOf("--into") + 1]) : path.join(ROOT, "backups", `${stamp()}-${target}`);
const db = supabase(target === "production" ? "" : target.toUpperCase() + "_");
const outDir = path.join(into, "storage");
const manifest = { target, host: db.host, startedAt: new Date().toISOString(), buckets: {} };

console.log(`Pool Shed read-only storage export · ${target} (${db.host})`);
const buckets = await db.call("GET", "/storage/v1/bucket");

async function list(bucket, prefix) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await db.call("POST", `/storage/v1/object/list/${encodeURIComponent(bucket)}`, { body: { prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } } });
    for (const item of page) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null || !item.metadata) out.push(...await list(bucket, full)); // folder
      else out.push({ name: full, size: Number(item.metadata.size || 0) });
    }
    if (page.length < 1000) break;
  }
  return out;
}

let totalFiles = 0, totalBytes = 0, failures = 0;
for (const bucket of buckets) {
  const objects = await list(bucket.name, "");
  const record = { public: !!bucket.public, files: {}, count: 0, bytes: 0, failed: [] };
  for (const obj of objects) {
    try {
      const res = await db.call("GET", `/storage/v1/object/${encodeURIComponent(bucket.name)}/${obj.name.split("/").map(encodeURIComponent).join("/")}`, { raw: true, accept: "*/*", timeout: 300000 });
      const buf = Buffer.from(await res.arrayBuffer());
      const file = path.join(outDir, bucket.name, obj.name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buf);
      record.files[obj.name] = { bytes: buf.length, sha256: sha256(buf) };
      record.count += 1; record.bytes += buf.length;
    } catch (error) {
      record.failed.push({ name: obj.name, error: String(error.message || error) });
      failures += 1;
    }
  }
  manifest.buckets[bucket.name] = record;
  totalFiles += record.count; totalBytes += record.bytes;
  console.log(`  ${record.failed.length ? "!" : "✓"} ${bucket.name.padEnd(22)} ${String(record.count).padStart(5)} files  ${human(record.bytes)}${record.failed.length ? `  (${record.failed.length} failed)` : ""}`);
}

manifest.finishedAt = new Date().toISOString();
writeJson(path.join(into, "storage-manifest.json"), manifest);
console.log(`\n${buckets.length} buckets · ${totalFiles} files · ${human(totalBytes)} saved to ${path.relative(ROOT, outDir)}`);
process.exit(failures ? 1 : 0);
