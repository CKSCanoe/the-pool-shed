# Pool Shed — section-by-section review

Started 20 Nov 2026 at the owner's request: *"recommend better processes and updates, and look at each section as unique."* This is a living document; each phase updates the sections it touches.

**Method:** how each section is really used, measured from the live data on 20 Nov 2026 (counts and patterns only; no customer details or amounts), plus what was learnt in the code during Phases 0–3. Each section gets its own recommendation, sized **S** (under a day), **M** (a few days) or **L** (a week or more), with the phase it fits.

---

## At a glance

| Section | What the data says | Top recommendation | Size |
|---|---|---|---|
| Sales orders | 29 orders, mostly phone orders; **70% of lines are typed-in custom lines** | Quick-pick "service and kit items" plus a proper invoicing hand-off to Accounts | M |
| Purchasing | 26 POs, **all still "Draft - Review"**, although 18 deliveries were received | Status moves by itself from what happens (sent, received, billed) | M |
| Stock and warehouse | **0 products stock-tracked**; total stock quantity 17; no stock takes, goods notes or allocations | Decide: job-materials tracking, not a full warehouse; hide unused tools | M |
| Products | 6,837 products (92% one supplier's price list); **141 ever sold** | Split "our range" from "supplier catalogue"; one place for cost | L |
| Customers | 19, all active, all with email | Customer history panel; keep it simple | S |
| Suppliers | 17, identified by **name** (no IDs); a duplicate | Stable supplier IDs; merge the duplicate | S |
| Jobs and projects | 2 jobs; one with 24 labour days; phases and documents unused | Start a job from the accepted quote; one-tap "log a labour day" | M |
| Quotes | 2 drafts; Quotient not connected | Decide quote volume before Phase 5 | — |
| Pool audits | 4 audits, **all still draft** | A clear "finish and send report" step | S–M |
| Notifications | 383, none archived; **72% are internal notes** | Separate "needs attention" from the activity timeline | M |
| Audit logs | Two separate logs (130 + 28) | Use the new per-record history as the one timeline | M |
| Integrations | Xero, Quotient, WooCommerce, shipping: **none connected** | Xero first (Phase 6), for Accounts | L |
| Unused modules | Tools, subscriptions, credits, automation rules, stock takes and more: **empty** | Hide by default; switch on per business need | S |

---

## Sales orders

**Data:** 29 orders (23 in October). 26 are phone orders and all were created manually. Average 5 lines; **102 of 145 lines are custom lines with a special price**, only 37 are catalogue products. Statuses used: Invoiced 18, Invoice Ready 5, Needs Review 5, Part Received 1 (**4 of the 14** configured statuses). 22 orders still carry the default Xero reference "Draft", although 18 are marked Invoiced. Payments are recorded on only 6 orders. No invoice emails are sent from Pool Shed. 12 orders are linked to a job.

**What it means:** staff mostly type what they sell (services, labour, chemicals, delivery) instead of picking from the 6,837-product catalogue, which is mostly a supplier price list. Invoicing happens outside Pool Shed, so the "Invoiced" status is set by hand and payments live elsewhere.

**Recommendations**
1. **Quick-pick items (S–M):** a short list of the things actually sold (services, labour rates, chemical doses, delivery) as proper items with price and cost, offered first when adding a line. Fewer typed lines means consistent prices, reliable margins and searchable history. Chemical usage charges (29 so far) already follow a pattern and are the first candidates.
2. **Accounts hand-off (M, ties to Phase 6):** "Invoice Ready" becomes Rach's queue (in the Deep End design). With Xero connected, one click creates the invoice, stores the real Xero number and brings payments back automatically, so "Invoiced" and "Paid" stop being typed by hand.
3. **Fewer statuses (S):** show the 6–7 statuses that match how orders actually move; keep the rest available but hidden, without deleting any history.
4. **Small fix (S):** the "price override reason" is filled automatically on every order with the price list used, so it isn't a real override. Rename it "Pricing note", so a genuine override stands out.

## Purchasing

**Data:** 26 purchase orders, **all "Draft - Review"**. 17 have no order date. 23 of 26 are for a job. 18 deliveries were received and put away, yet no PO moved to Sent, Part Received or Received. No supplier payments or invoice matching recorded.

**What it means:** purchasing is real (for jobs), but the status steps aren't used. Anyone looking at the PO list can't tell what's outstanding.

**Recommendations**
1. **Automatic status (M):** sent when emailed or marked sent; part or fully received from goods-in; billed from the supplier invoice (Xero, Phase 6). No manual status changes needed.
2. **"Order for this job" as the main flow (S–M):** start a PO from the job (materials list → supplier → PO), since 88% of POs are for a job.
3. **Outstanding deliveries view (S):** what's ordered and not yet received, by supplier, with expected dates from each supplier's lead time (already set for all 17 suppliers).

## Stock and warehouse

**Data:** **0 products are stock-tracked.** 37 stock rows with a total quantity of 17 and nothing allocated. 5 locations, 38 movements, 18 receipts, 36 QC events, 1 purchase return. No stock takes, goods notes, pick runs, allocations or restock rules.

**What it means:** Pool Bros works job by job: goods come in for a job and go out to the job. The full warehouse system (picking, packing, stock takes, restock rules) is built but not used, and it adds screens and data to every device.

**Recommendations**
1. **Decide the model (owner decision):** *job materials tracking* (receive → job bin → used on job, with what's left over) rather than a full warehouse, unless you plan to hold stock of a core range.
2. **If you'll hold a small range** (for example the chemicals you charge for): track only those products and set reorder levels for them.
3. **Hide the unused warehouse tools by default (S):** they can be switched back on in Settings, and their data is kept.

## Products and catalogue

**Data:** 6,837 products, 92% from one supplier's price list (Certikin 6,266). 175 hidden, 1,838 variants, **0 barcodes**. Trade price set on only 102. **141 products ever sold, 90 ever purchased.** Cost is stored twice: on the product and again in 6,749 supplier-product rows. Together these two lists are about **85% of the whole workspace's size**.

**What it means:** the catalogue is mostly a supplier price list used for look-ups, not the range you sell. Downloading and searching all of it on every device is the main reason the workspace is 7 MB.

**Recommendations**
1. **Split "our range" from "supplier catalogue" (L, Phase 3/4):** keep the products you sell or use on every device; search the supplier catalogue on the server only when needed, then bring a product into your range with one click. The workspace shrinks several-fold, so loads are faster, especially on iPads.
2. **One place for cost (M):** supplier price rows become the only cost source; the product shows its preferred supplier's cost. This ends cost drift between the two copies.
3. **Price rules instead of manual trade prices (M):** for example "trade = RRP less X% by category", with exceptions per product. Only 102 products have a trade price today.
4. **Barcodes (later):** only worthwhile if you start holding stock.

## Customers

**Data:** 19 customers, all active, all with email, all with a Xero contact reference. 17 retail, 2 trade. 8 have placed orders.

**What it means:** clean and small. No process problem.

**Recommendations**
1. **Customer history panel (S):** orders, jobs, quotes, audits and payments in one timeline. The per-record history from Phase 3 makes this cheap.
2. **Keep the Xero link as the master** for billing details once Xero is connected (Phase 6).

## Suppliers

**Data:** 17 suppliers with lead times set; 10 have an email; 13 used on POs. **No supplier IDs**: products and POs refer to the supplier by name, and "Certikin" and "Certikin International" both exist.

**Recommendations**
1. **Stable supplier IDs (S):** renaming a supplier would otherwise break its links. This is data-safe because the continuity check proves nothing is lost.
2. **Merge the duplicate (S, owner confirms):** Certikin and Certikin International.
3. **Supplier ordering email (S):** POs go to `ordersEmail`, which is missing for 7 suppliers.

## Jobs and projects

**Data:** 2 jobs, both Approved, invoice stage "Not reviewed". One job has **24 labour days from 5 subcontractors** and 2 correspondence notes; neither job uses phases, documents, variations or the material plan.

**What it means:** the project system is powerful but heavy for how it's used. Subcontractor day-rate tracking is the part that's really used.

**Recommendations**
1. **Start a job from the accepted quote (M, Phase 5):** customer, scope, price and stages filled in automatically; no blank form.
2. **"Log a labour day" (S):** one tap on a phone for date, person and rate; it builds the labour cost on the job automatically.
3. **Simple job view first (S–M, Phase 4):** status, money in versus cost to date, next action; the advanced project tools one click away.
4. **Assigned engineers (done in v1.50):** this also makes "My jobs" possible for engineers.

## Quotes

**Data:** 2 quotes, both draft; no templates; Quotient not connected.

**Recommendation:** before Phase 5 (Quote Studio replaces Quotient), confirm how many quotes you send a month and what's painful in Quotient today. If quotes are few, Phase 5 can be smaller and come after Phase 6 (Xero), which helps Accounts every day.

## Pool audits

**Data:** 4 audits, **all still draft**, about 18 answers each. Offline iPad support was built in October.

**What it means:** audits are started but never finished, or finishing isn't recorded.

**Recommendations**
1. **A clear "Finish and send report" step (S–M):** checks required answers, creates the PDF, emails the customer and marks it complete.
2. **Ask the engineers (owner):** why audits stay draft. It could be a missing step, slow signal on site, or the report being sent another way.

## Notifications

**Data:** 383 notifications, **none archived**. 276 are "Internal note" and 49 "In App"; 45 "Needs review" (these were the duplicate stock reminders, fixed in v1.48). The most common are "custom sales line added" (70), status changed (43) and line added (39).

**What it means:** most notifications are a log of every edit, not something anyone needs to act on. The ones that matter get lost, and the list grows with every change.

**Recommendations**
1. **Two different things (M):** an **activity timeline** on each record (from the per-record history, automatic) and **notifications that need someone** (approvals, reviews, deliveries due, overdue invoices), only those.
2. **Auto-archive informational notices after 7 days (S).**
3. **Tidy up the 45 duplicate stock reminders** already in the data (S, owner approves).

## Audit logs

**Data:** two logs, `auditLog` (130 entries) and `auditEvents` (28), plus the new per-record history since 20 Nov.

**Recommendation (M, Phase 3.5/4):** the per-record history becomes the single record of who changed what. It's complete (it catches every save path) and doesn't grow the workspace. The old logs stay as a read-only archive.

## Integrations

**Data:** Xero, Quotient, WooCommerce and the shipping carrier hub: **none connected**.

**Recommendation:** **Xero first** (Phase 6). It removes double entry for Accounts (invoices, payments, supplier bills), drives the "Invoiced" and "Paid" statuses automatically, and gives real profit figures. WooCommerce and shipping only if web sales or courier volume justify them.

## Unused modules

**Data:** empty sections: tools (assets, assignments, history), sales subscriptions, sales credits, automation rules, stock takes, goods notes, allocations, restock rules, quote templates, and the "sales" list.

**Recommendation (S):** hide unused modules from the menus by default, with a switch per module in Settings, keeping all data. This directly addresses the "too much information for fresh eyes" feedback on the redesign.

---

## Suggested order (fits the existing phases)

1. **Now, quick wins (S):** hide unused modules; rename the pricing note; tidy the duplicate reminders; supplier IDs and the duplicate merge; auto-archive informational notices.
2. **Phase 4 (redesign) with these built in:** quick-pick items; fewer statuses; the simple job view; customer timeline; the notifications/timeline split.
3. **Phase 6 (Xero) before Phase 5 (quotes)**, unless quote volume says otherwise: the invoicing hand-off and automatic PO and payment status.
4. **Products split (L):** our range versus supplier catalogue, alongside Phase 3.5c, because it is also the biggest remaining speed gain.

Each item follows the continuity promise: nothing is deleted; hidden modules keep their data; merges are confirmed by the owner and proven with the continuity check.
