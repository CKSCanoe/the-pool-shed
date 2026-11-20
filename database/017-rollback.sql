-- Pool Shed 017 rollback: per-record saves off; full saves as in 014/016. Workspace data is not changed.
begin;
drop function if exists public.ps_workspace_save_changes(text,timestamptz,jsonb);
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

create or replace function public.ps_workspace_save(w text,expected timestamptz,snapshot jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 previous public.workspace_snapshots;
 stamp timestamptz;
 last_revision timestamptz;
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
 if previous.workspace_id is not null then
  select max(updated_at) into last_revision from ps_workspace_revisions where workspace_id=w;
  insert into ps_workspace_revisions(workspace_id,data,updated_by,updated_at)
  values(w,previous.data,previous.updated_by,previous.updated_at);
  -- First save of a new day tidies old copies (small and quick after the first run).
  if last_revision is null or date_trunc('day',last_revision)<date_trunc('day',now()) then
   perform ps_workspace_revisions_prune(w,false);
  end if;
 end if;

 insert into workspace_snapshots(workspace_id,data,updated_by,updated_at)
 values(w,snapshot,auth.uid(),stamp)
 on conflict(workspace_id) do update
 set data=excluded.data,updated_by=excluded.updated_by,updated_at=excluded.updated_at;

 return jsonb_build_object('updated_at',stamp);
end $$;
drop function if exists public.ps_workspace_keep_revision(text, public.workspace_snapshots);
delete from public.ps_feature_flags where name='record_saves';
commit;
