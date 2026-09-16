# Pool Shed v1.24.1 — Executive Premium Contrast Authority

## Purpose
Correct the v1.24.0 system-wide contrast regression where legacy dark-mode compatibility rules and dark command strips could pair dark structural backgrounds with page-text or status-text tokens.

## Root causes corrected
- Removed legacy dark-mode repainting of ordinary panels, cards, inputs, tables and headings.
- Removed the later workspace-core dark override that repeated the same conflict with `!important`.
- Restored legacy `--color-dark-*` names as aliases into the semantic design system so older modules cannot drop declarations.
- Corrected Projects, Product Hub, Inventory and Dashboard dark command strips to use shell-safe foreground roles.
- Audited every maintained CSS rule that uses the shell/navy structural surface and converted unsafe direct foreground roles to `--color-shell-text`.
- Preserved the approved Executive Premium Steel Blue palette and Project Details terminology.

## New regression gates
- `scripts/test-contrast-cascade-v1241.mjs`
- `scripts/test-shell-surface-contrast-v1241.mjs`

These tests are included in the main validation chain.
