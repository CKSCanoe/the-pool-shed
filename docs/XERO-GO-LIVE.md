# Linking Pool Shed's ledger to Xero — go-live checklist

**Status (20 Nov 2026): ready but NOT linked, by the owner's decision.** Nothing is sent to Xero. Linking needs three separate locks opened on purpose; none of them is open:

| Lock | Where | Now |
|---|---|---|
| 1. Xero live mode on the server | Vercel environment: `XERO_INTEGRATION_MODE=live` plus all Xero keys (`XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_TOKEN_KEY`, `XERO_WEBHOOK_KEY`, `CRON_SECRET`) | **Locked** |
| 2. An authorised Xero connection | Pool Shed → Accounting → Xero Sync → Connect (an Admin signs in to Xero) | **Not connected** |
| 3. The ledger send switch | database: `ps_feature_flags` row `xero_push` | **Off** |

## What is already built and tested (staging)

- Every posted supplier bill and supplier payment is turned into exactly what Xero expects (type, contact, dates, invoice number, `PS-` reference, account code, VAT type) and held in an outbox with a plain list of anything to fix. See Accounting → Xero Sync → "Pool Shed ledger → Xero" ("What Xero receives").
- Bills are sent before payments; a payment waits until every bill it settles is in Xero.
- A retry never creates a duplicate (each bill is looked up by its `PS-` reference first, and every request has an idempotency key). Two Xero bills with the same reference stop the sender and ask a person.
- Opening balances (unpaid supplier bills in Xero on the go-live date) can be imported from Xero's Aged Payables export; they are recorded in Pool Shed, payable in payment runs, and **never sent back to Xero**.
- Supplier invoice and receipt files are stored privately (Admin, Management, Accounts only).

## Before linking (in this order)

1. **Account codes:** Accounting → Xero Sync → Xero account codes. Check each against Xero (Accounting → Chart of accounts) and press Confirm. Suggested codes are Xero's UK defaults.
2. **VAT types:** confirm 20% → INPUT2, 5% → RRINPUT, no VAT → NONE match your Xero tax rates (your accountant can confirm).
3. **Supplier records:** each supplier's payment basis (Pro Forma or Credit) and terms are right (e.g. Travis Perkins is currently set as Pro Forma).
4. **Choose the go-live date** (ideally the first day of a month) and stop entering supplier bills directly in Xero from that date.
5. **Opening balances:** export Xero → Reports → Aged Payables Detail as at the day before go-live, and load it in Xero Sync → Opening balances. Check the total against Xero.
6. **Apply** database migrations 022–025 to live and create the `finance-media` storage bucket (025 does this), with a backup first.
7. **Open lock 1** (Vercel environment), redeploy.
8. **Open lock 2:** an Admin connects Xero; match each supplier to its Xero contact (shown in the outbox as "Match … to a Xero contact").
9. **Send one bill first:** switch on `xero_push`, let one bill go, check it in Xero (amount, VAT, account, contact). Then let the rest go.
10. **Parallel month:** compare Pool Shed's aged creditors with Xero's at month end. After a clean month, Pool Shed is where supplier bills and payments are entered.

## To switch it off again at any time

`update ps_feature_flags set enabled = false where name = 'xero_push';`. Sending stops immediately; nothing already in Xero is changed, and anything not yet sent stays in the outbox.

## Not yet included (later steps)

Sales invoices, customer payments, credit notes and stock and cost-of-sales summary journals follow the same outbox pattern when the sales side of the ledger is built (Operations O3).
