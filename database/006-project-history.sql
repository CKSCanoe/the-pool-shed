begin;
create or replace function public.ps_project_history_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare old_job jsonb; new_job jsonb; old_item jsonb; new_item jsonb;
begin
 for old_job in select value from jsonb_array_elements(coalesce(old.data->'jobs','[]'::jsonb)) where value ? 'project' loop
  select j into new_job from jsonb_array_elements(coalesce(new.data->'jobs','[]'::jsonb)) j where j->>'id'=old_job->>'id';
  if coalesce((old_job->'project'->>'quoteAccepted')::boolean,false) then
   if new_job is null or new_job->'project'->>'quoteAccepted' is distinct from 'true' or (new_job->'project'->>'quoteNet')::numeric is distinct from (old_job->'project'->>'quoteNet')::numeric then raise exception 'Accepted project quote is immutable; use an approved variation'; end if;
  end if;
  for old_item in select value from jsonb_array_elements(coalesce(old_job->'project'->'variations','[]'::jsonb)) where value->>'status'='Approved' loop
   if not exists(select 1 from jsonb_array_elements(coalesce(new_job->'project'->'variations','[]'::jsonb)) v where v=old_item) then raise exception 'Approved extra history must be retained'; end if;
  end loop;
  for old_item in select value from jsonb_array_elements(coalesce(old_job->'project'->'costs','[]'::jsonb)) loop
   select c into new_item from jsonb_array_elements(coalesce(new_job->'project'->'costs','[]'::jsonb)) c where c->>'id'=old_item->>'id';
   if new_item is null or (new_item-'voidedAt'-'voidReason') is distinct from (old_item-'voidedAt'-'voidReason') or (old_item ? 'voidedAt' and new_item is distinct from old_item) then raise exception 'Cost history must be retained; record a reasoned correction'; end if;
   if new_item ? 'voidedAt' and coalesce(new_item->>'voidReason','')='' then raise exception 'Cost correction reason required'; end if;
  end loop;
  for old_item in select value from jsonb_array_elements(coalesce(old_job->'project'->'phases','[]'::jsonb)) loop
   if exists(select 1 from ps_finance_documents where workspace_id=old.workspace_id and source_id='PROJECT:'||(old_job->>'id')||':'||(old_item->>'id')) then
    select ph into new_item from jsonb_array_elements(coalesce(new_job->'project'->'phases','[]'::jsonb)) ph where ph->>'id'=old_item->>'id';
    if new_item is null or (new_item-'invoiceRequested'-'financeDocumentId') is distinct from (old_item-'invoiceRequested'-'financeDocumentId') then raise exception 'Queued invoice stage must remain unchanged'; end if;
   end if;
  end loop;
 end loop;
 return new;
end $$;
revoke all on function public.ps_project_history_guard() from public,anon,authenticated;
drop trigger if exists ps_project_history on public.workspace_snapshots;
create trigger ps_project_history before update of data on public.workspace_snapshots for each row execute function public.ps_project_history_guard();
commit;
