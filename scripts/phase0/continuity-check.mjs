#!/usr/bin/env node
// Continuity check: proves every record that existed in an earlier snapshot still exists now.
// New records and normal edits by staff are allowed and listed; a record that has disappeared fails the check.
// Usage: node scripts/phase0/continuity-check.mjs <earlier-snapshot.json> <current-snapshot.json>
// Each file may be the raw `data` object, a workspace_snapshots row, or an array holding that row.
// Prints counts only (no names or amounts), so the output is safe to paste into the release log.
import fs from "node:fs";
import { canonical, sha256 } from "./lib.mjs";

const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error("Usage: node scripts/phase0/continuity-check.mjs <earlier.json> <current.json>"); process.exit(2); }

function load(file) {
  let v = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Array.isArray(v)) v = v.find((r) => r && r.workspace_id === "pool-bros-main") || v[0];
  return v && v.data && typeof v.data === "object" && !Array.isArray(v.data) ? v.data : v;
}

// A stable key per record: its id where it has one, otherwise the fields that identify it.
function keyOf(item) {
  if (item && typeof item === "object") {
    if (item.id != null) return "id:" + item.id;
    if (item.productId != null) return "stock:" + item.productId + "|" + (item.locationId ?? item.location ?? "");
    if (item.name != null) return "name:" + item.name;
  }
  return "hash:" + sha256(canonical(item));
}

const before = load(a), after = load(b);
const rows = [];
let lost = 0;
for (const section of Object.keys(before).sort()) {
  const x = before[section];
  if (!Array.isArray(x)) continue;
  const y = Array.isArray(after[section]) ? after[section] : null;
  if (!y) { rows.push([section, x.length, "MISSING", x.length, 0, 0]); lost += x.length; continue; }
  const now = new Map(y.map((i) => [keyOf(i), sha256(canonical(i))]));
  const then = new Set();
  let missing = 0, changed = 0;
  for (const item of x) {
    const k = keyOf(item); then.add(k);
    if (!now.has(k)) missing += 1;
    else if (now.get(k) !== sha256(canonical(item))) changed += 1;
  }
  const added = [...now.keys()].filter((k) => !then.has(k)).length;
  lost += missing;
  if (x.length || y.length) rows.push([section, x.length, y.length, missing, added, changed]);
}

console.log("section".padEnd(26) + "before".padStart(8) + "now".padStart(8) + "missing".padStart(9) + "added".padStart(7) + "edited".padStart(8));
for (const r of rows) console.log(String(r[0]).padEnd(26) + String(r[1]).padStart(8) + String(r[2]).padStart(8) + String(r[3]).padStart(9) + String(r[4]).padStart(7) + String(r[5]).padStart(8));
if (lost === 0) { console.log("\nPASS · every earlier record is still present"); process.exit(0); }
console.log(`\nCHECK · ${lost} earlier record(s) no longer present. Confirm each was deleted on purpose by staff.`);
process.exit(1);
