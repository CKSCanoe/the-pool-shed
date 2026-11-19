#!/usr/bin/env node
// READ-ONLY export of every table the Supabase REST API exposes, plus the auth user list.
// It never writes to Supabase. Output: backups/<timestamp>-<target>/ with a SHA-256 manifest.
//
// Usage:
//   node scripts/phase0/backup-database.mjs                  # production (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
//   node scripts/phase0/backup-database.mjs --target staging # STAGING_SUPABASE_URL, STAGING_SUPABASE_SERVICE_ROLE_KEY
//   node scripts/phase0/backup-database.mjs --all-revisions  # include every ps_workspace_revisions row (can be very large)
import fs from "node:fs";
import path from "node:path";
import { ROOT, loadEnv, supabase, writeJson, stamp, human, sha256 } from "./lib.mjs";
import { fingerprint } from "./fingerprint.mjs";

loadEnv();
const args = process.argv.slice(2);
const target = args.includes("--target") ? args[args.indexOf("--target") + 1] : "production";
const allRevisions = args.includes("--all-revisions");
const db = supabase(target === "production" ? "" : target.toUpperCase() + "_");
const outDir = path.join(ROOT, "backups", `${stamp()}-${target}`);
const PAGE = 500;
const manifest = { target, host: db.host, startedAt: new Date().toISOString(), tables: {}, files: {} };

console.log(`Pool Shed read-only database export · ${target} (${db.host})`);
fs.mkdirSync(outDir, { recursive: true });

// 1. Discover tables from the REST schema (service role sees every exposed table).
const spec = await db.call("GET", "/rest/v1/", { accept: "application/openapi+json" });
const tables = Object.keys(spec.definitions || {}).sort();
if (!tables.length) throw new Error("No tables found. Is this the service-role key?");
console.log(`Found ${tables.length} tables.`);

for (const table of tables) {
  const isRevisions = table === "ps_workspace_revisions";
  const rows = [];
  try {
    if (isRevisions && !allRevisions) {
      rows.push(...await db.call("GET", `/rest/v1/${table}?select=*&order=updated_at.desc&limit=50`, { timeout: 300000 }));
      const head = await db.call("GET", `/rest/v1/${table}?select=updated_at&limit=1`, { raw: true, extra: { Prefer: "count=exact", Range: "0-0" } });
      manifest.tables[table + "_totalRows"] = Number((head.headers.get("content-range") || "").split("/")[1] || 0);
    } else {
      for (let offset = 0; ; offset += PAGE) {
        const page = await db.call("GET", `/rest/v1/${table}?select=*&limit=${PAGE}&offset=${offset}`, { timeout: 300000 });
        rows.push(...page);
        if (page.length < PAGE) break;
      }
    }
  } catch (error) {
    manifest.tables[table] = { error: String(error.message || error) };
    console.log(`  ! ${table}: ${error.message}`);
    continue;
  }
  const file = path.join(outDir, "tables", `${table}.json`);
  const info = writeJson(file, rows);
  manifest.tables[table] = { rows: rows.length, partial: isRevisions && !allRevisions };
  manifest.files[path.relative(outDir, file)] = info;
  console.log(`  ✓ ${table.padEnd(34)} ${String(rows.length).padStart(6)} rows  ${human(info.bytes)}`);
}

// 2. Auth users (ids, emails, metadata; never passwords). Needed to re-link profiles after a restore.
try {
  const users = [];
  for (let page = 1; ; page += 1) {
    const res = await db.call("GET", `/auth/v1/admin/users?page=${page}&per_page=200`);
    const list = res.users || [];
    users.push(...list.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, app_metadata: u.app_metadata, user_metadata: u.user_metadata })));
    if (list.length < 200) break;
  }
  const file = path.join(outDir, "auth-users.json");
  manifest.files["auth-users.json"] = writeJson(file, users);
  console.log(`  ✓ auth users ${users.length}`);
} catch (error) {
  console.log(`  ! auth users: ${error.message}`);
}

// 3. Fingerprint every workspace snapshot so later phases can prove nothing was lost.
const snapFile = path.join(outDir, "tables", "workspace_snapshots.json");
if (fs.existsSync(snapFile)) {
  for (const row of JSON.parse(fs.readFileSync(snapFile, "utf8"))) {
    const fp = fingerprint(row);
    const file = path.join(outDir, `fingerprint-${row.workspace_id}.json`);
    manifest.files[path.relative(outDir, file)] = writeJson(file, { workspace_id: row.workspace_id, updated_at: row.updated_at, ...fp });
    console.log(`  ✓ fingerprint ${row.workspace_id} (updated ${row.updated_at}) · ${fp.money.customers} customers, ${fp.money.products} products, ${fp.money.salesOrders} SOs, ${fp.money.purchaseOrders} POs, snapshot ${human(fp.canonicalBytes)}`);
  }
}

manifest.finishedAt = new Date().toISOString();
const failed = Object.entries(manifest.tables).filter(([, v]) => v && v.error);
writeJson(path.join(outDir, "manifest.json"), manifest);
console.log(`\nSaved to ${path.relative(ROOT, outDir)}${failed.length ? ` · ${failed.length} table(s) FAILED, see manifest` : " · all tables exported"}`);
console.log("This JSON export is the second copy. Also keep the pg_dump from the README.");
process.exit(failed.length ? 1 : 0);
