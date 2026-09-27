-- Pool Shed Azzy durable per-user memory
-- Additive. Does not change canonical operational business data.
--
-- SECURITY MODEL
-- Azzy memory is server-only. The browser never reads or writes this table directly.
-- Pool Shed authenticates the user and derives workspace permissions first, then the
-- server accesses this table with SUPABASE_SERVICE_ROLE_KEY. This deliberately avoids
-- depending on optional browser/RLS helper functions from earlier workspace migrations.

begin;

create table if not exists public.ps_azzy_memory (
  workspace_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

alter table public.ps_azzy_memory enable row level security;

-- Remove any policies from an earlier draft of this migration.
drop policy if exists ps_azzy_memory_read_own on public.ps_azzy_memory;
drop policy if exists ps_azzy_memory_insert_own on public.ps_azzy_memory;
drop policy if exists ps_azzy_memory_update_own on public.ps_azzy_memory;

-- Memory is never a browser data surface.
revoke all on public.ps_azzy_memory from public, anon, authenticated;
grant all on public.ps_azzy_memory to service_role;

create index if not exists ps_azzy_memory_updated
  on public.ps_azzy_memory(workspace_id,updated_at desc);

comment on table public.ps_azzy_memory is
  'Server-only per-user Azzy conversation and working memory. Pool Shed auth/permissions remain authoritative.';

commit;
