# Pool Shed release log

Status words: Working · Repaired · New · Tested locally · Deployed · Verified in production · Blocked · Outstanding.

---

## Phase 0 · Protect live data · started 19 Nov 2026

| # | Step | Status | Evidence |
|---|---|---|---|
| 0.1 | Local copy under git; baseline committed and tagged `v1.47.6-baseline` | **Done** | 860 files, commit `a96f48f` |
| 0.2 | Backups folder and secrets file excluded from git | **Done** | `.gitignore`: `backups/`, `.env.*.local` |
| 0.3 | Backup, fingerprint, compare and verify tools | **New · Tested locally** | `scripts/phase0/`; mock Supabase test (paging, revision limit, nested files, zero writes, tamper detection) |
| 0.4 | Existing build-gate tests on baseline | **Tested locally** | 83/83 pass |
| 0.5 | Full `pg_dump` of live database | **Done** | 120 MB custom-format dump + 495 KB schema SQL; 105 tables of data (58 public, auth, storage, realtime, vault); no errors |
| 0.6 | JSON export + live fingerprint | **Done** | 62 tables, 4 auth users, newest 5 revisions + index of all 314 |
| 0.7 | Storage file backup | **Done** | 4 buckets; 36 files, 90.7 MB (all in customer-media) |
| 0.8 | Backup integrity check, off-site copies ×2 | Integrity **PASS** (100 files); off-site copies **Outstanding** · owner | `backups/2026-11-19_22-39-32-production` (290 MB) |
| 0.9 | Restore drill into staging, fingerprint PASS | **Done · PASS** | Separate staging project (held only an empty Pool Shed schema, 0 rows, before the drill). Restored `auth.users` and the `public` schema from the pg_dump: 0 errors, 105 s. Snapshot fingerprint identical (`6b8eb341…`); all 58 public tables have identical row counts. Live unchanged (last save 20:56:45). |
| 0.10 | Compare with GitHub `main` and the v1.47.7 work (`d6a4d29`) | **Blocked** · repository URL and access needed | — |
| 0.11 | Vercel env var names inventory (names only) | **Outstanding** · needs owner | Vercel → Settings → Environment Variables |

### Live fingerprint

The full figures (record counts, money totals, fingerprint hash, project references) are kept **only** in the private backup folder: `backups/2026-11-19_22-39-32-production/LIVE-FINGERPRINT-PRIVATE.md` (git-ignored). This repository is public, so business figures stay out of it.

| Measure | Value |
|---|---|
| Snapshot updated_at | 2026-11-19 20:56:45 UTC |
| Snapshot size | 7.9 MB as text (868 KB compressed in Postgres); 48 sections |
| Duplicate record IDs | none |
| Revisions table | 314 rows, 210 MB (oldest 27 Sep 2026) |
| Whole database | 229 MB of 500 MB free-plan limit |

Staging follow-ups before Phase 1 testing: the `public` reset removed staging's storage policies and the `ps_on_auth_user_created` trigger on `auth.users`. Re-apply them from `pool-shed-schema.sql` before running the app against staging. Staging storage files are not yet copied.

Note: the older per-entity tables (`customers`, `products`, `sales_orders`, `stock_movements`, …) exist but are **empty**. All live business data is in the snapshot.

---

## Phase 1 · v1.48.0 egress fix · branch `phase-1-egress` · 19 Nov 2026

| # | Change | Status | Evidence |
|---|---|---|---|
| 1.1 | Sync checks only `updated_at` every 8 s while visible; full download only when another user saved; skipped while editing/saving | **New · Tested locally** | `scripts/test-egress-sync-v148.mjs`: idle hour = 450 stamp checks, 0 full downloads (was 720) |
| 1.2 | Realtime subscription on `workspace_snapshots` removed | **New · Tested locally** | Live publication was empty, so no behaviour is lost |
| 1.3 | Quote engagement refresh pauses while hidden | **New · Tested locally** | — |
| 1.4 | Logo 420 KB → 50 KB; design labs undeployed; `vercel.json` duplicate key removed | **New · Tested locally** | — |
| 1.5 | Version 1.48.0, new service-worker cache name | **New** | — |
| 1.6 | Build gate | **Tested locally** | 84/84 pass; CSS build and runtime validation pass |
| 1.7 | Staging repaired (login trigger, storage policies) | **Done** | staging only |
| 1.8 | Browser test on staging (owner's Chrome, measured with pg_stat_statements on staging) | **Tested on staging · PASS** | Idle 2 min: 10 stamp checks, 0 full downloads. Background tab: 0 requests. Simulated other-user save: tab synced on focus. That run exposed two bugs, fixed in `b4ca345`. Final run, about 2 h 40 min open: **1,213 stamp checks, 1 full download (initial load), 0 saves**, no new notifications. The old code would have made ~1,940 full downloads (~0.95 GB compressed). |
| 1.8a | Daily duplicate stock-count reminders forcing a full save | **Repaired · Tested on staging** | 45 duplicates in live data; key no longer includes the day |
| 1.8b | Simultaneous refresh triggers downloading 2–3 times | **Repaired · Tested on staging** | single in-flight lock |
| 1.8c | Committed `dist/` folder on GitHub is stale (older than `public/`); Vercel rebuilds it on deploy, so it is unused | **Outstanding** · remove from git in Phase 2 | found 20 Nov 2026 |
| 1.9 | Deploy to production and measure Supabase egress for 48 h | **Deployed 20 Nov 2026** · 48 h measurement **Outstanding** | PR #46 merged (`5453909`); live serves cache `pool-shed-v1.48.0-egress-r2`, 50 KB logo and the new sync code. Baseline at 08:20 UTC (stats since 19 Nov 16:26): 835 full-snapshot downloads and 11 stamp checks. Check again on 22 Nov: full downloads should grow only when someone saves; the stamp checks take over. |

Measured on live data (read-only): one old check = 7.07 MB (0.49 MB gzip); one new check = 51 bytes. The 11.51 GB overage ≈ 34 tab-hours of the old poll.

---

## Phase 2 · Database safety and size · branch `phase-2-db-safety` · 20 Nov 2026

| # | Change | Status | Evidence |
|---|---|---|---|
| 2.1 | Migration `014` replaces the never-applied `013`: keeps its safety rules (active-staff check, refuse to erase an established list, revisions index), **without** turning realtime back on | **New · Tested on staging** | `scripts/phase2/test-014-staging.sql`, run as a real staff account, every case rolled back: normal save, new customer and reordered receipts accepted; erase all customers, changed or removed receipt, duplicate receipt id, negative stock refused; stale save returns a conflict for the app to merge |
| 2.2 | Goods-in history check by hash instead of comparing every entry with every other (F5) | **New · Tested on staging** | 5,000 entries: old check 26.6 s (saves would time out), new 0.08 s. Today's data: 0.24 s. Normal save 0.85 s |
| 2.3 | Revision retention (F2): keep the newest 20, everything from 7 days, one a day to 90 days, one a month after; runs on the first save of each day | **New · Tested on staging** | Staging: 315 → 40 copies (oldest still 27 Sep); database 225 MB → **49 MB** after `VACUUM FULL`. One-off first run 11.6 s + 7.5 s vacuum, so on live it runs by hand at a quiet time |
| 2.4 | Rollback | **Ready** | `database/014-rollback.sql`, captured from live before any change |
| 2.5 | Hide costs and margins from Engineer accounts (F3) | **Deferred to Phase 3**, by decision | Live has 4 users, all Admin; nobody is exposed today. Stripping fields from one shared document is risky: an engineer's save would write the stripped copy back and could erase costs. Per-table security in Phase 3 does it properly. Until then: **do not give Engineer accounts to anyone who must not see costs** |
| 2.6 | `dist/` no longer tracked in git (121 stale files) | **Done** | `scripts/build.sh` deletes and rebuilds it; Vercel builds on deploy |
| 2.7 | Build-gate guard for 014 (no realtime, both save paths validated, prune staff-proof) | **New · Tested locally** | `scripts/test-migration-014.mjs` |
| 2.8 | Apply 014 to live, run the first clean-up, measure | **Deployed · Verified in production** 20 Nov 2026, 09:15 UTC | Pre-checks: live functions identical to the rollback capture; every pruned copy predates 12 Nov, so all are in the 19 Nov pg_dump. Applied with no errors; 4 Admin memberships unchanged; realtime still off. Clean-up: 315 → 40 copies (oldest 27 Sep) in 23.9 s, `VACUUM FULL` 8.8 s. **Database 230 MB → 51 MB.** Snapshot identical before and after (same md5 and counts). Rolled-back test save as a real admin: 0.99 s, accepted; rolled-back wipe of all products: refused by the safety lock. Daily retention now runs on the first save of each day. |
| 2.9 | Continuity check: every record from the 19 Nov backup still present on live | **PASS** 20 Nov 2026 | New `scripts/phase0/continuity-check.mjs` (allows new records and edits, fails on any missing record; tested against a copy with one customer removed). Live vs 19 Nov backup: 27 sections, 0 missing, including all customers, products, sales and purchase orders, receipts and audit history |

---

## Phase 3.1 · Per-record shadow store · migration `015` · 20 Nov 2026

| # | Change | Status | Evidence |
|---|---|---|---|
| 3.1a | `ps_records` (each record stored exactly as written), `ps_settings`, per-record `ps_record_history`, `ps_record_sync_issues`; service role only | **New · Tested on staging** | Backfill: 14,443 records + 9 settings in 2.9 s; `ps_records_verify` ok on all 48 sections (same records, content and order) |
| 3.1b | Trigger mirrors every save from every path, writing only changed records | **New · Tested on staging** | `scripts/phase3/test-015-staging.sql`, rolled back: edit, delete, add, reorder, setting change, id-less stock and supplier edits, Quote Studio path. History correct (one row per real change; none for reorders), versions increment, verify ok after each |
| 3.1c | A broken mirror never blocks a save | **Tested on staging** | Record table hidden mid-test: save succeeded, problem logged |
| 3.1d | Cost per save | **Measured** | Mirror step alone: ~0.2 s with nothing changed, ~0.25 s for a customer edit, ~0.45 s for a product edit (saves run in the background) |
| 3.1e | Server functions read single records | **Moved** to 3.2 (project tools) and Phase 7 (Azzy) | See PHASE-3-PLAN.md §3.1 |
| 3.1f | Build-gate guard | **New · Tested locally** | `scripts/test-migration-015.mjs` |
| 3.1g | Apply to live | **Deployed · Verified in production** 20 Nov 2026, 10:10 UTC | Private before-copy taken; continuity check PASS. Applied with no errors in 3.2 s: 14,438 records + settings mirrored; `ps_records_verify` ok on all 48 sections; snapshot byte-identical (same md5); staff cannot read the new tables; 0 sync issues. Rolled-back test saves as an admin: about 1.4–1.6 s with the mirror against 0.7 s without (first cold run 5.6 s). Saves run in the background; the per-save cost falls in 3.3, when saves become per-record. |
| 3.1h | **Mirror trigger switched off on live** (owner approved), 20 Nov 2026 ~11:35 UTC | **Paused** | Staging test showed saves timing out (8 s limit). Live app saves were already 5.8–7.9 s on the database (pg_stat_statements, 5 saves) because every save uploads and re-parses the whole 7.4 MB workspace; the mirror adds ~0.8 s. No live saves happened while it was on (none since 08:18), so nothing was lost. `alter table workspace_snapshots enable trigger zz_ps_records_mirror` turns it back on; a full re-mirror is needed first. Root fix: per-record saves (3.3). |

---

## v1.49.0 · Phase 3.2 + 3.3 · changes-only refresh and per-record saves · branch `phase-3-2-delta-refresh` · 20 Nov 2026

| # | Change | Status | Evidence |
|---|---|---|---|
| 3.2a | `016`: change feed `ps_records_changes` (permission-checked, kill switch `delta_refresh`, full-download fallback) | **New · Tested on staging** | `scripts/phase3/test-016-delta-staging.mjs`: 11 kinds of real save rebuilt with the app's own code, all **identical** to the server; 0.3–85 KB instead of 7.4 MB |
| 3.2b | `016`: saved revision stamp kept (bug on live since before Phase 0: a user's second quick save was rejected as "Another user saved first" and triggered a 7 MB download) | **Repaired · Tested on staging** | returned stamp = stored stamp; back-to-back saves accepted; stale saves still refused |
| 3.3a | `017`: `ps_workspace_save_changes` applies only changed records; per-record clash detection; same permission, lock and safety rules as the full save; kill switch `record_saves` | **New · Tested on staging** | `scripts/phase3/test-017-record-saves-staging.mjs`: 2.3 KB sent instead of 7.4 MB; two tabs editing different records from the same old copy both kept; same record reported as a clash and nothing overwritten; record copy verified |
| 3.3b | Whole-workspace safety copies at most every 10 minutes (per-record history covers every change in between) | **New · Tested on staging** | — |
| 3.3c | App: exact server copy kept; changed records worked out with an order-independent comparison; full save and full download remain as fallbacks | **New · Tested locally and in a real browser** | `test-delta-refresh-v149`, `test-record-saves-v149`, guards `test-migration-016/017`; build gate passes |
| 3.3d | Real browser on staging (owner's Chrome) | **Tested on staging · PASS** | Database timing: per-record saves avg 0.55 s (a full save of the same data: 8.0 s, timed out). Second tab picked up the change via the feed in 15 ms. Owner's two-window test: worked |
| 3.3e | Deploy | **Database deployed · verified** 20 Nov 2026 ~11:58 UTC; app **deployed** via PR #49 (`c9b4cd8`): live serves cache `pool-shed-v1.49.0-delta-r1`; build and Vercel checks green; post-deploy: record copy exact, 0 sync issues, both switches on, data unchanged. First real saves still to be reviewed | Private before-copy; continuity check PASS; 016+017 applied with no errors; record copy exact; mirror switched back on; rolled-back live tests: per-record save 1.2 s (incl. safety copy), feed 1.5 KB, old-app full save 1.9 s with mirror on, 0 sync issues; data fingerprint unchanged (`abb0e2aa…` snapshot md5) |

---

## Phase 3.4 · role-based visibility · branch `phase-3-followups`

| # | Change | Status | Evidence |
|---|---|---|---|
| 3.4a | `018`: staff cannot change their own role, permissions, active status or sign-in email (any signed-in user could previously make themselves Admin) | **Deployed · Verified in production** 20 Nov 2026 | Staging and live (rolled back): a temporary Engineer was refused promotion to Admin and could still edit their own details; admins unaffected; live profiles unchanged (4, all Admin, all active) |
| 3.4b | `019`: role-filtered load (`ps_workspace_load`) and change feed; restricted saves restore every hidden field from storage; hidden records/sections refused; full save refused for restricted roles; the app's 8 roles accepted by the database (it only accepted 6, so Accounts/Sales/Purchasing/Management could not be saved) | **New · Tested on staging** | `scripts/phase3/test-019-roles-staging.mjs` (rolled back): Admin, Accounts, Sales, Warehouse, Engineer, checked with an independent scan of everything returned (load and feed). No forbidden field reached a restricted role; every save left hidden fields unchanged. Found and fixed during testing: notification read markers embedding cost wording; an ambiguous function overload. Restricted load about 2 s (Admin 0.35 s) after performance work (was 10 s) |
| 3.4c | App v1.50.0: loads through `ps_workspace_load`; works out changes on the permitted view; restricted roles never full-save; Azzy reads as the user (not the service key) with finance documents for finance roles only; project AI review and Quote Studio staff actions require a cost-seeing role; job form "Assigned engineers" | **New · Tested locally and in a real browser** | Build gate passes (new `test-role-view-v150`, `test-migration-019`; project AI refuses Engineer/Warehouse). Owner's Chrome on staging as a temporary Engineer: 1 assigned job, 3 linked orders, no quotes, no real costs; the server sent no hidden fields (the margins and "Draft" seen in memory are app defaults); direct read refused; a job note saved and hidden margins (20, not the default 25) and payments were byte-identical afterwards |
| 3.4d | `020`: staff can no longer read the raw workspace directly (stamp only) | **Tested on staging** · apply to live only after every tab runs v1.50 | A v1.49 tab could not load on staging once 020 was applied, which confirms the ordering |
| 3.4e | Deploy | **019 deployed · verified on live** 20 Nov 2026 ~15:35 UTC; app v1.50 **deployed** via PR #50 (`6345f44`; live cache `pool-shed-v1.50.0-roles-r1`, checks green; post-deploy: data unchanged, record copy exact, 0 sync issues); 020 **after** all tabs run v1.50 | Private before-copy; continuity PASS; 019 applied without errors (10 functions, one `ps_redact_item`, roles widened); rolled-back live checks: Admin sees everything and saves normally; temporary Engineer received 0 forbidden field names (1 job, 3 orders, 0 quotes), its save worked and hidden data (project margins, order payments and line costs, product costs) was unchanged; record copy ok; data fingerprint unchanged |
