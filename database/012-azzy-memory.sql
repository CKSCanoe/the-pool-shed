-- Pool Shed Azzy durable per-user memory
-- Additive. Does not change canonical operational business data.
begin;

create table if not exists public.ps_azzy_memory (
  workspace_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

alter table public.ps_azzy_memory enable row level security;

revoke all on public.ps_azzy_memory from anon;
grant select,insert,update on public.ps_azzy_memory to authenticated;
grant all on public.ps_azzy_memory to service_role;

drop policy if exists ps_azzy_memory_read_own on public.ps_azzy_memory;
create policy ps_azzy_memory_read_own
on public.ps_azzy_memory for select to authenticated
using (
  user_id=auth.uid()
  and public.ps_workspace_can_read(workspace_id)
);

drop policy if exists ps_azzy_memory_insert_own on public.ps_azzy_memory;
create policy ps_azzy_memory_insert_own
on public.ps_azzy_memory for insert to authenticated
with check (
  user_id=auth.uid()
  and public.ps_workspace_can_read(workspace_id)
);

drop policy if exists ps_azzy_memory_update_own on public.ps_azzy_memory;
create policy ps_azzy_memory_update_own
on public.ps_azzy_memory for update to authenticated
using (
  user_id=auth.uid()
  and public.ps_workspace_can_read(workspace_id)
)
with check (
  user_id=auth.uid()
  and public.ps_workspace_can_read(workspace_id)
);

create index if not exists ps_azzy_memory_updated
  on public.ps_azzy_memory(workspace_id,updated_at desc);

commit;
