-- Requires 002-workspace-hardening.sql and enrolled project users.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('project-documents','project-documents',false,10485760,array['application/pdf','image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.ps_project_can_write(w text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from ps_workspace_members where workspace_id=w and user_id=auth.uid() and role in ('admin','operator'));
$$;
revoke all on function public.ps_project_can_write(text) from public,anon;
grant execute on function public.ps_project_can_write(text) to authenticated;
drop policy if exists ps_project_document_read on storage.objects;
drop policy if exists ps_project_document_insert on storage.objects;
create policy ps_project_document_read on storage.objects for select to authenticated using(bucket_id='project-documents' and ps_workspace_can_read((storage.foldername(name))[1]));
create policy ps_project_document_insert on storage.objects for insert to authenticated with check(bucket_id='project-documents' and ps_project_can_write((storage.foldername(name))[1]));
-- No browser UPDATE or DELETE policies: project evidence is append-only.
commit;
