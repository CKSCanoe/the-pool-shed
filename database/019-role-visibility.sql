-- Pool Shed 019 - Phase 3.4: role-based visibility (owner decisions 20 Nov 2026, docs/PHASE-3-PLAN.md)
--   Costs and margins:   Admin, Management, Accounts, Sales, Purchasing, Office    (hidden: Warehouse, Engineer)
--   Payments, finance:   Admin, Management, Accounts
--   Security settings:   Admin, Management
--   Engineer: only assigned jobs (owner, or listed in job.assignedUserIds) and the orders linked to them;
--             no prices anywhere; no quotes.
-- Enforced in the database: a restricted user's load, change feed and saves only ever see the permitted view,
-- and the server restores every hidden field from the stored record on save, so a restricted save can never
-- erase a cost, payment or hidden record.
-- Redaction works by field NAME at every nesting level (costs also sit inside audit values, returns, corrections).
-- Admin and Management are unrestricted and take exactly the same paths as before.
-- Requires 015-018. Rollback: database/019-rollback.sql.
begin;

-- 0. Found 20 Nov 2026: the app (identity-authority.js) assigns the roles Admin, Management, Accounts, Sales,
--    Purchasing, Warehouse, Engineer and Office, but the database only accepted Admin, Manager, Office,
--    Warehouse, Engineer and Viewer, so saving a user as Accounts, Sales, Purchasing or Management failed.
--    Accept the app's roles; keep the two older names (Manager = Management, Viewer = Office) for compatibility.
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles add constraint user_profiles_role_check
  check (role in ('Admin','Management','Accounts','Sales','Purchasing','Warehouse','Engineer','Office','Manager','Viewer'));

-- 1. Who is asking, and what they may see.
create or replace function public.ps_user_access()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare p record; costs boolean; finance boolean; security boolean; engineer boolean; pat text[] := '{}'; hidden text[] := '{}';
begin
  select id, role, full_name, active into p from user_profiles where id = auth.uid();
  if p.id is null or not coalesce(p.active, false) then raise exception 'Workspace read access denied'; end if;
  if p.role in ('Admin','Management','Manager') then
    return jsonb_build_object('role', p.role, 'restricted', false);
  end if;
  costs    := p.role in ('Accounts','Sales','Purchasing','Office','Viewer');
  finance  := p.role in ('Accounts');
  security := false;
  engineer := p.role = 'Engineer';
  if not costs then
    pat := pat || array['cost','costs','[a-z]*cost','[a-z]*costs','[a-z]*costnet','[a-z]*costgross','[a-z]*margin','margin[a-z]*',
                        '[a-z]*profit','profit[a-z]*','originalcostbudget','riskbuffernet','remainingnet','markup[a-z]*',
                        'rate','ratetype','forecast[a-z]*','headroom'];
    -- notificationCommand stores read markers under ids built from notification text (e.g. "...from-cost-margin")
    hidden := hidden || array['quotes','quoteSettings','quoteTemplates','notificationCommand'];
  end if;
  if not finance then
    pat := pat || array['payment','payments','paymentcorrections','paymentruns','unallocatedpayments','customercredits',
                        'suppliercredits','xero[a-z]*','invoice[a-z]*','credit[a-z]*','expectedcredit','deposit[a-z]*',
                        'amountpaid','amountdue','paid','paidat'];
    hidden := hidden || array['financeCommand'];
  end if;
  if not (costs and finance) then
    hidden := hidden || array['auditLog','auditEvents','actionAuthority'];
  end if;
  if not security then hidden := hidden || array['securityControl']; end if;
  if engineer then
    pat := pat || array['price','prices','unitprice','specialprice','pricenote','pricelist','pricemode','priceoverridereason',
                        'sellnet','quotenet','quoteref','shippingcharge','customerdiscountrate','discount','rrp','trade',
                        'wholesale','calculatedcharge','cataloguefullprice','minimumcharge','[a-z]*net','[a-z]*gross',
                        '[a-z]*vat','total[a-z]*','amount','chargetype'];
    hidden := hidden || array['analyticsCommand','salesCredits'];
  end if;
  return jsonb_build_object(
    'role', p.role, 'restricted', true, 'uid', p.id, 'name', coalesce(p.full_name,''),
    'engineer', engineer, 'costs', costs, 'finance', finance,
    'keys', case when cardinality(pat) > 0 then '^(' || array_to_string(pat, '|') || ')$' else null end,
    'hidden_sections', to_jsonb(hidden),
    -- whole records hidden when their text mentions these (notifications)
    'text_hide', case when engineer then '(margin|cost price|unit cost|profit|£ ?[0-9])'
                      when not costs then '(margin|cost price|unit cost|profit)' else null end);
end $$;
revoke all on function public.ps_user_access() from public, anon;
grant execute on function public.ps_user_access() to authenticated;

-- 2. Remove hidden field names at every level. Fast path: a value whose JSON text contains no hidden field name
--    ("name": ...) is returned untouched; hidden top-level fields are removed in one step; only nested values that
--    contain a hidden name are rebuilt.
create or replace function public.ps_redact_value(v jsonb, pat text)
returns jsonb language plpgsql immutable as $$
declare txt_pat text; drop_keys text[]; k text; x jsonb; out jsonb;
begin
  if pat is null or v is null or jsonb_typeof(v) not in ('object','array') then return v; end if;
  -- pat is '^(names)' plus a closing anchor; the JSON text form of a field name is "name": value
  txt_pat := '"' || substr(pat, 2, length(pat) - 2) || '": ';
  if v::text !~* txt_pat then return v; end if;
  if jsonb_typeof(v) = 'object' then
    select array_agg(key) into drop_keys from jsonb_object_keys(v) key where key ~* pat;
    if drop_keys is not null then v := v - drop_keys; end if;
    for k, x in select * from jsonb_each(v) loop
      if jsonb_typeof(x) in ('object','array') and x::text ~* txt_pat then
        v := jsonb_set(v, array[k], ps_redact_value(x, pat));
      end if;
    end loop;
    return v;
  end if;
  select coalesce(jsonb_agg(case when jsonb_typeof(e) in ('object','array') and e::text ~* txt_pat then ps_redact_value(e, pat) else e end order by i), '[]'::jsonb)
    into out from jsonb_array_elements(v) with ordinality t(e, i);
  return out;
end $$;

-- 3. Put hidden fields back from the stored value (objects by key; array elements by id, else by position).
create or replace function public.ps_unredact_value(incoming jsonb, stored jsonb, pat text)
returns jsonb language plpgsql immutable as $$
declare out jsonb; k text; x jsonb; e jsonb; i integer; match jsonb;
begin
  if pat is null then return incoming; end if;
  if stored is null then return ps_redact_value(incoming, pat); end if;
  if jsonb_typeof(incoming) = 'object' and jsonb_typeof(stored) = 'object' then
    out := '{}'::jsonb;
    for k, x in select * from jsonb_each(stored) loop          -- hidden fields: always the stored value
      if k ~* pat then out := out || jsonb_build_object(k, x); end if;
    end loop;
    for k, x in select * from jsonb_each(incoming) loop        -- visible fields: what the user sent
      if k ~* pat then continue; end if;
      out := out || jsonb_build_object(k, ps_unredact_value(x, stored->k, pat));
    end loop;
    return out;
  elsif jsonb_typeof(incoming) = 'array' and jsonb_typeof(stored) = 'array' then
    out := '[]'::jsonb; i := 0;
    for e in select value from jsonb_array_elements(incoming) loop
      match := null;
      if jsonb_typeof(e) = 'object' and e ? 'id' then
        select s into match from jsonb_array_elements(stored) s where jsonb_typeof(s)='object' and s->'id' = e->'id' limit 1;
      elsif jsonb_typeof(e) in ('object','array') then
        match := stored->i;
      end if;
      out := out || jsonb_build_array(case when jsonb_typeof(e) in ('object','array') then ps_unredact_value(e, match, pat) else e end);
      i := i + 1;
    end loop;
    return out;
  elsif jsonb_typeof(incoming) in ('object','array') then
    return ps_redact_value(incoming, pat);
  end if;
  return incoming;
end $$;

-- 4. Engineer: assigned job ids (job owner by name, or job.assignedUserIds contains the user).
create or replace function public.ps_engineer_job_ids(w text, acc jsonb)
returns text[] language sql stable security definer set search_path=public as $$
  select coalesce(array_agg(r.data->>'id'), '{}')
  from ps_records r
  where r.workspace_id=w and r.section='jobs' and r.deleted_at is null
    and (lower(coalesce(r.data->>'owner','')) = lower(acc->>'name') and acc->>'name' <> ''
         or coalesce(r.data->'assignedUserIds','[]'::jsonb) ? (acc->>'uid'));
$$;

-- 5. One record as this user may see it, or null when the whole record is hidden.
--    top_keys: hidden top-level field names already worked out for the whole section (fast path).
drop function if exists public.ps_redact_item(text, jsonb, jsonb, text[]);  -- earlier 4-argument draft
create or replace function public.ps_redact_item(section text, item jsonb, acc jsonb, job_ids text[], top_keys text[] default null)
returns jsonb language plpgsql immutable as $$
declare pat text := acc->>'keys';
begin
  if not coalesce((acc->>'restricted')::boolean, false) then return item; end if;
  if coalesce((acc->>'engineer')::boolean, false) then
    if section = 'jobs' and not ((item->>'id') = any(job_ids)) then return null; end if;
    if section in ('salesOrders','purchaseOrders')
       and not (coalesce(item->>'jobId','') = any(job_ids) or coalesce(item->>'projectId','') = any(job_ids)) then return null; end if;
  end if;
  if section = 'notifications' and acc->>'text_hide' is not null and item::text ~* (acc->>'text_hide') then return null; end if;
  if pat is null then return item; end if;
  if top_keys is not null and jsonb_typeof(item) = 'object' then
    item := item - top_keys;
    if item::text !~* ('"' || substr(pat, 2, length(pat) - 2) || '": ') then return item; end if;
  end if;
  return ps_redact_value(item, pat);
end $$;

-- Is a whole record visible to this user? (plain SQL so it runs set-based over thousands of records)
create or replace function public.ps_record_visible(section text, item jsonb, acc jsonb, job_ids text[])
returns boolean language sql immutable as $$
  select not coalesce((acc->>'restricted')::boolean, false) or (
    not (coalesce((acc->>'engineer')::boolean, false) and section = 'jobs' and not (coalesce(item->>'id','') = any(job_ids)))
    and not (coalesce((acc->>'engineer')::boolean, false) and section in ('salesOrders','purchaseOrders')
             and not (coalesce(item->>'jobId','') = any(job_ids) or coalesce(item->>'projectId','') = any(job_ids)))
    and not (section = 'notifications' and acc->>'text_hide' is not null and item::text ~* (acc->>'text_hide')));
$$;

-- A whole list section as this user may see it, set-based: hidden records dropped, hidden top-level names removed
-- in one step; the section text is then checked once, and only if a hidden name remains (nested) are records
-- inspected individually.
create or replace function public.ps_redact_section(section text, items jsonb, acc jsonb, job_ids text[])
returns jsonb language plpgsql immutable as $$
declare pat text := acc->>'keys'; txt text; ks text[]; out jsonb;
begin
  if not coalesce((acc->>'restricted')::boolean, false) then return items; end if;
  with vis as (
    select e, i from jsonb_array_elements(items) with ordinality t(e, i) where ps_record_visible(section, e, acc, job_ids)
  ), names as materialized (   -- materialized: the name test must run on the distinct names, not on every field
    select distinct k from vis, jsonb_object_keys(case when jsonb_typeof(vis.e)='object' then vis.e else '{}'::jsonb end) k
  )
  select (select coalesce(array_agg(k), '{}') from names where pat is not null and k ~* pat),
         null into ks, out;
  select coalesce(jsonb_agg(case when jsonb_typeof(e)='object' then e - ks else e end order by i), '[]'::jsonb) into out
    from jsonb_array_elements(items) with ordinality t(e, i) where ps_record_visible(section, e, acc, job_ids);
  if pat is null then return out; end if;
  txt := '"' || substr(pat, 2, length(pat) - 2) || '": ';
  if out::text !~* txt then return out; end if;
  select coalesce(jsonb_agg(case when jsonb_typeof(e) in ('object','array') and e::text ~* txt then ps_redact_value(e, pat) else e end order by i), '[]'::jsonb)
    into out from jsonb_array_elements(out) with ordinality t(e, i);
  return out;
end $$;

create or replace function public.ps_section_hidden(section text, acc jsonb)
returns boolean language sql immutable as $$
  select coalesce((acc->>'restricted')::boolean, false) and coalesce(acc->'hidden_sections','[]'::jsonb) ? section;
$$;

-- 6. Load: the whole workspace, or the permitted view, plus the rules the app needs to work out its own changes.
create or replace function public.ps_workspace_load(w text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare acc jsonb; snap public.workspace_snapshots; out jsonb := '{}'::jsonb; k text; v jsonb; ids text[];
begin
  if not ps_workspace_can_read(w) then raise exception 'Workspace read access denied'; end if;
  acc := ps_user_access();
  select * into snap from workspace_snapshots where workspace_id = w;
  if snap.workspace_id is null then return null; end if;
  if not (acc->>'restricted')::boolean then
    return jsonb_build_object('updated_at', snap.updated_at, 'data', snap.data, 'access', acc);
  end if;
  ids := case when (acc->>'engineer')::boolean then ps_engineer_job_ids(w, acc) else '{}' end;
  for k, v in select * from jsonb_each(snap.data) loop
    if ps_section_hidden(k, acc) then continue; end if;
    if jsonb_typeof(v) = 'array' then
      v := ps_redact_section(k, v, acc, ids);
    else
      v := ps_redact_value(v, acc->>'keys');
    end if;
    out := out || jsonb_build_object(k, v);
  end loop;
  return jsonb_build_object('updated_at', snap.updated_at, 'data', out,
    'access', jsonb_build_object('restricted', true, 'role', acc->>'role', 'keys', acc->'keys', 'hidden_sections', acc->'hidden_sections'));
end $$;
revoke all on function public.ps_workspace_load(text) from public, anon;
grant execute on function public.ps_workspace_load(text) to authenticated;

-- 7. Change feed with the same rules. For restricted users every changed list section carries its visible key list.
create or replace function public.ps_records_changes(w text, since timestamptz)
returns jsonb language plpgsql stable security definer set search_path=public, extensions as $$
declare cur timestamptz; s0 bigint; s1 bigint; n bigint; result jsonb; acc jsonb; restricted boolean; ids text[];
begin
  if not ps_workspace_can_read(w) then raise exception 'Workspace read access denied'; end if;
  if not coalesce((select enabled from ps_feature_flags where name='delta_refresh'), false) then
    return jsonb_build_object('full', true, 'reason', 'disabled');
  end if;
  acc := ps_user_access();
  restricted := coalesce((acc->>'restricted')::boolean, false);
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
  ids := case when restricted and (acc->>'engineer')::boolean then ps_engineer_job_ids(w, acc) else '{}' end;

  select jsonb_build_object('updated_at', cur, 'sections', coalesce(jsonb_agg(x.obj) filter (where x.obj is not null), '[]'::jsonb)) into result
  from (
    select case
      when ps_section_hidden(rs.section, acc) then null
      when rs.kind='settings' then jsonb_build_object('s', rs.section, 'kind', 'settings',
             'data', (select ps_redact_value(st.data, case when restricted then acc->>'keys' end) from ps_settings st where st.workspace_id=w and st.section=rs.section))
      when rs.kind='absent' then jsonb_build_object('s', rs.section, 'kind', 'absent')
      when not restricted then jsonb_build_object('s', rs.section, 'kind', 'list',
             'keys_sha', (select encode(digest(coalesce(string_agg(r.key, E'\n' order by r.ord),''), 'sha256'), 'hex')
                          from ps_records r where r.workspace_id=w and r.section=rs.section and r.deleted_at is null),
             'keys', case when rs.order_seq > s0 then
                       (select coalesce(jsonb_agg(r.key order by r.ord), '[]'::jsonb)
                        from ps_records r where r.workspace_id=w and r.section=rs.section and r.deleted_at is null) end,
             'records', (select coalesce(jsonb_agg(jsonb_build_array(r.key, r.data) order by r.ord), '[]'::jsonb)
                         from ps_records r where r.workspace_id=w and r.section=rs.section and r.deleted_at is null
                           and r.change_seq > s0 and r.change_seq <= s1))
      else (select jsonb_build_object('s', rs.section, 'kind', 'list',
             'keys_sha', encode(digest(coalesce(string_agg(v.key, E'\n' order by v.ord),''), 'sha256'), 'hex'),
             'keys', coalesce(jsonb_agg(v.key order by v.ord), '[]'::jsonb),
             'records', coalesce(jsonb_agg(jsonb_build_array(v.key, v.red) order by v.ord) filter (where v.change_seq > s0 and v.change_seq <= s1), '[]'::jsonb))
            from (select r.key, r.ord, r.change_seq,
                         case when r.change_seq > s0 and r.change_seq <= s1 then ps_redact_item(rs.section, r.data, acc, ids) end red
                  from ps_records r where r.workspace_id=w and r.section=rs.section and r.deleted_at is null
                    and ps_record_visible(rs.section, r.data, acc, ids)) v)
      end as obj
    from ps_record_sections rs
    where rs.workspace_id=w and rs.change_seq > s0 and rs.change_seq <= s1
  ) x;
  return result;
end $$;

-- 8. A restricted user's changes, made safe: hidden sections and records refused; every hidden field restored
--    from the stored record; new records stripped of hidden fields; order applied within the user's visible slots.
create or replace function public.ps_restricted_changes(w text, changes jsonb, acc jsonb)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare part jsonb; sec text; out jsonb := '[]'::jsonb; ups jsonb; u jsonb; stored jsonb; ids text[]; pat text := acc->>'keys';
        server_keys text[]; visible_keys text[]; client_order text[]; merged text[]; k text; j integer;
begin
  ids := case when (acc->>'engineer')::boolean then ps_engineer_job_ids(w, acc) else '{}' end;
  for part in select value from jsonb_array_elements(changes->'sections') loop
    sec := part->>'s';
    if ps_section_hidden(sec, acc) then raise exception 'Not permitted for your role: %', sec; end if;
    if part->>'kind' = 'settings' then
      out := out || jsonb_build_array(jsonb_set(part, '{data}',
        ps_unredact_value(part->'data', (select st.data from ps_settings st where st.workspace_id=w and st.section=sec), pat)));
      continue;
    end if;
    if part->>'kind' <> 'list' then raise exception 'Not permitted for your role: %', sec; end if;

    ups := '[]'::jsonb;
    for u in select value from jsonb_array_elements(coalesce(part->'upserts','[]'::jsonb)) loop
      select r.data into stored from ps_records r where r.workspace_id=w and r.section=sec and r.key=u->>0 and r.deleted_at is null;
      if stored is not null and not ps_record_visible(sec, stored, acc, ids) then
        raise exception 'Not permitted for your role: a hidden record in %', sec;
      end if;
      ups := ups || jsonb_build_array(jsonb_build_array(u->0, ps_unredact_value(u->1, stored, pat)));
      stored := null;
    end loop;
    if exists(select 1 from jsonb_array_elements(coalesce(part->'deletes','[]'::jsonb)) d
              join ps_records r on r.workspace_id=w and r.section=sec and r.key = d #>> '{}' and r.deleted_at is null
              where not ps_record_visible(sec, r.data, acc, ids)) then
      raise exception 'Not permitted for your role: a hidden record in %', sec;
    end if;
    part := jsonb_set(part, '{upserts}', ups);

    -- Order: the user only knows their visible records. Keep every hidden record where it is and place the
    -- user's order into the positions their visible records occupy; new records go at the end.
    if jsonb_typeof(part->'order') = 'array' then
      select coalesce(array_agg(r.key order by r.ord), '{}'),
             coalesce(array_agg(r.key order by r.ord) filter (where ps_record_visible(sec, r.data, acc, ids)), '{}')
        into server_keys, visible_keys
        from ps_records r where r.workspace_id=w and r.section=sec and r.deleted_at is null;
      select coalesce(array_agg(o #>> '{}' order by i), '{}') into client_order
        from jsonb_array_elements(part->'order') with ordinality t(o, i)
        where (o #>> '{}') = any(visible_keys);
      merged := '{}'; j := 1;
      foreach k in array server_keys loop
        if k = any(visible_keys) then
          if j <= cardinality(client_order) then merged := merged || client_order[j]; j := j + 1; end if;
        else merged := merged || k; end if;
      end loop;
      for k in select o #>> '{}' from jsonb_array_elements(part->'order') o
               where not ((o #>> '{}') = any(server_keys)) loop
        merged := merged || k;
      end loop;
      part := jsonb_set(part, '{order}', to_jsonb(merged));
    end if;
    out := out || jsonb_build_array(part);
  end loop;
  return jsonb_build_object('sections', out);
end $$;
revoke all on function public.ps_restricted_changes(text,jsonb,jsonb) from public, anon, authenticated;

-- 9. Saves. Restricted roles save per record only, through the safety step above.
create or replace function public.ps_workspace_save(w text,expected timestamptz,snapshot jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare previous public.workspace_snapshots; stamp timestamptz;
begin
 if not exists(
  select 1 from ps_workspace_members wm join user_profiles p on p.id=wm.user_id
  where wm.workspace_id=w and wm.user_id=auth.uid() and wm.role in ('admin','operator') and p.active=true
 ) then raise exception 'Workspace write access denied'; end if;
 if coalesce((ps_user_access()->>'restricted')::boolean, true) then
   raise exception 'Full saves are not available for your role';
 end if;
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

-- 10. Per-record save (017) with the restricted-role safety step.
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
  -- 019: restricted roles only ever change what they can see; hidden fields are restored from storage.
  if coalesce((ps_user_access()->>'restricted')::boolean, true) then
    changes := ps_restricted_changes(w, changes, ps_user_access());
  end if;
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

commit;
