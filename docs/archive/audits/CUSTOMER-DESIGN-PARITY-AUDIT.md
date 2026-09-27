# Customer Design Parity Audit — v1.4.0

## Root cause

The v1.3.x Customer implementation preserved the selected concept's data model and several visual motifs, but it did not preserve the Design Lab's actual page composition. The production implementation substituted a conventional list-then-detail flow and production helper panels for the approved persistent master-detail workspace. That architectural substitution changed the entire visual hierarchy before CSS was even considered.

## High-impact mismatches found

1. **Master-detail structure lost**
   - Design Lab: persistent 290px customer directory beside the selected account.
   - v1.3.x: separate customer directory screen; opening a customer replaced it with a full-width profile.

2. **Customer hero changed**
   - Design Lab: white account card, compact avatar, relationship metadata, status pills, actions, tabs.
   - v1.3.x: dark navy account header plus a separate action bar.

3. **Overview composition reduced**
   - Design Lab: KPI row, highlighted Account Essentials, Account Health, Recent Activity, People & Locations, supporting control/reference cards, smart-default note.
   - v1.3.x: KPI row plus Account Essentials and Account Health only.

4. **Tab content used generic production panels**
   - Design Lab: dedicated depth-card layouts with compact operational rows.
   - v1.3.x: generic `panel()` output, producing visibly different spacing, headers and hierarchy.

5. **Quick Edit proportions changed**
   - Design Lab: approximately 560px drawer, two-column form rhythm, compact tab strip.
   - v1.3.x: approximately 760px drawer and three-column forms, making it visually much heavier.

6. **CSS was recreated rather than faithfully translated**
   - v1.3.x introduced new CRM-specific visual language instead of mapping the approved Design Lab geometry into production-scoped CSS.
   - This preserved palette ideas but not the approved composition.

## v1.4.0 correction

- Restored persistent master-detail Customers workspace.
- Restored white account hero and integrated tab strip.
- Restored Design Lab KPI rhythm and Account Essentials hierarchy.
- Restored supporting overview cards and smart-default guidance.
- Replaced generic tab panels with dedicated customer depth cards.
- Returned Quick Edit to the compact 560px/two-column direction.
- Preserved production customer master state, order links, job links, address syncing, validation and save protections.
- Kept all CRM CSS scoped so Dashboard and unrelated modules are not restyled.
- Retained production readability hardening by using the app's minimum readable text size where the prototype used smaller display-only text.

## Verification

Added `scripts/test-customer-design-parity.mjs` to prevent recurrence of the structural mismatch. Existing Customer Workspace, customer save-flow, Sales Order customer picker, Project, fulfilment, receiving, accounting, CSS and Dashboard regressions were also rerun.
