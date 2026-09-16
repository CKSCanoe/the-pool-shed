# Pool Shed v1.18.0 Automation Command + Smart Assistant Design

## Authority
Approved design: `docs/design-labs/automation-command-azzy-approved-v2.html` plus the approved refinements in the 16 September 2026 conversation.

## Goal
Create an Automation Command with a Shopify-Flow-style visual rule builder and a globally available configurable Pool Shed assistant that answers only from authorised Pool Shed records and approved Pool Shed knowledge.

## Assistant identity
- Default assistant name is `Azzy` but the name is editable in Settings.
- Admin can upload a PNG avatar; PNG alpha transparency must be preserved.
- One profile value propagates to floating chat, training, Automation Builder and notifications.
- Admin can remove/reset the avatar.

## Assistant grounding contract
- The assistant must not browse the web or use external factual knowledge for answers.
- Every factual answer must be derived from authorised Pool Shed records or approved Pool Shed Knowledge entries.
- Answers include internal source/provenance metadata.
- If evidence is incomplete, do not guess. State the missing data, explain why it matters, and provide the next in-system action.
- Permissions filter both retrieval and direct actions.

## Floating assistant
Available across the application with modes:
1. Ask
2. Find Anything
3. Guide Me
4. Training

Question intent supports How do I, Why, What should I do, Where is, What does this mean, Train me, What happened, and Find.

## Find Anything
Search authorised Customers, Suppliers, Products, Sales Orders, Projects, Purchase Orders, Goods Notes, Inventory/locations, movements, Finance records, Engineer Requests, Notes/Activity, automation and approved knowledge.
Ranking prioritises exact IDs/SKUs/barcodes/supplier SKUs before names, aliases, descriptions and related-record evidence. Fuzzy/semantic candidates are labelled as candidates, not interchangeable substitutes.

## Knowledge
Pool Shed Knowledge stores approved procedures, training articles, terminology, aliases and FAQs. Alias learning requires explicit user confirmation. The assistant may suggest an alias based on repeated searches but may not silently create it.

## Answer quality
Responses should be complete and operational, using relevant facts, steps, explanation, status and next actions. No generic fallback. Knowledge gaps are explicit and actionable.

## Automation Command
Pages: Overview, Active Automations, Suggested Automations, Automation Builder, Templates, Alerts & Escalations, Approvals, Scheduled Jobs, Azzy, Activity Log.

## Flow model
Nodes: Trigger, Schedule, Condition, Get Data, Branch, Wait, Action, Approval, Notify.
Authority levels:
- Automatic: low-risk internal actions only.
- Approval Required: customer/supplier communication, draft PO, claims, stock transfer proposals and similar controlled actions.
- Suggest Only: financial/commercial policy changes and sensitive decisions.

Every active workflow has trigger, conditions, actions, authority, audit history and simulation support. Activation requires a successful validation/simulation and cannot bypass user permissions.

## Settings
Add `Assistant & Automation` under Settings. It owns assistant name/avatar, knowledge entries, aliases, assistant answer policy, automation permissions and safe-action policy.

## Compatibility
- Start from v1.17.0 Analytics Command.
- Retain one authoritative runtime stylesheet (`assets/css/app.css`).
- Preserve Supplier, Finance, Analytics, Fulfilment, Inventory, Product Hub, Projects, Purchasing, Warehouse and Sales Order behaviour.
- Version runtime assets coherently as v1.18.0.
