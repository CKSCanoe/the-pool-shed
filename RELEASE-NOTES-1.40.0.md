# Pool Shed 1.40.0: Quote acceptance and signatures

## Customer flow
- Review the proposal and current choices on the first page.
- Continue to acceptance opens a dedicated signing screen at #acceptance.
- Review the quote total, payment due after acceptance, version and terms reference.
- Confirm contact and property details, then type a signature or draw with mouse, finger or pen.
- Clear and redraw is available. Explicit agreement to the displayed terms reference is required.
- Back to proposal retains draft details and signature within the open page. Changing an option clears the signature and consent.
- Reloading clears unsigned drafts. Accepted proposals display a recorded confirmation and prevent further option changes.

## Storage and deployment
Deploy the full project, including api/quote.js, server/quote.js and the public assets together. The API now requires a signature and explicit terms consent. Customers with an already-open old page should refresh before accepting.
Signatures are stored in ps_quote_acceptances.evidence.signature via the existing atomic acceptance procedure. Typed signatures contain text; drawn signatures contain bounded normalised strokes. No external signing service is used.
No new Supabase migration or configuration changes are required relative to v1.39.0. Existing quote acceptance tables and procedures must already be installed.
The acceptance calculation also preserves an explicit zero VAT rate.

## Verification
- Quote regression tests, signature validation, signing-flow handlers and API evidence tests.
- Production build and runtime validation.
- Complete ZIP extraction and per-file SHA-256 comparison.
The API tests stub database transport; no live customer acceptance or database write was performed. Browser visual and physical touchscreen testing were not completed in this environment.

This package has not been deployed to the live app.
