# Pool Shed — verified local release

## What this release adds
The dashboard now offers an optional administrator AI daily briefing, alongside the automatic Today’s review. It summarises saved counts of outstanding orders, missing details, overdue purchasing deliveries and project risks. It is requested by the user, not a background monitor. It cannot modify data. Project margin wording and billing guidance have been clarified.

Includes all previous receiving, sales, customer, inventory, project, accounting and visual improvements.

## Verification completed
- 25 validation suites passed. Full output: FINAL-VERIFICATION-RESULTS.txt.
- All 50 local HTML asset references exist; every public, API and server JavaScript file parses.
- Browser smoke visited 76 sections with no reported page errors or local asset failures; 390px viewport stayed within its width.
- Browser exercised receipt, Receiving Bay transfer, linked allocation, partial shipment, repeat-shipment rejection, quarantine rejection, tools/kit returns, sales saving, protected customer reassignment, catalogue mouse-wheel scrolling, labour-only order controls, project expense/margin changes, document download and staged invoice queueing.
- Database checks use PGlite with migrations. AI and accounting provider calls use mocks, including permission and failure paths.
- ZIP has package.json and vercel.json at its root and passes archive integrity checks.

## Live verification still required
A live app URL and configured test accounts were not available in this pass. Production hosting, Supabase authentication/storage/RLS under real accounts, Xero OAuth and webhook/payment round trips, real AI responses, and external email/carrier delivery are not verified. Automated tests are not exhaustive proof that every possible workflow or dataset is correct. Company statutory profit-and-loss accounting is not supplied by the quarterly order estimate report.

## Deploy
Extract the ZIP and upload its contents to the repository root. package.json must appear at the top level. Retain the existing deployment environment variables. Use the included Vercel configuration: npm install, npm run build, output dist. Do not upload only dist: server APIs and database migrations are also included.

## Optional AI setup
Uses the existing project-review API and PROJECT_AI_MODEL, OPENAI_API_KEY, APP_ORIGIN, SUPABASE_URL and server-side SUPABASE_SERVICE_ROLE_KEY. Apply the existing project AI rate-limit migration and workspace-membership setup. Dashboard review requires an admin membership on the server, a signed-in client and successful shared snapshot sync. Project review retains manager access. Never put secret keys in public config.js.
The dashboard sends aggregate counts, not customer contact details or invoice files. The provider request sets store:false and has no action tools. This does not claim zero retention under every provider policy. Reference: https://developers.openai.com/api/reference/cli/resources/responses/methods/create

## Audit trail
This file describes the latest state. Earlier release audits are historical. The latest source changes are dashboard-review-engine.js, api/project-review.js, business-review.js, project-workspace.js, index.html, service-worker.js, package.json, new dashboard/asset tests, expanded browser smoke and rebuilt dist.
