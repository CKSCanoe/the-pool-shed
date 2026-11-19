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
| 0.9 | Restore drill into staging, fingerprint PASS | **Done · PASS** | Staging `rcmbqegxardafopurwdu` (eu-west-1; held only an empty Pool Shed schema, 0 rows, before the drill). Restored `auth.users` and the `public` schema from the pg_dump: 0 errors, 105 s. Snapshot fingerprint identical (`6b8eb341…`); all 58 public tables have identical row counts. Live unchanged (last save 20:56:45). |
| 0.10 | Compare with GitHub `main` and the v1.47.7 work (`d6a4d29`) | **Blocked** · repository URL and access needed | — |
| 0.11 | Vercel env var names inventory (names only) | **Outstanding** · needs owner | Vercel → Settings → Environment Variables |

### Live fingerprint (fill in after step 0.6)

| Measure | Value |
|---|---|
| Snapshot updated_at | 2026-11-19 20:56:45 UTC |
| Snapshot size | 7.9 MB as text (868 KB compressed in Postgres); 48 sections |
| Customers / Products / Suppliers | 19 / 6,837 (+6,749 supplierProducts) / 17 |
| Sales orders / lines / raw line value / payments | 29 / 145 / £274,988.15 / £85,059.87 |
| Purchase orders / lines / raw line cost | 26 / 90 / £68,223.51 |
| Stock rows / total qty | 37 / 17 |
| Jobs / quotes | 2 / 2 |
| Duplicate record IDs | none |
| Revisions table | 314 rows, 210 MB (oldest 27 Sep 2026) |
| Whole database | 229 MB of 500 MB free-plan limit |
| Storage | 4 buckets, 36 files, 90.7 MB |
| Fingerprint hash | `6b8eb3415a5f377fd9942e1f7d405ed295d3040abdcd5b0484a5056f2bcbd384` |

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
| 1.8 | Browser test on staging (login, dashboard, save, two-user edit, idle network) | **Outstanding** · needs owner sign-in and the staging publishable key | — |
| 1.9 | Deploy to production and measure Supabase egress for 48 h | **Outstanding** · after 1.8 | — |

Measured on live data (read-only): one old check = 7.07 MB (0.49 MB gzip); one new check = 51 bytes. The 11.51 GB overage ≈ 34 tab-hours of the old poll.
