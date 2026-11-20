#!/usr/bin/env node
// Builds a "nothing lost" fingerprint of a Pool Shed workspace snapshot.
// Usage: node scripts/phase0/fingerprint.mjs <workspace-snapshot.json> [out.json]
// Input may be the raw `data` object or a workspace_snapshots row ({ data, updated_at, ... }).
// Uses only stored values (never app pricing logic), so any change to the data changes the result.
import fs from "node:fs";
import { canonical, sha256, writeJson } from "./lib.mjs";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round = (v) => Math.round(v * 100) / 100;

export function fingerprint(input) {
  const data = input && input.data && typeof input.data === "object" && !Array.isArray(input.data) ? input.data : input;
  if (!data || typeof data !== "object") throw new Error("Snapshot is not a JSON object");
  const sections = {};
  for (const key of Object.keys(data).sort()) {
    const value = data[key];
    const entry = { type: Array.isArray(value) ? "array" : value === null ? "null" : typeof value, sha256: sha256(canonical(value)) };
    if (Array.isArray(value)) {
      entry.count = value.length;
      const ids = value.map((item) => (item && typeof item === "object" ? item.id ?? item.code ?? item.sku ?? null : null)).filter((id) => id !== null).map(String);
      entry.withId = ids.length;
      entry.uniqueIds = new Set(ids).size;
      entry.idsSha256 = sha256(ids.slice().sort().join("\n"));
    }
    sections[key] = entry;
  }
  const arr = (k) => (Array.isArray(data[k]) ? data[k] : []);
  const lines = (rows) => rows.flatMap((r) => (r && Array.isArray(r.lines) ? r.lines : []));
  const soLines = lines(arr("salesOrders"));
  const poLines = lines(arr("purchaseOrders"));
  const pays = (rows) => rows.flatMap((r) => (r && Array.isArray(r.payments) ? r.payments : []));
  const money = {
    salesOrders: arr("salesOrders").length,
    salesOrderLines: soLines.length,
    salesOrderLineQty: round(soLines.reduce((s, l) => s + num(l.qty), 0)),
    salesOrderLineValueRaw: round(soLines.reduce((s, l) => s + num(l.qty) * num(l.unitPrice ?? l.price), 0)),
    salesOrderPayments: round(pays(arr("salesOrders")).reduce((s, p) => s + num(p.amount), 0)),
    purchaseOrders: arr("purchaseOrders").length,
    purchaseOrderLines: poLines.length,
    purchaseOrderLineQty: round(poLines.reduce((s, l) => s + num(l.qty), 0)),
    purchaseOrderLineCostRaw: round(poLines.reduce((s, l) => s + num(l.qty) * num(l.unitCost), 0)),
    purchaseOrderPayments: round(pays(arr("purchaseOrders")).reduce((s, p) => s + num(p.amount), 0)),
    stockRows: arr("stock").length,
    stockQty: round(arr("stock").reduce((s, r) => s + num(r && r.qty), 0)),
    stockAllocated: round(arr("stock").reduce((s, r) => s + num(r && r.allocated), 0)),
    products: arr("products").length,
    productCostSum: round(arr("products").reduce((s, p) => s + num(p && p.cost), 0)),
    customers: arr("customers").length,
    suppliers: arr("suppliers").length,
    jobs: arr("jobs").length,
    quotes: arr("quotes").length
  };
  const text = canonical(data);
  return { version: 1, createdAt: new Date().toISOString(), totalSha256: sha256(text), canonicalBytes: Buffer.byteLength(text), money, sections };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, out] = process.argv.slice(2);
  if (!input) { console.error("Usage: node scripts/phase0/fingerprint.mjs <snapshot.json> [out.json]"); process.exit(2); }
  const result = fingerprint(JSON.parse(fs.readFileSync(input, "utf8")));
  if (out) writeJson(out, result);
  console.log(`Fingerprint ${result.totalSha256.slice(0, 16)}… (${Object.keys(result.sections).length} sections)`);
  for (const [k, v] of Object.entries(result.money)) console.log(`  ${k.padEnd(26)} ${v}`);
  if (out) console.log(`Saved ${out}`);
}
