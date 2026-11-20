-- Pool Shed 015 rollback: removes the shadow record store. The workspace snapshot is never touched by 015.
begin;
drop trigger if exists zz_ps_records_mirror on public.workspace_snapshots;
drop function if exists public.ps_records_after_snapshot();
drop function if exists public.ps_records_verify(text);
drop function if exists public.ps_records_sync(text,jsonb,jsonb,uuid,boolean);
drop function if exists public.ps_records_sync_section(text,text,jsonb,uuid,boolean);
drop function if exists public.ps_section_items(text,jsonb);
drop table if exists public.ps_record_sync_issues;
drop table if exists public.ps_record_history;
drop table if exists public.ps_settings;
drop table if exists public.ps_records;
commit;
