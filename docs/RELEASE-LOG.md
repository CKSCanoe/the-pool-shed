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
| 0.5 | Full `pg_dump` of live database | **Outstanding** · needs owner | Runbook step 3 |
| 0.6 | JSON export + live fingerprint | **Outstanding** · needs owner | Runbook step 4 |
| 0.7 | Storage file backup | **Outstanding** · needs owner | Runbook step 5 |
| 0.8 | Backup integrity check, off-site copies ×2 | **Outstanding** | Runbook step 6 |
| 0.9 | Restore drill into staging, fingerprint PASS | **Outstanding** · gate for Phase 1 | Runbook step 7 |
| 0.10 | Compare with GitHub `main` and the v1.47.7 work (`d6a4d29`) | **Blocked** · repository URL and access needed | — |
| 0.11 | Vercel env var names inventory (names only) | **Outstanding** · needs owner | Vercel → Settings → Environment Variables |

### Live fingerprint (fill in after step 0.6)

| Measure | Value |
|---|---|
| Snapshot updated_at | |
| Snapshot size | |
| Customers / Products / Suppliers | |
| Sales orders / lines | |
| Purchase orders / lines | |
| Stock rows / total qty | |
| Revisions table rows | |
| Storage buckets / files / size | |
| Fingerprint hash | |
