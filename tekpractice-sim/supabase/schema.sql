-- TekPractice accounts: schema to run once in the Supabase SQL editor (project in an EU region).
-- Provided, not run by the repository. Safe to run again (idempotent).
--
-- What is stored: ONLY the fields below. No birthdate, no phone, no employer, no address.
-- Who can read it: the owner of the row, nobody else. There is no policy for the `anon` role.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text check (first_name is null or char_length(first_name) between 1 and 40),
  age_range text not null check (age_range in ('-15', '15-17', '18-21', '22-25', '26-30', '31-35', '36-40', '41+')),
  -- One node id of the goal tree, a dotted string such as etudie.bts-mav-son.
  goal text check (goal is null or char_length(goal) between 1 and 80),
  region text check (region is null or char_length(region) between 1 and 80),
  -- Students only: a school id from the schools list, or 'autre:' followed by free text (80 characters at most).
  school text check (school is null or char_length(school) between 1 and 100),
  consent_at timestamptz not null,
  parental_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  -- Under 15 without a parent or guardian confirmation: only the age range and the goal may be stored.
  constraint profiles_under_15_minimum check (
    age_range <> '-15' or parental_confirmation or (first_name is null and region is null and school is null)
  ),
  -- The parent confirmation only exists for the under-15 range.
  constraint profiles_parent_confirmation_only_under_15 check (not parental_confirmation or age_range = '-15')
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- Nothing for visitors who are not signed in; only signed-in users, and only on their own row.
revoke all on table public.profiles from anon;
revoke all on table public.profiles from public;
grant select, insert, update, delete on table public.profiles to authenticated;

drop policy if exists "profiles: owner reads" on public.profiles;
create policy "profiles: owner reads" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles: owner inserts" on public.profiles;
create policy "profiles: owner inserts" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles: owner updates" on public.profiles;
create policy "profiles: owner updates" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "profiles: owner deletes" on public.profiles;
create policy "profiles: owner deletes" on public.profiles
  for delete to authenticated
  using ((select auth.uid()) = id);
