-- Pool Shed 015 - Phase 3.1: per-record shadow store
-- Additive. The workspace snapshot stays the source of truth; nothing in it is changed.
-- Every save, from every path (staff app, Quote Studio, recovery tools), is mirrored record by record into
-- ps_records (lossless: each record is stored exactly as the app wrote it) and ps_settings, with a per-record
-- history in ps_record_history.
-- Safety: the mirror can never block or fail a staff save. Any problem is logged to ps_record_sync_issues
-- and the save continues. ps_records_verify() proves the mirror equals the snapshot.
-- Rollback: database/015-rollback.sql (drops the trigger and the new tables; the snapshot is untouched).
begin;

create table if not exists public.ps_records (
  workspace_id text not null,
  section text not null,
  key text not null,
  ord integer not null,
  data jsonb not null,
  hash text not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  primary key (workspace_id, section, key)
);
create index if not exists ps_records_live on public.ps_records(workspace_id, section, ord) where deleted_at is null;
create index if not exists ps_records_changed on public.ps_records(workspace_id, updated_at);

create table if not exists public.ps_record_history (
  id bigserial primary key,
  workspace_id text not null,
  section text not null,
  key text not null,
  action text not null check (action in ('insert','update','delete','restore')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index if not exists ps_record_history_record on public.ps_record_history(workspace_id, section, key, changed_at desc);
create index if not exists ps_record_history_time on public.ps_record_history(workspace_id, changed_at desc);

create table if not exists public.ps_settings (
  workspace_id text not null,
  section text not null,
  data jsonb not null,
  hash text not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (workspace_id, section)
);

create table if not exists public.ps_record_sync_issues (
  id bigserial primary key,
  workspace_id text not null,
  snapshot_updated_at timestamptz,
  problem text not null,
  detail text,
  logged_at timestamptz not null default now()
);

-- Service role only for now (Phase 3.4 adds role-based staff access).
alter table public.ps_records enable row level security;
alter table public.ps_record_history enable row level security;
alter table public.ps_settings enable row level security;
alter table public.ps_record_sync_issues enable row level security;
revoke all on public.ps_records, public.ps_record_history, public.ps_settings, public.ps_record_sync_issues from anon, authenticated;

-- The records of one list section, with a stable key and the ord the app keeps them in.
-- Key: the record's id; otherwise a natural key (stock: product|location; named items: name or label;
-- plain strings: the string); otherwise a content hash. Repeats of the same key get '#2', '#3' ... in order.
create or replace function public.ps_section_items(section text, items jsonb)
returns table(key text, ord integer, data jsonb, hash text)
language sql immutable set search_path=public as $$
  with e as (
    select value as data, ordinality::integer as ord,
      coalesce(
        case when jsonb_typeof(value)='object' and value ? 'id' and jsonb_typeof(value->'id') in ('string','number') then 'id:'||(value->>'id') end,
        case when section='stock' and jsonb_typeof(value)='object' then 'stock:'||coalesce(value->>'productId','')||'|'||coalesce(value->>'locationId',value->>'location','') end,
        case when jsonb_typeof(value)='object' and coalesce(value->>'name',value->>'label','')<>'' then 'name:'||coalesce(value->>'name',value->>'label') end,
        case when jsonb_typeof(value)='string' then 'text:'||(value#>>'{}') end,
        'hash:'||md5(value::text)
      ) as base_key
    from jsonb_array_elements(case when jsonb_typeof(items)='array' then items else '[]'::jsonb end) with ordinality
  )
  select case when row_number() over w = 1 then base_key else base_key||'#'||row_number() over w end,
         ord, data, md5(data::text)
  from e window w as (partition by base_key order by ord);
$$;

-- Mirror one section. Writes only records that changed; logs each change to history.
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

-- Mirror a whole snapshot. Each document is unpacked once (jsonb_each), and sections that are
-- unchanged (binary jsonb comparison) are skipped, so an ordinary save only touches the sections that changed.
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

-- Proof: every list record and setting in the snapshot equals the mirror, in the same order, and nothing extra.
create or replace function public.ps_records_verify(w text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare snap jsonb; problems text[] := '{}'; k text; a text; b text; sections integer := 0; records bigint := 0;
begin
  select data into snap from workspace_snapshots where workspace_id=w;
  if snap is null then return jsonb_build_object('ok',false,'problems',array['no snapshot']); end if;
  for k in select jsonb_object_keys(snap) loop
    sections := sections + 1;
    if jsonb_typeof(snap->k)='array' then
      select string_agg(i.key||'='||i.hash, ',' order by i.ord), count(*) into a, records
        from (select * from ps_section_items(k, snap->k)) i;
      select string_agg(r.key||'='||r.hash, ',' order by r.ord) into b
        from ps_records r where r.workspace_id=w and r.section=k and r.deleted_at is null;
      if coalesce(a,'') <> coalesce(b,'') then problems := problems || ('section differs: '||k); end if;
    else
      if not exists(select 1 from ps_settings s where s.workspace_id=w and s.section=k and s.data=snap->k) then
        problems := problems || ('setting differs: '||k);
      end if;
    end if;
  end loop;
  for k in select distinct r.section from ps_records r where r.workspace_id=w and r.deleted_at is null and not (snap ? r.section) loop
    problems := problems || ('extra section in mirror: '||k);
  end loop;
  select count(*) into records from ps_records where workspace_id=w and deleted_at is null;
  return jsonb_build_object('ok', cardinality(problems)=0, 'sections', sections, 'live_records', records, 'problems', problems);
end $$;

-- Trigger: runs after the snapshot is written. It can never block or fail the save.
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

drop trigger if exists zz_ps_records_mirror on public.workspace_snapshots;
create trigger zz_ps_records_mirror
after insert or update of data on public.workspace_snapshots
for each row execute function public.ps_records_after_snapshot();

revoke all on function public.ps_section_items(text,jsonb) from public, anon, authenticated;
revoke all on function public.ps_records_sync_section(text,text,jsonb,uuid,boolean) from public, anon, authenticated;
revoke all on function public.ps_records_sync(text,jsonb,jsonb,uuid,boolean) from public, anon, authenticated;
revoke all on function public.ps_records_verify(text) from public, anon, authenticated;
grant execute on function public.ps_records_verify(text) to service_role;
revoke all on function public.ps_records_after_snapshot() from public, anon, authenticated;

-- Backfill from the current snapshot (no history rows: these are the starting records).
select public.ps_records_sync(workspace_id, null, data, updated_by, false) from public.workspace_snapshots;

commit;
