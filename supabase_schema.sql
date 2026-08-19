-- =========================================================================
-- StreamLoop 24x7 Complete Supabase Database Schema & Row Level Security Setup
-- =========================================================================

-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid not null references auth.users on delete cascade primary key,
  user_id text unique,
  full_name text,
  email text unique,
  avatar_url text,
  role text default 'USER',
  status text default 'ACTIVE',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Stream Settings Table
create table if not exists public.stream_settings (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  stream_url text,
  stream_key text,
  stream_status text default 'STOPPED',
  auto_start boolean default false,
  auto_restart boolean default true,
  bitrate text default '4000k',
  fps text default '30',
  quality text default 'source',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Videos Table
create table if not exists public.videos (
  id text primary key,
  user_id text not null,
  original_name text not null,
  stored_name text not null,
  path text not null,
  size bigint default 0,
  duration numeric default 0,
  resolution text,
  fps numeric,
  codec text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Playlists Table
create table if not exists public.playlists (
  id text primary key,
  user_id text not null,
  name text not null,
  video_ids jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Sessions Table (Stream History)
create table if not exists public.sessions (
  id text primary key,
  user_id text not null,
  video_id text,
  status text,
  start_time text,
  end_time text,
  duration_seconds integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================================================

alter table public.profiles enable row level security;
alter table public.stream_settings enable row level security;
alter table public.videos enable row level security;
alter table public.playlists enable row level security;
alter table public.sessions enable row level security;

-- Profiles Policies
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Stream Settings Policies
drop policy if exists "Users can view own stream settings" on public.stream_settings;
create policy "Users can view own stream settings" on public.stream_settings for select using (auth.uid()::text = user_id or user_id = 'public');

drop policy if exists "Users can upsert own stream settings" on public.stream_settings;
create policy "Users can upsert own stream settings" on public.stream_settings for all using (auth.uid()::text = user_id);

-- Videos Policies
drop policy if exists "Users can manage own videos" on public.videos;
create policy "Users can manage own videos" on public.videos for all using (auth.uid()::text = user_id);

-- Playlists Policies
drop policy if exists "Users can manage own playlists" on public.playlists;
create policy "Users can manage own playlists" on public.playlists for all using (auth.uid()::text = user_id);

-- Sessions Policies
drop policy if exists "Users can manage own sessions" on public.sessions;
create policy "Users can manage own sessions" on public.sessions for all using (auth.uid()::text = user_id);

-- =========================================================================
-- AUTOMATIC PROFILE TRIGGER
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, user_id, full_name, email, avatar_url, role)
  values (
    new.id,
    new.id::text,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    case when new.email = 'titangaming4m@gmail.com' then 'ADMIN' else 'USER' end
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
