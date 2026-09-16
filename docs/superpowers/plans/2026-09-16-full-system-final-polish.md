# Pool Shed Full System Final Polish Implementation Plan

**Goal:** Produce v1.21.0 as the coherent full Pool Shed system release.

**Architecture:** Preserve every existing module authority. Apply only release-wide terminology, wiring, diagnostics, documentation and verification changes, then package the exact verified tree.

**Tech Stack:** Static JavaScript application, generated CSS, service worker, Node validation scripts.

**Spec:** `docs/superpowers/specs/2026-09-16-full-system-final-polish-design.md`

## Global Constraints
- Xero stays Ready to Connect and live operations remain locked.
- Existing business engines and data ownership are not duplicated.
- Main navigation uses the approved final names.
- One release/cache version is used across runtime assets.
- Full-system acceptance is evidence-based.

### Task 1: Final release contract
- [ ] Add failing v1.21 final-release test for version, cache, navigation and Xero lock.
- [ ] Run it and confirm failure on v1.20.1.
- [ ] Update release/version/navigation wiring.
- [ ] Run it and confirm pass.

### Task 2: Final usability terminology polish
- [ ] Add test for approved main navigation and suggested operational flow.
- [ ] Update legacy visible labels while preserving internal IDs.
- [ ] Verify project/engineer route compatibility.

### Task 3: Full-system acceptance aggregation
- [ ] Add a final acceptance script that verifies critical module authorities, permissions, Xero-ready lock, runtime assets and current release identity.
- [ ] Run protected regression suites.

### Task 4: Production package
- [ ] Build production assets.
- [ ] Run final release asset/runtime checks.
- [ ] Write final system guide and release audit.
- [ ] Create and integrity-test the final ZIP.
