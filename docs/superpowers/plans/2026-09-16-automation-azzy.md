# Automation Command + Smart Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build v1.18.0 Automation Command and a configurable Pool Shed-only smart assistant with global search, training and governed workflow automation.

**Architecture:** Add independent assistant retrieval/answer and automation engines, then a workspace UI that replaces the legacy Settings-only rule builder. Keep Pool Shed data canonical through `__POOL_SHED_GET_DATA__`, persist only profile/knowledge/rule/audit state, and route actions into existing modules rather than duplicating operational records.

**Tech Stack:** Browser JavaScript, existing Pool Shed workspace state, HTML/CSS authority bundle, Node-based regression tests.

**Spec:** `docs/superpowers/specs/2026-09-16-automation-azzy-design.md`

## Global Constraints
- Assistant factual answers use only authorised Pool Shed data and approved Pool Shed Knowledge.
- No web/external lookup in assistant behaviour.
- No silent substitutions or financial/commercial policy actions.
- Transparent PNG avatar support.
- One authoritative `app.css` runtime stylesheet.
- Preserve all v1.17.0 protected modules.

---

### Task 1: Smart assistant retrieval and answer contract
**Files:** Create `public/assistant-engine.js`; Test `scripts/test-assistant-engine-v118.mjs`.
**Produces:** `PoolShedAssistantEngine.search()`, `answer()`, `profile()`, `saveProfile()`, `addAlias()`, `knowledge()`.
- [ ] Write failing tests for exact/fuzzy record retrieval, permissions, provenance, detailed how-to answers and explicit knowledge gaps.
- [ ] Run test and verify RED because engine is missing.
- [ ] Implement minimal grounded retrieval/answer engine.
- [ ] Run test and verify GREEN.

### Task 2: Automation engine
**Files:** Create `public/automation-command-engine.js`; Test `scripts/test-automation-command-engine-v118.mjs`.
**Produces:** workflow templates, validation, simulation, authority levels, suggested automations and audited rule persistence.
- [ ] Write failing tests for node validation, approval gates, simulation and safe activation.
- [ ] Verify RED.
- [ ] Implement engine.
- [ ] Verify GREEN.

### Task 3: Automation + floating assistant workspace
**Files:** Create `public/automation-command-workspace.js`, `public/assets/css/system/52-automation-command.css`; modify `public/assets/css/app.css` source build if required; Test workspace/actions/visual files.
**Produces:** Automation pages, Flow Builder, floating Ask/Find/Guide/Training assistant and source-linked answers.
- [ ] Write failing workspace/action/visual tests.
- [ ] Verify RED.
- [ ] Implement approved UI and interaction handlers.
- [ ] Verify GREEN.

### Task 4: Settings assistant profile and knowledge
**Files:** Modify legacy settings hooks and automation workspace; Test `scripts/test-assistant-settings-v118.mjs`.
**Produces:** Assistant & Automation Settings, editable name, PNG avatar data URL with alpha preserved, knowledge and aliases.
- [ ] Write failing settings test.
- [ ] Verify RED.
- [ ] Implement settings panel/integration.
- [ ] Verify GREEN.

### Task 5: Navigation, version and release wiring
**Files:** Modify `public/index.html`, `public/service-worker.js`, legacy tab/render wiring, `package.json`, build outputs; Test `scripts/test-automation-release-v118.mjs`.
**Produces:** first-class Automation nav and v1.18.0 asset/cache wiring.
- [ ] Write failing release wiring test.
- [ ] Verify RED.
- [ ] Wire Automation and version assets.
- [ ] Verify GREEN.

### Task 6: Regression and packaging
**Files:** release audit and ZIP only after verification.
- [ ] Run v1.18 tests.
- [ ] Run protected module regressions.
- [ ] Run full validator to known PGlite boundary and remaining non-DB tests separately if necessary.
- [ ] Run production build and runtime asset parse validation.
- [ ] Attempt browser smoke and report dependency limitations accurately.
- [ ] Create audit, ZIP, integrity test and SHA-256.
