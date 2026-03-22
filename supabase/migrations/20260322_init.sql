-- Enable UUID generation
create extension if not exists pgcrypto;

-- User profile + role
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null check (role in ('admin', 'user')) default 'user',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- PRTG connection settings
create table if not exists public.prtg_servers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_url text not null,
  api_token text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Raw logs from PRTG API
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  source text not null default 'prtg',
  severity text not null check (severity in ('info', 'warning', 'critical')) default 'info',
  message text not null,
  payload jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

-- Dashboard alerts that are streamed with realtime
create table if not exists public.alerts (
  id bigint generated always as identity primary key,
  title text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')) default 'info',
  status text not null check (status in ('new', 'ack', 'resolved')) default 'new',
  score_impact int not null default 1,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

-- Updated timestamp helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger trg_prtg_servers_updated_at
before update on public.prtg_servers
for each row execute function public.set_updated_at();

-- Auto create profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'user')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.prtg_servers enable row level security;
alter table public.audit_logs enable row level security;
alter table public.alerts enable row level security;

-- Profiles policies
create policy "profile_select_own_or_admin"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "profile_update_own_or_admin"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  auth.uid() = id
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- PRTG server config is admin-only
create policy "prtg_servers_admin_all"
on public.prtg_servers
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Audit logs visible to all authenticated users
create policy "audit_logs_authenticated_read"
on public.audit_logs
for select
to authenticated
using (true);

-- Insert logs only by admin (or edge function using service role bypass)
create policy "audit_logs_admin_insert"
on public.audit_logs
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Alerts visible to all authenticated users
create policy "alerts_authenticated_read"
on public.alerts
for select
to authenticated
using (true);

create policy "alerts_admin_mutation"
on public.alerts
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Realtime publication
alter publication supabase_realtime add table public.alerts;
