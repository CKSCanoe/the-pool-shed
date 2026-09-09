# Project management and commercial control for Pool Shed

A useful project system for pool installation and refurbishment must connect physical delivery with the commercial agreement. A generic task board cannot explain whether a purchase order has consumed the remaining margin, and an accounting balance alone cannot show what still needs buying or installing. The strongest design combines a controlled contract value, a forward-looking cost forecast, operational item tracking and evidence-based billing stages.

The comparison below covers six relevant products using their published documentation. It is a focused design comparison, not an exhaustive market survey or independent certification of their performance. Vendor statements establish documented capabilities, not proof that a particular feature will save a specific amount of time or money. No subscription purchase or migration to a third-party project application is proposed.

## Findings from established products

| Product | Documented approach | Design implication for Pool Shed |
| --- | --- | --- |
| Procore | Separates commitments from spending and describes forecasting the remaining cost of a project. | Include outstanding POs and remaining work before reporting projected profit. |
| Simpro | Connects project cost tracking with progress billing against defined stages. | Link completion evidence and an agreed billing amount to each stage. |
| Buildertrend | Can draw invoice content from estimates, approved choices, changes and costs; distinguishes fixed-price and open-book workflows. | Reuse approved source data and cap fixed-price billing against the contract. |
| WorkflowMax | Compares quote estimates with actual time and costs and supports a phase-based quote structure. | Preserve the accepted quote and show cost changes against it over the job’s life. |
| Xero Projects | Links time, expenses, project profitability and deposit/progress invoicing within accounting. | Make financial status visible alongside the operational project without inventing a competing ledger. |
| monday.com | Separates high-level oversight from detailed work and documents date/dependency automations. | Provide a short project overview with deeper task detail and clear completion dependencies. |

Sources: Procore[^1], Simpro[^2], Buildertrend[^3], WorkflowMax[^4], Xero[^5], monday.com[^6].

### Commercial forecasting

Procore’s treatment of commitments is particularly relevant to materials-heavy projects. A business may be committed to supplier spending before the supplier invoice arrives. Forecasting only from recorded invoices therefore gives an incomplete picture of exposure. Its published guidance distinguishes costs already agreed from the forecast work still needed to finish.[^1]

The implementation recommendation is to make forecast final cost the main warning measure. The app should still identify which figures are recorded expenses and which are estimates. Calling every received item an accounting expense would obscure timing and valuation differences. A visible breakdown makes the number reviewable rather than presenting a seemingly precise total with hidden assumptions.

### Stages and approval evidence

Simpro’s progress-billing guidance connects defined stages with completion information and highlights the need for approved changes to flow into the job’s commercial structure.[^2] Buildertrend’s documentation describes both flat and itemised invoices, schedule-linked dates and reuse of information from estimates, changes and other financial records.[^3]

For Pool Shed, a stage should have a fixed net amount, an agreed billing condition, a planned date and optional preceding stage. The date is a reminder, not an automatic entitlement to payment. Completion of a task is useful evidence, but a manager still needs to confirm the agreed customer terms. The system should prepare a draft for review rather than deciding that an invoice is contractually valid.

### Quote-to-cost comparison

WorkflowMax describes comparing actual job time and costs against the quoted position. Its job financial summary guidance also explains that final profit depends on complete invoicing and complete cost/time records.[^4][^7] This is an important constraint: a system cannot accurately forecast expenses that no one has entered or estimated.

Pool Shed should therefore identify incomplete cost records and require periodic confirmation of the remaining-cost forecast. A green margin should not mean “guaranteed profit”. It means the current recorded assumptions support the target. The quoted contract amount should be retained once accepted, with later changes shown separately rather than silently overwriting the original agreement.

### Financial visibility and task simplicity

Xero Projects describes assigning costs and time to a project and supporting deposits and progress payments.[^5] Its value for this design is the connection between project work and accounting records. The Pool Shed integration should continue to use Xero as the authority for posted invoice and payment status, while retaining its own stock and job workflow.

monday.com’s documented high-level and low-level board approach separates portfolio oversight from detailed work. Its automation examples include overdue-item notification and adjustment of dates following dependencies.[^6] The transferable idea is progressive disclosure: show the commercial health and next action first, with tasks and supporting records one level deeper. A dense screen combining every field would work against that goal.

## Recommended operating model

### One job identity

The existing job record should remain the identity for a project. Creating a new, unrelated project register would force staff to reconcile job codes, customer links and order references. Multiple sales orders can belong to that job, but each order should have one project owner. Explicit line-level ownership should take precedence over a purchase-order header when a PO contains work for different projects.

A project’s agreed selling value comes from the accepted quote plus approved changes. Linked sales orders describe what will be supplied; their selling totals must not be added to the quote again. This prevents a £20,000 contract with two £10,000 fulfilment orders from appearing to have £40,000 of revenue.

### Separate recorded, committed and remaining cost

Use the following management forecast:

```
Agreed revenue = accepted quote + approved selling changes
Forecast final cost = recorded expenses + received-goods estimates
                    + outstanding commitments + remaining forecast
                    + tool/hire cost to date
Forecast profit = agreed revenue − forecast final cost
Forecast margin = forecast profit ÷ agreed revenue × 100
```

This is a management calculation, not a statutory profit-and-loss statement. It must not be confused with cash collected, VAT-inclusive invoice totals or inventory valuation. The implementation uses GBP and net amounts; another currency or a specialised tax treatment needs an explicit extension.

A linked supplier bill should replace the portion of a PO estimate it covers. For example, a £1,000 PO with £400 of received goods consists of £400 received estimate and £600 outstanding commitment. If a bill of £450 replaces that £400 estimate, the forecast becomes £1,050: £450 recorded and £600 outstanding. Adding the bill to the entire £1,000 PO would incorrectly produce £1,450.

Stock drawn from existing inventory needs a similar matching mechanism. A recorded material cost can replace an uncovered sales-order material estimate. Separate expenses must remain separate. Physical transfers between the receiving bay, warehouse and job bin should not add another commercial cost merely because the location changed.

### Protect the 30% target

The selected default target is 30% margin, adjustable per project. Margin is profit divided by selling price. It is not markup, which compares profit with cost. On a £10,000 contract, a 30% margin target permits £7,000 forecast cost.

The overview should show headroom at target as well as forecast profit:

```
Headroom at target = agreed revenue × (1 − target margin) − forecast cost
```

A project with £10,000 revenue and £6,800 forecast cost has £3,200 forecast profit, 32% margin and £200 of headroom before missing the 30% target. At £7,500 cost it remains profitable but has missed the target. At £9,600 cost it is close to break-even. These are different management situations and deserve different messages.

Use an amber warning below the target and a stronger warning at a configurable near-loss margin, initially 5%. Show a direct loss warning when forecast cost exceeds revenue. Also identify zero/missing material costs, an unconfirmed or stale remaining-cost forecast and undecided extras. These checks are more useful than a single red/green indicator.

### Approve extras before counting revenue

Proposed extras should show their possible selling value, but should not increase agreed revenue. Approval should record a customer reference and date. Rejected extras remain in history. Negative approved variations can represent agreed scope reductions; they must not reduce the contract below already planned or reserved billing without a commercial review.

The extra’s additional forecast cost should exclude work already represented in linked orders and POs. Recording actual costs against the extra can replace that remaining estimate. This does require disciplined categorisation. An unlinked invoice cannot safely be inferred to be “the same cost” merely because it has a similar description or amount.

### Use a controlled invoice plan

A deposit should be a stage within the contract total. If a £10,000 project has a £2,000 deposit, the remaining stages should total £8,000, not another £10,000. Fixed net stage amounts are easier to reconcile than repeatedly recalculating percentages after changes.

Before a draft is queued, check the accepted quote, agreed stage condition, completion status, task dependencies and contract limit. Use a permanent source reference for each stage. The server should refuse a second full-order invoice for an order already assigned to project phase billing. Repeated submissions of the same stage should return the same queued document.

The draft should then enter the existing Xero integration. Xero approval and payment updates come back through that connection. Paying an invoice must not mark materials received or shipped. Conversely, shipping materials should not silently mark an invoice paid.

## User experience

A short list of projects should show the contract, expected profit, margin and number of checks needing review. Opening a project should lead with four figures: contract, forecast cost, forecast profit and headroom. Seven focused sections provide the detail: Overview, Orders & items, Costs, Extras, Tasks & billing, Documents and Settings.

Forms should use explicit labels such as “net cost”, “estimate replaced” and “agreed billing condition”. Monetary fields should say whether VAT is included. The app should give a reason when a stage cannot be billed, rather than merely disabling a button. Completed or corrected records should retain an audit trail.

Document storage should be private and should show whether a file is shared or only on the current device. Uploading a supplier invoice should not automatically create a cost: the amount and matching source must be reviewed. A future extraction feature could suggest fields, but human confirmation would still be necessary to avoid duplicate postings or incorrect VAT treatment.

## Automation and AI boundaries

The first layer should be deterministic: target-margin warnings, near-loss warnings, overdue tasks, stale forecasts and stage-readiness checks. These conditions can be tested repeatedly against known examples. In-app triggers work without an external AI provider.

An optional AI review can explain the forecast and suggest which existing stage warrants attention. It should receive only the necessary totals and stage descriptions, distinguish a reminder from a billing entitlement, and never alter records or send invoices. The implemented optional endpoint uses the Responses API with explicit non-storage of the response and no action tools.[^8] This setting is not a claim of universal zero data retention; provider account policies still apply.

Background email reminders, customer notifications and unattended billing require separate delivery infrastructure and explicit configuration. They should not be presented as active simply because a local notification or rule exists.

## Implementation status and remaining scope

The accompanying build implements the shared job/project identity, linked orders and item progress, the 30% target, cost and forecast separation, matched supplier/material costs, labour entries, extras approval, task dependencies, stage drafts, private document upload support, audit guards and optional AI review connection. Database migrations and live provider setup are required before server features operate.

It does not replicate every capability of the compared products. Formal retention accounting, complex progress valuations, cost-plus contracts, resource scheduling, subcontractor certification, automated OCR, complete Xero expense import and a normalised transaction-by-transaction warehouse database remain separate extensions. Real concurrent-user testing, restored backups and live Xero demo acceptance are still required before claiming production reliability.

The practical objective is a coherent commercial workflow with verifiable numbers and a low training burden. No documentation comparison can establish that a new build is “the best” or flawless. That judgement needs real jobs, measured performance and successful recovery from failures as well as a polished interface.

## Sources

[^1]: Procore, [The role of committed costs in construction accounting](https://www.procore.com/en-au/library/committed-costs), May 20, 2026. Describes purchase/subcontract commitments and forecasting exposure before invoices arrive.
[^2]: Simpro, [HVAC Schedule of Values & Progress Billing](https://www.simprogroup.com/blog/hvac-schedule-of-values-progress-billing), accessed September 8, 2026. Used for stage-based progress-billing and completion-data concepts, not adoption or savings claims.
[^3]: Buildertrend, [Invoice Overview](https://buildertrend.com/help-article/invoice-overview/), accessed September 8, 2026. Documents invoice sources, fixed/open-book distinctions, schedule-linked dates and payment information.
[^4]: WorkflowMax, [Job Estimating and Quoting Software](https://workflowmax.com/job-management-software/quoting-and-estimating), accessed September 8, 2026. Describes quote-to-actual comparison and phase structure.
[^5]: Xero UK, [Project Tracking Software](https://www.xero.com/uk/accounting-software/track-projects/), accessed September 8, 2026. Describes project time/expense tracking, profitability and deposit/progress invoices.
[^6]: monday.com Support, [What are High-Level and Low-Level boards?](https://support.monday.com/hc/en-us/articles/115005317229-What-are-High-Level-and-Low-Level-boards), accessed September 8, 2026. Used for overview/detail separation and documented dependency/overdue automation examples.
[^7]: WorkflowMax Support, [About the job financial summary report](https://support.workflowmax.com/hc/en-us/articles/24773446025881-About-the-job-financial-summary-report), updated July 15, 2026. Explains quoted/actual measures and completeness requirements for profit reporting.
[^8]: OpenAI, [Create a model response](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses/methods/create), accessed September 8, 2026. Used for the optional advisory endpoint’s input, instructions, output and storage settings.
