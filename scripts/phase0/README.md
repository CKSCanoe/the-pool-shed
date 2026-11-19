# Phase 0 runbook: protect the live data before any change

Time needed: about 45 minutes, plus a 15-minute no-edit window for staff.
Everything here only **reads** from the live Supabase project. The one step that writes (the restore drill) writes to a **separate, empty** staging project.

Backups land in `backups/`, which git ignores, because they contain customer and financial data. Keep two copies off this Mac (an encrypted external drive, plus a private cloud folder).

---

## Step 1 · One-time setup (5 min)

1. In Supabase: **Project Settings → API**. Copy the Project URL and the `service_role` secret.
2. In the project folder: copy `.env.phase0.example` to `.env.phase0.local` and paste both values. The file is git-ignored. Never share it or paste the key into chat.
3. Install the Postgres tools for the full database dump:
   ```bash
   brew install libpq
   ```

## Step 2 · Freeze (start of the 15-minute window)

Ask staff not to edit Pool Shed. Note the time in `docs/RELEASE-LOG.md`.

## Step 3 · Full database dump (primary backup)

In Supabase: **Connect → Session pooler**. Copy the connection string and swap in the database password. Then:

```bash
mkdir -p backups/pgdump
/opt/homebrew/opt/libpq/bin/pg_dump "PASTE-CONNECTION-STRING" --no-owner --no-privileges -Fc -f backups/pgdump/pool-shed-full.dump
```

```bash
/opt/homebrew/opt/libpq/bin/pg_dump "PASTE-CONNECTION-STRING" --schema-only --no-owner -f backups/pgdump/pool-shed-schema.sql
```

This captures the tables, functions, row-level-security policies and auth users. It does **not** capture uploaded files (step 5).

## Step 4 · Independent JSON export and fingerprint (second backup)

```bash
node scripts/phase0/backup-database.mjs
```

This exports every table, the user list, and `fingerprint-pool-bros-main.json`: record counts, stored money totals and a hash of every section. The fingerprint is the "nothing lost" baseline for every later phase.

Only the newest 50 workspace revisions are exported by default, because that table may be very large. The total row count is recorded. Add `--all-revisions` if you want everything.

## Step 5 · Uploaded files

```bash
node scripts/phase0/backup-storage.mjs --into backups/<folder-from-step-4>
```

This downloads every file in every bucket, recording its size and SHA-256.

## Step 6 · End the freeze, then check the backup

```bash
node scripts/phase0/verify-backup.mjs backups/<folder-from-step-4>
```

It must say `PASS`. Copy the `backups/` folder to both off-site locations.

## Step 7 · Restore drill (proves the backup actually works)

1. Create a new, empty Supabase project called `pool-shed-staging` in the same region. It is free; delete it after Phase 1 if you like.
2. Add its URL and service key to `.env.phase0.local` as `STAGING_SUPABASE_URL` and `STAGING_SUPABASE_SERVICE_ROLE_KEY`.
3. Restore the application schema and data into staging, using the staging project's own Session pooler connection string:
   ```bash
   /opt/homebrew/opt/libpq/bin/pg_restore --no-owner --no-privileges --schema=public -d "STAGING-CONNECTION-STRING" backups/pgdump/pool-shed-full.dump
   ```
4. Export staging the same way and compare:
   ```bash
   node scripts/phase0/backup-database.mjs --target staging
   ```
   ```bash
   node scripts/phase0/compare-fingerprints.mjs backups/<production-folder>/fingerprint-pool-bros-main.json backups/<staging-folder>/fingerprint-pool-bros-main.json
   ```
5. It must print `PASS · identical`. Record the result in `docs/RELEASE-LOG.md`. **Phase 1 does not start until this passes.**

---

## What each tool does

| Tool | Writes to Supabase? | Purpose |
|---|---|---|
| `backup-database.mjs` | No (GET only) | Export all tables, users and fingerprint |
| `backup-storage.mjs` | No (reads and lists only) | Download every stored file with hashes |
| `verify-backup.mjs` | No (local only) | Prove the backup on disk is intact |
| `fingerprint.mjs` | No (local only) | Counts, stored money totals, per-section hashes |
| `compare-fingerprints.mjs` | No (local only) | PASS/FAIL between two fingerprints, listing every difference |

These tools were tested on 19 Nov 2026 against a local mock of Supabase:
- paging through 1,234 rows;
- the newest-50 revision limit;
- nested storage folders;
- zero write requests;
- tamper detection for a changed quantity, a removed record and a corrupted file;
- no false alarm when only key order differs.

They have **not yet been run against the live project.**
