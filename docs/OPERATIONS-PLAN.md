# Pool Bros operations build-out — sales, projects, tools, supply, accounts, warehouse and profit

Owner's brief (20 Nov 2026): *everything we do for Pool Bros, from sales and projects to tools and supply, with a very tight professional accounts system, easy payment runs for what needs invoicing and what needs paying, a top-notch warehouse that tracks stock on vans and where everything is, and a clear view of how much profit the business makes. Make sure each area is usable, and put processes in where there aren't any.*

Bound by the continuity promise: nothing already entered is lost; every change is tested on staging first.

---

## 1. Diagnosis: the parts exist, the chains are broken

Much of this was built in earlier versions but is unused, because the **first step of each chain never happens**, so everything after it stays empty:

| Chain | Where it breaks today (live data, 20 Nov 2026) | Effect |
|---|---|---|
| Supplier → pay | All 26 POs stay "Draft - Review"; no supplier bills recorded; no supplier on-account terms | **Payment runs are always empty** (they need: PO sent → received → bill matched → on account) |
| Order → invoice → paid | 22 orders still carry the default Xero reference "Draft"; payments on 6 of 29; Xero not connected | Invoicing and payments live outside Pool Shed; "Invoiced" is typed by hand |
| Goods in → stock → van → job | 0 products set to "track stock"; no van locations; stock total 17 | Stock levels, van readiness and restock can't work |
| Work → profit | Profit per order excludes project orders (most of your work); labour (24 days logged) not in profit | No reliable "how much are we making" |
| Tools | Tool charging exists inside projects; the tools register is empty | No idea where tools are or what they earn |

What already exists in the code (and will be reused): Finance Command (invoice-ready list, customer and supplier accounts, overdue, **payment runs**, three-way match, reconciliation, month end, Xero document queue), Engineer Van locations with min/target/max and a "van readiness" check, transfers, goods-in with QC and putaway, stock movements, project labour and tool charges, profit per order.

---

## 2. The end-to-end processes (what "working" means)

**A. Sales and invoicing**
Quote (or phone order) → Sales Order → goods picked from the warehouse, a van or a job bin → delivered or fitted → **Invoice Ready** (automatic once delivered or completed) → Accounts reviews in one queue → invoice created in Xero with one click → payment received in Xero and matched back → order shows **Paid**. Overdue invoices appear on the dashboard for chasing.

**B. Supply and paying suppliers**
Need (job materials, a van below minimum, a customer order) → PO (from the job or the reorder list) → **Sent** (emailed from Pool Shed or marked sent) → delivery booked in at goods-in → **Received** (part or full, automatically) → supplier bill entered or pulled from Xero → **three-way match** (ordered = received = billed, differences flagged) → due date from supplier terms → **payment run**: one screen showing what is due this week, tick, approve, export the bank payment file (or pay in Xero) → marked paid, with remittance emailed to the supplier.

**C. Warehouse and vans**
Every place stock can be is a location: warehouse bins, receiving bay, quarantine, **each van**, each job bin. Goods-in → putaway to bin → **transfer to van** (by scan or tap) → engineer **uses on job** from the van (phone, one tap) → that stock is costed to the job automatically → van below minimum → restock list → transfer or PO. Weekly **van stock check** on the phone; differences reported. A live **"where is it?"** search: product → every location and quantity.

**D. Tools**
Tools register (serial, value, service due) → assigned to a van or person → booked onto a job (hire charge if wanted) → returned or checked → service and inspection reminders → "where is every tool right now".

**E. Profit**
Every sale line has a cost (from the product, the supplier bill or the job). Every job collects materials (POs, van usage), labour (days × rate) and tool hire. Profit appears **per order, per job, per customer and per month**: sold − cost = gross profit and margin. With Xero, overheads give net profit for the business. A dashboard tile shows **this month's profit against last month**.

---

## 3. Build plan (in order; each step is usable on its own)

| Step | What | Builds on | Size |
|---|---|---|---|
| **O1. Purchasing that flows** | Automatic PO status (sent, part or fully received, billed); "order for this job"; outstanding deliveries; supplier terms (on account / proforma, days); supplier bill entry with three-way match | Phase 3 records | M |
| **O2. Payment runs** | Due-this-week list from matched bills; approve; bank payment file export (your bank's format) or push to Xero; mark paid; remittance email | O1 | M |
| **O3. Pool Shed ledger** | Double-entry ledger (§5): invoices, credit notes, bills, payments, stock journals; posted entries can't be edited (corrections by credit or reversal); month close; aged debtors and creditors; trial balance; push to Xero | Phase 6 reshaped | L |
| **O4. Warehouse and vans** | Set up vans as locations; choose tracked products (van kit and chemicals first); transfers; "use on job" from a van on the phone; weekly van check; "where is it?" search; restock from van minimums | Phase 3 records | L |
| **O5. Profit** | Costs on every line (including custom lines); job profit from materials, labour and tools; profit per order, job, customer and month; dashboard tile; Xero overheads for net profit | O1–O4 | M |
| **O6. Tools** | Register, assignment to van or person, job bookings and hire charges, service reminders, "where is it?" | O4 locations | M |
| **O7. Sales and projects polish** | Quick-pick service items; job from accepted quote; one-tap labour day; simple job view; customer timeline | SECTION-REVIEW.md | M |

The **Deep End interface (Phase 4)** is built as these land: each area gets its redesigned screens when its process is in place, not as a separate big bang.

Phase 3 still finishes first where it protects data (020 tomorrow; 3.5c about 4 Dec).

---

## 4. Decisions needed from the owner

1. ~~Accounts system of record~~ **Decided 20 Nov 2026: Pool Shed is the ledger** (Brightpearl-style); posted documents are pushed to Xero. See §5.
2. **How suppliers are paid:** online banking with a bulk payment file (which bank?), paid in Xero, or by card or direct debit.
3. **Vans:** how many, and who drives each.
4. **Which stock to track first:** van kit and chemicals (recommended), or more.
5. **First priority**, if not O1 → O2 → O3 → O4 → O5 → O6 → O7.


---

## 5. The Pool Shed ledger (owner decision 20 Nov 2026: Brightpearl-style)

**Principle:** Pool Shed is where every financial event is recorded and corrected. Xero receives the **final, posted** documents for the official books, VAT return and bank reconciliation. Nothing financial is ever edited after posting: mistakes are corrected with a credit note, a reversal or a correcting journal, so there is always a full, auditable trail. This is how Brightpearl, Sage and Xero itself work.

**What it records (each posts a balanced double entry: debits = credits, enforced by the database):**

| Event in Pool Shed | Ledger document | Double entry (simplified) |
|---|---|---|
| Goods received at goods-in | Stock receipt | Dr Stock · Cr Goods received not invoiced |
| Supplier bill entered and matched | Purchase invoice | Dr Goods received not invoiced (+ price variance) + Dr VAT input · Cr Creditors |
| Return to supplier / supplier credit | Purchase credit note | the reverse of the above, for the returned quantity |
| Payment run paid | Supplier payment | Dr Creditors · Cr Bank |
| Order delivered or job stage complete | Sales invoice | Dr Debtors · Cr Sales + Cr VAT output; **and** Dr Cost of sales · Cr Stock at average cost |
| Customer return or price correction | Sales credit note | the reverse, for the credited lines (restocked items go back to Stock) |
| Customer pays | Customer receipt | Dr Bank · Cr Debtors (allocated to invoices) |
| Van stock used on a job | Job materials journal | Dr Job cost (work in progress) · Cr Stock |
| Labour day logged | Labour cost journal | Dr Job cost · Cr Subcontractor accruals (or creditors via their bill) |
| Stock check difference | Stock adjustment | Dr/Cr Stock adjustments · Cr/Dr Stock |
| Anything else | Manual journal (Accounts and Admin only, with a reason) | as entered, must balance |

**Rules built into the database (not just the screens):**
- Posted documents and journal lines **cannot be changed or deleted**; corrections create new documents that reference the original.
- Every journal **balances** (debits = credits) or it is rejected.
- **Month close:** once a month is closed, nothing can post into it; corrections go into the current month with a reference to the original.
- Who can post, approve payment runs and close months follows the role rules from 3.4 (Accounts, Management, Admin).
- The ledger lives in proper database tables (not inside the workspace document), so it stays fast and is never part of what restricted roles download.

**Reports from the ledger:** aged debtors and aged creditors, customer and supplier statements, trial balance, profit and loss (gross profit from real cost of sales; net profit once overheads arrive from Xero or are entered), stock valuation, VAT summary to check against Xero, and job profitability.

**Push to Xero:** the existing Xero connection (OAuth, queue, webhooks, sync) is reused. Posted sales invoices, credit notes, purchase invoices, purchase credits and payments go to Xero as documents against the mapped contacts and account codes. Stock, cost-of-sales and job journals go as **daily summary journals**, so Xero's books match without clutter. Each document shows its status: *not sent, queued, in Xero, needs attention*. Anything Xero rejects is listed with the reason, and is fixed in Pool Shed, never in Xero.

**Before go-live:** chart of accounts mapped to your Xero account codes; **opening balances** taken from Xero on the go-live date (open customer invoices, open supplier bills, stock value); a parallel month where both are compared; then Pool Shed becomes the place where entries are made.

**Still to decide:** stock costing (recommended: weighted average cost); VAT scheme (standard accrual or cash, flat rate?); posting style to Xero (documents plus daily summaries, recommended); go-live month.


---

## 6. Finding (20 Nov 2026): purchase orders are used to record job costs

Live data (patterns only): 24 of 26 POs entered by hand, all "Needs review", supplier email "Blocked until reviewed" on 24; **70 of 90 lines are one-off custom purchases** (building materials 42, plant and crane hire 12, groundworks, delivery, consumables), suppliers include builders' merchants, plant and crane hire, a tree surgeon, traffic management and a fuel station; 23 of 26 are for a job; none linked to a sales order. Only one PO shows real ordering (supplier confirmed, part received).

**Meaning:** most "POs" are records of things already bought, used to put the cost on the job. Forcing them through sent → received → billed adds steps without value, which is why they never leave "Draft".

**Proposed process (owner to confirm):** two clear routes, both feeding job profit, the ledger and payment runs:

1. **Record a purchase** (most cases): supplier, date, job, category, net and VAT, how it was paid (on account, card or cash), receipt photo. One step. It posts a **purchase invoice** (Dr job cost or direct purchases + VAT input; Cr creditors) and, if paid by card or cash, the **payment** at the same time. Purchases on account then appear in the **payment run** when due.
2. **Order from a supplier** (goods ordered in advance, e.g. pool equipment): PO → sent → received at goods-in (status automatic) → supplier bill matched (three-way) → payment run.

**Existing 26 POs:** they stay as they are (continuity promise). They pre-date the ledger, and their costs are already in Xero, so they are **not** posted again. They are marked "Recorded before ledger" (owner confirms) so the PO list shows what is genuinely outstanding.
