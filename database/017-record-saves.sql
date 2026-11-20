-- Pool Shed 017 - Phase 3.3: per-record saves
-- The app sends only the records it changed (a few KB) instead of the whole 7 MB workspace.
-- The server checks each changed record against what the app last saw: different records never clash;
-- only a record that someone else changed in the meantime is reported as a conflict.
-- The workspace snapshot is still written (rebuilt server-side from the records), so every existing reader,
-- the full-save path and the safety rules keep working unchanged.
-- Kill switch: update ps_feature_flags set enabled=false where name='record_saves';
--   the app then uses the full save it uses today.
-- Requires 015 + 016. Rollback: database/017-rollback.sql.
begin;

insert into public.ps_feature_flags(name,enabled,note)
values ('record_saves', true, 'Phase 3.3: the app sends only changed records. Set false to fall back to full saves.')
on conflict (name) do nothing;

-- Whole-workspace safety copies: at most one per 10 minutes (per-record history covers every change in between).
create or replace function public.ps_workspace_keep_revision(w text, previous public.workspace_snapshots)
returns void language plpgsql security definer set search_path=public as $$
declare last_revision timestamptz; last_kept timestamptz;
begin
  select max(updated_at), max(updated_at) into last_revision, last_kept from ps_workspace_revisions where workspace_id=w;
  if last_kept is null or last_kept < previous.updated_at - interval '10 minutes' then
    insert into ps_workspace_revisions(workspace_id,data,updated_by,updated_at)
    values (w, previous.data, previous.updated_by, previous.updated_at);
    if last_revision is null or date_trunc('day', last_revision) < date_trunc('day', now()) then
      perform ps_workspace_revisions_prune(w, false);
    end if;
  end if;
end $$;
revoke all on function public.ps_workspace_keep_revision(text, public.workspace_snapshots) from public, anon, authenticated;

-- changes: {"sections":[
--   {"s":"customers","kind":"list","upserts":[[key,record],...],"deletes":[key,...],"order":[key,...]|null},
--   {"s":"companySettings","kind":"settings","data":{...}},
--   {"s":"oldSection","kind":"absent"} ]}
-- Returns {updated_at, seq, merged} on success; {conflicts:[...], updated_at} if someone else changed the same
-- record or setting; {fallback:true, reason} when the app should use the full save instead.
create or replace function public.ps_workspace_save_changes(w text, expected timestamptz, changes jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  previous public.workspace_snapshots;
  base_seq bigint; v_seq bigint; stamp timestamptz;
  part jsonb; sec text; kind text; conflicts jsonb := '[]'::jsonb;
  new_data jsonb; rebuilt jsonb; final_order text[]; server_keys text[]; check_keys text[];
  rec jsonb; actor uuid := auth.uid(); order_changed boolean;
begin
  if not exists(
    select 1 from ps_workspace_members wm join user_profiles p on p.id=wm.user_id
    where wm.workspace_id=w and wm.user_id=actor and wm.role in ('admin','operator') and p.active=true
  ) then raise exception 'Workspace write access denied'; end if;
  if not coalesce((select enabled from ps_feature_flags where name='record_saves'), false) then
    return jsonb_build_object('fallback', true, 'reason', 'disabled');
  end if;
  if jsonb_typeof(changes->'sections') is distinct from 'array' then raise exception 'Invalid changes'; end if;
  if exists(select 1 from jsonb_array_elements(changes->'sections') p, jsonb_array_elements(coalesce(p->'upserts','[]'::jsonb)) u
            where jsonb_typeof(u) <> 'array' or jsonb_typeof(u->0) <> 'string' or u->1 is null or jsonb_typeof(u->1)='null') then
    raise exception 'Invalid changes: each changed record needs a key and data';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(w,0));
  select * into previous from workspace_snapshots where workspace_id=w for update;
  if previous.workspace_id is null then return jsonb_build_object('fallback', true, 'reason', 'no snapshot'); end if;
  if not exists(select 1 from pg_trigger where tgname='zz_ps_records_mirror' and tgenabled<>'D') then
    return jsonb_build_object('fallback', true, 'reason', 'mirror off');
  end if;
  select seq into base_seq from ps_snapshot_seq where workspace_id=w and snapshot_updated_at=expected;
  if base_seq is null then return jsonb_build_object('fallback', true, 'reason', 'base revision unknown'); end if;
  if exists(select 1 from ps_record_sync_issues where workspace_id=w and snapshot_updated_at > expected) then
    return jsonb_build_object('fallback', true, 'reason', 'mirror incomplete');
  end if;

  -- 1. Conflicts: a record or setting this save touches was changed by someone else since the app's base.
  for part in select value from jsonb_array_elements(changes->'sections') loop
    sec := part->>'s'; kind := part->>'kind';
    if kind='list' then
      select conflicts || coalesce(jsonb_agg(jsonb_build_object('s',sec,'k',r.key)), '[]'::jsonb) into conflicts
      from ps_records r
      where r.workspace_id=w and r.section=sec and r.change_seq > base_seq
        and r.key in (select u->>0 from jsonb_array_elements(coalesce(part->'upserts','[]'::jsonb)) u
                      union select d #>> '{}' from jsonb_array_elements(coalesce(part->'deletes','[]'::jsonb)) d);
    elsif kind in ('settings','absent') then
      if exists(select 1 from ps_record_sections rs where rs.workspace_id=w and rs.section=sec and rs.change_seq > base_seq) then
        conflicts := conflicts || jsonb_build_array(jsonb_build_object('s',sec,'k','settings'));
      end if;
    else
      raise exception 'Invalid change kind';
    end if;
  end loop;
  if jsonb_array_length(conflicts) > 0 then
    return jsonb_build_object('conflicts', conflicts, 'updated_at', previous.updated_at);
  end if;

  -- 2. Apply the changes to the records, then rebuild only the changed sections of the snapshot.
  v_seq := nextval('ps_record_change_seq');
  new_data := previous.data;
  for part in select value from jsonb_array_elements(changes->'sections') loop
    sec := part->>'s'; kind := part->>'kind';
    if kind='settings' then
      if jsonb_typeof(previous.data->sec)='array' or jsonb_typeof(part->'data')='array' then raise exception 'Section type changed: %', sec; end if;
      insert into ps_record_history(workspace_id,section,key,action,old_data,new_data,changed_by)
      values (w, sec, 'settings', case when previous.data ? sec then 'update' else 'insert' end, previous.data->sec, part->'data', actor);
      insert into ps_settings as st (workspace_id,section,data,hash,updated_by,change_seq)
      values (w, sec, part->'data', md5((part->'data')::text), actor, v_seq)
      on conflict (workspace_id,section) do update
        set data=excluded.data, hash=excluded.hash, version=st.version+1, updated_at=now(), updated_by=excluded.updated_by, change_seq=v_seq;
      insert into ps_record_sections as rs (workspace_id,section,kind,change_seq,order_seq) values (w, sec, 'settings', v_seq, v_seq)
      on conflict (workspace_id,section) do update set kind='settings', change_seq=v_seq;
      new_data := jsonb_set(new_data, array[sec], part->'data', true);
      continue;
    end if;
    if kind='absent' then
      raise exception 'Removing a whole section needs a full save';
    end if;

    -- list
    if previous.data ? sec and jsonb_typeof(previous.data->sec) <> 'array' then raise exception 'Section type changed: %', sec; end if;
    select coalesce(array_agg(r.key order by r.ord), '{}') into server_keys
      from ps_records r where r.workspace_id=w and r.section=sec and r.deleted_at is null;

    -- history first (needs the old values)
    insert into ps_record_history(workspace_id,section,key,action,old_data,new_data,changed_by)
    select w, sec, u->>0,
           case when r.key is null then 'insert' when r.deleted_at is not null then 'restore' else 'update' end,
           r.data, u->1, actor
    from jsonb_array_elements(coalesce(part->'upserts','[]'::jsonb)) u
    left join ps_records r on r.workspace_id=w and r.section=sec and r.key=u->>0
    where r.key is null or r.deleted_at is not null or r.hash <> md5((u->1)::text);
    insert into ps_record_history(workspace_id,section,key,action,old_data,new_data,changed_by)
    select w, sec, r.key, 'delete', r.data, null, actor
    from ps_records r
    where r.workspace_id=w and r.section=sec and r.deleted_at is null
      and r.key in (select d #>> '{}' from jsonb_array_elements(coalesce(part->'deletes','[]'::jsonb)) d);

    insert into ps_records as r (workspace_id,section,key,ord,data,hash,updated_by,change_seq)
    select w, sec, u->>0, 2147483647, u->1, md5((u->1)::text), actor, v_seq
    from jsonb_array_elements(coalesce(part->'upserts','[]'::jsonb)) u
    on conflict (workspace_id,section,key) do update
      set data=excluded.data, hash=excluded.hash, version=r.version+1, updated_at=now(), updated_by=excluded.updated_by,
          change_seq=v_seq, deleted_at=null
      where r.hash<>excluded.hash or r.deleted_at is not null;
    update ps_records r set deleted_at=now(), updated_at=now(), updated_by=actor, version=r.version+1, change_seq=v_seq
    where r.workspace_id=w and r.section=sec and r.deleted_at is null
      and r.key in (select d #>> '{}' from jsonb_array_elements(coalesce(part->'deletes','[]'::jsonb)) d);

    -- Order: the app's order, keeping any records other people added meanwhile (appended, in server order).
    if jsonb_typeof(part->'order')='array' then
      select array_agg(k order by i) into final_order from (
        select o #>> '{}' k, i from jsonb_array_elements(part->'order') with ordinality t(o,i)
        where exists(select 1 from ps_records r where r.workspace_id=w and r.section=sec and r.key=o #>> '{}' and r.deleted_at is null)
        union all
        select r.key, 1000000 + r.ord from ps_records r
        where r.workspace_id=w and r.section=sec and r.deleted_at is null
          and not exists(select 1 from jsonb_array_elements(part->'order') o where o #>> '{}' = r.key)
      ) x;
      update ps_records r set ord=x.i::integer
      from unnest(final_order) with ordinality x(k,i)
      where r.workspace_id=w and r.section=sec and r.key=x.k and r.ord<>x.i;
    else
      -- No order list: existing records keep their places; new records go at the end, in the order sent.
      update ps_records r set ord = x.base + x.n
      from (select u->>0 k, i::integer n,
                   (select coalesce(max(r2.ord),0) from ps_records r2 where r2.workspace_id=w and r2.section=sec and r2.deleted_at is null and r2.ord<2147483647) base
            from jsonb_array_elements(coalesce(part->'upserts','[]'::jsonb)) with ordinality t(u,i)) x
      where r.workspace_id=w and r.section=sec and r.key=x.k and r.ord=2147483647 and r.deleted_at is null;
    end if;

    select coalesce(jsonb_agg(r.data order by r.ord), '[]'::jsonb), coalesce(array_agg(r.key order by r.ord), '{}')
      into rebuilt, final_order
      from ps_records r where r.workspace_id=w and r.section=sec and r.deleted_at is null;
    -- The app's record keys must match the server's own key rules exactly; otherwise use a full save.
    select coalesce(array_agg(i.key order by i.ord), '{}') into check_keys from ps_section_items(sec, rebuilt) i;
    if check_keys is distinct from final_order then raise exception 'Record keys do not match in %', sec; end if;
    order_changed := server_keys is distinct from final_order;
    insert into ps_record_sections as rs (workspace_id,section,kind,change_seq,order_seq)
    values (w, sec, 'list', v_seq, case when order_changed then v_seq else 0 end)
    on conflict (workspace_id,section) do update
      set kind='list', change_seq=v_seq, order_seq=case when order_changed then v_seq else rs.order_seq end;
    new_data := jsonb_set(new_data, array[sec], rebuilt, true);
  end loop;

  -- 3. Same safety rules as every save.
  perform ps_workspace_validate(previous.data, new_data, true);

  -- 4. Write the snapshot. The mirror trigger sees the records are already applied and only records the revision.
  perform ps_workspace_keep_revision(w, previous);
  stamp := greatest(clock_timestamp(), previous.updated_at + interval '1 millisecond');
  perform set_config('ps.records_applied', v_seq::text, true);
  update workspace_snapshots set data=new_data, updated_by=actor, updated_at=stamp where workspace_id=w;
  perform set_config('ps.records_applied', '', true);

  return jsonb_build_object('updated_at', stamp, 'seq', v_seq, 'merged', previous.updated_at is distinct from expected);
end $$;
revoke all on function public.ps_workspace_save_changes(text,timestamptz,jsonb) from public, anon;
grant execute on function public.ps_workspace_save_changes(text,timestamptz,jsonb) to authenticated;

-- Mirror trigger: when the records were applied by ps_workspace_save_changes, only map the revision.
create or replace function public.ps_records_after_snapshot()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_seq bigint; full_resync boolean; applied text := current_setting('ps.records_applied', true);
begin
  begin
    if coalesce(applied,'') <> '' then
      insert into ps_snapshot_seq(workspace_id, snapshot_updated_at, seq) values (new.workspace_id, new.updated_at, applied::bigint)
      on conflict (workspace_id, snapshot_updated_at) do update set seq=excluded.seq, recorded_at=now();
      return null;
    end if;
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

-- The full-save path keeps working for fallbacks and other writers, with the same 10-minute safety copies.
create or replace function public.ps_workspace_save(w text,expected timestamptz,snapshot jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare previous public.workspace_snapshots; stamp timestamptz;
begin
 if not exists(
  select 1 from ps_workspace_members wm join user_profiles p on p.id=wm.user_id
  where wm.workspace_id=w and wm.user_id=auth.uid() and wm.role in ('admin','operator') and p.active=true
 ) then raise exception 'Workspace write access denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended(w,0));
 select * into previous from workspace_snapshots where workspace_id=w for update;
 if previous.workspace_id is not null and previous.updated_at is distinct from expected then return null; end if;
 if previous.workspace_id is null and expected is not null then return null; end if;
 perform ps_workspace_validate(previous.data, snapshot, true);
 stamp=greatest(clock_timestamp(),coalesce(previous.updated_at,'1970-01-01'::timestamptz)+interval '1 millisecond');
 if previous.workspace_id is not null then perform ps_workspace_keep_revision(w, previous); end if;
 insert into workspace_snapshots(workspace_id,data,updated_by,updated_at)
 values(w,snapshot,auth.uid(),stamp)
 on conflict(workspace_id) do update
 set data=excluded.data,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 return jsonb_build_object('updated_at',stamp);
end $$;

commit;
