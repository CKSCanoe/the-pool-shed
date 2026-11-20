-- Pool Shed 018 - Phase 3.4 prerequisite: staff cannot change their own role, permissions or active status.
-- Found 20 Nov 2026: the policy "users can update own profile" let any signed-in user update every column of
-- their own user_profiles row, including role (e.g. to 'Admin'), permissions and active. Admin checks across the
-- app, the server functions and Phase 3.4 rely on that role, so this must be closed first.
-- Staff can still edit their own name, phone, job title, avatar and notes. Admins can change anything.
-- Service-role/server code (no signed-in user) is not affected. Data is not changed.
-- Rollback: drop trigger ps_profile_protect_privileges on public.user_profiles;
begin;

create or replace function public.ps_profile_protect_privileges()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  -- Server code using the service role has no signed-in user; it is trusted.
  if auth.uid() is null then return new; end if;
  if public.current_user_is_admin() then return new; end if;
  if new.role is distinct from old.role
     or new.permissions is distinct from old.permissions
     or new.active is distinct from old.active
     or new.id is distinct from old.id
     or new.email is distinct from old.email then
    raise exception 'Only an administrator can change role, permissions, active status or sign-in email';
  end if;
  return new;
end $$;
revoke all on function public.ps_profile_protect_privileges() from public, anon, authenticated;

drop trigger if exists ps_profile_protect_privileges on public.user_profiles;
create trigger ps_profile_protect_privileges
before update on public.user_profiles
for each row execute function public.ps_profile_protect_privileges();

commit;
