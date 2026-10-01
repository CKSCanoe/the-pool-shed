# Pool Shed completion audit 1.51.0

## Scope
Supplier Option B, Sales Order / PO cross-links, critical runtime duplication, and Azzy end-to-end stability.

## Findings corrected
- Added a production build guard for the approved Supplier Option B workspace, all nine Supplier tabs, funding panels and PO/SO navigation.
- The duplicate Pro Forma PO release guard/listener implementation found during the purchasing audit has been removed.
- Confirmed no duplicate named function declarations remain in the critical Purchase, Sales, Supplier and Azzy browser workspaces.
- Retired unused azzy-live image assets; the active runtime uses azzy-jarvis assets only.
- Fixed Azzy browser recovery so a transient failed bootstrap no longer leaves an offline object that suppresses later retries.
- Added a one-time authenticated retry after HTTP 401 and automatic retry when browser connectivity returns.
- Fixed Azzy workspace loading without a Supabase server secret. Authenticated snapshot RLS now proves workspace membership instead of querying the deliberately locked ps_workspace_members table.
- Added safe intelligence degradation so malformed attention/watch data cannot take down the whole Azzy bootstrap.
- Added authenticated Azzy diagnostics and clearer failure-stage/error codes.
- Extended Azzy normalization for supplier Credit/Pro Forma details, supplier contact/address context, custom non-stock PO lines and their receipt history.
- Added build tests for authenticated-RLS workspace access, resilience/reconnection, custom PO understanding and duplicate/dead critical runtime guards.

## Deliberately retained
- Legacy Customer Orders compatibility routing is retained only to redirect old saved state/deep links into Sales Orders. It is not a second visible order workflow.
- demo-store remains because Azzy tests/development explicitly import it as the development fallback.
- project-labour.js and quote customer portal scripts are dynamically loaded / separately routed and are not dead runtime files.
- dist is generated build output. public/ is the runtime source and build.sh recreates dist.

## Production rule
All tests above must pass before the deployable dist directory is assembled.
