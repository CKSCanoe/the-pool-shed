-- ============================================================
-- POOL SHED v1.34.0 - ENROL FIRST ADMIN
-- ============================================================
-- 1. Run the fresh full install first.
-- 2. Supabase Dashboard -> Authentication -> Users -> Add user.
-- 3. Change BOTH email placeholders below to that user's email.
-- 4. Run this in SQL Editor as project owner.
-- ============================================================

do $$
declare
  v_email text := 'CHANGE-ME@YOUR-DOMAIN.CO.UK';
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email)=lower(v_email) limit 1;
  if v_user is null then
    raise exception 'No Supabase Auth user exists for %. Create the Auth user first.',v_email;
  end if;

  insert into public.user_profiles(id,full_name,email,role,job_title,permissions,active)
  select
    u.id,
    coalesce(nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),split_part(coalesce(u.email,''),'@',1)),
    coalesce(u.email,''),
    'Admin',
    'Administrator',
    jsonb_build_object(
      'admin',true,'products',true,'customers',true,'suppliers',true,'projects',true,
      'sales_orders',true,'purchase_orders',true,'stock',true,'goods_in',true,
      'goods_out',true,'reports',true,'settings',true,'users',true,'quotes',true
    ),
    true
  from auth.users u where u.id=v_user
  on conflict(id) do update set
    full_name=excluded.full_name,email=excluded.email,role='Admin',job_title='Administrator',
    permissions=excluded.permissions,active=true,updated_at=now();

  insert into public.ps_workspace_members(workspace_id,user_id,role)
  values('pool-bros-main',v_user,'admin')
  on conflict(workspace_id,user_id) do update set role='admin';

  insert into public.ps_finance_members(workspace_id,user_id,role)
  values('pool-bros-main',v_user,'admin')
  on conflict(workspace_id,user_id) do update set role='admin';

  insert into public.workspace_snapshots(workspace_id,data,updated_by,updated_at)
  values(
    'pool-bros-main',
    jsonb_build_object(
      'stock','[]'::jsonb,
      'receiptEvents','[]'::jsonb,
      'putawayTransfers','[]'::jsonb
    ),
    v_user,
    clock_timestamp()
  )
  on conflict(workspace_id) do nothing;

  raise notice 'Pool Shed first admin enrolled: %',v_email;
end $$;

select
  p.id,p.full_name,p.email,p.role as business_role,p.active,
  wm.role as workspace_role,fm.role as finance_role
from public.user_profiles p
left join public.ps_workspace_members wm on wm.user_id=p.id and wm.workspace_id='pool-bros-main'
left join public.ps_finance_members fm on fm.user_id=p.id and fm.workspace_id='pool-bros-main'
where lower(p.email)=lower('CHANGE-ME@YOUR-DOMAIN.CO.UK');
