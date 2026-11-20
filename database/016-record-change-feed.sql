-- Pool Shed 016 - Phase 3.2: change feed for delta refresh
-- Lets an open tab ask "what changed since revision X?" and receive only the changed records,
-- instead of downloading the whole 7 MB workspace.
-- Additive. The workspace snapshot is unchanged and is still the source of truth.
-- Kill switch: update ps_feature_flags set enabled=false where name='delta_refresh';
--   every tab then falls back to the full download it uses today, with no deploy.
-- Rollback: database/016-rollback.sql (restores the 015 mirror functions; drops the feed).
begin;

create sequence if not exists public.ps_record_change_seq;

alter table public.ps_records  add column if not exists change_seq bigint not null default 0;
alter table public.ps_settings add column if not exists change_seq bigint not null default 0;
create index if not exists ps_records_change_seq on public.ps_records(workspace_id, change_seq);

-- One row per top-level section: when its content last changed, and when its membership or order last changed.
create table if not exists public.ps_record_sections (
  workspace_id text not null,
  section text not null,
  kind text not null check (kind in ('list','settings','absent')),
  change_seq bigint not null default 0,
  order_seq bigint not null default 0,
  primary key (workspace_id, section)
);

-- Which change number each saved revision corresponds to.
create table if not exists public.ps_snapshot_seq (
  workspace_id text not null,
  snapshot_updated_at timestamptz not null,
  seq bigint not null,
  recorded_at timestamptz not null default now(),
  primary key (workspace_id, snapshot_updated_at)
);

-- Set when the mirror misses a save; the next save then re-mirrors everything (only real differences are written).
create table if not exists public.ps_record_sync_state (
  workspace_id text primary key,
  needs_full boolean not null default false
);

create table if not exists public.ps_feature_flags (
  name text primary key,
  enabled boolean not null default false,
  note text,
  updated_at timestamptz not null default now()
);
insert into public.ps_feature_flags(name,enabled,note)
values ('delta_refresh', true, 'Phase 3.2: tabs fetch only changed records. Set false to fall back to full downloads.')
on conflict (name) do nothing;

alter table public.ps_record_sections enable row level security;
alter table public.ps_snapshot_seq enable row level security;
alter table public.ps_record_sync_state enable row level security;
alter table public.ps_feature_flags enable row level security;
revoke all on public.ps_record_sections, public.ps_snapshot_seq, public.ps_record_sync_state, public.ps_feature_flags from anon, authenticated;

-- Mirror one list section (015 logic) and stamp every changed record with this save's change number.
-- Returns whether the section's membership or order changed.
drop function if exists public.ps_records_sync_section(text,text,jsonb,uuid,boolean);
create or replace function public.ps_records_sync_section(w text, p_section text, items jsonb, actor uuid, write_history boolean, p_seq bigint)
returns boolean language plpgsql security definer set search_path=public as $$
declare order_changed boolean;
begin
  if to_regclass('pg_temp.ps_sync_new') is null then
    create temp table ps_sync_new(key text primary key, ord integer, data jsonb, hash text) on commit drop;
  else
    truncate ps_sync_new;
  end if;
  insert into ps_sync_new select * from ps_section_items(p_section, items);

  select exists(select 1 from ps_sync_new n left join ps_records r on r.workspace_id=w and r.section=p_section and r.key=n.key
                where r.key is null or r.deleted_at is not null or r.ord<>n.ord)
      or exists(select 1 from ps_records r where r.workspace_id=w and r.section=p_section and r.deleted_at is null
                and not exists(select 1 from ps_sync_new n where n.key=r.key))
    into order_changed;

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

  insert into ps_records as r (workspace_id,section,key,ord,data,hash,updated_by,change_seq)
  select w, p_section, n.key, n.ord, n.data, n.hash, actor, p_seq from ps_sync_new n
  where not exists(select 1 from ps_records r0 where r0.workspace_id=w and r0.section=p_section and r0.key=n.key
                   and r0.hash=n.hash and r0.ord=n.ord and r0.deleted_at is null)
  on conflict (workspace_id,section,key) do update
    set ord=excluded.ord, data=excluded.data, hash=excluded.hash,
        version=case when r.hash<>excluded.hash or r.deleted_at is not null then r.version+1 else r.version end,
        updated_at=case when r.hash<>excluded.hash or r.deleted_at is not null then now() else r.updated_at end,
        updated_by=case when r.hash<>excluded.hash or r.deleted_at is not null then excluded.updated_by else r.updated_by end,
        change_seq=case when r.hash<>excluded.hash or r.deleted_at is not null then excluded.change_seq else r.change_seq end,
        deleted_at=null
    where r.hash<>excluded.hash or r.ord<>excluded.ord or r.deleted_at is not null;

  update ps_records r set deleted_at=now(), updated_at=now(), updated_by=actor, version=r.version+1, change_seq=p_seq
  where r.workspace_id=w and r.section=p_section and r.deleted_at is null
    and not exists(select 1 from ps_sync_new n where n.key=r.key);

  return order_changed;
end $$;

drop function if exists public.ps_records_sync(text,jsonb,jsonb,uuid,boolean);
create or replace function public.ps_records_sync(w text, old_data jsonb, new_data jsonb, actor uuid, write_history boolean, p_seq bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s record; sections_changed integer := 0; reordered boolean;
begin
  for s in
    select coalesce(n.key,o.key) as k, o.value as ov, n.value as nv
    from jsonb_each(coalesce(old_data,'{}'::jsonb)) o
    full join jsonb_each(coalesce(new_data,'{}'::jsonb)) n on n.key=o.key
    where old_data is null or o.key is null or n.key is null or o.value<>n.value
  loop
    sections_changed := sections_changed + 1;
    if jsonb_typeof(s.nv)='array' or (s.nv is null and jsonb_typeof(s.ov)='array') then
      reordered := ps_records_sync_section(w, s.k, coalesce(s.nv,'[]'::jsonb), actor, write_history, p_seq);
      insert into ps_record_sections as rs (workspace_id,section,kind,change_seq,order_seq)
      values (w, s.k, case when s.nv is null then 'absent' else 'list' end, p_seq, case when reordered or s.nv is null then p_seq else 0 end)
      on conflict (workspace_id,section) do update
        set kind=excluded.kind, change_seq=p_seq,
            order_seq=case when reordered or s.nv is null or rs.kind<>excluded.kind then p_seq else rs.order_seq end;
    elsif s.nv is not null then
      if write_history and (s.ov is null or s.ov<>s.nv) then
        insert into ps_record_history(workspace_id,section,key,action,old_data,new_data,changed_by)
        values (w, s.k, 'settings', case when s.ov is null then 'insert' else 'update' end, s.ov, s.nv, actor);
      end if;
      insert into ps_settings as st (workspace_id,section,data,hash,updated_by,change_seq)
      values (w, s.k, s.nv, md5(s.nv::text), actor, p_seq)
      on conflict (workspace_id,section) do update
        set data=excluded.data, hash=excluded.hash, version=st.version+1, updated_at=now(), updated_by=excluded.updated_by, change_seq=p_seq
        where st.hash<>excluded.hash;
      insert into ps_record_sections as rs (workspace_id,section,kind,change_seq,order_seq)
      values (w, s.k, 'settings', p_seq, p_seq)
      on conflict (workspace_id,section) do update
        set kind='settings', change_seq=case when rs.kind<>'settings' or exists(select 1 from ps_settings st where st.workspace_id=w and st.section=s.k and st.change_seq=p_seq) then p_seq else rs.change_seq end,
            order_seq=case when rs.kind<>'settings' then p_seq else rs.order_seq end;
    else
      if write_history then
        insert into ps_record_history(workspace_id,section,key,action,old_data,new_data,changed_by)
        values (w, s.k, 'settings', 'delete', s.ov, null, actor);
      end if;
      delete from ps_settings where workspace_id=w and section=s.k;
      insert into ps_record_sections as rs (workspace_id,section,kind,change_seq,order_seq)
      values (w, s.k, 'absent', p_seq, p_seq)
      on conflict (workspace_id,section) do update set kind='absent', change_seq=p_seq, order_seq=p_seq;
    end if;
  end loop;
  return jsonb_build_object('sections_changed',sections_changed,'seq',p_seq);
end $$;

-- Trigger: mirror the save, then record which change number this revision corresponds to.
-- Never blocks or fails a save. A missed save makes the next one re-mirror everything.
create or replace function public.ps_records_after_snapshot()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_seq bigint; full_resync boolean;
begin
  begin
    v_seq := nextval('ps_record_change_seq');
    select needs_full into full_resync from ps_record_sync_state where workspace_id=new.workspace_id;
    perform ps_records_sync(new.workspace_id,
      case when tg_op='UPDATE' and not coalesce(full_resync,false) then old.data else null end,
      new.data, new.updated_by, true, v_seq);
    insert into ps_snapshot_seq(workspace_id, snapshot_updated_at, seq) values (new.workspace_id, new.updated_at, v_seq)
    on conflict (workspace_id, snapshot_updated_at) do update set seq=excluded.seq, recorded_at=now();
    if coalesce(full_resync,false) then
      update ps_record_sync_state set needs_full=false where workspace_id=new.workspace_id;
    end if;
    delete from ps_snapshot_seq where workspace_id=new.workspace_id and recorded_at < now()-interval '30 days';
  exception when others then
    insert into ps_record_sync_issues(workspace_id, snapshot_updated_at, problem, detail)
    values (new.workspace_id, new.updated_at, sqlerrm, sqlstate);
    insert into ps_record_sync_state(workspace_id, needs_full) values (new.workspace_id, true)
    on conflict (workspace_id) do update set needs_full=true;
  end;
  return null;
end $$;

-- The change feed. Staff with read access to the workspace receive exactly what they can already read today.
-- Returns {unchanged} / {full:true, reason} / {updated_at, sections:[...]}.
-- Each list section carries keys_sha (SHA-256 of its ordered record keys) so the app can prove its rebuild.
create or replace function public.ps_records_changes(w text, since timestamptz)
returns jsonb language plpgsql stable security definer set search_path=public, extensions as $$
declare cur timestamptz; s0 bigint; s1 bigint; n bigint; result jsonb;
begin
  if not ps_workspace_can_read(w) then raise exception 'Workspace read access denied'; end if;
  if not coalesce((select enabled from ps_feature_flags where name='delta_refresh'), false) then
    return jsonb_build_object('full', true, 'reason', 'disabled');
  end if;
  select updated_at into cur from workspace_snapshots where workspace_id=w;
  if cur is null then return jsonb_build_object('full', true, 'reason', 'no snapshot'); end if;
  if since is not null and cur = since then return jsonb_build_object('unchanged', true, 'updated_at', cur); end if;
  select seq into s0 from ps_snapshot_seq where workspace_id=w and snapshot_updated_at=since;
  select seq into s1 from ps_snapshot_seq where workspace_id=w and snapshot_updated_at=cur;
  if s0 is null or s1 is null then return jsonb_build_object('full', true, 'reason', 'revision not in feed'); end if;
  if exists(select 1 from ps_record_sync_issues where workspace_id=w and snapshot_updated_at > since) then
    return jsonb_build_object('full', true, 'reason', 'mirror incomplete');
  end if;
  select count(*) into n from ps_records where workspace_id=w and change_seq > s0 and change_seq <= s1;
  if n > 2000 then return jsonb_build_object('full', true, 'reason', 'too many changes'); end if;

  select jsonb_build_object('updated_at', cur, 'sections', coalesce(jsonb_agg(x.obj), '[]'::jsonb)) into result
  from (
    select case
      when rs.kind='settings' then jsonb_build_object('s', rs.section, 'kind', 'settings',
             'data', (select st.data from ps_settings st where st.workspace_id=w and st.section=rs.section))
      when rs.kind='absent' then jsonb_build_object('s', rs.section, 'kind', 'absent')
      else jsonb_build_object('s', rs.section, 'kind', 'list',
             'keys_sha', (select encode(digest(coalesce(string_agg(r.key, E'\n' order by r.ord),''), 'sha256'), 'hex')
                          from ps_records r where r.workspace_id=w and r.section=rs.section and r.deleted_at is null),
             'keys', case when rs.order_seq > s0 then
                       (select coalesce(jsonb_agg(r.key order by r.ord), '[]'::jsonb)
                        from ps_records r where r.workspace_id=w and r.section=rs.section and r.deleted_at is null) end,
             'records', (select coalesce(jsonb_agg(jsonb_build_array(r.key, r.data) order by r.ord), '[]'::jsonb)
                         from ps_records r where r.workspace_id=w and r.section=rs.section and r.deleted_at is null
                           and r.change_seq > s0 and r.change_seq <= s1))
      end as obj
    from ps_record_sections rs
    where rs.workspace_id=w and rs.change_seq > s0 and rs.change_seq <= s1
  ) x;
  return result;
end $$;
revoke all on function public.ps_records_changes(text,timestamptz) from public, anon;
grant execute on function public.ps_records_changes(text,timestamptz) to authenticated;

revoke all on function public.ps_records_sync_section(text,text,jsonb,uuid,boolean,bigint) from public, anon, authenticated;
revoke all on function public.ps_records_sync(text,jsonb,jsonb,uuid,boolean,bigint) from public, anon, authenticated;

-- Fix (found 20 Nov 2026): the generic set_updated_at trigger replaced the revision stamp that
-- ps_workspace_save returns to the app with the transaction start time. The app then held a stamp the
-- database did not, so a user's next save within seconds was rejected as a conflict ("Another user saved
-- first"), followed by a full download and merge. Keep an explicitly set newer stamp; otherwise use now().
create or replace function public.ps_workspace_snapshot_stamp()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.updated_at is not null and new.updated_at is distinct from old.updated_at and new.updated_at > old.updated_at then
    return new;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists workspace_snapshots_set_updated_at on public.workspace_snapshots;
create trigger workspace_snapshots_set_updated_at
before update on public.workspace_snapshots
for each row execute function public.ps_workspace_snapshot_stamp();

-- Starting point: every current section and the current revision map to change number 0.
insert into public.ps_record_sections(workspace_id, section, kind, change_seq, order_seq)
select s.workspace_id, k.key, case when jsonb_typeof(k.value)='array' then 'list' else 'settings' end, 0, 0
from public.workspace_snapshots s, jsonb_each(s.data) k
on conflict (workspace_id, section) do nothing;
insert into public.ps_snapshot_seq(workspace_id, snapshot_updated_at, seq)
select workspace_id, updated_at, 0 from public.workspace_snapshots
on conflict do nothing;

commit;
