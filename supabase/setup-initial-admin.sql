-- =====================================================================
-- StreamVault — Initial Super Admin setup
-- =====================================================================
-- IMPORTANT: This file does NOT create the login itself.
--
-- A Supabase Auth user must be created through Supabase Auth (which hashes
-- the password and owns the credential), never by inserting into
-- auth.users by hand — hand-written rows produce accounts that cannot log
-- in, cannot reset their password, and can break future Supabase upgrades.
--
-- So the process is two steps: create the account in the Dashboard (or by
-- signing up through the app), then run the SQL below to grant it the
-- admin role.
-- =====================================================================


-- ---------------------------------------------------------------------
-- STEP 1 — create the account (do this first, outside SQL)
-- ---------------------------------------------------------------------
-- Option A (recommended) — Supabase Dashboard:
--   Authentication -> Users -> "Add user" -> "Create new user"
--     Email:         admin@streamvault.local
--     Password:      SV_Admin@2026!Secure
--     Auto Confirm User:  ON   (required, or the account cannot sign in)
--
--   Note: some Supabase projects reject non-routable domains such as
--   ".local" when email confirmation is enabled. If the address is
--   refused, use a real address you control (e.g. you@yourdomain.com) and
--   substitute it everywhere below.
--
-- Option B — sign up through the app at /signup with the same email and
--   password. The handle_new_user trigger creates the profile row
--   automatically.
--
-- Either way the account starts with role = 'user'. Step 2 promotes it.


-- ---------------------------------------------------------------------
-- STEP 2 — promote that account to Super Admin
-- ---------------------------------------------------------------------
-- Run in: Supabase Dashboard -> SQL Editor -> New query.
-- Change the email here if you used a different one in step 1.

do $$
declare
  target_email text := 'admin@streamvault.local';
  target_id    uuid;
begin
  select id into target_id from auth.users where lower(email) = lower(target_email);

  if target_id is null then
    raise exception
      'No auth user exists for %. Complete STEP 1 first.', target_email;
  end if;

  -- The profile row is normally created by the handle_new_user trigger.
  -- Insert defensively in case the account predates that trigger.
  insert into public.profiles (id, email, full_name, role, is_active)
  values (target_id, target_email, 'StreamVault Admin', 'admin', true)
  on conflict (id) do update
    set role = 'admin',
        is_active = true;

  raise notice 'Super Admin ready: % (%).', target_email, target_id;
end
$$;


-- ---------------------------------------------------------------------
-- STEP 3 — verify
-- ---------------------------------------------------------------------
select p.id, p.email, p.role, p.is_active, p.created_at
from public.profiles p
where p.role = 'admin'
order by p.created_at;


-- ---------------------------------------------------------------------
-- STEP 4 — change the password immediately after first login
-- ---------------------------------------------------------------------
-- The password above is a documented bootstrap credential and is public
-- knowledge to anyone who can read this repository. Sign in at /admin and
-- change it right away from /admin/profile, which goes through Supabase
-- Auth (supabase.auth.updateUser).
--
-- This password is NOT present anywhere in the application source; it
-- exists only in this setup file.
-- =====================================================================
