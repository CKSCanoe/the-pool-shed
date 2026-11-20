-- Pool Shed 021 - Phase 3.5a: the whole workspace, rebuilt from the per-record store.
-- Read-only additions. Nothing writes differently yet; the snapshot stays the source of truth.
-- ps_workspace_document(w)  : the full workspace built from ps_records + ps_settings (service role only).
-- ps_workspace_document_check(w): proves it equals the stored snapshot (and how long the rebuild took).
-- Phase 3.5c (after two clean weeks) can then stop rewriting the 7 MB snapshot on every save.
-- Rollback: drop function public.ps_workspace_document_check(text); drop function public.ps_workspace_document(text);
begin;

create or replace function public.ps_workspace_document(w text)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_object_agg(x.section, x.val), '{}'::jsonb)
  from (
    select rs.section,
           (select coalesce(jsonb_agg(r.data order by r.ord), '[]'::jsonb)
              from ps_records r where r.workspace_id = w and r.section = rs.section and r.deleted_at is null) as val
      from ps_record_sections rs
     where rs.workspace_id = w and rs.kind = 'list'
    union all
    select st.section, st.data
      from ps_settings st join ps_record_sections rs on rs.workspace_id = st.workspace_id and rs.section = st.section
     where st.workspace_id = w and rs.kind = 'settings'
  ) x;
$$;
revoke all on function public.ps_workspace_document(text) from public, anon, authenticated;
grant execute on function public.ps_workspace_document(text) to service_role;

create or replace function public.ps_workspace_document_check(w text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare t0 timestamptz := clock_timestamp(); doc jsonb; snap jsonb; ms numeric; diff text[];
begin
  doc := ps_workspace_document(w);
  ms := round(extract(epoch from clock_timestamp() - t0) * 1000);
  select data into snap from workspace_snapshots where workspace_id = w;
  select coalesce(array_agg(k order by k), '{}') into diff
    from (select key k from jsonb_each(snap) s where (doc -> s.key) is distinct from s.value
          union select key from jsonb_each(doc) d where not (snap ? d.key)) z;
  return jsonb_build_object('identical', doc = snap, 'rebuild_ms', ms, 'sections_differing', to_jsonb(diff),
                            'sections', (select count(*) from jsonb_object_keys(doc)));
end $$;
revoke all on function public.ps_workspace_document_check(text) from public, anon, authenticated;
grant execute on function public.ps_workspace_document_check(text) to service_role;

commit;
