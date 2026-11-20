# Phase 3 plan — from one shared document to per-record storage

Status: **approved 20 Nov 2026** · 3.1 live (mirror paused) · 3.2 + 3.3 built and tested on staging, released together as v1.49.0 · written 20 Nov 2026 · nothing in this plan has been built yet.

Bound by the continuity promise (master guide §1): this is an upgrade of the existing system. Every record already entered stays in the app, in its usual place, at every step. No step starts from an empty database or asks staff to re-enter anything.

---

## 1. Why Phase 3

Today the whole business is one 7 MB document (`workspace_snapshots`, row `pool-bros-main`). After Phases 1 and 2, the remaining problems all come from that design:

| Problem | Effect on staff | Fixed in step |
|---|---|---|
| Any two people saving at once clash, even on unrelated records | "Another user saved first" messages; the merge runs in the browser | 3.3 |
| When someone saves, every other open tab downloads the whole 7 MB again | Slow refresh; Supabase data use | 3.2 |
| Every save uploads the whole business | Slow saves on iPads and weak signal | 3.3 |
| Every user receives costs, margins and finance | Cannot safely give Engineer or Warehouse logins | 3.4 |
| Server features (Azzy, quotes, project review/email, health checks) download the whole business for one record | Slow; 60-second Azzy timeouts | 3.1 |
| Each safety copy is a full 7 MB copy | Database growth (contained by Phase 2 retention) | 3.5 |

## 2. What we found (20 Nov 2026)

- The app keeps the business in one in-memory object (`data`). **216 save calls in about 40 files** change it and call `saveAppData()`. All network traffic goes through one sync layer in `01-legacy-01.js` (load, stamp check, `ps_workspace_save`).
- **9 server functions** read the snapshot directly: `quote`, `project-review`, `project-email`, `workspace-health`, `workspace-sales-audit`, `workspace-integrity-audit`, `workspace-order-recovery`, `workspace-recovery-publish`, and Azzy (`server/azzy-pool-shed.js`).
- **Record shapes vary and are wide.** Products have 43 fields, suppliers 47, sales orders 37, with nested lines and payments. Several fields were added in later versions.
- **Eight list sections have no `id`** (`suppliers`, `stock`, `brands`, `statuses`, `purchaseStatuses`, `tags`, `customerNotificationRules`, `integrations`). Each has a unique natural key (for example supplier name; stock = product + location; both checked unique on live).
- **Nine sections are settings objects**, not lists (`companySettings`, `quoteSettings`, `financeCommand`, …).
- About **30 typed tables from an earlier attempt** (`customers`, `products`, `sales_orders`, …) exist but are **empty**. They have fixed columns that do not match the current records.

## 3. The key decision: change the sync layer, not the screens

**Recommended: keep the app's in-memory model and every screen as they are, and replace only the sync engine underneath.** The 216 save calls keep working unchanged. The sync layer works out which records changed and sends only those.

**Rejected: rewrite each screen to call per-record APIs.** That means touching ~216 call sites across ~40 files: high risk of a missed path silently not saving, and months of work before any benefit.

**Storage: one lossless record store**, not the old typed tables:

```
ps_records(workspace_id, section, key, data jsonb, hash, version, updated_at, updated_by, deleted_at)
ps_record_history(record, old data, new data, changed_by, changed_at)   -- per-record history
ps_settings(workspace_id, section, data jsonb, version, …)              -- the 9 settings objects
```

- `data` holds the record **exactly as the app wrote it**, with every field, including ones added in future. Nothing can be dropped in translation, which is what the continuity promise needs.
- `key` = the record's `id`, or its natural key where there is no id. Record JSON is never rewritten to add ids.
- Typed **reporting views** (customer name, order totals, status, dates) sit on top for dashboards, Xero and reports. They are read-only, so a mistake in a view can never damage data.
- The empty legacy tables are left untouched, and retired in a later clean-up.

## 4. Steps

Each step is built and proven on staging (with a fresh copy of live) first. Each step ends with the continuity check (`PASS · every earlier record is still present`), the build gate, and the owner's go-ahead before live.

### 3.1 Shadow store (no app change) — low risk
- Create `ps_records`, `ps_record_history` and `ps_settings`, then backfill them from the live snapshot in one transaction.
- A database trigger on `workspace_snapshots` keeps them in step on **every** save, from every path: the staff app, Quote Studio and recovery tools. It compares section hashes first, so unchanged sections (for example 13,586 product rows) cost almost nothing. Only changed records are written, and each change is added to history.
- A built-in self-check: `ps_records_verify()` proves every record and setting equals the snapshot, in the same order. **Revised:** a mirror problem never blocks a staff save. It is logged to `ps_record_sync_issues` instead, because in 3.1 the snapshot is still the source of truth.
- ~~Move the 9 server functions to read single records.~~ **Revised 20 Nov 2026 after reading them:** the recovery, audit and health tools genuinely need the whole business and run rarely. Azzy answers questions about anything, so it needs per-question lookups (Phase 7), not a swapped source. Project review and extra-email need linked orders and costs across several sections and run a few times a day. These move to 3.2, which adds a "fetch these sections" read anyway. Swapping them now would add risk for little gain.
- **Proof:** record-by-record equality with the snapshot after a week of normal use; Azzy, quote and project-email answers identical before and after.
- **Rollback:** drop the trigger. The snapshot is untouched and still the source of truth.

### 3.2 Delta refresh (app reads changes only) — low-medium risk
- The 8-second stamp check returns **the records changed since this tab last looked** (usually a few KB), instead of triggering a 7 MB download.
- Start-up still loads everything once (later: paged), and the offline/iPad copy in IndexedDB keeps working, because the app still holds the full `data` object.
- Behind a switch (`deltaRefresh`), so it can be turned off instantly.
- **Proof:** two browsers; edits in one appear in the other within 8 s; transfer per refresh in KB; offline audit on iPad still opens and syncs.

### 3.3 Per-record saves (no more whole-business uploads or clashes) — medium risk
- The sync layer compares the current `data` with the last confirmed copy and sends only the changed records (`ps_records_save(changes, base versions)`).
- The server checks each record's version: different records never clash. Only two people editing **the same record** get a merge prompt, showing whose change and which fields.
- Business rules move to per-record checks: append-only goods-in ledger (database trigger refuses update/delete), stock never negative, refuse mass erasure.
- During this step the server rebuilds the snapshot from the records after every save, so the old store stays a complete, current archive and fallback.
- Behind a switch (`recordSaves`), sections switched one at a time: customers → suppliers and small lists → products/supplierProducts → stock and ledger → purchase orders → sales orders and payments → jobs, quotes, projects → notifications and logs.
- **Proof per section:** continuity check PASS; concurrency test (two users edit different records at once, both survive); same-record conflict test; reload test; offline test; totals on screen unchanged.

### 3.4 Role-based visibility (safe Engineer and Warehouse logins) — medium risk
- Row-level security on `ps_records` by section and role. Sensitive fields (cost, margin, supplier price, payments, finance) are removed **server-side** for roles that should not see them. They never reach the browser, the network tab or Azzy.
- Saves from restricted roles update only the fields they can see. Hidden fields are kept by the server, so (unlike the rejected Phase 2 idea) a restricted save can never erase costs.
- **Proof:** an Engineer test account cannot obtain cost or margin data by any route (screens, network tab, Azzy, direct API), and its saves leave hidden fields intact.

### 3.5 Retire whole-document writes
- Once every section runs on records for 2 clean weeks, the snapshot stops being written per save. It becomes a nightly read-only archive.
- Whole-document revisions stop. Per-record history replaces them: it is smaller and shows who changed what.
- **Rollback:** switch sections back to snapshot mode. The nightly archive and history allow a rebuild.

## 5. Decisions needed from the owner

1. **Approve the approach** in §3 (keep screens, replace sync; lossless record store).
2. **Role visibility matrix for step 3.4.** Recommended default:

| Data | Admin | Management | Accounts | Sales | Purchasing | Warehouse | Engineer |
|---|---|---|---|---|---|---|---|
| Customers and jobs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Products (sell prices) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Product cost, supplier prices, margins | ✓ | ✓ | ✓ | — | ✓ | — | — |
| Sales orders | ✓ | ✓ | ✓ | ✓ | view | view (no prices) | own jobs |
| Payments, finance, Xero | ✓ | ✓ | ✓ | — | — | — | — |
| Purchase orders | ✓ | ✓ | ✓ | view | ✓ | view (no costs) | — |

3. **Testing window.** Steps 3.2 and 3.3 each need someone to use two devices for about 30 minutes on staging.

## 6. Estimate

| Step | Working sessions | Live risk |
|---|---|---|
| 3.1 Shadow store + server reads | 1–2 | Low (no app change) |
| 3.2 Delta refresh | 1–2 | Low-medium (switchable) |
| 3.3 Per-record saves, section by section | 3–5 | Medium (switchable per section) |
| 3.4 Role visibility | 2 | Medium |
| 3.5 Retire document writes | 1 | Low (after 2 clean weeks) |

The first live benefit (faster Azzy and server features, per-record history) arrives after 3.1. The biggest staff benefit (no clashes, fast saves) arrives during 3.3.

## 7. What does not change

Screens, workflows, record numbers, customer and order history, documents, PDFs, audits, logins and the Vercel app address all stay the same. Phase 4 (the "Deep End" redesign) is built on top of this, after it.


---

## 3.4 detailed design (owner decisions, 20 Nov 2026)

**Who sees what**

| | Admin, Management, Accounts | Sales, Purchasing, Office | Warehouse | Engineer |
|---|---|---|---|---|
| Costs and margins (`products.cost`, `supplierProducts.cost`, PO line `unitCost`/`confirmedUnitCost`, SO line `unitCost`, project `costs`, margins, budgets, labour rates, extra costs) | ✓ | ✓ | hidden | hidden |
| Payments and finance (SO/PO `payments`, `paymentCorrections`, `xeroRef`, invoice status, customer `creditLimit`/`creditDays`/`creditTermType`/`xeroContactId`, `financeCommand`) | ✓ | hidden | hidden | hidden |
| Security settings (`securityControl`) | Admin, Management | hidden | hidden | hidden |
| Jobs | all | all | all | **assigned jobs only** (owner, or listed in a new "Assigned engineers" field) |
| Sales and purchase orders | all | all | all | **only orders linked to their jobs, with no prices** |
| Quotes | all | all | all | hidden (they are price documents) |

**Found while designing (fix first):** any signed-in user could change their own `role`, `permissions` or `active` in `user_profiles`, so every role check could be bypassed. `018` closes it (tested on staging).

**How it is enforced (server-side; nothing hidden ever reaches a restricted device)**
1. `workspace_snapshots.data` is no longer readable directly by staff. Everyone loads through `ps_workspace_load()`, which returns the full workspace to Admin, Management and Accounts, and a redacted copy to other roles. The stamp check (`updated_at`) stays a direct read.
2. The change feed applies the same redaction (hidden records are left out, hidden fields are stripped, and record lists cover visible records only).
3. Restricted roles can only save per record. The server puts every hidden field back from the stored record before saving, so a restricted save can never erase a cost, a payment or a hidden order. Hidden records and settings cannot be changed. The full save is refused for restricted roles.
4. The load response lists the hidden fields, so the app strips them from its own copy before working out changes (otherwise defaults such as `cost: 0` would look like edits).
5. Server functions: the project AI review and Quote Studio staff actions require a role that sees costs; Azzy reads through the redacted load.

**Proof required before live:** an Engineer test account on staging cannot obtain any cost, margin, payment or hidden order through the app, the network tab, the REST API, the change feed, Azzy or the server functions (automated scan for cost, finance and price fields in everything returned). Its saves leave every hidden field unchanged (before and after compared field by field). Admin behaviour is unchanged.

**Known limitation until Phase 4:** some screens may show £0.00 or "—" in cost columns for Warehouse and Engineer users. The data is not there; the new interface in Phase 4 hides those columns properly.

**Implementation notes (20 Nov 2026):** database roles now match the app's (Admin, Management, Accounts, Sales, Purchasing, Warehouse, Engineer, Office; legacy Manager = Management, Viewer = Office). Audit logs and approval settings are visible to Admin, Management and Accounts only, because they hold before-and-after copies of costs and payments. Notification read markers are hidden from cost-restricted roles. **Known limit:** free text typed into a visible field (for example an order note that mentions a price) is shown as typed.
