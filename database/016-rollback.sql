-- Pool Shed 016 rollback: removes the change feed and restores the 015 mirror and the original stamp trigger.
-- The workspace snapshot is never changed by 016.
begin;
drop trigger if exists workspace_snapshots_set_updated_at on public.workspace_snapshots;
create trigger workspace_snapshots_set_updated_at before update on public.workspace_snapshots
for each row execute function public.set_updated_at();
drop function if exists public.ps_workspace_snapshot_stamp();
drop function if exists public.ps_records_changes(text,timestamptz);
drop function if exists public.ps_records_sync(text,jsonb,jsonb,uuid,boolean,bigint);
drop function if exists public.ps_records_sync_section(text,text,jsonb,uuid,boolean,bigint);
-- 015 definitions
create or replace function public.ps_records_sync_section(w text, p_section text, items jsonb, actor uuid, write_history boolean)
returns integer language plpgsql security definer set search_path=public as $$
declare changed integer := 0; n integer;
begin
  if to_regclass('pg_temp.ps_sync_new') is null then
    create temp table ps_sync_new(key text primary key, ord integer, data jsonb, hash text) on commit drop;
  else
    truncate ps_sync_new;
  end if;
  insert into ps_sync_new select * from ps_section_items(p_section, items);

  if write_history then
    insert into ps_record_history(workspace_id,section,key,action,old_data,new_data,changed_by)
    select w, p_section, n.key,
           case when r.key is null then 'insert' when r.deleted_at is not null then 'restore' else 'update' end,
           r.data, n.data, actor
    from ps_sync_new n
    left join ps_records r on r.workspace_id=w and r.section=p_section and r.key=n.key
    where r.key is null or r.deleted_at is not null or r.hash<>n.hash;

    insert into ps_record_history(workspace_id,section,key,action,old_data,new_data,changed_by)
    select w, p_section, r.key, 'delete', r.data, null, actor
    from ps_records r
    where r.workspace_id=w and r.section=p_section and r.deleted_at is null
      and not exists(select 1 from ps_sync_new n where n.key=r.key);
  end if;

  insert into ps_records as r (workspace_id,section,key,ord,data,hash,updated_by)
  select w, p_section, n.key, n.ord, n.data, n.hash, actor from ps_sync_new n
  where not exists(select 1 from ps_records r0 where r0.workspace_id=w and r0.section=p_section and r0.key=n.key
                   and r0.hash=n.hash and r0.ord=n.ord and r0.deleted_at is null)
  on conflict (workspace_id,section,key) do update
    set ord=excluded.ord, data=excluded.data, hash=excluded.hash,
        version=case when r.hash<>excluded.hash or r.deleted_at is not null then r.version+1 else r.version end,
        updated_at=case when r.hash<>excluded.hash or r.deleted_at is not null then now() else r.updated_at end,
        updated_by=case when r.hash<>excluded.hash or r.deleted_at is not null then excluded.updated_by else r.updated_by end,
        deleted_at=null
    where r.hash<>excluded.hash or r.ord<>excluded.ord or r.deleted_at is not null;
  get diagnostics n = row_count; changed := changed + n;

  update ps_records r set deleted_at=now(), updated_at=now(), updated_by=actor, version=r.version+1
  where r.workspace_id=w and r.section=p_section and r.deleted_at is null
    and not exists(select 1 from ps_sync_new n where n.key=r.key);
  get diagnostics n = row_count; changed := changed + n;
  return changed;
end $$;

create or replace function public.ps_records_sync(w text, old_data jsonb, new_data jsonb, actor uuid, write_history boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s record; sections_changed integer := 0; records_changed integer := 0;
begin
  for s in
    select coalesce(n.key,o.key) as k, o.value as ov, n.value as nv
    from jsonb_each(coalesce(old_data,'{}'::jsonb)) o
    full join jsonb_each(coalesce(new_data,'{}'::jsonb)) n on n.key=o.key
    where old_data is null or o.key is null or n.key is null or o.value<>n.value
  loop
    sections_changed := sections_changed + 1;
    if jsonb_typeof(s.nv)='array' or (s.nv is null and jsonb_typeof(s.ov)='array') then
      records_changed := records_changed + ps_records_sync_section(w, s.k, coalesce(s.nv,'[]'::jsonb), actor, write_history);
    elsif s.nv is not null then
      if write_history then
        insert into ps_record_history(workspace_id,section,key,action,old_data,new_data,changed_by)
        values (w, s.k, 'settings', case when s.ov is null then 'insert' else 'update' end, s.ov, s.nv, actor);
      end if;
      insert into ps_settings as st (workspace_id,section,data,hash,updated_by)
      values (w, s.k, s.nv, md5(s.nv::text), actor)
      on conflict (workspace_id,section) do update
        set data=excluded.data, hash=excluded.hash, version=st.version+1, updated_at=now(), updated_by=excluded.updated_by
        where st.hash<>excluded.hash;
    else
      if write_history then
        insert into ps_record_history(workspace_id,section,key,action,old_data,new_data,changed_by)
        values (w, s.k, 'settings', 'delete', s.ov, null, actor);
      end if;
      delete from ps_settings where workspace_id=w and section=s.k;
    end if;
  end loop;
  return jsonb_build_object('sections_changed',sections_changed,'records_changed',records_changed);
end $$;

create or replace function public.ps_records_after_snapshot()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  begin
    perform ps_records_sync(new.workspace_id, case when tg_op='UPDATE' then old.data else null end, new.data, new.updated_by, true);
  exception when others then
    insert into ps_record_sync_issues(workspace_id, snapshot_updated_at, problem, detail)
    values (new.workspace_id, new.updated_at, sqlerrm, sqlstate);
  end;
  return null;
end $$;
drop table if exists public.ps_feature_flags;
drop table if exists public.ps_record_sync_state;
drop table if exists public.ps_snapshot_seq;
drop table if exists public.ps_record_sections;
alter table public.ps_settings drop column if exists change_seq;
alter table public.ps_records drop column if exists change_seq;
drop sequence if exists public.ps_record_change_seq;
commit;
