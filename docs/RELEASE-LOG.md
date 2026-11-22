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

---

## Phase 3.5 · record store as source of truth

| # | Change | Status | Evidence |
|---|---|---|---|
| 3.5a | `021`: `ps_workspace_document` (whole workspace from records) and a check function | **New · Tested on staging**; live proven **read-only** (function not yet on live) | Staging: identical, 48 sections, rebuild 1.6–1.9 s. Live read-only query: identical, 48 sections, 1.5 s |
| 3.5c | Stop rewriting the document per save; cached document; nightly archive | **Planned for ~4 Dec 2026** (two clean weeks after 3.3) · owner go-ahead | design in PHASE-3-PLAN.md |

---

## Operations O1/O2 · purchases, payment runs and the Pool Shed ledger · branch `ops-o1-purchasing-ledger`

| # | Change | Status | Evidence |
|---|---|---|---|
| O1a | `022` ledger foundation: balanced, permanent postings; reversals; closed months; finance roles only | **New · Tested on staging** | `scripts/ops/test-022-ledger-staging.sql` (rolled back): all rules hold; trial balance 0.00 |
| O1b | `023` record purchases and payment runs with controls (pro-forma paid up front; on-account due on terms; unique supplier invoice; job or category; VAT check; copy before payment; approval by a different person at or above £1,000; runs approved by a different person) | **New · Tested on staging** | `scripts/ops/test-023-purchases-staging.sql` (rolled back): every control holds; the books balance |
| O1c | `024` private finance file storage (supplier invoices and receipts, finance roles only) and the screen lists | **New · Tested on staging** | `test-finance-media-v151` (Sales, Warehouse, Engineer and Office refused; Admin and Accounts allowed) |
| O1d | v1.51.0 screens: Accounting → **Record a Purchase**, **Payment Runs** | **New · Tested in a real browser on staging** | Pro-forma purchase paid at purchase; on-account due on Net 30; duplicate refused; copy-missing hold; run created, approved by a second admin, marked paid; bill £0 owed; payment list correct. Uploads need the Vercel API (not available in the local preview), so they are tested by the role test and get a final check on the Vercel preview |
| O1e | Xero hand-off **ready, not linked** (owner decision): `025` outbox with exact Xero payloads and problem checks; account-code and VAT mapping; opening balances import (never sent back to Xero); sender `server/xero-ledger-push.js` behind three locks (server live mode, Xero connection, `xero_push` switch, all closed) | **New · Tested on staging and with a fake Xero** | `scripts/ops/test-025-xero-outbox-staging.sql` (rolled back): held with reasons; ready after codes and contacts; payments wait for bills; opening balances not queued; trial balance 0.00. `test-xero-ledger-push-v151`: nothing sent while off or unlinked; bills before payments; retries never duplicate. `test-xero-handoff-ui-v151`: Aged Payables CSV read correctly; unknown suppliers listed, never guessed. Real browser on staging: Xero Sync shows "Not linked"; confirming an account code cleared that problem. Go-live steps: `docs/XERO-GO-LIVE.md` |

Note: staging now holds a few posted test documents (PINV-000001/2, SPAY-000001/2, RUN-000001). By design they cannot be deleted; they are labelled "(UI test)".
| O1f | **Database released to live** 20 Nov 2026 (021–025), Xero **not linked** | **Deployed · verified on live** | Private data and schema backup; continuity PASS. 021–025 applied without errors; `xero_push` off; `finance-media` private. Ledger, purchase and Xero tests run on live and rolled back: every rule and control held, trial balance 0.00. Afterwards: 0 ledger documents, 0 runs, empty outbox; data unchanged. App v1.51 **deployed** via PR #51 (`0d57276`; live cache `pool-shed-v1.51.0-ledger-r1`, checks green). Live upload check: a test PDF uploaded to private finance storage, opened through a signed link, then archived; no ledger entry created; `xero_push` still off |

---

## Vans & Fleet · v1.52.0 · branch `fleet-vans`

| # | Change | Status | Evidence |
|---|---|---|---|
| F1 | `026` van register, compliance (MOT, tax, insurance, service, breakdown), van supplies, monthly report, damage, sign-off | **New · Tested on staging** | `scripts/ops/test-026-fleet-staging.sql` (rolled back): plate formatting and duplicate refused; due states; engineers see only their van (no policy number) and cannot add vans; report needs mileage (never backwards), every check answered, notes on problems, damage photos, supplies counted, signature; locked after submit; send back needs a reason; sign-off by a different person; damage closed with a note |
| F2 | `027` private van photo and document storage; per-van permission using the user's own sign-in; read-only supplies list | **New · Tested** | `test-fleet-media-v152` (engineers: own-van photos and signatures only; managers: documents and removal) |
| F3 | v1.52.0 screens: Vans & Fleet menu; van register with compliance colours and UK-style plate; add and edit van with supplies list and documents; engineer's monthly report (OK / Problem checks, damage with photos, supplies count, signature pad); manager review, sign-off or send back; print / save as PDF | **New · Tested in a real browser on staging** | Added PB21 VAN through the form (plate formatted; tax overdue and MOT due soon shown). Report filled at speed: 18 checks, 1 problem with note, mileage, supplies all saved. Two bugs found and fixed: mileage cleared on redraw; quick edits overwriting each other's save. Signing and submitting use the upload service (Vercel only), so they are proven by the database tests and get a live check after release |
| F4 | Release to live | **Database deployed · verified on live** 20 Nov 2026 (026, 027); app **deployed** via PR #52 (`38def03`; live cache `pool-shed-v1.52.0-fleet-r1`, checks green). Live upload check: a signature and a damage photo uploaded to private fleet storage, opened through signed links, then archived; no van or report created. Note: an already-open tab shows the new section after one normal reload, as with every app update | Schema backup first. Fleet tests run on live and rolled back: every rule held; afterwards 0 vans, 0 reports, profiles unchanged. Same check: today's first real staff save (17:14) was a per-record save (2.3 s against 7.1 s for the old full saves); record copy exact; 0 sync issues; continuity PASS |

---

## Van report reminders · v1.53.0 · branch `fleet-reminders`

| # | Change | Status | Evidence |
|---|---|---|---|
| F5 | `028` reminder schedule (engineers on the 1st, then every 3 days while outstanding, and straight away when a report is sent back; Admin and Management on the 8th, 15th and 22nd), a log so nobody is emailed twice in a day, switch `fleet_email_reminders` (**off**), van list carries the review comment | **New · Tested on staging** | `scripts/ops/test-028-reminders-staging.sql` (rolled back): day 1 yes, day 2 no, day 4 yes, day 8 adds managers, no repeat the same day, sent-back report reminded at once, none once submitted. `test-migration-028` guard |
| F6 | Daily email check (Vercel cron 07:00 UTC → `/api/workspace-health?fleet-reminders=1`, needs `CRON_SECRET`); sends only when the switch is on and `RESEND_API_KEY` and `QUOTE_FROM_EMAIL` are set | **New · Tested with fake email** | `test-fleet-reminders-v153`: nothing sent while off or unconfigured; correct wording for due, sent back and the manager digest; each email logged |
| F8 | **Database released to live** 20 Nov 2026 (028); email switch **off** | **Deployed · verified on live** | Schema backup first; data unchanged (same fingerprint before and after). `scripts/ops/test-028-reminders-live.sql` with a temporary van, rolled back: day 1 yes, day 2 no, day 4 yes, day 8 adds 4 managers, no repeat after sending, sent-back report reminded at once, none once submitted. Afterwards 0 vans, 0 reports, empty log |
| F7 | v1.53.0 in-app reminder: banner under the top bar and a count on Vans & Fleet in the menu (engineers: their van; managers: waiting for sign-off and not started); "Hide for today"; refreshes every 10 minutes | **New · Tested in a real browser** | `test-fleet-reminders-v153` (engineer sees only their own van; sent-back comment and "Update report"; clears when signed off; manager counts). Browser check in the app shell: Admin banner "1 van has no November report yet"; engineer banner with the sent-back comment; red count 2 on Vans & Fleet; "Hide for today" hides the banner and keeps the count. Styling fixed after the check (banner lined up with the cards; "Hide for today" a small link) |

---

## Operations O3 · sales invoicing in the Pool Shed ledger · v1.54.0 · branch `ops-o3-invoicing`

Owner decisions 21 Nov 2026: invoice numbers carry on from INV-2049; a sale is ready to invoice once delivered (orders) or a stage is reached (projects), with deposit invoices allowed up front; due on receipt unless the customer has terms; PDF emailed from Pool Shed, switched off until approved.

| # | Change | Status | Evidence |
|---|---|---|---|
| O3a | `029` invoicing in the ledger: ready-to-invoice queue (delivered, not delivered, project stages, invoiced before the ledger); final, deposit and stage invoices; credit notes with a reason; customer payments applied to invoices, money on account, apply and refund; aged debtors; invoice details (VAT number, bank) with checks; email log; opening customer balances from Xero; switch `invoice_emails` **off** | **New · Tested on staging** | Order prices worked out by the database match the app's own pricing code on all 29 orders, VAT included (0 differences). `scripts/ops/test-029-invoicing-staging.sql` (rolled back): Sales refused; changed total refused; INV-2049 = order total, due on receipt; second invoice refused; invoiced-before-ledger refused; not delivered refused; deposit then final deducts it (980 − 294 = 686); over the order and over the project contract refused; credit needs a reason and cannot exceed the invoice; over-applied payment refused; extra kept on account and refunded; posted invoice cannot be edited; bad VAT number refused; books balance (difference 0.00). `test-migration-029` guard |
| O3b | Invoice and credit note PDF (A4, no new library) and email with the PDF attached (`/api/media?action=invoice-pdf` / `invoice-email`, using the person's own sign-in) | **New · Tested** | `test-sales-invoicing-v154`: valid PDF (structure, £ sign, negative deductions, multi-page numbering, credit note layout); email refused while off, with details missing, without email set up or with a bad address; when allowed the PDF is attached, replies go to the office address, and the send is recorded with the person's own sign-in |
| O3c | v1.54.0 screens: Accounting → Invoice Ready, Customer Invoices, Payments & Allocations, Credit Control (aged debtors), Credits & Returns. The order's Invoice button opens Invoice Ready, and for ledger-invoiced orders its payment button opens Payments & Allocations (numbers and payments only go through the ledger); ledger payments are copied onto the order so its balance is right | **New · Tested in a real browser on staging** | Signed in as Admin in Chrome: queue matched the database test (5 ready, 1 not delivered, 2 projects, 11 before the ledger). Reviewed SO-2051 (lines and £853.68 match the order) and posted **INV-2049**: the order became Invoiced with that number and saved for the team; ready list 5 → 4. £500 bank payment recorded and applied automatically (RCPT-000001), then £100 by card (RCPT-000002), which was copied onto the order. Credit Control: £253.68 not yet due. The order's Invoice button opened Invoice Ready with the review for SO-2064 (not posted). PDF and email need the server (Vercel only): proven by the tests and checked live after release. Staging now holds INV-2049 and RCPT-000001/2 from this check (posted documents cannot be deleted) |
| O3d | **Database released to live** 21 Nov 2026 (029); invoice emails **off** | **Deployed · verified on live** | Schema backup first; data unchanged (same fingerprint before and after). Order prices from the database match the app's own pricing on all 29 live orders. `test-029` run on live and rolled back: every rule held, books balanced; afterwards 0 ledger documents, next number still INV-2049, all profiles unchanged, invoice details empty |
| O3e | App released | **Deployed · verified on live** 21 Nov 2026 via PR #54 (`e6c7753`; live cache `pool-shed-v1.54.0-invoicing-r1`, Vercel check green) | Live site serves `sales-invoicing-workspace.js?v=1.54.0`; invoice PDF and email refuse requests without a valid sign-in (401); ledger still empty, next number INV-2049; emails off. The PDF itself is checked live on the first real invoice |

---

## Blueprint step 1 · grouped menu, Home queues, status bars · v1.55.0 · branch `frame-statuses`

Owner approved the blueprint 21 Nov 2026 (eight areas; Pool Audits under My Work; engineers get van reports and van stock only; sales orders improved not replaced; fulfilment emails with tick boxes; complete stock control with reorder thresholds). Blueprint source: `docs/blueprint/index.html`.

| # | Change | Status | Evidence |
|---|---|---|---|
| B1a | Menu grouped into Home & My Work, Customers, Sales, Projects, Purchasing, Stock, Team & Vans, Accounts, Reports, Settings; every page kept under its area; sections not yet assigned appear under More; "Classic menu" switch per person | **New · Tested in a real browser on staging** | `test-frame-v155`: every section at most once, areas follow permissions, folded areas open on click. Browser: ten areas, Team & Vans badge kept, Stock opens Products with Inventory, Warehouse and Fulfilment beneath; classic menu shows the old 17 sections and switches back |
| B1b | Home work queues by role (ready to invoice, invoices overdue, bills this week, orders and POs waiting too long, orders needing review, to pick, deliveries overdue, van reports); empty ones listed as all clear | **New · Tested in a real browser on staging** | Staging: 4 ready to invoice, 8 sales orders waiting too long, 5 need review, 1 van report; the "waiting too long" tile opened Sales Orders filtered to those 8 |
| B1c | Status bars on the sales order and purchase order lists (your statuses, colours and order, counts, click to filter, "Waiting too long"); purchase statuses get reminders; older PO screens use your chosen colours | **New · Tested in a real browser on staging** | Sales: All 10, Needs Review 5, Part Received 1, Invoice Ready 4, Waiting too long 8; chosen chip fills in its colour, dropdown kept in step. Purchase: Draft - Review 26 (all live POs are still drafts). Settings → Statuses shows reminders for both. Build gate passes |
| B1d | App release | **Deployed · verified on live** 21 Nov 2026 via PR #55 (`e74c390`; live cache `pool-shed-v1.55.0-frame-r1`, Vercel check green) | Live site serves `back-office-frame.js?v=1.55.0`; no database change; workspace data unchanged (same fingerprint). Already-open tabs show the new menu after one normal reload |

---

## Blueprint step 2 · sales orders improved · v1.56.0 · branch `sales-orders-v156`

| # | Change | Status | Evidence |
|---|---|---|---|
| B2a | Order page flow bar: rail (Ordered, Allocated, Picked & packed, Delivered, Invoiced, Paid) worked out from the order; one next-step button reusing the existing actions (allocate, pick/pack/ship, mark a service order done, invoice, payment); money summary (total, invoiced, paid, balance, margin); old Invoice button steps back | **New · Tested in a real browser on staging** | `test-orders-v156` (each step and button, delivered orders skip earlier steps, on hold). Staging SO-2064 (delivered, one unit never allocated): bar went straight to "Invoice £65.94" |
| B2b | Invoice and payment in place on the order (pop-up from the Accounts invoicing screens; finance roles only; only delivered orders can be invoiced) | **New · Tested in a real browser on staging** | Posted **INV-2050** for SO-2064 from the order page; order became Invoiced with that number; "Record payment £65.94" then took a card payment (RCPT-000003) for the right customer; bar showed "Complete: delivered, invoiced and paid", balance £0.00. An undelivered order gave a clear message instead. Staging keeps these documents |
| B2c | Copy order (same customer, items and agreed prices; nothing allocated, picked or invoiced; starts in Needs Review) and Quick add of the most often sold items while an order is being built | **New · Tested in a real browser on staging** | Copied SO-2064 to SO-2065 (1 line, 0 allocated); one tap on Quick add added a line and updated the total; products with the same name show their code. Build gate passes |
| B2d | App release | **Deployed · verified on live** 21 Nov 2026 via PR #56 (`4eb168f`; live cache `pool-shed-v1.56.0-orders-r1`, Vercel check green) | Live site serves `sales-order-flow.js?v=1.56.0`; no database change; workspace data unchanged (same fingerprint); ledger still empty. Already-open tabs update after one normal reload |

---

## Blueprint step 3 · fulfilment customer emails · v1.57.0 · branch `fulfilment-emails`

| # | Change | Status | Evidence |
|---|---|---|---|
| B3a | `030` switch `customer_emails` (**off**), send log, `ps_customer_email_context` (recipient = the order's customer email; steps Pick, Pack, Ship, Part Ship, Collection only; Engineers refused) and `ps_customer_email_sent` | **New · Tested on staging** | `scripts/ops/test-030-customer-emails.sql` (rolled back): recipient found on the record; non-fulfilment step refused; unknown order refused; engineer refused for both |
| B3b | Server: wording from Settings rules (defaults for part shipment and collection), tracking link for main UK carriers, send through `/api/media?action=customer-email` with the person's own sign-in; preview action | **New · Tested with fake services** | `test-customer-emails-v157`: links and wording; preview shows the record's email; refused while off, without email set up, or with no customer email; when sent, goes only to the record's email (never the one the screen sends), replies to the office, logged with the person's own sign-in; Invoice step refused |
| B3c | "Email the customer?" card at each fulfilment step from any screen or batch, tick per order (default from Settings), preview, choice noted on the order | **New · Tested in a real browser on staging** | Two steps queued together: SO-2064 full shipment "has shipped · DPD …", SO-2051 "is packed", both ticked from Settings; off-switch warning shown; "Don't send" recorded "Not sent (staff chose not to)" on each order. Found and fixed: a shipment covering the whole order was called a part shipment. Build gate passes. Live send checked after the owner switches emails on |
| B3d | **Database released to live** 21 Nov 2026 (030); customer emails **off** | **Deployed · verified on live** | Schema backup first; data unchanged (same fingerprint). `test-030` run on live and rolled back: recipient found on the record, non-fulfilment step refused, unknown order refused, engineer refused; afterwards profiles unchanged (all Admin), email log empty |
| B3e | App release | **Deployed · verified on live** 21 Nov 2026 via PR #57 (`1a745c1`; live cache `pool-shed-v1.57.0-fulfilment-r1`, Vercel check green) | Live site serves `customer-emails.js?v=1.57.0`; the email action refuses requests without sign-in (401); data unchanged; email log empty; switch off |

---

## Blueprint step 4 · van stock (Team & Vans) · v1.58.0 · branch `team-vans`

| # | Change | Status | Evidence |
|---|---|---|---|
| B4a | `031` van linked to its stock location; `ps_van_stock` (own van or managers; quantities and minimums, never costs); counts stored until the office applies or discards them; one count waiting at a time; whole numbers; no self-approval of differences; van list carries the location | **New · Tested on staging** | `scripts/ops/test-031-van-stock.sql` (rolled back), 13 checks: set-up, one location per van, engineer cannot see another van or review counts, part units refused, count sent with its difference, second count refused while one waits, office sees it, applied by another person, decided once, own count with differences refused, discard allowed. Found and fixed: a `note` name clash in the decide function |
| B4b | v1.58.0 screens on Vans & Fleet: engineer "My van stock" and phone count (+/-, starts at expected); office van stock table (items, value, shortfalls, last count), set up van stock, minimums from the supplies list, counts to check (differences only) with apply/discard, top-up list creating warehouse-to-van transfers | **New · Tested in a real browser on staging** | `test-van-stock-v158`. Browser (after staging recovered): PB21 VAN set up with its own location; a minimum of 1 showed "1 short" and the top-up list; "Create top-up transfers" moved 1 from the warehouse (van "Full"); another user counted 0 with a note; the office saw only that difference, applied it: van stock 0, "Van Count Down" movement with the note, stock take recorded, van "1 short" again; an earlier matching count discarded |
| B4c | Workspace start-up: each device keeps the exact server copy; opening asks only for changes since (change feed) when the person's access is unchanged, else the full load as before; one full load at a time (callers share it); retries 2 s, 4 s instead of 0.3 s | **New · Tested in a real browser on staging** | Found while checking B4b: a cold full load took 12–25 s on staging against the 8 s database limit, and start-up retries piled up (live is the same database size; warm load 1.1 s). After: reload ready in 0.6 s with two small requests (access check and change feed, ~65 ms each) and no full download ("device copy, unchanged"); after another user changed SO-2065 on staging, reload took 0.7 s and showed the change ("device copy plus changes"). `test-workspace-load-v158`; older start-up test updated for the renamed function |
| B4d | Restock rules (van and location minimums) keyed by product + location in the app and the database (`031`), so they save one record at a time; the re-key is reported through the change feed | **Fixed · Tested on staging** | Found while checking B4b: rules had no key in the app, so any rule forced a full 7.9 MB save, which timed out on staging. After: a rule change saved per record in about 1 s with no warnings. Re-key lesson: changing records without pointing the current revision at the change left an open device out of step; the migration now updates the revision mapping (live has no rules, so nothing to re-key there) |
| B4e | **Database released to live** 21 Nov 2026 (031) | **Deployed · verified on live** | Schema backup first; data unchanged (same fingerprint); live had no restock rules, so nothing re-keyed. `test-031` on live, rolled back: all 13 checks held; afterwards 0 vans, 0 counts, profiles unchanged. Change feed answers on live (0.25 s) |
| B4f | App release | **Deployed · verified on live** 21 Nov 2026 via PR #58 (`64f624d`; live cache `pool-shed-v1.58.0-vanstock-r1`, Vercel check green) | Live site serves `van-stock.js?v=1.58.0` and the new start-up (device copy plus change feed, restock rule keys); data unchanged. Each person's first open does one full load to create their device copy |

---

## Blueprint step 5 · customer account and Accounts home · v1.59.0 · branch `customer-accounts`

| # | Change | Status | Evidence |
|---|---|---|---|
| B5a | `032` `ps_customer_account`: balance, ageing, every invoice, credit, payment and refund, and a statement for any period (opening balance, running balance, closing) from the trade debtors lines of posted documents; finance roles only | **New · Tested on staging** | Trinity Primary School (staging): INV-2049 £853.68 less £500 and £100 = £253.68, statement and balance agree; a later period opens at £253.68 |
| B5b | Statement PDF (shared PDF assembly with invoices) through `/api/media?action=statement-pdf` with the person's own sign-in | **New · Tested** | `test-customer-accounts-v159`; sample viewed (columns spaced after a first overlap); invoice PDF tests unchanged |
| B5c | Customer page "Account" tab (finance roles only): balance, overdue, terms, credit limit, on account, documents with status and PDFs, statement with period, Record a payment | **New · Tested in a real browser on staging** | Trinity: tiles £253.68 / £0.00 / Due on receipt / £0.00; INV-2049 "£253.68 to pay"; statement running balance to £253.68; "Record a payment" opened with Trinity chosen. Added an "Applied" label for used payments after the check |
| B5d | Accounts home (money in, money out, the books, from the ledger; each figure opens its page) and the 18 tabs grouped the same way; earlier order-based overview kept folded; header "Record Payment" goes to the ledger page | **New · Tested in a real browser on staging** | Staging: 3 ready to invoice £3,158, 1 unpaid £254, ledger balanced, 4 documents for Xero (not linked); "unpaid invoices" opened Customer Invoices. Build gate passes |
| B5e | **Database released to live** 21 Nov 2026 (032, read-only functions) | **Deployed · verified on live** | Schema backup first; data unchanged. On live (rolled back): Admin gets an empty, correct account (balance 0, no documents, terms Due on receipt); Sales refused; profiles unchanged (all Admin) |
| B5f | App release | **Deployed · verified on live** 21 Nov 2026 via PR #59 (`4e0ff6d`; live cache `pool-shed-v1.59.0-accounts-r1`, Vercel check green) | Live site serves `customer-account.js` and `accounts-home.js` at v1.59.0; the statement PDF refuses requests without sign-in (401); data unchanged |

---

## Old styles removed · v1.77.0 · branch `css-cleanup`

Owner: remove the old styles now the new look is everywhere. Finding: fixed colours were already almost gone (22 outside the palette); the problem was size and duplication: app.css 1.19 MB, of which the design kit repeated a 260-character list of screen ids 220 times.

| # | Change | Status | Evidence |
|---|---|---|---|
| CS1 | Removed 391 rules (and trimmed 80 selector lists) whose class or id appears nowhere in the app's code; classes built from a prefix ("pill-"+tone) are kept | **New · Tested in a real browser on staging** | Every menu page (109) in light and dark, plus a sales order, purchase order, customer, product and the quote editor: the computed style of every visible element compared with the old and new stylesheet on the same page. All identical (one Home reading caught a colour fade; identical once settled) |
| CS2 | Design kit rules use `.ps-kit-scope:not(#ps-kit-none)` instead of the list of 17 screen ids: same strength in the cascade; only the menu code marks a screen | **New · Tested in a real browser on staging** | Same comparison as CS1. Kit file 105 KB → 43 KB; app.css 1,194,756 → 1,081,798 bytes |
| CS3 | Last fixed colours moved to the palette (save-status dots, supplier banner, super-admin badge with a new --color-special in light and dark); status borders darken with "black" | **New · Checked on staging** | Supplier profile banner unchanged in light; follows dark mode |
| CS4 | Build check `test-css-hygiene-v177`: fails on rules for unused classes, fixed colours outside 00-color-tokens.css, app.css over 1,100,000 bytes, or the long kit selector | **New · Unit tested** | Tried with a dummy rule `.never-used-class-xyz{color:#123456}`: both problems reported, build stopped |
| CS5 | Look tests updated for the short kit selector | **Changed** | `test-look-sales-v170`, `test-look-all-v176` |
| CS6 | Older tests that named rules for classes no longer used now check those rules only while the app still uses the class; the runtime check no longer requires `.ci-search-backdrop` (element no longer created); the two standalone copies (`quote-studio.css`, `finance-command.css`) re-synced with their modules | **Changed** | `test-project-workspace-v143`, `test-cross-page-uniformity`, `test-project-360-visual-guard-v110`, `test-supplier-command-visual-v115`, `test-sales-order-detail-v162`, `validate-runtime`. Every test in the repo compared with main: no new failures |
| CS7 | Found by the contrast test: the supplier banner's main button would have been dark on dark in dark mode after the colour swap; now light text-colour background in both themes | **Fixed before release** | `test-theme-semantic-contrast-v124` passes |

## The new look everywhere · v1.76.0 · branch `look-rest`

Owner: roll the look out to the remaining areas. Approach: switch every area on, then check every menu page against the old look on staging and fix what got worse.

| # | Change | Status | Evidence |
|---|---|---|---|
| LK1 | Design kit on every area (17 screens); engineer and barcode screens and the quote editor excluded | **New · Tested in a real browser on staging** | All 100 menu pages opened with the look on and off and compared for overflow and unreadable text; 3 flagged: the customer record (a reading taken mid-draw; readable on inspection) and Stock › Imports / Catalogue Health (13px wider) |
| LK2 | Underlined tabs on purchase order, supplier, project, product and customer records | **New · Tested in a real browser on staging** | Purchase order and customer tabs: open tab in the brand colour, others plain |
| LK3 | Stock › Imports history column fits its cards (an old overflow) | **New · Tested in a real browser on staging** | Imports and Catalogue Health overflow 0 (was 41 before the look, 54 with it) |
| LK4 | Dark mode | **Tested in a real browser on staging** | Invoices, Company settings, Stock levels, Today's work, Reports overview, Vans and Projects: no unreadable text |
| LK5 | Two pilot tests that pinned "not converted yet" updated | **Changed** | `test-look-pilot-v169`, `test-look-sales-v170`; new `test-look-all-v176` |
| LK6 | App release (PR #75) | **Deployed · verified on live** 22 Nov 2026 (Vercel check green; live cache `pool-shed-v1.76.0-look-r1`) | Live serves the kit on every area and the Imports fix; data unchanged |

## Quote Studio custom HTML · v1.75.0 · branch `quote-html`

Release E, the last of four. Owner: HTML blocks plus a full HTML page, scripts removed, Pool Shed filling in price, choices and Accept.

| # | Change | Status | Evidence |
|---|---|---|---|
| HT1 | Shared cleaner (`quote-html-safe.js`): allow-list of content tags; scripts, frames, forms, buttons, SVG and similar dropped with their content; no on… handlers, data- attributes or ids starting pc/ps/be/qs; links and pictures https only (plus mailto/tel and inline images); risky CSS removed; new-tab links get noopener | **New · Tested in a real browser on staging** | A payload with script, onclick, onerror, javascript: links, iframe, form, svg, @import and a clashing id came out with all of them removed and the safe parts kept (18 checks) |
| HT2 | Custom HTML section and Full HTML page (Theme) with word placeholders (inserted as text) and live parts (the page's own HTML); cleaned when published and again when shown; older published versions unaffected; accept button added if left out | **New · Tested in a real browser on staging** | On Q-2026-0002: an HTML section showed the customer's name and total, with its script and onclick gone; a full page with a style block and {{pool_specs}} showed 2 live choices, and picking one changed {{total}} from £5,100 to £4,794; switched back off afterwards |
| HT3 | Release test | **New · Unit tested** | `test-quote-html-v175` |
| HT4 | App release (PR #74) | **Deployed · verified on live** 22 Nov 2026 (Vercel check green; live cache `pool-shed-v1.75.0-html-r1`) | Live serves `quote-html-safe.js` and the proposal page loads it; data unchanged. Quote Studio releases B to E complete |

## Quote Studio customer experience · v1.74.0 · branch `quote-customer-experience`

Release D of four. Owner: show the bank details, and send a Xero request for the deposit, custom per project. Finding: typed signatures, the separate signing page and questions per option already existed; after accepting, the customer only saw "we will issue the request separately"; the server worked out the accepted deposit as a percentage only, ignoring fixed and full-payment quotes.

| # | Change | Status | Evidence |
|---|---|---|---|
| CX1 | Thank-you page after acceptance: version and signer, deposit due now, bank details and reference, next steps, PDF copy, ask a question; "Accepted" bar on later visits | **New · Tested in a real browser on staging** | Customer page loaded with a mocked accepted answer: deposit £7,830, bank rows and reference Q-2026-0002 shown; banner on the main page |
| CX2 | Server sends the payment details only once accepted (bank details only when sort code and account number are set; never the whole invoice profile); the deposit follows the quote's own rule (percentage, fixed, full or none) from the customer's final choices | **New · Unit tested** | `test-quote-customer-v174` (30% £3,600, 50% £6,000, fixed £2,500, full £12,000, none £0 on £10,000 + VAT; older versions keep their percentage) |
| CX3 | "Save PDF" (printable copy without buttons and bars), "Ask a question" in the bottom bar, larger bottom-bar text, phone layout of the bar | **New · Tested in a real browser on staging** | Phone view in the editor: total and button on their own lines, nothing cut off |
| CX4 | Deposit invoice still raised by staff in one click (v1.71) and sent to Xero once linked; no automatic Xero request on acceptance (needs Xero linked and a server-side invoice function, a database change for later) | **Unchanged · noted** | |
| CX5 | App release (PR #73) | **Deployed · verified on live** 22 Nov 2026 (Vercel check green; live cache `pool-shed-v1.74.0-customer-r1`) | Live serves the thank-you payment view; the quote server refuses an invalid link (404); data unchanged |

## Quote Studio pool specs · v1.73.0 · branch `quote-spec-configurator`

Release C of four. Owner: choice groups per template, each choice with photo, description, price and cost, from the catalogue or typed in, adjustable per quote with a live price; accepted choices flow into the project, sales order and purchasing. Finding: catalogue choices already flowed into the sales order, project materials and draft purchase orders; typed-in choices reached the sales order with a blank product.

| # | Change | Status | Evidence |
|---|---|---|---|
| QS1 | Each choice in the editor: photo, name, description, highlights, badge, price, quantity, cost, live margin (coloured), supplier for typed-in choices, reorder; group shows the starting total | **New · Tested in a real browser on staging** | On Q-2026-0002: highlights showed on the customer card; a choice priced £3,995 and picked by the "customer" made the total £4,794 inc. VAT; the settings panel fits at 1,483 px wide after a fix |
| QS2 | Catalogue search in each group (name, code or supplier code, 8 results, one-off records never offered) adds the product with its details | **New · Tested in a real browser on staging** | "heat pump" returned 8; the first was added with its code and supplier (it has no price in the catalogue, so it came in at £0 as expected) |
| QS3 | "Save as a template" in the editor; "Copy a group from a template" copies a group with fresh ids and its pictures | **New · Tested in a real browser on staging** | Saved a template, copied its group in, then removed both |
| QS4 | Typed-in choices become sales order lines with the CUSTOM code and their own name (v1.71 stand-in); no draft purchase order or material line unless a supplier is named. Same rule in the app and on the server (customer accepting online) | **New · Unit tested** | `test-quote-specs-v173`. Quotes already accepted are unchanged |
| QS5 | App release (PR #72) | **Deployed · verified on live** 22 Nov 2026 (Vercel check green; live cache `pool-shed-v1.73.0-specs-r1`) | Live serves the catalogue search and template group copy; data unchanged |

## Quote Studio brochure editor · v1.72.0 · branch `quote-studio-editor`

Owner: Quote Studio should build a professional brochure quote the way Shopify builds a website, easy to use, with customers choosing their pool specs. This is release B of four (B editor, C pool spec configurator, D customer experience, E HTML). Approach: the editor shows the customer's real proposal page in a frame and edits it in place, so what staff see is exactly what the customer gets. Older published versions keep their fixed section order; only new versions (marked `brochure:1`) follow the list.

| # | Change | Status | Evidence |
|---|---|---|---|
| QE1 | Quotes open on a three-panel editor: sections (drag to reorder, hide, add from a library of 14), the live customer page (desktop, tablet, phone; click any words to change them), and settings for the selected section; theme (style, heading font, brand colour, name); autosave and undo | **New · Tested in a real browser on staging** | On Q-2026-0002: title typed in the panel showed in the page; words typed in the page showed in the panel; a Timeline added, dragged after Investment, saved; a choice priced £4,250 and chosen made the customer total £5,100 inc. VAT; undo reverted the last change; brand colour and font reached the page; no console errors |
| QE2 | Customer page: sections follow the list; new section types (intro letter, gallery, text and picture, timeline, reviews, questions and answers, terms); the hard-coded headings are now editable with the same defaults | **New · Unit tested** | `test-quote-editor-v172`. Published versions before v1.72 render as before |
| QE3 | The customer page may be framed by Pool Shed itself only (X-Frame-Options SAMEORIGIN, frame-ancestors 'self'; was DENY/'none'); edit mode needs a staff preview inside a frame and only answers messages from the same site; settings paths are checked (no constructor/prototype/__proto__) and accepted quotes are read only | **New · Unit tested** | `test-quote-editor-v172` |
| QE4 | Two old tests pinned the old behaviour (no per-quote colour, file version 1.45.1); updated to check that only a checked #rrggbb colour reaches the page and that a version is present | **Changed** | `test-quote-command-v138`, `test-quote-portal-v131` |
| QE5 | App release (PR #71) | **Deployed · verified on live** 22 Nov 2026 (Vercel check green; live cache `pool-shed-v1.72.0-editor-r1`) | Live serves `quote-brochure-editor.js` and the editor styles; `/proposal` sends X-Frame-Options SAMEORIGIN; data unchanged |

## One code for custom items, deposits per quote and project · v1.71.0 · branch `custom-lines`

Owner: custom items should all be one product code, not a product per one-off item; deposits need to be custom per project (50% when the supplier needs it, 30% other times), with a Xero request for the amount. Finding: 26 places find an order line by its product and 67 places show a line by looking up its product, which is why each custom line had its own product record. Rather than rewiring all of them, each custom line keeps a private reference and product() returns a stand-in built from the line (code CUSTOM or SHIPPING). Same result for the owner, far less risk.

| # | Change | Status | Evidence |
|---|---|---|---|
| CI1 | createNonStockProduct no longer adds records; product() returns a stand-in from the line (code CUSTOM / SHIPPING, the line's name, price and cost); the start-up repair step skips one-off ids; old one-off records hidden from Stock levels | **New · Tested in a real browser on staging** | Two custom lines added to SO-2063: the product count stayed at 6,839, both show CUSTOM with their own names, and the server invoice preview named and priced them correctly (£95, £40). Found and fixed on the way: the repair step was recreating "Recovered product" placeholders |
| CI2 | Quote deposit: "Raise deposit invoice" creates a ledger deposit invoice for the quote's own amount (against its sales order, or the project when billed by stage), replacing the old Xero queue that needed a Xero contact | **New · Unit tested** | `test-custom-items-v171` |
| CI3 | Project invoice stage: "or % of the agreed value" fills in the amount and names it "50% deposit" | **New · Unit tested** | Build gate passes. No database change |
| CI4 | App release (v1.69 + v1.70 + v1.71 together, PR #70) | **Deployed · verified on live** 22 Nov 2026 (Vercel check green; live cache `pool-shed-v1.71.0-custom-r1`) | Live serves the design kit (module 68) and the one-off product stand-in; data unchanged |

## Sales on the new look · v1.70.0 · branch `look-sales`

| # | Change | Status | Evidence |
|---|---|---|---|
| LS1 | Whole Sales area on the kit (orders list and order page, quotes list, contracts, web orders, returns); kit rules anchored to screen ids so they outrank the older class rules | **New · Tested in a real browser on staging** | Order SO-2063 shown with the record layout. On a 1,512 px screen the cards sit in a row and the lines table fits with nothing clipped (forced minimum widths cleared). On 1,680 px and up the cards move to a right-hand column |
| LS2 | Order page: duplicate Invoice button gone; progress current step in the brand colour; underline tabs; compact "+" add row; commercial check card hidden | **New · Tested in a real browser on staging** | Before and after screenshots |
| LS3 | Quotes list inside the app (menu and title kept; Quote Studio's back button, tab row and banner hidden, its buttons kept); quote editor untouched and full-screen | **New · Tested in a real browser on staging** | Editor opened full-screen with its own styles (kit rules exclude `.qs-studio-root`) |
| LS5 | Order value bottom right like an invoice (Net, VAT, Total inc VAT, Paid, Balance due, then Take / Record payment), catalogue search to its left; stacks on narrow screens | **New · Tested in a real browser on staging** | Screenshot of SO-2063 |
| LS4 | One-line description per Sales page instead of the section's old subtitle | **New** | `test-look-sales-v170`; pilot test updated (order pages now included, PO pages not yet); build gate passes. No database change |

## Look pilot · v1.69.0 · branch `look-pilot`

Audit: 3,057 `!important` overrides, 93 hard-coded colours, 112 corner styles, 181 text sizes, 29 button and 26 badge designs, 14 add-ons with their own styles. The pilot proves one kit on three pages before any rollout.

| # | Change | Status | Evidence |
|---|---|---|---|
| L1 | Design kit `system/68-pool-shed-kit.css` (loaded last), built on the existing tokens (`--color-*`, `--ps-*`); no new hard-coded colours | **New · Tested in a real browser on staging** | Orders, Purchase orders and Products: banners gone, figure cards unified (Products' dark strip and Purchasing's blue band became white cards), round filters, compact table buttons, status colours from Settings kept, Delete red, name links plain. Dark theme correct after moving the kit's names off `:root` (the app sets the theme on `<body>`) |
| L2 | Kit only on those three list pages; "New look: on/off" switch in the menu | **New · Tested** | `test-look-pilot-v169` (scoping, switch, no hex colours, kit last); build gate passes. No database change |

## Speed · v1.68.0 · branch `speed`

Audit on staging (owner: "I need everything a lot faster"): most pages redrew in 0.1–0.25 s, but Reorder list took 6.3 s, Reports 1.1–2.5 s, Products 2.1 s, Stock levels up to 2.6 s, Suppliers up to 3.4 s and My work 0.7 s. The cause, measured function by function, was full-list searches for every product: the app's product lookup, supplier prices (6,800 × 6,800), and the supplier price check that runs three times per draw. My work also rescanned and saved on every redraw.

| # | Change | Status | Evidence |
|---|---|---|---|
| S1 | Lookups built once per screen draw (product engine: supplier offers, inbound, demand, restock rules, the full reorder list; Reports, supplier and inventory engines: product and customer lookups), reset at the start of every draw and after the task; the app's product lookup indexed, falling back to a full search; supplier price check uses a set | **New · Tested in a real browser on staging** | Every page in the menu redraws in at most 0.57 s (median 0.15 s). Reorder list 6.3 → 0.2 s, Products 2.1 → 0.2 s, Suppliers → under 0.2 s, Reports 2.5 → about 0.55 s. Same figures as before (needs ordering 1 / £391.23, catalogue issues 6878, 21 units suggested) |
| S2 | Stock levels: 100 at a time, products holding stock first; Movements lookups indexed | **New · Tested in a real browser on staging** | "Showing 1–100 of 6,839 (16 holding stock, listed first)"; page 2 works; 2.6 → 0.2 s |
| S3 | My work rescans its sources at most once a minute (it rescanned and saved on every redraw); "… opened." message removed from menu clicks | **New · Tested** | My work 0.7 → 0.15 s |
| S4 | Tests | **New** | `test-speed-v168` (same answers with the lookups; 3,000 products in well under a second; reset picks up changes; source guards); existing engine tests pass; build gate passes. `test-supplier-command-engine-v115` (not in the gate) already failed before this change. No database change |
| S5 | App release | **Deployed · verified on live** 22 Nov 2026 (Vercel check green; live cache `pool-shed-v1.68.0-speed-r1`) | Live serves the faster engines; data unchanged |

Not in this release: loading rarely used parts only when first opened (82 scripts, 3.4 MB load on every visit), and the CSV import loops that look products up by SKU row by row.

## Faster Catalogue page · v1.67.0 · branch `catalogue-speed`

| # | Change | Status | Evidence |
|---|---|---|---|
| K1 | Catalogue draws 100 products at a time (it drew all ~6,800, about 10 s on staging); Previous / Next with "Showing x–y of n"; search, filters and sort still cover every product and go back to page 1 | **New · Tested in a real browser on staging** | Draws 100 of 6,662 rows; opening Catalogue from Home went from about 10 s to about 2 s; redraws and page changes 0.15–0.75 s; search "chlorine" found 215 across the whole catalogue, and clearing it brought all 6,662 back. `test-catalogue-paging-v167`; existing Product Hub tests pass; build gate passes. No database change |
| K2 | App release | **Deployed · verified on live** 22 Nov 2026 (live cache `pool-shed-v1.67.0-catalogue-r1`) | The first deploy attempt failed: the pager styles were in the generated app.css, which the CSS build overwrites. They were moved to `system/46-product-hub-command.css` and both checks passed. Live serves the pager code and styles; data unchanged |

## Navigation and page tidy-up · v1.66.0 · branch `navigation`

Owner: the navigation, the flow and the placement of tabs and buttons were not good. Audit on staging: 17 sections and about 100 pages; 8 things listed in two places (suppliers, counts, transfers, vans, invoices, credits, reorder list, approvals); three different kinds of menu (side menu, Accounts' 18 in-page buttons, Reports' 13-tab row); old internal names as page titles ("Inventory Tracker", "Data Insights", "Finance Command"); titles repeated in page banners; "Back to Dashboard" everywhere.

| # | Change | Status | Evidence |
|---|---|---|---|
| N1 | Side menu: 11 areas with at most 7 pages each, every page in one place, the rest under each area's "More"; sections added later still show; the menu follows each person's permissions; "Classic menu" kept | **New · Tested in a real browser on staging** | Every main page opened from the menu with the right title and highlight, mostly in about 0.6 s. "Reorder list" highlights Purchasing (it opens the stock replenishment screen). "Catalogue" (draws all 6,800 products, about 10 s) moved under More. Classic switch works both ways |
| N2 | One title per page ("Area › Page"); Back to Dashboard, repeated banner titles, Accounts' button block, the Reports and Quote Studio tab rows hidden; van reminder banner on Home only; Orders list without the duplicate count boxes | **New · Tested in a real browser on staging** | Accounts home: one title, and work starts at the top. Orders: the list starts about 100 px higher. No console errors |
| N3 | "+ New" at the top of the menu: sales order, quote, customer, purchase order, product, contract, project | **New · Tested in a real browser on staging** | Contract opened the new contract form; the quote and product start buttons and the order functions were found |
| N4 | Tests | **New** | `test-navigation-v166` (every existing page reachable, each listed once, at most 7 per area, aliases, + New, tidy-up rules); `test-frame-v155` updated for the new menu. Build gate passes. No database change |
| N5 | App release | **Deployed · verified on live** 21 Nov 2026 (Vercel check green; live cache `pool-shed-v1.66.0-nav-r1`) | Live site serves the new menu (`back-office-frame.js` v1.66.0); data unchanged |

## Ready for the web shop (any platform) · v1.65.0 · branch `webshop-ready`

Owner: the website is not built yet, so everything is ready to connect whichever platform is chosen. It starts switched off.

| # | Change | Status | Evidence |
|---|---|---|---|
| W1 | Migration 035: shop settings (secret never readable by staff), web orders received once, dispatch outbox, stock feed (sell-online products, warehouse stock less allocations) | **New · Proven on staging (rolled back), then applied on staging** | `scripts/ops/test-035-web-shop.sql`, 18 checks: starts off; can't switch on without a secret; short secret refused; secret never returned; Sales can't open settings but can list orders; Warehouse can't; same order twice makes one row (payment updated); no lines refused; ignore needs a reason; no double import; can't ignore an imported order; outbox only for web orders; test order; stock feed counts warehouse stock less allocations and leaves vans out; receive and stock functions are server-only |
| W2 | Server (`api/media.js`, no new function): `shop-order` (Shopify and WooCommerce webhooks, or any site signing with the secret) and `shop-stock` (Bearer secret); refused while switched off | **New · Unit tested** | `test-web-shop-v165`: signatures (right, wrong, body changed, unsigned, no secret); Shopify with VAT included, a discount and delivery; WooCommerce; generic. Prices before VAT per line after discounts |
| W3 | Sales → Web Orders (customer matched by email or created, SKUs checked, custom lines only when ticked, delivery line, payment if paid, one click or all ready); Settings → Web Shop (switch, platform, secret, the two addresses, test order, sell-online marking, catalogue check, outbox); dispatch updates queued on ship, part ship and collection | **New · Tested in a real browser on staging** | Test order sent from Settings, then created as SO-2067 for a new customer: 2 stock lines, delivery and payment £195.36. The server priced it at £162.80 before VAT, matching the web order |
| W4 | App and database release | **Deployed · verified on live** 21 Nov 2026 (035 applied after a schema backup; rolled-back live checks 18/18; Vercel check green; live cache `pool-shed-v1.65.0-webshop-r1`) | Live: the order and stock addresses both answer 503 "switched off" (nothing stored, 0 shop orders); data unchanged; switched off until the owner turns it on |

## Monthly management pack · v1.64.0 · branch `monthly-pack`

Finding: Reports already had a "Monthly Management Pack" card, but it only exported the report builder's current view. The new pack is a real page; the card now opens it.

| # | Change | Status | Evidence |
|---|---|---|---|
| M1 | Reports → Monthly Pack: any of the last 13 months. Sales and profit from delivered or invoiced orders, against last month and the same month last year, with a six-month trend. Best customers and best sellers. "Worth a look" list. Money from the ledger (finance roles only) plus what is owed from before the ledger. Stock value at average cost by place (each van listed). Purchasing, quotes, projects and contracts. Print or save as PDF (A4 print layout); CSV | **New · Tested in a real browser on staging** | Staging October 2026 drew in full: 13 orders, 47.0% margin, best customers and sellers, ledger money with the largest balances, and "worth a look" flagged 3 orders missing a cost, 1 core line to reorder and 1 low-margin project. Stock showed £0, which is correct for staging, where all positive stock rows are custom charges (not stock) |
| M2 | Tests | **New** | `test-monthly-pack-v164`: month maths and the default month, comparisons, stock by place (vans, negative bins ignored, no-cost lines counted), purchasing (drafts and cancelled excluded), quotes, contracts, ledger money (invoices less credits, receipts, aged buckets, overdue bills), money shown to finance roles only. Analytics tests still pass; build gate passes. No database change |
| M3 | App release | **Deployed · verified on live** 21 Nov 2026 (Vercel check green; live cache `pool-shed-v1.64.0-pack-r1`) | Live site serves `monthly-pack.js` at v1.64.0 with Reports → Monthly Pack; data unchanged since the v1.63 check |

## Contracts · recurring maintenance and repeat orders · v1.63.0 · branch `contracts`

Finding: Sales → Subscriptions already existed (repeat orders), but it only repeated stock products, so service lines were dropped. It counted in days rather than calendar months and created one order at a time. Live has none, so the same records are upgraded in place. Owner decisions: billing is per contract (fixed fee or per visit); due contracts are listed and created with one click, never automatically.

| # | Change | Status | Evidence |
|---|---|---|---|
| C1 | Sales → Contracts (old menu name still opens it): maintenance (fixed fee in advance or arrears, or per visit) or repeat order; service and product lines at the agreed price (customer discount not applied); weekly to yearly on the calendar; start, end, renewal, site and PO | **New · Tested in a real browser on staging** | Contract saved for a staging customer with a 5% discount; listed as due today; "Create 1 order" made an order straight to Invoice Ready with the period on the line; the server's invoice preview showed the full contract price with no discount |
| C2 | One click for everything due; the same period is never created twice; contracts stop after their end date; pause, resume, end; renewals in 60 days with a price change; monthly and yearly value; Home tile "contracts due" | **New · Unit tested** | `test-contracts-v163`: month-end and leap-year dates, arrears labels, older day-based subscriptions still create orders, a second order for the same period is refused, an ended contract creates nothing, a 5% renewal moves the line and its charge product; nothing runs on a timer. Build gate passes. No database change |
| C3 | App release | **Deployed · verified on live** 21 Nov 2026 (Vercel check green; live cache `pool-shed-v1.63.0-contracts-r1`) | Live site serves `contracts.js` at v1.63.0 with Sales → Contracts. Data fingerprint changed once since v1.62: on 21 Nov at 20:08 the owner's session (the post-020 live check) saved the 9 purchase-order status settings with `remindDays: 0` added (the v1.55 "no reminder" default). No other records changed; earlier values are in `ps_record_history` |

## Phase 3.4 finish · every read through the role rules (020 + 034) · v1.62.0 · branch `close-direct-reads`

Finding (live, read-only): besides the raw workspace table that 020 closes, 41 tables and views from the first design (products, sales_orders, purchase_orders, suppliers, quotes, stock and more) were open to any signed-in user to read and change, and 8 of them to anonymous visitors. Pool Shed has never used them. They are empty apart from a few setting and log rows, and no app or server code touches them. One app feature still read the raw table: the iPad Pool Audit handover check.

| # | Change | Status | Evidence |
|---|---|---|---|
| L1 | Migration 034: `ps_record_get` (one record, same role rules as the app load); first-design tables closed to signed-in and anonymous users, nothing dropped; exact rollback recorded from live grants (`034-rollback.sql`) | **New · Proven on staging (rolled back), then applied on staging** | `scripts/ops/test-034-lock-direct-access.sql`: Admin product has cost; Warehouse same product without cost; Engineer refused an unassigned job; no user refused; old products read and sales_orders write refused; raw workspace refused; change stamp, user profiles and the app load still work; anonymous view refused |
| L2 | App: the Pool Audit handover check reads the audit through `ps_record_get` | **New · Tested in a real browser on staging** (020 + 034 on) | Staging loaded normally with raw reads refused. Handover passed for both audits without photos; audits with photos stopped only at the server photo check, which has no local `/api`. `test-commercial-audits-v146` updated, new `test-locked-reads-v162`, build gate passes |
| L3 | 020 on live | **Deployed · verified on live** 21 Nov 2026, after the v1.62 app was live | Staff can no longer read the raw workspace data; the change stamp is still readable; the app load works. Azzy and server code are unaffected: Azzy uses `ps_workspace_load`, and server routes use the service key |
| L4 | App and database release | **Deployed · verified on live** 21 Nov 2026 (034 applied after a schema backup; rolled-back live checks 13/13; Vercel check green; live cache `pool-shed-v1.62.0-locked-r1`) | Live app in a real browser after 020: signed in, loaded and synced, no console errors; data unchanged. Staff can now be given their real roles |

## Blueprint step 7 · project stage invoices, average cost and Profit · v1.61.0 · branch `profit`

Finding: the project page already works out budget against actual (materials, linked POs, labour, tools, approved extras), but stage invoices still went to the old Xero draft queue. The Profit page only counted PO lines linked to an order, so anything sold from stock or entered as a custom line showed as 100% margin. Goods in never updated a product's cost. Not in this step: stock and cost-of-sales journals in the ledger. They wait for Xero go-live, so the books are set up once, against the chosen chart of accounts.

| # | Change | Status | Evidence |
|---|---|---|---|
| B7a | Migration 033: each stage lists its ledger invoices; a stage still billed cannot be invoiced again (credit it first); `ps_job_billing` gives one project's invoices, paid and owed (finance roles only) | **New · Proven on staging (rolled back)** | `scripts/ops/test-033-stage-billing.sql`: contract 10,500 including the approved extra; stage invoiced; second invoice for it refused; another stage still bills; full credit frees it; re-invoiced; totals 7,000 net; contract limit still applies; no user refused; numbering back to its value after the rollback |
| B7b | Project page: "Raise invoice" on a ready stage opens the Accounts invoice form on the ledger (the ready checks are kept); the stage shows its invoice number; a "Billed on the ledger" box shows agreed, invoiced, paid and owed with each invoice; close-out accepts ledger stage invoices | **New · Tested in a real browser on staging** | Test stage on a staging project: form filled from the stage, posted INV-2051 (£1,800), stage showed "INV-2051 · £1,800.00 still owed", box updated; after a reload the stage could not be picked again |
| B7c | Goods in: running average cost per product, with delivery, carriage, freight and duty lines on the PO spread by value (project charges stay on the project); the cost price is never changed; each receipt keeps unit, landed and before/after average | **New · Unit tested** | `test-profit-v161`: 4 at £120 plus £80 delivery on an £800 PO comes to £132 landed; with 2 on hand at £100 the average is £121.33; crane hire and site delivery are left out; non-stock lines are untouched. The wrapper is active in the browser |
| B7d | Accounts → Order Profit becomes Profit: by order, project, customer and month; period and "delivered or invoiced only"; stock at average cost, custom lines at their line cost, lines bought in at PO cost; a missing cost is flagged (never 100%); CSV for every view | **New · Tested in a real browser on staging** | Staging: every tab, period and filter drawn; orders with a custom line and no cost entered are flagged "check cost". Before the custom-line fix the overall margin was badly overstated (custom lines were skipped) |
| B7e | App and database release | **Deployed · verified on live** 21 Nov 2026 (033 applied after a schema backup; rolled-back live tests passed; Vercel check green; live cache `pool-shed-v1.61.0-profit-r1`) | Live site serves `profit-report.js` and `stock-costing.js` at v1.61.0; live ledger still empty, next invoice INV-2049; data unchanged |

## Blueprint step 6 · core stock and the reorder list · v1.60.0 · branch `stock-control`

Finding (live, read-only): 6,662 products count as stocked but only 18 hold any stock (17 units); none has a reorder level; 6,469 have a cost and all have a supplier. Pool Bros buys mostly to order. Existing features reused: Product Hub replenishment (projected stock with stock on order and orders waiting, pack sizes, grouped by supplier, draft POs) and automatic PO statuses from receiving. Not in this step (moved to step 7, profit): average and landed cost on goods in, and stock journals in the ledger.

| # | Change | Status | Evidence |
|---|---|---|---|
| B6a | Core Stock page (Stock → Products): keep / stop keeping each line or a whole page, sales in 90 days and 12 months, on hand, cost, reorder point and order-up-to with suggestions from sales rounded to pack size; only kept lines can need ordering | **New · Tested in a real browser on staging** | `test-core-stock-v160`. Staging: top seller (42 sold in 90 days) kept with suggested 7 / 20; it appeared on the reorder list (1 already needed by an order, 21 suggested, £391.23); 62 Water Testing lines kept in one action (1 / 2, no sales) then released. Redraw cut from 1.2 s to 0.1 s by checking only kept lines |
| B6b | Purchasing → Reorder List link; Home tile "core stock lines to reorder" (kept lines only) | **New · Tested in a real browser on staging** | Menu shows Reorder List, which opens Product Hub → Replenishment; Home showed "1 core stock line to reorder, £391 suggested". Build gate passes. No database change |
| B6c | App release | **Deployed · verified on live** 21 Nov 2026 (Vercel check green; live cache `pool-shed-v1.60.0-corestock-r1`) | Live site serves `core-stock.js?v=1.60.0`; no database change; data unchanged |
