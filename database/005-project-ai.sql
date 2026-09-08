begin;
create table if not exists public.ps_project_ai_requests(workspace_id text not null,user_id uuid not null,requested_at timestamptz not null,primary key(workspace_id,user_id));
alter table public.ps_project_ai_requests enable row level security;
revoke all on public.ps_project_ai_requests from anon,authenticated;
grant all on public.ps_project_ai_requests to service_role;
create or replace function public.ps_project_ai_claim(w text,u uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
 insert into ps_project_ai_requests values(w,u,now()) on conflict(workspace_id,user_id) do update set requested_at=excluded.requested_at where ps_project_ai_requests.requested_at<now()-interval '1 minute';
 return found;
end $$;
revoke all on function public.ps_project_ai_claim(text,uuid) from public,anon,authenticated;
grant execute on function public.ps_project_ai_claim(text,uuid) to service_role;
commit;
