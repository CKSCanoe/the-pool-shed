// v1.62 (020 + 034): staff read only through the role-filtered functions. The raw workspace table keeps only its
// change stamp; the unused first-design tables are closed to signed-in and anonymous users; nothing is dropped.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const strip = s => s.replace(/--.*$/gm, '');
const m020 = strip(fs.readFileSync('database/020-close-direct-workspace-reads.sql', 'utf8'));
assert(/revoke select on public\.workspace_snapshots from authenticated;/.test(m020) && /grant select \(workspace_id, updated_at\) on public\.workspace_snapshots to authenticated;/.test(m020), '020: stamp only');
const m034 = strip(fs.readFileSync('database/034-lock-direct-access.sql', 'utf8'));
const fn = m034.slice(m034.indexOf('function public.ps_record_get('), m034.indexOf('end $$;'));
for (const [re, why] of [[/ps_workspace_can_read\(w\)/, 'workspace members only'], [/ps_section_hidden\(section, acc\)/, 'hidden sections stay hidden'],
  [/ps_record_visible\(section, item, acc, ids\)/, 'hidden records stay hidden (engineer jobs)'], [/ps_redact_item\(section, item, acc, ids\)/, 'hidden fields removed (costs)'],
  [/r\.deleted_at is null/, 'deleted records are not returned']]) assert(re.test(fn), why);
assert(/revoke all on function public\.ps_record_get\(text,text,text\) from public, anon;/.test(m034) && /grant execute on function public\.ps_record_get\(text,text,text\) to authenticated;/.test(m034));
assert(/revoke all on public\.%I from anon, authenticated/.test(m034) && !/\bdrop table\b|\bdelete from\b|\btruncate\b/i.test(m034), 'old tables closed, nothing dropped or deleted');
assert(!/'user_profiles'/.test(m034) && !/'workspace_snapshots'/.test(m034), 'user_profiles (in use) and the workspace table (020) are not touched here');
for (const t of ['products', 'sales_orders', 'purchase_orders', 'suppliers', 'quotes', 'sales_order_margin_summary']) assert(m034.includes("'" + t + "'"), t + ' closed');
const rb = fs.readFileSync('database/034-rollback.sql', 'utf8');
assert((rb.match(/^grant /gm) || []).length >= 41 && /drop function if exists public\.ps_record_get/.test(rb), 'exact rollback recorded');
// The app reads the raw workspace only as a fallback for a database without ps_workspace_load.
const app = fs.readFileSync('public/assets/js/01-legacy-01.js', 'utf8');
const direct = [...app.matchAll(/from\(["']workspace_snapshots["']\)\.select\(["']([^"']+)["']\)/g)].map(x => x[1]);
assert.deepEqual(direct.sort(), ['data,updated_at', 'updated_at'], 'only the load fallback and the change stamp read the table directly');
assert(/rpc\('ps_record_get', \{ w: WORKSPACE_ID, section: 'poolAudits', record_id: auditId \}\)/.test(app), 'audit handover uses the role-filtered record read');
const azzy = fs.readFileSync('server/azzy-pool-shed.js', 'utf8');
assert(azzy.indexOf('rpc/ps_workspace_load') < azzy.indexOf('rest/v1/workspace_snapshots') && /if\(r\.status===404\)\{/.test(azzy), 'Azzy reads through ps_workspace_load; direct read only on an old database');
console.log('Locked reads v1.62: one-record read follows the role rules, raw workspace stamp only, first-design tables closed.');
