# Pool Shed v1.33.0 - Process Authority Audit

## Implemented in this release

### Critical quote lifecycle
- Atomic acceptance before operational conversion
- One conversion job per accepted publication
- Idempotent conversion retry
- Superseded publication authority
- Decline state
- Expiry authority
- Customer permission enforcement
- Published versus Sent separated
- Live-version-only email delivery

### Staff process
- Simplified quote creation
- Advanced workflow disclosure instead of default complexity
- Working template actions
- Undo / redo
- Next Action in quote header
- Commercially meaningful quote pipeline
- Failed-handover recovery state

### Customer process
- View + Accept really means read-only plus acceptance
- Quick Quote wording corrected
- Customer decline response
- Permanent acceptance confirmation wording

### Wider operations
- Quote exceptions feed My Work / Action Authority
- Existing Sales Order, Project, stock, PO and finance authorities remain the mutation owners

## Deliberately not rewritten in v1.33.0

The full application still uses the existing workspace snapshot architecture for many operational records. Replacing every Product, Sales Order, PO, stock and Project write with normalised transactional Supabase records would be a major platform migration. It is not bundled into this quote-process release because doing it at the same time would materially increase regression and data-migration risk.

Recommended platform sequence after v1.33 production stabilises:

1. normalise one operational domain at a time, beginning with Sales Orders / allocations;
2. move Purchasing and goods-in to record-level transactions;
3. move Project commercial events to append-only transactional records;
4. lazy-load large workspaces rather than eagerly loading every module;
5. introduce a shared proposal renderer used by both staff canvas and customer portal for true single-render WYSIWYG parity;
6. add controlled PDF archive generation and first-class variations.

## Release decision

v1.33.0 is intentionally an authority/process release rather than a destructive platform rewrite. It fixes the customer-decision and handover risks first, improves daily usability, and creates a safer foundation for the larger data-architecture migration later.
