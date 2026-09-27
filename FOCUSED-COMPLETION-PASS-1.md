# Focused completion pass 1 · project quotes, extras and finance

Base: Pool Shed v1.45.1 Workspace Audit. This is a completion candidate, not a deployed release.

## Completed in this pass

- A Project can own the accepted original contract plus multiple linked Quote Studio extras or credits.
- The original accepted quote value remains immutable.
- Linked quotes remain Pending until customer acceptance. Declined/rejected quotes remain excluded from agreed revenue.
- Customer acceptance creates one approved project extra/credit, retains the accepted quote/version/value evidence, records dated correspondence, and reuses the existing Project.
- Sending/publishing/emailing a quote is explicitly separate from customer approval.
- Accepted linked quotes create a Sales Order tied to the approved extra/credit. Selling prices and costs come from the frozen accepted quote snapshot.
- Duplicate acceptance/conversion is idempotent and cannot duplicate project revenue or Sales Orders.
- Conflicting re-acceptance of an already accepted extra version/value is rejected rather than rewriting approval evidence.
- Project finance displays Original contract value, Approved extras, Total selling value, Actual costs, Committed costs, Remaining forecast costs, Projected profit and Projected margin.
- Missing/zero material costs continue to raise a project warning; open-ended daily hire continues to raise a forecast warning.
- Linked credits are supported for later contractual reductions without editing the accepted original quote.
- Database migration `database/011-project-extra-quotes.sql` extends the project history guard to retain accepted quote linkage/evidence and require accepted Quote Studio evidence for newly approved linked extras.

## Performance

The project-summary hot path now indexes costs, Purchase Orders and Sales Orders instead of repeatedly scanning the complete project ledger for every linked extra.

Focused synthetic regression: 800 connected Sales Orders + 800 POs + 800 approved extras + 800 actual costs averaged about 19–20 ms per project summary in this execution environment. Before the final PO/Sales Order indexing change, the same synthetic case was about 204 ms. The build includes a 150 ms regression budget for this fixture.

## Verification completed

- `npm run build` passed and regenerated `dist/`.
- `npm run test:quotes` passed.
- Project quote/extra workflow regression passed: pending/rejected isolation, immutable original contract, accepted revenue handover, frozen SO pricing/costs, approval evidence, idempotency and server parity.
- Project financial performance regression passed.
- Project control, project workspace, labour/profit, project engine, project email and project AI mocked checks passed.
- `npm run audit` passed; HTML shell remains below its size budget and application code remains cacheable.
- Migration wiring/static history-guard regression passed.

## Verification not claimed yet

- The new migration 011 has not been executed against production.
- The local PGlite database test could not be rerun in this cleaned working copy because dev dependencies are not installed and package installation was unavailable in the execution environment. The v1.45.1 baseline database suite was previously verified; migration 011 therefore still needs execution in the normal dependency-installed test/CI environment before release promotion.
- Signed-in desktop/tablet/mobile visual checks are still outstanding.
- No live email, accounting-provider transaction or production deployment was performed.
- Remaining completion-order work (cost integrity across purchasing/labour/hire, invoicing, margin protection, workspace-wide visual consistency, complete end-to-end project verification, historical test reconciliation and release deployment) is not marked complete by this pass.

## Deployment requirement

For an existing environment already migrated through 010, apply `database/011-project-extra-quotes.sql` as database owner before deploying the matching application build. Do not initialise, reset or replace existing production data.
