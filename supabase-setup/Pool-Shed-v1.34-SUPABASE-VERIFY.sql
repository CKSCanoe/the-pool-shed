-- ============================================================
-- POOL SHED v1.34.0 - SUPABASE VERIFICATION
-- READ ONLY
-- ============================================================

select table_name
from information_schema.tables
where table_schema='public'
  and table_name in(
    'user_profiles','ps_workspace_members','workspace_snapshots','ps_workspace_revisions',
    'ps_finance_members','ps_finance_connections','ps_finance_oauth','ps_finance_documents',
    'ps_finance_jobs','ps_finance_inbox','ps_finance_audit','ps_project_ai_requests',
    'ps_quote_publications','ps_quote_events','ps_quote_messages','ps_quote_acceptances',
    'ps_quote_media','ps_quote_conversion_jobs','ps_product_media','ps_customer_media'
  )
order by table_name;

select routine_name
from information_schema.routines
where routine_schema='public'
  and routine_name in(
    'ps_profile_is_admin','ps_workspace_can_read','ps_workspace_save','ps_project_can_write',
    'ps_finance_lock','ps_finance_enqueue','ps_finance_webhook','ps_project_ai_claim',
    'ps_project_history_guard','ps_quote_history_guard','ps_quote_workspace_save',
    'ps_quote_accept_atomic','ps_quote_conversion_claim','ps_quote_conversion_finish'
  )
order by routine_name;

select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets
where id in('project-documents','quote-media','product-media','customer-media')
order by id;

select c.relname as table_name,c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in(
    'user_profiles','ps_workspace_members','workspace_snapshots','ps_workspace_revisions',
    'ps_finance_members','ps_finance_connections','ps_finance_oauth','ps_finance_documents',
    'ps_finance_jobs','ps_finance_inbox','ps_finance_audit','ps_project_ai_requests',
    'ps_quote_publications','ps_quote_events','ps_quote_messages','ps_quote_acceptances',
    'ps_quote_media','ps_quote_conversion_jobs','ps_product_media','ps_customer_media'
  )
order by c.relname;

select p.id,p.full_name,p.email,p.role,p.active,wm.role as workspace_role,fm.role as finance_role
from public.user_profiles p
left join public.ps_workspace_members wm on wm.user_id=p.id and wm.workspace_id='pool-bros-main'
left join public.ps_finance_members fm on fm.user_id=p.id and fm.workspace_id='pool-bros-main'
order by p.email;

select workspace_id,updated_by,updated_at from public.workspace_snapshots;

select 'POOL SHED v1.34 SUPABASE VERIFICATION COMPLETE' as result;
