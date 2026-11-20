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
