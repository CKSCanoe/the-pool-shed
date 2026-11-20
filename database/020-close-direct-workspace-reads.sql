-- Pool Shed 020 - Phase 3.4 final step: staff can no longer read the raw workspace directly.
-- APPLY ONLY AFTER every open tab runs v1.50.0 or later (which loads through ps_workspace_load). Older tabs use the
-- direct read and would stop loading until refreshed.
-- Staff keep direct access to the revision stamp only (the 8-second "anything changed?" check).
-- Server code using the service role is not affected. Data is not changed.
-- Rollback: grant select on public.workspace_snapshots to authenticated;
begin;
revoke select on public.workspace_snapshots from authenticated;
grant select (workspace_id, updated_at) on public.workspace_snapshots to authenticated;
commit;
